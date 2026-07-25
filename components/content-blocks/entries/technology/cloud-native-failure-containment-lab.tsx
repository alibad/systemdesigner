'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleOff,
  CloudOff,
  Gauge,
  Layers3,
  LoaderCircle,
  Network,
  ServerCrash,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Waypoints,
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

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  durationSeconds: number;
  dependencyLatencyMs: number;
};

type RequestHandling = {
  id: string;
  label: string;
  detail: string;
  capacityMultiplier: number;
  riskMultiplier: number;
};

type FailureContainmentData = {
  title: string;
  description: string;
  trafficRps: number;
  podCapacityRps: number;
  defaults: {
    scenarioId: string;
    replicas: number;
    zones: number;
    timeoutMs: number;
    handlingId: string;
  };
  bounds: {
    replicas: Bounds;
    zones: Bounds;
    timeoutMs: Bounds;
  };
  scenarios: FailureScenario[];
  handling: RequestHandling[];
};

const BLOCK_ID = 'technology/cloud-native-failure-containment-lab';

const scenarioIcons: Record<string, LucideIcon> = {
  'pod-crash': ServerCrash,
  'zone-loss': CloudOff,
  'slow-dependency': Timer,
};

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<Bounds>;
  return typeof bounds.min === 'number'
    && typeof bounds.max === 'number'
    && typeof bounds.step === 'number';
}

function isFailureContainmentData(value: unknown): value is FailureContainmentData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<FailureContainmentData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.trafficRps === 'number'
      && typeof data.podCapacityRps === 'number'
      && typeof data.defaults?.scenarioId === 'string'
      && typeof data.defaults.replicas === 'number'
      && typeof data.defaults.zones === 'number'
      && typeof data.defaults.timeoutMs === 'number'
      && typeof data.defaults.handlingId === 'string'
      && isBounds(data.bounds?.replicas)
      && isBounds(data.bounds.zones)
      && isBounds(data.bounds.timeoutMs)
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.durationSeconds === 'number'
        && typeof scenario.dependencyLatencyMs === 'number'
      ))
      && Array.isArray(data.handling)
      && data.handling.length >= 2
      && data.handling.every((handling) => (
        typeof handling.id === 'string'
        && typeof handling.label === 'string'
        && typeof handling.detail === 'string'
        && typeof handling.capacityMultiplier === 'number'
        && typeof handling.riskMultiplier === 'number'
      )),
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? 'compact' : 'standard',
  }).format(value);
}

export default function CloudNativeFailureContainmentLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureContainmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No failure-containment model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the failure model (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureContainmentData(payload)) {
          throw new Error('The failure model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the failure model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure containment lab"
          title="Loading the failure model"
          description="The lesson is loading its failure scenarios and capacity envelope."
          icon={ShieldCheck}
          accent="rose"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center p-6 text-center">
            {error ? (
              <div>
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
                <p className="mt-3 text-sm">Loading failure scenarios...</p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    );
  }

  return <FailureContainmentWorkbench data={data} />;
}

function FailureContainmentWorkbench({ data }: { data: FailureContainmentData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialHandling = data.handling.find((item) => item.id === data.defaults.handlingId)
    ?? data.handling[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [replicas, setReplicas] = useState(data.defaults.replicas);
  const [zones, setZones] = useState(data.defaults.zones);
  const [timeoutMs, setTimeoutMs] = useState(data.defaults.timeoutMs);
  const [handlingId, setHandlingId] = useState(initialHandling.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const handling = data.handling.find((item) => item.id === handlingId) ?? data.handling[0];

  const result = useMemo(() => {
    let lostReplicas = 0;
    let dependencyFactor = 1;

    if (scenario.id === 'pod-crash') {
      lostReplicas = 1;
    } else if (scenario.id === 'zone-loss') {
      lostReplicas = Math.ceil(replicas / zones);
    } else {
      const excessWait = Math.max(0, timeoutMs - 700);
      dependencyFactor = Math.max(0.25, 0.95 - excessWait / 3200);
    }

    const remainingReplicas = Math.max(0, replicas - lostReplicas);
    const capacityRps = Math.round(
      remainingReplicas
        * data.podCapacityRps
        * dependencyFactor
        * handling.capacityMultiplier,
    );
    const shortfallRps = Math.max(0, data.trafficRps - capacityRps);
    const totalRequests = data.trafficRps * scenario.durationSeconds;
    const requestsAtRisk = Math.min(
      totalRequests,
      Math.round(shortfallRps * scenario.durationSeconds * handling.riskMultiplier),
    );
    const availabilityPercent = 100 * (1 - requestsAtRisk / totalRequests);
    const capacityPercent = 100 * capacityRps / data.trafficRps;

    let verdict = 'The failure remains inside the service envelope';
    let explanation = 'Surviving capacity can carry demand, and bounded request handling prevents retry amplification.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (remainingReplicas === 0 || availabilityPercent < 95) {
      verdict = 'The failure becomes a user-visible outage';
      explanation = scenario.id === 'zone-loss' && zones === 1
        ? 'All replicas share one zone, so replica count does not create an independent failure boundary.'
        : 'The remaining service and dependency capacity cannot carry admitted traffic. Shed load, reduce amplification, or add independent capacity.';
      tone = 'rose';
    } else if (availabilityPercent < 99.9 || capacityPercent < 115) {
      verdict = 'The service survives with little operating margin';
      explanation = 'The design contains a complete outage but spends meaningful availability or headroom. Test autoscaler and replacement delay before relying on it.';
      tone = 'amber';
    }

    return {
      availabilityPercent,
      capacityPercent,
      capacityRps,
      dependencyFactor,
      explanation,
      lostReplicas,
      remainingReplicas,
      requestsAtRisk,
      tone,
      verdict,
    };
  }, [
    data.podCapacityRps,
    data.trafficRps,
    handling.capacityMultiplier,
    handling.riskMultiplier,
    replicas,
    scenario.durationSeconds,
    scenario.id,
    timeoutMs,
    zones,
  ]);

  function reset() {
    setScenarioId(initialScenario.id);
    setReplicas(data.defaults.replicas);
    setZones(data.defaults.zones);
    setTimeoutMs(data.defaults.timeoutMs);
    setHandlingId(initialHandling.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure containment lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {data.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenario.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={scenarioIcons[candidate.id] ?? TriangleAlert}
                      accent="rose"
                      onClick={() => setScenarioId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Ready replicas"
                  value={replicas}
                  output={String(replicas)}
                  {...data.bounds.replicas}
                  accent="blue"
                  lowLabel="Single instance"
                  highLabel="More capacity"
                  onChange={setReplicas}
                />
                <LabRange
                  label="Failure domains"
                  value={zones}
                  output={`${zones} zone${zones === 1 ? '' : 's'}`}
                  {...data.bounds.zones}
                  accent="violet"
                  lowLabel="Co-located"
                  highLabel="Zone-spread"
                  onChange={setZones}
                />
                <LabRange
                  label="Dependency timeout"
                  value={timeoutMs}
                  output={`${timeoutMs} ms`}
                  {...data.bounds.timeoutMs}
                  accent="amber"
                  lowLabel="Fail fast"
                  highLabel="Hold concurrency"
                  onChange={setTimeoutMs}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Request handling
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.handling.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === handling.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.id === 'bounded-queue' ? Layers3 : Waypoints}
                      accent={candidate.id === 'bounded-queue' ? 'emerald' : 'amber'}
                      onClick={() => setHandlingId(candidate.id)}
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
                label="Ready after failure"
                value={`${result.remainingReplicas} / ${replicas}`}
                detail={`${result.lostReplicas} unavailable`}
                icon={Network}
                tone={result.remainingReplicas > 1 ? 'emerald' : result.remainingReplicas === 1 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Surviving capacity"
                value={`${formatCompact(result.capacityRps)} rps`}
                detail={`${result.capacityPercent.toFixed(0)}% of demand`}
                icon={Gauge}
                tone={result.capacityPercent >= 115 ? 'emerald' : result.capacityPercent >= 100 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Requests at risk"
                value={formatCompact(result.requestsAtRisk)}
                detail={`During ${Math.round(scenario.durationSeconds / 60 * 10) / 10} min incident`}
                icon={CircleOff}
                tone={result.requestsAtRisk === 0 ? 'emerald' : result.availabilityPercent >= 99 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Modeled availability"
                value={`${result.availabilityPercent.toFixed(2)}%`}
                detail="For this incident window"
                icon={Activity}
                tone={result.tone}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="grid gap-3 md:grid-cols-[0.9fr_1.4fr_0.9fr] md:items-stretch">
                <FailureNode
                  icon={Network}
                  eyebrow="Demand"
                  title={`${data.trafficRps.toLocaleString()} rps`}
                  detail={handling.label}
                  state="healthy"
                />
                <div className="rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Service fleet</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{replicas} replicas across {zones} zone{zones === 1 ? '' : 's'}</p>
                    </div>
                    <Layers3 aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-4 xl:grid-cols-8">
                    {Array.from({ length: replicas }, (_, index) => {
                      const failed = index >= result.remainingReplicas;
                      return (
                        <span
                          key={index}
                          title={failed ? `Replica ${index + 1}: unavailable` : `Replica ${index + 1}: ready`}
                          className={`flex aspect-square min-w-0 items-center justify-center rounded border text-xs font-semibold ${
                            failed
                              ? 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                              : 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                          }`}
                        >
                          {failed ? 'X' : index + 1}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {result.remainingReplicas} ready, {result.lostReplicas} unavailable. Placement is a resilience control only when replicas occupy independent domains.
                  </p>
                </div>
                <FailureNode
                  icon={scenario.id === 'slow-dependency' ? Timer : ShieldCheck}
                  eyebrow="Required dependency"
                  title={scenario.id === 'slow-dependency' ? `${scenario.dependencyLatencyMs} ms response` : 'Available'}
                  detail={scenario.id === 'slow-dependency' ? `${timeoutMs} ms caller timeout` : 'No injected dependency fault'}
                  state={scenario.id === 'slow-dependency' && result.dependencyFactor < 0.7 ? 'failed' : 'healthy'}
                />
              </div>
            </div>

            <div className={`rounded-lg border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
            }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FailureNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  state,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  state: 'healthy' | 'failed';
}) {
  return (
    <div className={`rounded-md border p-4 ${
      state === 'healthy'
        ? 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    }`}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="h-5 w-5" />
        <span className="text-[11px] font-semibold uppercase">{state === 'healthy' ? 'Available' : 'Degraded'}</span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase opacity-70">{eyebrow}</p>
      <p className="mt-1 text-base font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}
