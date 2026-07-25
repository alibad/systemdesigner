'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  LoaderCircle,
  Network,
  PauseCircle,
  ServerCog,
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

type FlowPreset = {
  id: string;
  label: string;
  detail: string;
  sourceBehavior: 'push' | 'pull';
  sourceLabel: string;
  countThreshold: number;
  sizeThresholdMiB: number;
  arrivalRate: number;
  processingRate: number;
  averageFlowFileKiB: number;
};

type FlowControlModel = {
  title: string;
  description: string;
  modelNote: string;
  defaultPresetId: string;
  bounds: {
    arrivalRate: Bounds;
    processingRate: Bounds;
    averageFlowFileKiB: Bounds;
  };
  presets: FlowPreset[];
};

const BLOCK_ID = 'technology/nifi-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/nifi/data/flow-control-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return (
    isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min < candidate.max
    && candidate.step > 0
  );
}

function isFlowControlModel(value: unknown): value is FlowControlModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FlowControlModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && candidate.defaultPresetId
      && isBounds(candidate.bounds?.arrivalRate)
      && isBounds(candidate.bounds?.processingRate)
      && isBounds(candidate.bounds?.averageFlowFileKiB)
      && Array.isArray(candidate.presets)
      && candidate.presets.length >= 3
      && candidate.presets.every((preset) => (
        typeof preset.id === 'string'
        && typeof preset.label === 'string'
        && typeof preset.detail === 'string'
        && (preset.sourceBehavior === 'push' || preset.sourceBehavior === 'pull')
        && typeof preset.sourceLabel === 'string'
        && isFiniteNumber(preset.countThreshold)
        && preset.countThreshold > 0
        && isFiniteNumber(preset.sizeThresholdMiB)
        && preset.sizeThresholdMiB > 0
        && isFiniteNumber(preset.arrivalRate)
        && isFiniteNumber(preset.processingRate)
        && isFiniteNumber(preset.averageFlowFileKiB)
        && preset.averageFlowFileKiB > 0
      ))
      && candidate.presets.some((preset) => preset.id === candidate.defaultPresetId),
  );
}

export default function NifiFlowControlLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<FlowControlModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFlowControlModel(payload)) {
          throw new Error('The NiFi flow-control model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the NiFi flow-control model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Queue pressure workbench"
            title="Trace back pressure through one connection"
            description="Loading documented queue thresholds and workload fixtures."
            icon={Gauge}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <FlowControlWorkbench model={model} />
      )}
    </div>
  );
}

function FlowControlWorkbench({ model }: { model: FlowControlModel }) {
  const defaultPreset = (
    model.presets.find((preset) => preset.id === model.defaultPresetId)
    ?? model.presets[0]
  );
  const [presetId, setPresetId] = useState(defaultPreset.id);
  const [arrivalRate, setArrivalRate] = useState(defaultPreset.arrivalRate);
  const [processingRate, setProcessingRate] = useState(defaultPreset.processingRate);
  const [averageFlowFileKiB, setAverageFlowFileKiB] = useState(
    defaultPreset.averageFlowFileKiB,
  );

  const preset = (
    model.presets.find((candidate) => candidate.id === presetId)
    ?? defaultPreset
  );

  const result = useMemo(() => {
    const sizeLimitedObjects = Math.max(
      1,
      Math.floor((preset.sizeThresholdMiB * 1024) / averageFlowFileKiB),
    );
    const effectiveLimit = Math.min(preset.countThreshold, sizeLimitedObjects);
    const limitingThreshold = sizeLimitedObjects < preset.countThreshold
      ? 'data size'
      : sizeLimitedObjects > preset.countThreshold
        ? 'object count'
        : 'both thresholds';
    const netGrowthPerSecond = Math.max(0, arrivalRate - processingRate);
    const timeToPressureSeconds = netGrowthPerSecond > 0
      ? effectiveLimit / netGrowthPerSecond
      : null;
    const queueAfterMinute = Math.min(effectiveLimit, netGrowthPerSecond * 60);
    const queuePercent = effectiveLimit > 0
      ? Math.min(100, (queueAfterMinute / effectiveLimit) * 100)
      : 0;

    return {
      effectiveLimit,
      incomingMiBPerSecond: (arrivalRate * averageFlowFileKiB) / 1024,
      limitingThreshold,
      netGrowthPerSecond,
      processingMiBPerSecond: (processingRate * averageFlowFileKiB) / 1024,
      queueAfterMinute,
      queuePercent,
      sizeLimitedObjects,
      timeToPressureSeconds,
    };
  }, [
    arrivalRate,
    averageFlowFileKiB,
    preset.countThreshold,
    preset.sizeThresholdMiB,
    processingRate,
  ]);

  function choosePreset(nextPreset: FlowPreset) {
    setPresetId(nextPreset.id);
    setArrivalRate(nextPreset.arrivalRate);
    setProcessingRate(nextPreset.processingRate);
    setAverageFlowFileKiB(nextPreset.averageFlowFileKiB);
  }

  function reset() {
    choosePreset(defaultPreset);
  }

  const isPressured = result.timeToPressureSeconds !== null;
  const pressureTime = result.timeToPressureSeconds === null
    ? null
    : formatDuration(result.timeToPressureSeconds);
  const sourceConsequence = preset.sourceBehavior === 'push'
    ? 'Once the connection is full, ListenHTTP cannot transfer more FlowFiles to its success relationship. Current component documentation says clients can receive HTTP 503 or have connections denied until capacity returns.'
    : 'Once the connection reaches its first threshold, upstream production into that connection pauses while the downstream processor drains queued FlowFiles.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Queue pressure workbench"
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
                1. Workload shape
              </legend>
              <div className="mt-3 grid gap-2">
                {model.presets.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === preset.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Network}
                    accent="cyan"
                    onClick={() => choosePreset(candidate)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Arrival rate"
                value={arrivalRate}
                output={`${arrivalRate.toLocaleString()} FlowFiles/s`}
                {...model.bounds.arrivalRate}
                lowLabel="100/s"
                highLabel="5,000/s"
                accent="blue"
                onChange={setArrivalRate}
              />
              <LabRange
                label="Downstream capacity"
                value={processingRate}
                output={`${processingRate.toLocaleString()} FlowFiles/s`}
                {...model.bounds.processingRate}
                lowLabel="100/s"
                highLabel="5,000/s"
                accent="emerald"
                onChange={setProcessingRate}
              />
              <LabRange
                label="Average FlowFile content"
                value={averageFlowFileKiB}
                output={formatKiB(averageFlowFileKiB)}
                {...model.bounds.averageFlowFileKiB}
                lowLabel="1 KiB"
                highLabel="16 MiB"
                accent="violet"
                onChange={setAverageFlowFileKiB}
              />
            </div>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              isPressured
                ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {isPressured ? (
                <PauseCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Predicted connection state
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {isPressured
                    ? `Back pressure in ${pressureTime}`
                    : 'Downstream capacity keeps the queue from growing'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {isPressured
                    ? `${result.limitingThreshold} reaches its configured limit first. ${sourceConsequence}`
                    : 'The steady processing rate is at least the arrival rate. Keep burst headroom and repository behavior in the production test even though this simple model remains balanced.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <PathNode
              icon={Network}
              eyebrow="Source"
              title={preset.sourceLabel}
              detail={`${arrivalRate.toLocaleString()} FlowFiles/s`}
              tone="blue"
            />
            <ArrowRight
              aria-hidden="true"
              className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0"
            />
            <PathNode
              icon={Database}
              eyebrow="Bounded connection"
              title={`${result.effectiveLimit.toLocaleString()} FlowFiles`}
              detail={`${preset.countThreshold.toLocaleString()} objects or ${preset.sizeThresholdMiB.toLocaleString()} MiB`}
              tone={isPressured ? 'amber' : 'violet'}
            />
            <ArrowRight
              aria-hidden="true"
              className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0"
            />
            <PathNode
              icon={ServerCog}
              eyebrow="Processor"
              title={`${processingRate.toLocaleString()} FlowFiles/s`}
              detail="Measured downstream capacity"
              tone="emerald"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <span>Queue after 60 seconds</span>
              <span className="tabular-nums">
                {Math.round(result.queueAfterMinute).toLocaleString()}
                {' / '}
                {result.effectiveLimit.toLocaleString()}
              </span>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
              role="progressbar"
              aria-label="Projected queue occupancy after 60 seconds"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(result.queuePercent)}
            >
              <div
                className={`h-full transition-[width] motion-reduce:transition-none ${
                  result.queuePercent >= 85
                    ? 'bg-amber-500'
                    : result.queuePercent > 0
                      ? 'bg-cyan-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${result.queuePercent}%` }}
              />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Queue growth"
              value={`${result.netGrowthPerSecond.toLocaleString()}/s`}
              detail="max(arrivals - processing, 0)"
              icon={Gauge}
              tone={result.netGrowthPerSecond > 0 ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="First limit"
              value={result.limitingThreshold}
              detail={`${result.sizeLimitedObjects.toLocaleString()} objects fit by size`}
              icon={CircleAlert}
              tone="violet"
            />
            <LabMetric
              label="Ingress volume"
              value={`${formatNumber(result.incomingMiBPerSecond)} MiB/s`}
              detail="Rate multiplied by average content size"
              icon={Network}
              tone="blue"
            />
            <LabMetric
              label="Drain capacity"
              value={`${formatNumber(result.processingMiBPerSecond)} MiB/s`}
              detail="A model input, not a NiFi claim"
              icon={ServerCog}
              tone="emerald"
            />
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PathNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: typeof Network;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'amber' | 'blue' | 'emerald' | 'violet';
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
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
    <LearningLabBody>
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
        {error ? (
          <>
            <CircleAlert aria-hidden="true" className="h-6 w-6 text-rose-500" />
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              Flow-control data could not be loaded
            </p>
            <p className="max-w-lg text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="h-6 w-6 animate-spin text-cyan-500 motion-reduce:animate-none"
            />
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Loading queue thresholds...
            </p>
          </>
        )}
      </div>
    </LearningLabBody>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 3600) return `${formatNumber(seconds / 60)} minutes`;
  return `${formatNumber(seconds / 3600)} hours`;
}

function formatKiB(value: number) {
  if (value < 1024) return `${value.toLocaleString()} KiB`;
  return `${formatNumber(value / 1024)} MiB`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}
