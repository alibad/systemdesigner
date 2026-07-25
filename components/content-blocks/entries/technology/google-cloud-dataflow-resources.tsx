'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CircleAlert,
  Gauge,
  KeyRound,
  LoaderCircle,
  ServerCog,
  ShieldCheck,
  TimerReset,
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
type CapacityScenario = {
  id: string;
  label: string;
  detail: string;
  inputRate: number;
  observedWorkerRate: number;
  activeWorkers: number;
  maxWorkers: number;
  parallelSlots: number;
};
type CapacityModel = {
  title: string;
  description: string;
  observationSeconds: number;
  bounds: {
    inputRate: Bound;
    observedWorkerRate: Bound;
    activeWorkers: Bound;
    maxWorkers: Bound;
    parallelSlots: Bound;
  };
  scenarios: CapacityScenario[];
};

const BLOCK_ID = 'technology/google-cloud-dataflow-resources';
const DEFAULT_DATA_FILE = '/api/content/technology/google-cloud-dataflow/data/streaming-capacity-envelope.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min < candidate.max
    && candidate.step > 0;
}

function isScenario(value: unknown): value is CapacityScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityScenario>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isFiniteNumber(candidate.inputRate)
      && isFiniteNumber(candidate.observedWorkerRate)
      && isFiniteNumber(candidate.activeWorkers)
      && isFiniteNumber(candidate.maxWorkers)
      && isFiniteNumber(candidate.parallelSlots),
  );
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && isFiniteNumber(candidate.observationSeconds)
      && candidate.observationSeconds > 0
      && candidate.bounds
      && isBound(candidate.bounds.inputRate)
      && isBound(candidate.bounds.observedWorkerRate)
      && isBound(candidate.bounds.activeWorkers)
      && isBound(candidate.bounds.maxWorkers)
      && isBound(candidate.bounds.parallelSlots)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isScenario),
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function GoogleCloudDataflowResources({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [inputRate, setInputRate] = useState(12000);
  const [observedWorkerRate, setObservedWorkerRate] = useState(1500);
  const [activeWorkers, setActiveWorkers] = useState(6);
  const [maxWorkers, setMaxWorkers] = useState(12);
  const [parallelSlots, setParallelSlots] = useState(20);

  function applyScenario(scenario: CapacityScenario) {
    setScenarioId(scenario.id);
    setInputRate(scenario.inputRate);
    setObservedWorkerRate(scenario.observedWorkerRate);
    setActiveWorkers(scenario.activeWorkers);
    setMaxWorkers(scenario.maxWorkers);
    setParallelSlots(scenario.parallelSlots);
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
        applyScenario(payload.scenarios[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    const currentWorkerLimit = Math.min(activeWorkers, maxWorkers, parallelSlots);
    const ceilingWorkerLimit = Math.min(maxWorkers, parallelSlots);
    const currentCapacity = currentWorkerLimit * observedWorkerRate;
    const ceilingCapacity = ceilingWorkerLimit * observedWorkerRate;
    const requiredWorkers = Math.ceil(inputRate / observedWorkerRate);
    const currentDelta = (currentCapacity - inputRate) * (data?.observationSeconds ?? 60);
    const ceilingDelta = (ceilingCapacity - inputRate) * (data?.observationSeconds ?? 60);
    const status = currentCapacity >= inputRate
      ? 'stable'
      : ceilingCapacity >= inputRate
        ? 'scale'
        : 'constrained';

    return {
      ceilingCapacity,
      ceilingDelta,
      ceilingWorkerLimit,
      currentCapacity,
      currentDelta,
      currentWorkerLimit,
      requiredWorkers,
      status,
    };
  }, [activeWorkers, data?.observationSeconds, inputRate, maxWorkers, observedWorkerRate, parallelSlots]);

  const selectedScenario = data?.scenarios.find((scenario) => scenario.id === scenarioId);
  const tone = result.status === 'stable' ? 'emerald' : result.status === 'scale' ? 'amber' : 'rose';
  const chartMax = Math.max(inputRate, result.currentCapacity, result.ceilingCapacity, 1);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Streaming pressure lab"
          title={data?.title ?? 'Can this pipeline keep up?'}
          description={data?.description ?? 'Loading the capacity assumptions.'}
          icon={Activity}
          accent="blue"
          onReset={data ? () => applyScenario(data.scenarios[0]) : undefined}
        />

        {!data ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload observation
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.scenarios.map((scenario) => (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === scenarioId}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={scenario.id === 'steady' ? ShieldCheck : scenario.id === 'arrival-spike' ? ArrowUpRight : KeyRound}
                        accent={scenario.id === 'steady' ? 'emerald' : scenario.id === 'arrival-spike' ? 'amber' : 'rose'}
                        onClick={() => applyScenario(scenario)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange label="Incoming records" value={inputRate} output={`${compact(inputRate)}/s`} {...data.bounds.inputRate} accent="rose" lowLabel="Lower arrival" highLabel="Higher arrival" onChange={(value) => { setScenarioId(''); setInputRate(value); }} />
                <LabRange label="Observed worker rate" value={observedWorkerRate} output={`${compact(observedWorkerRate)}/s`} {...data.bounds.observedWorkerRate} accent="cyan" lowLabel="Measured slower" highLabel="Measured faster" onChange={(value) => { setScenarioId(''); setObservedWorkerRate(value); }} />
                <LabRange label="Active workers" value={activeWorkers} output={`${activeWorkers}`} {...data.bounds.activeWorkers} accent="blue" lowLabel="Current floor" highLabel="Current pool" onChange={(value) => { setScenarioId(''); setActiveWorkers(value); setMaxWorkers((current) => Math.max(current, value)); }} />
                <LabRange label="Configured worker ceiling" value={maxWorkers} output={`${maxWorkers}`} {...data.bounds.maxWorkers} accent="violet" lowLabel="Bounded spend" highLabel="More headroom" onChange={(value) => { setScenarioId(''); setMaxWorkers(value); setActiveWorkers((current) => Math.min(current, value)); }} />
                <LabRange label="Usable parallel slots" value={parallelSlots} output={`${parallelSlots}`} {...data.bounds.parallelSlots} accent="amber" lowLabel="Hot-key limited" highLabel="Well distributed" onChange={(value) => { setScenarioId(''); setParallelSlots(value); }} />
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className={`rounded-md border p-5 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
                <div className="flex items-start gap-3">
                  {result.status === 'stable' ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : result.status === 'scale' ? <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">Capacity verdict</p>
                    <h4 className="mt-1 text-lg font-semibold">
                      {result.status === 'stable'
                        ? 'Current modeled capacity exceeds arrivals'
                        : result.status === 'scale'
                          ? 'Configured headroom can catch up after scaling'
                          : 'The modeled ceiling is below the arrival rate'}
                    </h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">
                      {result.status === 'stable'
                        ? `The envelope drains about ${compact(Math.max(0, result.currentDelta))} records during this ${data.observationSeconds}-second observation if the measured rate holds.`
                        : result.status === 'scale'
                          ? 'Autoscaling is not instantaneous. Backlog can grow while Dataflow gathers signals and adds useful workers, so alert on backlog time and verify the recovery duration.'
                          : 'Raising only the worker limit is insufficient when usable key parallelism is the tighter cap. Repartition hot keys, reduce work, or increase measured per-worker capacity.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Arrivals" value={`${compact(inputRate)}/s`} detail="Observed source rate" icon={Activity} tone="rose" />
                <LabMetric label="Current capacity" value={`${compact(result.currentCapacity)}/s`} detail={`${result.currentWorkerLimit} useful worker-equivalents`} icon={Gauge} tone={result.currentCapacity >= inputRate ? 'emerald' : 'amber'} />
                <LabMetric label="Ceiling capacity" value={`${compact(result.ceilingCapacity)}/s`} detail={`${result.ceilingWorkerLimit} useful worker-equivalents`} icon={ServerCog} tone={result.ceilingCapacity >= inputRate ? 'blue' : 'rose'} />
                <LabMetric label="Workers required" value={`${result.requiredWorkers}`} detail="At the supplied measured rate" icon={ArrowUpRight} tone={result.requiredWorkers <= result.ceilingWorkerLimit ? 'neutral' : 'rose'} />
              </div>

              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Rate comparison</p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">See which boundary is binding</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Bar widths share one records-per-second scale.</p>
                </div>
                <div className="mt-5 space-y-4">
                  <RateBar label="Incoming" value={inputRate} max={chartMax} color="bg-rose-500" />
                  <RateBar label="Current" value={result.currentCapacity} max={chartMax} color="bg-cyan-500" />
                  <RateBar label="At ceiling" value={result.ceilingCapacity} max={chartMax} color="bg-violet-500" />
                </div>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
                <p className="font-semibold">This is a planning envelope, not a Dataflow benchmark</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  Capacity equals useful worker-equivalents times a rate measured from your own representative load test. Dataflow also considers backlog, utilization, and available keys; connectors, shuffle, hot keys, quotas, and external services can lower the observed rate.
                </p>
                {selectedScenario ? <p className="mt-2 text-xs opacity-70">Profile: {selectedScenario.label}</p> : null}
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function RateBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = Math.max(2, (value / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-950 dark:text-white">{compact(value)}/s</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${color} motion-safe:transition-[width]`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6" role={error ? 'alert' : 'status'}>
      <div className="max-w-md text-center">
        {error ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" /> : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-blue-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{error ? 'Capacity model unavailable' : 'Loading capacity model'}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{error ?? 'Preparing the streaming envelope.'}</p>
        {error ? <button type="button" onClick={onRetry} className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100">Retry</button> : null}
      </div>
    </div>
  );
}
