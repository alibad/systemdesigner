'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  CircleAlert,
  Gauge,
  HeartPulse,
  Layers3,
  Link,
  Network,
  Repeat2,
  Server,
  ShieldCheck,
  TimerReset,
  Waypoints,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  kind: 'uniform' | 'variable' | 'affinity';
  affinitySharePct: number;
  writePct: number;
};
type Backend = {
  id: string;
  label: string;
  zone: string;
  capacityRps: number;
};
type Topology = {
  id: string;
  label: string;
  detail: string;
  entryZone: string;
  backends: Backend[];
};
type Algorithm = {
  id: string;
  label: string;
  detail: string;
  kind: 'round-robin' | 'least-request' | 'consistent-hash';
  adaptation: number;
};
type Incident = {
  id: string;
  label: string;
  detail: string;
  kind: 'healthy' | 'not-ready' | 'slow-outlier' | 'zone-loss';
  targetBackendId?: string;
  targetZone?: string;
  capacityFactor: number;
  errorRate: number;
};
type RetryPolicy = {
  id: string;
  label: string;
  detail: string;
  kind: 'none' | 'budgeted' | 'blind';
  retryBudgetPct: number;
  retriesPerFailure: number;
  idempotent: boolean;
};
type TrafficModel = {
  title: string;
  description: string;
  bounds: { requestRate: Bound };
  defaults: {
    workloadId: string;
    topologyId: string;
    algorithmId: string;
    incidentId: string;
    retryPolicyId: string;
    requestRate: number;
    readinessGating: boolean;
    outlierEjection: boolean;
    connectionReuse: boolean;
  };
  workloads: Workload[];
  topologies: Topology[];
  algorithms: Algorithm[];
  incidents: Incident[];
  retryPolicies: RetryPolicy[];
};

type BackendResult = Backend & {
  assignedRps: number;
  effectiveCapacity: number;
  errorRate: number;
  excluded: boolean;
  condition: string;
  pressure: number;
};

const BLOCK_ID = 'technology/proxies-load-balancing-traffic-resilience-lab';

function isTrafficModel(value: unknown): value is TrafficModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrafficModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.bounds?.requestRate
      && candidate.defaults?.workloadId
      && candidate.defaults.topologyId
      && candidate.defaults.algorithmId
      && candidate.defaults.incidentId
      && candidate.defaults.retryPolicyId
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length > 0
      && Array.isArray(candidate.algorithms)
      && candidate.algorithms.length > 0
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && Array.isArray(candidate.retryPolicies)
      && candidate.retryPolicies.length > 0,
  );
}

export default function ProxiesLoadBalancingTrafficResilienceLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TrafficModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No traffic-resilience model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTrafficModel(payload)) {
          throw new Error('The traffic-resilience model is incomplete.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the traffic lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return <LabState title="Traffic lab unavailable" detail={error} tone="error" />;
  }
  if (!data) {
    return (
      <LabState
        title="Loading traffic lab"
        detail="Preparing backend capacity and failure signals..."
      />
    );
  }
  return <TrafficWorkbench data={data} />;
}

function TrafficWorkbench({ data }: { data: TrafficModel }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [topologyId, setTopologyId] = useState(data.defaults.topologyId);
  const [algorithmId, setAlgorithmId] = useState(data.defaults.algorithmId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const [retryPolicyId, setRetryPolicyId] = useState(data.defaults.retryPolicyId);
  const [requestRate, setRequestRate] = useState(data.defaults.requestRate);
  const [readinessGating, setReadinessGating] = useState(data.defaults.readinessGating);
  const [outlierEjection, setOutlierEjection] = useState(data.defaults.outlierEjection);
  const [connectionReuse, setConnectionReuse] = useState(data.defaults.connectionReuse);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const algorithm = data.algorithms.find((item) => item.id === algorithmId) ?? data.algorithms[0];
  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const retryPolicy =
    data.retryPolicies.find((item) => item.id === retryPolicyId) ?? data.retryPolicies[0];

  const result = useMemo(() => {
    const initial = topology.backends.map((backend) => {
      const targeted =
        incident.kind === 'zone-loss'
          ? backend.zone === incident.targetZone
          : backend.id === incident.targetBackendId;
      const effectiveCapacity = targeted
        ? backend.capacityRps * incident.capacityFactor
        : backend.capacityRps;
      const errorRate = targeted ? incident.errorRate : 0;
      const excluded =
        targeted
        && (
          ((incident.kind === 'not-ready' || incident.kind === 'zone-loss') && readinessGating)
          || (incident.kind === 'slow-outlier' && outlierEjection)
        );
      const condition = !targeted
        ? 'Ready'
        : excluded
          ? 'Ejected'
          : incident.kind === 'zone-loss'
            ? 'Down'
            : incident.kind === 'not-ready'
              ? 'Not ready'
              : 'Slow outlier';
      return { ...backend, condition, effectiveCapacity, errorRate, excluded };
    });

    const eligible = initial.filter((backend) => !backend.excluded);
    const shares = new Map<string, number>();
    if (eligible.length > 0) {
      if (algorithm.kind === 'consistent-hash') {
        const hotShare = Math.min(1, workload.affinitySharePct / 100);
        eligible.forEach((backend, index) => {
          const share =
            eligible.length === 1
              ? 1
              : index === 0
                ? hotShare
                : (1 - hotShare) / (eligible.length - 1);
          shares.set(backend.id, share);
        });
      } else {
        const weights = eligible.map((backend) => {
          if (algorithm.kind === 'round-robin') return 1;
          const degradation = 1 - backend.effectiveCapacity / backend.capacityRps;
          return Math.max(0.05, 1 - degradation * algorithm.adaptation);
        });
        const totalWeight = weights.reduce((sum, value) => sum + value, 0);
        eligible.forEach((backend, index) => {
          shares.set(backend.id, weights[index] / totalWeight);
        });
      }
    }

    const firstPass = initial.map((backend) => {
      const assignedRps = backend.excluded ? 0 : requestRate * (shares.get(backend.id) ?? 0);
      const capacityFailures = Math.max(0, assignedRps - backend.effectiveCapacity);
      const observedFailures = assignedRps * backend.errorRate;
      const failedRps = Math.min(assignedRps, Math.max(capacityFailures, observedFailures));
      return { ...backend, assignedRps, failedRps };
    });
    const firstFailures = firstPass.reduce((sum, backend) => sum + backend.failedRps, 0);
    const retryAttempts =
      retryPolicy.kind === 'none'
        ? 0
        : retryPolicy.kind === 'budgeted'
          ? Math.min(firstFailures, requestRate * (retryPolicy.retryBudgetPct / 100))
          : firstFailures * retryPolicy.retriesPerFailure;
    const offeredRps = requestRate + retryAttempts;

    const backends: BackendResult[] = firstPass.map((backend) => {
      const assignedRps =
        backend.assignedRps
        + (backend.excluded ? 0 : retryAttempts * (shares.get(backend.id) ?? 0));
      const pressure =
        backend.effectiveCapacity > 0
          ? assignedRps / backend.effectiveCapacity
          : assignedRps > 0
            ? Number.POSITIVE_INFINITY
            : 0;
      return { ...backend, assignedRps, pressure };
    });

    const spareCapacity = firstPass.reduce(
      (sum, backend) =>
        sum
        + (
          backend.excluded
            ? 0
            : Math.max(0, backend.effectiveCapacity - backend.assignedRps)
              * (1 - backend.errorRate)
        ),
      0,
    );
    const successfulRetries = Math.min(retryAttempts, spareCapacity);
    const userErrors = Math.max(0, firstFailures - successfulRetries);
    const duplicateWrites =
      retryPolicy.idempotent
        ? 0
        : retryAttempts * (workload.writePct / 100);
    const maxPressure = backends.reduce(
      (maximum, backend) => Math.max(maximum, backend.pressure),
      0,
    );
    const zones = Array.from(new Set(topology.backends.map((backend) => backend.zone))).map(
      (zone) => {
        const members = backends.filter((backend) => backend.zone === zone);
        return {
          zone,
          assignedRps: members.reduce((sum, backend) => sum + backend.assignedRps, 0),
          capacityRps: members.reduce(
            (sum, backend) => sum + (backend.excluded ? 0 : backend.effectiveCapacity),
            0,
          ),
          available: members.some(
            (backend) => !backend.excluded && backend.effectiveCapacity > 0,
          ),
        };
      },
    );
    const availableZones = zones.filter((zone) => zone.available).length;
    const crossZoneRps = zones
      .filter((zone) => zone.zone !== topology.entryZone)
      .reduce((sum, zone) => sum + zone.assignedRps, 0);
    const handshakeRps = connectionReuse
      ? eligible.length * 4
      : offeredRps;

    const signalQuality =
      algorithm.kind === 'consistent-hash'
        ? workload.kind === 'affinity'
          ? 'Locality, not load'
          : 'Weak'
        : algorithm.kind === 'least-request'
          ? workload.kind === 'variable'
            ? 'Strong'
            : 'Good'
          : workload.kind === 'uniform'
            ? 'Good'
            : 'Weak';

    let status: 'healthy' | 'caution' | 'unsafe' = 'healthy';
    let title = 'Traffic fits the measured serving envelope';
    let detail =
      'The selected targets have headroom, retry work is bounded, and the observed load signal matches the workload closely enough to distribute requests.';

    if (eligible.length === 0 || availableZones === 0) {
      status = 'unsafe';
      title = 'No serving failure domain remains';
      detail =
        'Health decisions removed every target, or the incident removed the only zone. A fallback needs independent capacity, routing, and application state outside the failed boundary.';
    } else if (duplicateWrites >= 1) {
      status = 'unsafe';
      title = 'Retries can repeat state-changing work';
      detail =
        'The load balancer sees failed attempts, not the durable business outcome. Retry writes only when the application recognizes the same logical operation and returns the original result.';
    } else if (maxPressure > 1 || userErrors / requestRate > 0.01) {
      status = 'unsafe';
      title = 'Retry work or skew pushes at least one target beyond capacity';
      detail =
        'Stop adding attempts before adding servers blindly. Shed optional traffic, cap retry concurrency, fix the load signal, and preserve reserve capacity for the declared failure.';
    } else if (incident.kind !== 'healthy') {
      status = 'caution';
      title = 'The incident is contained, but the pool is degraded';
      detail =
        'Keep the failed target out long enough to recover, ramp it back gradually, and verify that remaining zones can carry the peak without retry amplification.';
    }

    return {
      availableZones,
      backends,
      crossZoneRps,
      detail,
      duplicateWrites,
      handshakeRps,
      maxPressure,
      offeredRps,
      retryAttempts,
      signalQuality,
      status,
      title,
      userErrors,
      zones,
    };
  }, [
    algorithm,
    connectionReuse,
    incident,
    outlierEjection,
    readinessGating,
    requestRate,
    retryPolicy,
    topology,
    workload,
  ]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setTopologyId(data.defaults.topologyId);
    setAlgorithmId(data.defaults.algorithmId);
    setIncidentId(data.defaults.incidentId);
    setRetryPolicyId(data.defaults.retryPolicyId);
    setRequestRate(data.defaults.requestRate);
    setReadinessGating(data.defaults.readinessGating);
    setOutlierEjection(data.defaults.outlierEjection);
    setConnectionReuse(data.defaults.connectionReuse);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Traffic and failure lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <SelectControl
                id="proxy-workload"
                label="Workload shape"
                value={workload.id}
                options={data.workloads}
                onChange={setWorkloadId}
              />
              <SelectControl
                id="proxy-topology"
                label="Failure-domain layout"
                value={topology.id}
                options={data.topologies}
                onChange={setTopologyId}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Load signal
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.algorithms.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === algorithm.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.kind === 'consistent-hash' ? Link : Waypoints}
                      accent={item.kind === 'least-request' ? 'emerald' : 'amber'}
                      onClick={() => setAlgorithmId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <SelectControl
                id="proxy-incident"
                label="Injected condition"
                value={incident.id}
                options={data.incidents}
                onChange={setIncidentId}
              />
              <LabRange
                label="Client request rate"
                value={requestRate}
                output={`${requestRate.toLocaleString()} RPS`}
                min={data.bounds.requestRate.min}
                max={data.bounds.requestRate.max}
                step={data.bounds.requestRate.step}
                accent="amber"
                lowLabel="Normal"
                highLabel="Peak"
                onChange={setRequestRate}
              />
              <SelectControl
                id="proxy-retries"
                label="Retry policy"
                value={retryPolicy.id}
                options={data.retryPolicies}
                onChange={setRetryPolicyId}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Pool protections
                </legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice
                    selected={readinessGating}
                    label="Readiness and active health gating"
                    detail="Remove targets that cannot accept their full request contract."
                    icon={HeartPulse}
                    accent="emerald"
                    onClick={() => setReadinessGating((value) => !value)}
                  />
                  <LabChoice
                    selected={outlierEjection}
                    label="Passive outlier ejection"
                    detail="Temporarily remove a target whose live results diverge from peers."
                    icon={Ban}
                    accent="rose"
                    onClick={() => setOutlierEjection((value) => !value)}
                  />
                  <LabChoice
                    selected={connectionReuse}
                    label="Reuse upstream connections"
                    detail="Pool connections instead of paying a new handshake per request."
                    icon={Network}
                    accent="blue"
                    onClick={() => setConnectionReuse((value) => !value)}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Offered attempts"
                value={`${Math.round(result.offeredRps).toLocaleString()} RPS`}
                detail={`${Math.round(result.retryAttempts).toLocaleString()} RPS are retries.`}
                icon={Repeat2}
                tone={result.retryAttempts / requestRate > 0.1 ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Hottest target"
                value={
                  Number.isFinite(result.maxPressure)
                    ? `${Math.round(result.maxPressure * 100)}%`
                    : 'No capacity'
                }
                detail="Assigned attempts divided by effective target capacity."
                icon={Zap}
                tone={result.maxPressure > 1 ? 'rose' : 'amber'}
              />
              <LabMetric
                label="User errors"
                value={`${Math.round(result.userErrors).toLocaleString()} RPS`}
                detail="First-attempt failures not recovered by spare capacity."
                icon={result.userErrors >= 1 ? CircleAlert : ShieldCheck}
                tone={result.userErrors / requestRate > 0.01 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="TLS or TCP handshakes"
                value={`~${Math.round(result.handshakeRps).toLocaleString()}/s`}
                detail={connectionReuse ? 'Pooled connection estimate.' : 'One new upstream connection per attempt.'}
                icon={TimerReset}
                tone={connectionReuse ? 'emerald' : 'violet'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Backend assignment
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    Signal quality: <strong>{result.signalQuality}</strong>
                  </p>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {algorithm.label} / {incident.label}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {result.backends.map((backend) => (
                  <BackendBar key={backend.id} backend={backend} />
                ))}
              </div>
            </section>

            <section className={statusClasses[result.status]}>
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Serving decision</p>
                  <p className="mt-1 text-base font-semibold">{result.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryFact
                icon={Layers3}
                label="Failure domains serving"
                value={`${result.availableZones} of ${result.zones.length} zones`}
                detail={`${Math.round(result.crossZoneRps).toLocaleString()} RPS crosses from ${topology.entryZone}.`}
              />
              <SummaryFact
                icon={Activity}
                label="Potential duplicate writes"
                value={`${Math.round(result.duplicateWrites).toLocaleString()} RPS`}
                detail={
                  retryPolicy.idempotent
                    ? 'The selected policy requires one stable operation identity.'
                    : `${workload.writePct}% of this workload changes state.`
                }
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function SelectControl<T extends { id: string; label: string; detail: string }>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: T[];
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function BackendBar({ backend }: { backend: BackendResult }) {
  const pressurePct = Number.isFinite(backend.pressure)
    ? Math.round(backend.pressure * 100)
    : 999;
  const barWidth = `${Math.min(100, pressurePct)}%`;
  const overloaded = backend.pressure > 1;
  const barClass = backend.excluded
    ? 'bg-neutral-400 dark:bg-neutral-600'
    : overloaded
      ? 'bg-rose-500'
      : backend.condition === 'Ready'
        ? 'bg-emerald-500'
        : 'bg-amber-500';

  return (
    <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_7rem] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
          {backend.label}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {backend.zone} / {backend.condition}
        </p>
      </div>
      <div
        className="h-5 overflow-hidden rounded-sm border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
        role="img"
        aria-label={`${backend.label} at ${pressurePct}% of effective capacity`}
      >
        <div className={`h-full ${barClass}`} style={{ width: barWidth }} />
      </div>
      <p className="text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
        {Math.round(backend.assignedRps)} / {Math.round(backend.effectiveCapacity)} RPS
      </p>
    </div>
  );
}

function SummaryFact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LabState({
  title,
  detail,
  tone = 'loading',
}: {
  title: string;
  detail: string;
  tone?: 'loading' | 'error';
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            className={`flex min-h-48 items-start gap-3 rounded-md border p-5 ${
              tone === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
            }`}
            role={tone === 'error' ? 'alert' : 'status'}
          >
            {tone === 'error' ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Server aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm opacity-75">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const statusClasses = {
  healthy:
    'border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50',
  caution:
    'border-l-4 border-amber-500 bg-amber-50 px-4 py-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50',
  unsafe:
    'border-l-4 border-rose-500 bg-rose-50 px-4 py-4 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50',
};
