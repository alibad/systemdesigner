'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  CircleX,
  Database,
  Gauge,
  Globe2,
  HeartPulse,
  Network,
  Route,
  Server,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CheckStatus = 'passing' | 'critical' | 'unknown';

type DiscoveryInterface = {
  id: string;
  label: string;
  detail: string;
  consistency: string;
  requestPath: string[];
  healthyBehavior: string;
  outageBehavior: string;
  supportsPassingFilter: boolean;
};

type HealthCheck = {
  id: string;
  label: string;
  detail: string;
  detects: string;
  blindSpot: string;
  failureDelay: string;
};

type CheckOutcome = {
  status: CheckStatus;
  explanation: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  serviceState: 'ready' | 'hung' | 'last-observed';
  controlPlaneState: 'quorum' | 'no-quorum';
  cacheAgeSeconds: number;
  checkOutcomes: Record<string, CheckOutcome>;
};

type DiscoveryModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    interfaceId: string;
    checkId: string;
    incidentId: string;
  };
  interfaces: DiscoveryInterface[];
  checks: HealthCheck[];
  incidents: Incident[];
};

const BLOCK_ID = 'technology/consul-discovery-contract-lab';

function isDiscoveryModel(value: unknown): value is DiscoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DiscoveryModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && candidate.title
      && candidate.description
      && candidate.defaults?.interfaceId
      && candidate.defaults.checkId
      && candidate.defaults.incidentId
      && Array.isArray(candidate.interfaces)
      && candidate.interfaces.length > 0
      && Array.isArray(candidate.checks)
      && candidate.checks.length > 0
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0,
  );
}

export default function ConsulDiscoveryContractLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DiscoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No discovery model was supplied.');
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
        if (!isDiscoveryModel(payload)) {
          throw new Error('The discovery model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the discovery lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <DiscoveryWorkbench data={data} />;
}

function DiscoveryWorkbench({ data }: { data: DiscoveryModel }) {
  const [interfaceId, setInterfaceId] = useState(data.defaults.interfaceId);
  const [checkId, setCheckId] = useState(data.defaults.checkId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);

  const discoveryInterface =
    data.interfaces.find((item) => item.id === interfaceId) ?? data.interfaces[0];
  const check = data.checks.find((item) => item.id === checkId) ?? data.checks[0];
  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const checkOutcome = incident.checkOutcomes[check.id] ?? {
    status: 'unknown' as const,
    explanation: 'No check outcome is defined for this combination.',
  };

  const result = useMemo(() => {
    const quorumLost = incident.controlPlaneState === 'no-quorum';
    const lookupAvailable =
      !quorumLost
      || discoveryInterface.id === 'dns-stale'
      || discoveryInterface.id === 'http-cached';

    if (!lookupAvailable) {
      return {
        label: 'Lookup unavailable',
        detail: 'This read path requires a leader and quorum, so it cannot return a new catalog result.',
        tone: 'rose' as const,
        icon: CircleX,
        source: 'No response',
      };
    }

    if (checkOutcome.status === 'critical') {
      return {
        label: 'Endpoint excluded',
        detail: 'The selected check marks this instance critical, so a passing-only lookup removes it from the answer.',
        tone: 'emerald' as const,
        icon: ShieldCheck,
        source: quorumLost ? 'Last replicated state' : 'Current catalog',
      };
    }

    if (incident.serviceState === 'hung' && checkOutcome.status === 'passing') {
      return {
        label: 'Unsafe endpoint eligible',
        detail: 'The lookup works, but the check contract is too shallow to detect the application failure.',
        tone: 'rose' as const,
        icon: TriangleAlert,
        source: 'Current catalog',
      };
    }

    if (checkOutcome.status === 'unknown') {
      return {
        label: 'Degraded evidence',
        detail: 'The result can keep traffic moving, but its age and last-observed health must fit an explicit fail-static policy.',
        tone: 'amber' as const,
        icon: CircleHelp,
        source: discoveryInterface.id === 'http-cached' ? 'Warm local cache' : 'Follower state',
      };
    }

    return {
      label: 'Healthy endpoint eligible',
      detail: 'The discovery path is available and the selected health contract currently marks the service ready.',
      tone: 'emerald' as const,
      icon: CheckCircle2,
      source: discoveryInterface.id === 'http-cached' ? 'Agent cache' : 'Current catalog',
    };
  }, [checkOutcome.status, discoveryInterface.id, incident.controlPlaneState, incident.serviceState]);

  const statusPresentation: Record<
    CheckStatus,
    { label: string; tone: 'emerald' | 'rose' | 'amber'; icon: typeof CheckCircle2 }
  > = {
    passing: { label: 'Passing', tone: 'emerald', icon: CheckCircle2 },
    critical: { label: 'Critical', tone: 'rose', icon: CircleX },
    unknown: { label: 'Last observed', tone: 'amber', icon: CircleHelp },
  };
  const checkStatus = statusPresentation[checkOutcome.status];

  function reset() {
    setInterfaceId(data.defaults.interfaceId);
    setCheckId(data.defaults.checkId);
    setIncidentId(data.defaults.incidentId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Discovery contract lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Lookup path
                </legend>
                <div className="mt-3 space-y-2">
                  {data.interfaces.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === discoveryInterface.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'dns-stale' ? Globe2 : Database}
                      accent="cyan"
                      onClick={() => setInterfaceId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Health contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.checks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === check.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'ttl-heartbeat' ? TimerReset : HeartPulse}
                      accent="violet"
                      onClick={() => setCheckId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Inject an event
                </legend>
                <div className="mt-3 space-y-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'healthy' ? Activity : TriangleAlert}
                      accent={item.id === 'healthy' ? 'emerald' : 'amber'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Read contract"
                value={discoveryInterface.consistency}
                detail={discoveryInterface.label}
                icon={Gauge}
                tone="cyan"
              />
              <LabMetric
                label="Health state"
                value={checkStatus.label}
                detail={check.failureDelay}
                icon={checkStatus.icon}
                tone={checkStatus.tone}
              />
              <LabMetric
                label="Result source"
                value={result.source}
                detail={incident.cacheAgeSeconds > 0 ? `${incident.cacheAgeSeconds}s since server contact` : 'Current observation'}
                icon={Server}
                tone={incident.cacheAgeSeconds > 0 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Traffic decision"
                value={result.label}
                detail="Passing-only endpoint selection"
                icon={result.icon}
                tone={result.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Active request path
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {discoveryInterface.label}
                  </h4>
                </div>
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {incident.controlPlaneState === 'quorum' ? 'Leader available' : 'No quorum'}
                </span>
              </div>

              <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                {discoveryInterface.requestPath.map((step, index) => (
                  <div key={`${discoveryInterface.id}-${step}`} className="contents">
                    <div className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                        {index + 1}
                      </span>
                      <p className="mt-2 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">
                        {step}
                      </p>
                    </div>
                    {index < discoveryInterface.requestPath.length - 1 ? (
                      <ArrowRight
                        aria-hidden="true"
                        className="mx-auto h-4 w-4 shrink-0 rotate-90 text-neutral-400 md:rotate-0"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.tone === 'rose'
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <result.icon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    User-visible outcome
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {result.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.detail}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Network aria-hidden="true" className="h-4 w-4" />
                  <h4 className="text-sm font-semibold">Lookup semantics</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-blue-950 dark:text-blue-100">
                  {incident.controlPlaneState === 'quorum'
                    ? discoveryInterface.healthyBehavior
                    : discoveryInterface.outageBehavior}
                </p>
              </section>
              <section className="rounded-md border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                <div className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                  <HeartPulse aria-hidden="true" className="h-4 w-4" />
                  <h4 className="text-sm font-semibold">Check semantics</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-violet-950 dark:text-violet-100">
                  {checkOutcome.explanation}
                </p>
                <p className="mt-2 text-xs leading-5 text-violet-800 dark:text-violet-200">
                  Blind spot: {check.blindSpot}
                </p>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading Consul discovery lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">The Consul discovery lab could not load.</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
