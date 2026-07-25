'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Network,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/go-concurrency-capacity-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/go-concurrency/data/concurrency-capacity-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  cpuFraction: number;
  activeStackKb: number;
  guidance: string;
};

type CapacityModel = {
  kind: 'go-concurrency-capacity';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  logicalCpuCount: number;
  safeCpuUtilization: number;
  defaults: {
    profileId: string;
    arrivalRatePerSecond: number;
    serviceTimeMs: number;
    workerLimit: number;
  };
  bounds: {
    arrivalRatePerSecond: Bound;
    serviceTimeMs: Bound;
    workerLimit: Bound;
  };
  profiles: WorkloadProfile[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  return isRecord(value)
    && isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isProfile(value: unknown): value is WorkloadProfile {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.cpuFraction)
    && value.cpuFraction > 0
    && value.cpuFraction <= 1
    && isFiniteNumber(value.activeStackKb)
    && value.activeStackKb > 0
    && typeof value.guidance === 'string';
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.bounds)) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'go-concurrency-capacity'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.logicalCpuCount)
    && value.logicalCpuCount > 0
    && isFiniteNumber(value.safeCpuUtilization)
    && value.safeCpuUtilization > 0
    && value.safeCpuUtilization <= 1
    && typeof defaults.profileId === 'string'
    && isFiniteNumber(defaults.arrivalRatePerSecond)
    && isFiniteNumber(defaults.serviceTimeMs)
    && isFiniteNumber(defaults.workerLimit)
    && isBound(bounds.arrivalRatePerSecond)
    && isBound(bounds.serviceTimeMs)
    && isBound(bounds.workerLimit)
    && Array.isArray(value.profiles)
    && value.profiles.length === 3
    && value.profiles.every(isProfile)
    && value.profiles.some((profile) => profile.id === defaults.profileId)
    && typeof value.notice === 'string';
}

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export default function GoConcurrencyCapacityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) {
          throw new Error('The concurrency capacity model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the concurrency capacity model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <CapacityWorkbench model={model} />;
}

function CapacityWorkbench({ model }: { model: CapacityModel }) {
  const [profileId, setProfileId] = useState(model.defaults.profileId);
  const [arrivalRate, setArrivalRate] = useState(
    model.defaults.arrivalRatePerSecond,
  );
  const [serviceTimeMs, setServiceTimeMs] = useState(model.defaults.serviceTimeMs);
  const [workerLimit, setWorkerLimit] = useState(model.defaults.workerLimit);

  const profile =
    model.profiles.find((item) => item.id === profileId) ?? model.profiles[0];

  const result = useMemo(() => {
    const inFlightDemand = arrivalRate * (serviceTimeMs / 1000);
    const workerCapacity = workerLimit * (1000 / serviceTimeMs);
    const safeCpuCores = model.logicalCpuCount * model.safeCpuUtilization;
    const cpuDemandCores = inFlightDemand * profile.cpuFraction;
    const cpuCapacity = safeCpuCores * 1000 / (serviceTimeMs * profile.cpuFraction);
    const effectiveCapacity = Math.min(workerCapacity, cpuCapacity);
    const queueGrowthPerSecond = Math.max(0, arrivalRate - effectiveCapacity);
    const workerPressure = arrivalRate / workerCapacity;
    const cpuPressure = cpuDemandCores / safeCpuCores;
    const stackReserveMb = workerLimit * profile.activeStackKb / 1024;

    return {
      bottleneck: cpuCapacity < workerCapacity ? 'CPU' : 'worker limit',
      cpuDemandCores,
      cpuPressure,
      effectiveCapacity,
      inFlightDemand,
      queueGrowthPerSecond,
      stackReserveMb,
      workerPressure,
    };
  }, [
    arrivalRate,
    model.logicalCpuCount,
    model.safeCpuUtilization,
    profile,
    serviceTimeMs,
    workerLimit,
  ]);

  const state = result.queueGrowthPerSecond > 0
    ? 'overloaded'
    : Math.max(result.cpuPressure, result.workerPressure) > 0.8
      ? 'thin'
      : 'healthy';

  const stateTone = state === 'healthy' ? 'emerald' : state === 'thin' ? 'amber' : 'rose';
  const StateIcon = state === 'healthy' ? CheckCircle2 : TriangleAlert;
  const stateTitle = state === 'healthy'
    ? 'The bounded pool absorbs the modeled demand with headroom'
    : state === 'thin'
      ? 'The pool is stable, but a latency tail or burst can create a queue'
      : `Demand exceeds the ${result.bottleneck.toLowerCase()} capacity`;
  const stateDetail = state === 'overloaded'
    ? `The queue grows by about ${integerFormatter.format(result.queueGrowthPerSecond)} jobs each second. Bound admission or add measured capacity before increasing the buffer.`
    : `Average useful in-flight work is ${Math.ceil(result.inFlightDemand)} jobs. The worker limit is ${workerLimit}, and the safe CPU envelope is ${(model.logicalCpuCount * model.safeCpuUtilization).toFixed(1)} cores.`;

  function reset() {
    setProfileId(model.defaults.profileId);
    setArrivalRate(model.defaults.arrivalRatePerSecond);
    setServiceTimeMs(model.defaults.serviceTimeMs);
    setWorkerLimit(model.defaults.workerLimit);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Concurrency budget lab"
          title={model.title}
          description={model.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the work shape
                </legend>
                <div className="mt-3 space-y-2">
                  {model.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'cpu-bound' ? Cpu : Network}
                      accent={item.id === 'cpu-bound' ? 'amber' : 'cyan'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Arrival rate"
                value={arrivalRate}
                output={`${integerFormatter.format(arrivalRate)}/s`}
                min={model.bounds.arrivalRatePerSecond.min}
                max={model.bounds.arrivalRatePerSecond.max}
                step={model.bounds.arrivalRatePerSecond.step}
                accent="blue"
                lowLabel="Steady"
                highLabel="Burst"
                onChange={setArrivalRate}
              />

              <LabRange
                label="Average service time"
                value={serviceTimeMs}
                output={`${serviceTimeMs}ms`}
                min={model.bounds.serviceTimeMs.min}
                max={model.bounds.serviceTimeMs.max}
                step={model.bounds.serviceTimeMs.step}
                accent="violet"
                lowLabel="Fast"
                highLabel="Slow"
                onChange={setServiceTimeMs}
              />

              <LabRange
                label="Worker limit"
                value={workerLimit}
                output={`${workerLimit}`}
                min={model.bounds.workerLimit.min}
                max={model.bounds.workerLimit.max}
                step={model.bounds.workerLimit.step}
                accent="emerald"
                lowLabel="Tight bound"
                highLabel="More in flight"
                onChange={setWorkerLimit}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                state === 'healthy'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : state === 'thin'
                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Capacity verdict
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{stateTitle}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{stateDetail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Useful concurrency"
                value={integerFormatter.format(Math.ceil(result.inFlightDemand))}
                detail="Arrival rate × service time"
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Capacity ceiling"
                value={`${integerFormatter.format(result.effectiveCapacity)}/s`}
                detail={`Limited by ${result.bottleneck.toLowerCase()}`}
                icon={Activity}
                tone={stateTone}
              />
              <LabMetric
                label="Safe CPU pressure"
                value={`${Math.round(result.cpuPressure * 100)}%`}
                detail={`${result.cpuDemandCores.toFixed(1)} modeled cores`}
                icon={Cpu}
                tone={result.cpuPressure > 1 ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Active stack reserve"
                value={`${result.stackReserveMb.toFixed(1)}MB`}
                detail="Illustrative active stacks only"
                icon={MemoryStick}
                tone="violet"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <PressureBar
                label="Worker occupancy"
                value={result.workerPressure}
                detail={`${Math.round(result.workerPressure * 100)}% of bounded worker throughput`}
              />
              <PressureBar
                label="CPU envelope"
                value={result.cpuPressure}
                detail={`${Math.round(result.cpuPressure * 100)}% of the safe CPU budget`}
              />
              <PressureBar
                label="Queue growth"
                value={result.queueGrowthPerSecond > 0 ? 1 : 0}
                detail={
                  result.queueGrowthPerSecond > 0
                    ? `+${integerFormatter.format(result.queueGrowthPerSecond)} jobs/s`
                    : 'No sustained growth in this model'
                }
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <strong className="text-neutral-950 dark:text-white">
                Design guidance:
              </strong>{' '}
              {profile.guidance}
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PressureBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const percent = Math.min(100, Math.max(0, value * 100));
  const stressed = value > 1;
  const thin = !stressed && value > 0.8;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-950 dark:text-white">
          {label}
        </span>
        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
            stressed ? 'bg-rose-500' : thin ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
            Capacity lab unavailable
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading the concurrency capacity model…
        </div>
      )}
    </div>
  );
}
