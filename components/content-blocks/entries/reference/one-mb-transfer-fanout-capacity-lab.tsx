'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Gauge,
  Network,
  Repeat2,
  Server,
  Users,
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

type Scenario = {
  id: string;
  label: string;
  detail: string;
  objectsPerSecond: number;
  recipientsPerObject: number;
  cacheHitPercent: number;
  retryPercent: number;
  clientGoodputMbps: number;
  clientRttMs: number;
};

type Failure = {
  id: string;
  label: string;
  detail: string;
  edgeCapacityFactor: number;
  originCapacityFactor: number;
  cacheHitOverridePercent: number | null;
};

type FanoutCapacityModel = {
  payloadBytes: number;
  wireOverheadPercent: number;
  targetUtilizationPercent: number;
  observationSeconds: number;
  defaults: {
    scenarioId: string;
    failureId: string;
    objectsPerSecond: number;
    recipientsPerObject: number;
    cacheHitPercent: number;
    retryPercent: number;
    edgeCapacityGbps: number;
    originCapacityGbps: number;
  };
  bounds: {
    objectsPerSecond: Bound;
    recipientsPerObject: Bound;
    cacheHitPercent: Bound;
    retryPercent: Bound;
    edgeCapacityGbps: Bound;
    originCapacityGbps: Bound;
  };
  scenarios: Scenario[];
  failures: Failure[];
};

const block = 'reference/one-mb-transfer-fanout-capacity-lab';
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function formatGbps(value: number) {
  if (value < 1) return `${decimal.format(value * 1_000)} Mb/s`;
  return `${decimal.format(value)} Gb/s`;
}

function formatData(bytes: number) {
  if (bytes >= 1_000_000_000) return `${decimal.format(bytes / 1_000_000_000)} GB`;
  if (bytes >= 1_000_000) return `${decimal.format(bytes / 1_000_000)} MB`;
  return `${decimal.format(bytes / 1_000)} KB`;
}

function LabState({ label, error }: { label: string; error?: string }) {
  return (
    <div data-content-block={block}>
      <div
        className={`min-h-[700px] rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        aria-label={label}
        role={error ? 'alert' : undefined}
      >
        {error ? (
          <>
            <p className="font-semibold">Fan-out capacity model unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function OneMbTransferFanoutCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FanoutCapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('shared-asset');
  const [failureId, setFailureId] = useState('healthy');
  const [objectsPerSecond, setObjectsPerSecond] = useState(20);
  const [recipientsPerObject, setRecipientsPerObject] = useState(100);
  const [cacheHitPercent, setCacheHitPercent] = useState(90);
  const [retryPercent, setRetryPercent] = useState(2);
  const [edgeCapacityGbps, setEdgeCapacityGbps] = useState(40);
  const [originCapacityGbps, setOriginCapacityGbps] = useState(10);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The fan-out capacity data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<FanoutCapacityModel>;
      })
      .then((model) => {
        setData(model);
        setScenarioId(model.defaults.scenarioId);
        setFailureId(model.defaults.failureId);
        setObjectsPerSecond(model.defaults.objectsPerSecond);
        setRecipientsPerObject(model.defaults.recipientsPerObject);
        setCacheHitPercent(model.defaults.cacheHitPercent);
        setRetryPercent(model.defaults.retryPercent);
        setEdgeCapacityGbps(model.defaults.edgeCapacityGbps);
        setOriginCapacityGbps(model.defaults.originCapacityGbps);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the fan-out capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
    if (!scenario || !failure) return null;

    const effectiveCacheHitPercent = failure.cacheHitOverridePercent ?? cacheHitPercent;
    const wireBytes = data.payloadBytes * (1 + data.wireOverheadPercent / 100);
    const logicalDeliveriesPerSecond = objectsPerSecond * recipientsPerObject;
    const attemptsPerSecond = logicalDeliveriesPerSecond * (1 + retryPercent / 100);
    const edgeDemandGbps = attemptsPerSecond * wireBytes * 8 / 1_000_000_000;
    const originAttemptsPerSecond = attemptsPerSecond * (1 - effectiveCacheHitPercent / 100);
    const originDemandGbps = originAttemptsPerSecond * wireBytes * 8 / 1_000_000_000;
    const edgeAvailableGbps = edgeCapacityGbps * failure.edgeCapacityFactor;
    const originAvailableGbps = originCapacityGbps * failure.originCapacityFactor;
    const edgeSafeGbps = edgeAvailableGbps * data.targetUtilizationPercent / 100;
    const originSafeGbps = originAvailableGbps * data.targetUtilizationPercent / 100;
    const edgePressure = edgeDemandGbps / edgeSafeGbps;
    const originPressure = originDemandGbps / originSafeGbps;
    const transferMs = scenario.clientRttMs + wireBytes * 8 / (scenario.clientGoodputMbps * 1_000_000) * 1_000;
    const activeTransfers = attemptsPerSecond * transferMs / 1_000;
    const edgeQueueGrowthBytesPerSecond = Math.max(0, edgeDemandGbps - edgeSafeGbps) * 1_000_000_000 / 8;
    const originQueueGrowthBytesPerSecond = Math.max(0, originDemandGbps - originSafeGbps) * 1_000_000_000 / 8;
    const queueGrowthBytes = Math.max(edgeQueueGrowthBytesPerSecond, originQueueGrowthBytesPerSecond) * data.observationSeconds;
    const edgeOverload = edgePressure > 1;
    const originOverload = originPressure > 1;
    const nearLimit = !edgeOverload && !originOverload && Math.max(edgePressure, originPressure) >= 0.75;

    return {
      activeTransfers,
      attemptsPerSecond,
      edgeAvailableGbps,
      edgeDemandGbps,
      edgeOverload,
      edgePressure,
      edgeSafeGbps,
      effectiveCacheHitPercent,
      failure,
      logicalDeliveriesPerSecond,
      nearLimit,
      originAttemptsPerSecond,
      originAvailableGbps,
      originDemandGbps,
      originOverload,
      originPressure,
      originSafeGbps,
      queueGrowthBytes,
      scenario,
      transferMs,
      wireBytes,
    };
  }, [cacheHitPercent, data, edgeCapacityGbps, failureId, objectsPerSecond, originCapacityGbps, recipientsPerObject, retryPercent, scenarioId]);

  if (loadError) return <LabState label="Fan-out capacity model unavailable" error={loadError} />;
  if (!data) return <LabState label="Loading fan-out capacity model" />;
  if (!model) return <LabState label="Fan-out capacity model unavailable" error="The scenario or failure options are incomplete." />;

  const applyScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setObjectsPerSecond(scenario.objectsPerSecond);
    setRecipientsPerObject(scenario.recipientsPerObject);
    setCacheHitPercent(scenario.cacheHitPercent);
    setRetryPercent(scenario.retryPercent);
  };

  const overloaded = model.edgeOverload || model.originOverload;
  const status = model.edgeOverload && model.originOverload
    ? 'Both egress boundaries are overloaded'
    : model.edgeOverload
      ? 'Client-facing edge egress is overloaded'
      : model.originOverload
        ? 'Origin-facing egress is overloaded'
        : model.nearLimit
          ? 'The plan is inside capacity with limited headroom'
          : 'Both egress boundaries retain modeled headroom';
  const guidance = model.edgeOverload && model.originOverload
    ? 'Reject or shape new delivery work, protect origin with a concurrency cap, and restore capacity before retries expand both queues.'
    : model.edgeOverload
      ? 'A higher cache hit rate cannot remove client-facing bytes. Reduce the representation, add edge egress, shed load, or slow fan-out.'
      : model.originOverload
        ? 'Protect origin with reusable responses, correct cache keys, request collapsing, and an explicit miss-concurrency limit.'
        : model.nearLimit
          ? 'The system fits only narrowly. Keep the failure mode active when calculating reserve and test burst plus retry behavior.'
          : 'The modeled boundaries fit. Validate with representative transfer duration, cache behavior, and loss before treating this as capacity evidence.';

  return (
    <div data-content-block={block}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Fan-out and failure-boundary lab"
          title="Watch one megabyte multiply across recipients"
          description="Tune publication rate, recipients, cache reuse, retries, and available links. The model keeps client-facing and origin-facing egress separate."
          icon={Network}
          accent="cyan"
          onReset={() => {
            setScenarioId(data.defaults.scenarioId);
            setFailureId(data.defaults.failureId);
            setObjectsPerSecond(data.defaults.objectsPerSecond);
            setRecipientsPerObject(data.defaults.recipientsPerObject);
            setCacheHitPercent(data.defaults.cacheHitPercent);
            setRetryPercent(data.defaults.retryPercent);
            setEdgeCapacityGbps(data.defaults.edgeCapacityGbps);
            setOriginCapacityGbps(data.defaults.originCapacityGbps);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Delivery shape</legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice key={scenario.id} selected={scenario.id === model.scenario.id} label={scenario.label} detail={scenario.detail} icon={Users} accent="cyan" onClick={() => applyScenario(scenario)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Capacity challenge</legend>
                <div className="mt-3 space-y-2">
                  {data.failures.map((failure) => (
                    <LabChoice key={failure.id} selected={failure.id === model.failure.id} label={failure.label} detail={failure.detail} icon={failure.id === 'healthy' ? CheckCircle2 : AlertTriangle} accent={failure.id === 'healthy' ? 'emerald' : 'rose'} onClick={() => setFailureId(failure.id)} />
                  ))}
                </div>
              </fieldset>

              <LabRange label="Source objects" value={objectsPerSecond} output={`${objectsPerSecond}/s`} {...data.bounds.objectsPerSecond} accent="blue" lowLabel="1 per second" highLabel="200 per second" onChange={setObjectsPerSecond} />
              <LabRange label="Recipients per object" value={recipientsPerObject} output={recipientsPerObject.toLocaleString()} {...data.bounds.recipientsPerObject} accent="violet" lowLabel="direct" highLabel="1,000-way fan-out" onChange={setRecipientsPerObject} />
              {model.failure.cacheHitOverridePercent === null ? (
                <LabRange label="Reusable cache hits" value={cacheHitPercent} output={`${cacheHitPercent}%`} {...data.bounds.cacheHitPercent} accent="emerald" lowLabel="origin-heavy" highLabel="edge reuse" onChange={setCacheHitPercent} />
              ) : (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
                  <p className="text-xs font-semibold uppercase opacity-70">Reusable cache hits</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">{model.effectiveCacheHitPercent}% forced</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">The selected cache-bypass challenge overrides the planned hit rate. Choose another challenge to restore the control.</p>
                </div>
              )}
              <LabRange label="Retry attempts" value={retryPercent} output={`${retryPercent}%`} {...data.bounds.retryPercent} accent="rose" lowLabel="none" highLabel="30% extra" onChange={setRetryPercent} />
              <LabRange label="Nominal edge egress" value={edgeCapacityGbps} output={`${edgeCapacityGbps} Gb/s`} {...data.bounds.edgeCapacityGbps} accent="amber" lowLabel="1 Gb/s" highLabel="100 Gb/s" onChange={setEdgeCapacityGbps} />
              <LabRange label="Nominal origin egress" value={originCapacityGbps} output={`${originCapacityGbps} Gb/s`} {...data.bounds.originCapacityGbps} accent="violet" lowLabel="1 Gb/s" highLabel="40 Gb/s" onChange={setOriginCapacityGbps} />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Logical deliveries" value={`${compact.format(model.logicalDeliveriesPerSecond)}/s`} detail={`${objectsPerSecond}/s x ${recipientsPerObject.toLocaleString()} recipients`} icon={Users} tone="blue" />
              <LabMetric label="Wire attempts" value={`${compact.format(model.attemptsPerSecond)}/s`} detail={`${retryPercent}% retry amplification`} icon={Repeat2} tone={retryPercent >= 10 ? 'rose' : 'violet'} />
              <LabMetric label="Active transfers" value={compact.format(model.activeTransfers)} detail={`${decimal.format(model.transferMs)} ms illustrative client completion`} icon={Activity} tone="cyan" />
              <LabMetric label="Edge demand" value={formatGbps(model.edgeDemandGbps)} detail={`Safe boundary ${formatGbps(model.edgeSafeGbps)}`} icon={Network} tone={model.edgeOverload ? 'rose' : model.edgePressure >= 0.75 ? 'amber' : 'emerald'} />
              <LabMetric label="Origin demand" value={formatGbps(model.originDemandGbps)} detail={`${decimal.format(model.effectiveCacheHitPercent)}% effective cache hits`} icon={Server} tone={model.originOverload ? 'rose' : model.originPressure >= 0.75 ? 'amber' : 'emerald'} />
              <LabMetric label={`${data.observationSeconds}s queue growth`} value={model.queueGrowthBytes > 0 ? formatData(model.queueGrowthBytes) : '0 B'} detail={model.queueGrowthBytes > 0 ? 'At the most overloaded boundary' : 'No modeled sustained overload'} icon={Gauge} tone={model.queueGrowthBytes > 0 ? 'rose' : 'emerald'} />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Delivery path under the selected challenge</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <div className={`rounded-md border p-4 ${model.originOverload ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50'}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><Server aria-hidden="true" className="h-4 w-4" />Origin boundary</span>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{formatGbps(model.originDemandGbps)}</p>
                  <p className="mt-1 text-xs opacity-75">{compact.format(model.originAttemptsPerSecond)} miss attempts/s</p>
                </div>
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 md:rotate-0" />
                <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-50">
                  <span className="flex items-center gap-2 text-sm font-semibold"><Cloud aria-hidden="true" className="h-4 w-4" />Reuse boundary</span>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{decimal.format(model.effectiveCacheHitPercent)}% hits</p>
                  <p className="mt-1 text-xs opacity-75">Protects origin, not edge egress</p>
                </div>
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 md:rotate-0" />
                <div className={`rounded-md border p-4 ${model.edgeOverload ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold"><Users aria-hidden="true" className="h-4 w-4" />Recipient boundary</span>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{formatGbps(model.edgeDemandGbps)}</p>
                  <p className="mt-1 text-xs opacity-75">Every attempt carries {formatData(model.wireBytes)}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-2">
              <CapacityBar label="Origin egress" demand={model.originDemandGbps} safe={model.originSafeGbps} available={model.originAvailableGbps} pressure={model.originPressure} />
              <CapacityBar label="Edge egress" demand={model.edgeDemandGbps} safe={model.edgeSafeGbps} available={model.edgeAvailableGbps} pressure={model.edgePressure} />
            </section>

            <section className={`mt-5 border-l-4 p-5 ${overloaded ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : model.nearLimit ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`} role="status">
              <div className="flex items-start gap-3">
                {overloaded ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Capacity consequence</p>
                  <h4 className="mt-2 text-lg font-semibold">{status}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{guidance}</p>
                </div>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Illustrative model: each logical delivery carries a 1 MB decimal payload plus {data.wireOverheadPercent}% modeled wire allowance. Attempts include the selected retry rate. Safe capacity is {data.targetUtilizationPercent}% of capacity remaining after the selected failure. Cache misses are modeled independently; real request collapsing can reduce origin fetches. Client completion uses {model.scenario.clientGoodputMbps} Mb/s and {model.scenario.clientRttMs} ms RTT for the selected scenario.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function CapacityBar({ label, demand, safe, available, pressure }: { label: string; demand: number; safe: number; available: number; pressure: number }) {
  const overloaded = pressure > 1;
  const nearLimit = !overloaded && pressure >= 0.75;
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{formatGbps(safe)} safe of {formatGbps(available)} available</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${overloaded ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100' : nearLimit ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}`}>{decimal.format(pressure * 100)}%</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${overloaded ? 'bg-rose-500' : nearLimit ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pressure * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Demand {formatGbps(demand)} against the safe operating boundary.</p>
    </div>
  );
}
