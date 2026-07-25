'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  HardDrive,
  MemoryStick,
  RefreshCw,
  ScanLine,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };

type DeploymentData = {
  title: string;
  description: string;
  resolutions: number[];
  valueFormats: Array<{
    id: string;
    label: string;
    detail: string;
    bytesPerValue: number;
  }>;
  defaults: {
    resolution: number;
    batchSize: number;
    valueFormatId: string;
    stagingCopies: number;
    deviceBudgetMiB: number;
    profiledReserveMiB: number;
    measuredBatchLatencyMs: number;
    batchWaitMs: number;
    nonModelLatencyMs: number;
    arrivalFps: number;
    deadlineMs: number;
  };
  bounds: Record<
    | 'batchSize'
    | 'stagingCopies'
    | 'deviceBudgetMiB'
    | 'profiledReserveMiB'
    | 'measuredBatchLatencyMs'
    | 'batchWaitMs'
    | 'arrivalFps'
    | 'deadlineMs',
    Bounds
  >;
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/yolo/data/deployment-envelope.json';
const MEBIBYTE = 1024 * 1024;

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<Bounds>;
  return typeof bounds.min === 'number'
    && typeof bounds.max === 'number'
    && typeof bounds.step === 'number';
}

function isDeploymentData(value: unknown): value is DeploymentData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<DeploymentData>;
  const boundKeys = [
    'batchSize',
    'stagingCopies',
    'deviceBudgetMiB',
    'profiledReserveMiB',
    'measuredBatchLatencyMs',
    'batchWaitMs',
    'arrivalFps',
    'deadlineMs',
  ] as const;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && Array.isArray(data.resolutions)
      && data.resolutions.length > 0
      && data.resolutions.every((item) => typeof item === 'number' && item > 0)
      && Array.isArray(data.valueFormats)
      && data.valueFormats.length > 0
      && data.valueFormats.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.bytesPerValue === 'number'
        && item.bytesPerValue > 0
      ))
      && data.defaults
      && typeof data.defaults.resolution === 'number'
      && typeof data.defaults.batchSize === 'number'
      && typeof data.defaults.valueFormatId === 'string'
      && typeof data.defaults.stagingCopies === 'number'
      && typeof data.defaults.deviceBudgetMiB === 'number'
      && typeof data.defaults.profiledReserveMiB === 'number'
      && typeof data.defaults.measuredBatchLatencyMs === 'number'
      && typeof data.defaults.batchWaitMs === 'number'
      && typeof data.defaults.nonModelLatencyMs === 'number'
      && typeof data.defaults.arrivalFps === 'number'
      && typeof data.defaults.deadlineMs === 'number'
      && data.bounds
      && boundKeys.every((key) => isBounds(data.bounds?.[key])),
  );
}

export default function YoloDeploymentEnvelopeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DeploymentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isDeploymentData(payload)) {
          throw new Error('The deployment model is incomplete.');
        }
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the deployment model.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return <DeploymentLab data={data} />;
}

function DeploymentLab({ data }: { data: DeploymentData }) {
  const [resolution, setResolution] = useState(data.defaults.resolution);
  const [batchSize, setBatchSize] = useState(data.defaults.batchSize);
  const [valueFormatId, setValueFormatId] = useState(data.defaults.valueFormatId);
  const [stagingCopies, setStagingCopies] = useState(data.defaults.stagingCopies);
  const [deviceBudgetMiB, setDeviceBudgetMiB] = useState(
    data.defaults.deviceBudgetMiB,
  );
  const [profiledReserveMiB, setProfiledReserveMiB] = useState(
    data.defaults.profiledReserveMiB,
  );
  const [measuredBatchLatencyMs, setMeasuredBatchLatencyMs] = useState(
    data.defaults.measuredBatchLatencyMs,
  );
  const [batchWaitMs, setBatchWaitMs] = useState(data.defaults.batchWaitMs);
  const [arrivalFps, setArrivalFps] = useState(data.defaults.arrivalFps);
  const [deadlineMs, setDeadlineMs] = useState(data.defaults.deadlineMs);
  const [profileConfirmed, setProfileConfirmed] = useState(true);

  const valueFormat = data.valueFormats.find(
    (format) => format.id === valueFormatId,
  ) ?? data.valueFormats[0];

  const model = useMemo(() => {
    const valuesPerImage = resolution * resolution * 3;
    const inputMiBPerImage = (valuesPerImage * valueFormat.bytesPerValue) / MEBIBYTE;
    const stagedInputMiB = inputMiBPerImage * batchSize * stagingCopies;
    const accountedMemoryMiB = profiledReserveMiB + stagedInputMiB;
    const memoryHeadroomMiB = deviceBudgetMiB - accountedMemoryMiB;
    const maximumThroughputFps = (batchSize * 1000) / measuredBatchLatencyMs;
    const utilization = arrivalFps / maximumThroughputFps;
    const latencyEnvelopeMs = data.defaults.nonModelLatencyMs
      + batchWaitMs
      + measuredBatchLatencyMs;
    const deadlineMarginMs = deadlineMs - latencyEnvelopeMs;
    const releaseReady = profileConfirmed
      && memoryHeadroomMiB >= 0
      && utilization < 1
      && deadlineMarginMs >= 0;

    return {
      accountedMemoryMiB,
      deadlineMarginMs,
      inputMiBPerImage,
      latencyEnvelopeMs,
      maximumThroughputFps,
      memoryHeadroomMiB,
      releaseReady,
      stagedInputMiB,
      utilization,
      valuesPerBatch: valuesPerImage * batchSize,
    };
  }, [
    arrivalFps,
    batchSize,
    batchWaitMs,
    data.defaults.nonModelLatencyMs,
    deadlineMs,
    deviceBudgetMiB,
    measuredBatchLatencyMs,
    profiledReserveMiB,
    profileConfirmed,
    resolution,
    stagingCopies,
    valueFormat.bytesPerValue,
  ]);

  function markProfileStale(next: () => void) {
    next();
    setProfileConfirmed(false);
  }

  function reset() {
    setResolution(data.defaults.resolution);
    setBatchSize(data.defaults.batchSize);
    setValueFormatId(data.defaults.valueFormatId);
    setStagingCopies(data.defaults.stagingCopies);
    setDeviceBudgetMiB(data.defaults.deviceBudgetMiB);
    setProfiledReserveMiB(data.defaults.profiledReserveMiB);
    setMeasuredBatchLatencyMs(data.defaults.measuredBatchLatencyMs);
    setBatchWaitMs(data.defaults.batchWaitMs);
    setArrivalFps(data.defaults.arrivalFps);
    setDeadlineMs(data.defaults.deadlineMs);
    setProfileConfirmed(true);
  }

  const releaseReason = !profileConfirmed
    ? 'Profile the selected shape and batch on the target runtime.'
    : model.memoryHeadroomMiB < 0
      ? 'The accounted memory exceeds the device budget.'
      : model.utilization >= 1
        ? 'Arrival rate meets or exceeds the modeled service capacity.'
        : model.deadlineMarginMs < 0
          ? 'The conservative latency envelope exceeds the deadline.'
          : 'All four modeled release gates pass.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Deployment envelope lab"
        title={data.title}
        description={data.description}
        icon={ServerCog}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Tensor contract
              </legend>
              <label className="mt-3 block">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Square input target
                </span>
                <select
                  value={resolution}
                  onChange={(event) => markProfileStale(
                    () => setResolution(Number(event.target.value)),
                  )}
                  className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.resolutions.map((item) => (
                    <option key={item} value={item}>
                      {item} x {item}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4">
                <LabRange
                  label="Batch size"
                  value={batchSize}
                  output={`${batchSize} images`}
                  {...data.bounds.batchSize}
                  accent="violet"
                  lowLabel="latency-oriented"
                  highLabel="throughput candidate"
                  onChange={(value) => markProfileStale(() => setBatchSize(value))}
                />
              </div>
              <div className="mt-4 space-y-2">
                {data.valueFormats.map((format) => (
                  <LabChoice
                    key={format.id}
                    selected={format.id === valueFormat.id}
                    label={format.label}
                    detail={format.detail}
                    icon={HardDrive}
                    accent="blue"
                    onClick={() => markProfileStale(() => setValueFormatId(format.id))}
                  />
                ))}
              </div>
              <div className="mt-4">
                <LabRange
                  label="Input staging copies"
                  value={stagingCopies}
                  output={`${stagingCopies}`}
                  {...data.bounds.stagingCopies}
                  accent="blue"
                  lowLabel="one resident buffer"
                  highLabel="multiple pipeline buffers"
                  onChange={setStagingCopies}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Measured target profile
              </legend>
              <LabRange
                label="Device memory budget"
                value={deviceBudgetMiB}
                output={`${deviceBudgetMiB} MiB`}
                {...data.bounds.deviceBudgetMiB}
                accent="emerald"
                onChange={setDeviceBudgetMiB}
              />
              <LabRange
                label="Profiled non-input reserve"
                value={profiledReserveMiB}
                output={`${profiledReserveMiB} MiB`}
                {...data.bounds.profiledReserveMiB}
                accent="emerald"
                onChange={setProfiledReserveMiB}
              />
              <LabRange
                label="Observed batch latency"
                value={measuredBatchLatencyMs}
                output={`${measuredBatchLatencyMs} ms`}
                {...data.bounds.measuredBatchLatencyMs}
                accent="amber"
                onChange={setMeasuredBatchLatencyMs}
              />
              <button
                type="button"
                aria-pressed={profileConfirmed}
                onClick={() => setProfileConfirmed(true)}
                className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  profileConfirmed
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                }`}
              >
                {profileConfirmed ? (
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <ScanLine aria-hidden="true" className="h-4 w-4" />
                )}
                {profileConfirmed
                  ? 'Profile matches this shape'
                  : 'Mark measurements updated'}
              </button>
            </fieldset>

            <fieldset className="space-y-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Traffic and deadline
              </legend>
              <LabRange
                label="Arrival rate"
                value={arrivalFps}
                output={`${arrivalFps} frames/s`}
                {...data.bounds.arrivalFps}
                accent="cyan"
                onChange={setArrivalFps}
              />
              <LabRange
                label="Maximum batch wait"
                value={batchWaitMs}
                output={`${batchWaitMs} ms`}
                {...data.bounds.batchWaitMs}
                accent="amber"
                onChange={setBatchWaitMs}
              />
              <LabRange
                label="End-to-end deadline"
                value={deadlineMs}
                output={`${deadlineMs} ms`}
                {...data.bounds.deadlineMs}
                accent="rose"
                onChange={setDeadlineMs}
              />
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Staged inputs"
              value={`${model.stagedInputMiB.toFixed(1)} MiB`}
              detail={`${model.inputMiBPerImage.toFixed(2)} MiB per image x ${batchSize} x ${stagingCopies} copies.`}
              icon={MemoryStick}
              tone={model.memoryHeadroomMiB >= 0 ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Memory headroom"
              value={`${model.memoryHeadroomMiB.toFixed(1)} MiB`}
              detail="Budget minus profiled reserve and exact input buffers."
              icon={HardDrive}
              tone={model.memoryHeadroomMiB >= 0 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Capacity ceiling"
              value={`${model.maximumThroughputFps.toFixed(1)} fps`}
              detail={`${batchSize} x 1000 / ${measuredBatchLatencyMs} ms; full batches assumed.`}
              icon={Gauge}
              tone={model.utilization < 1 ? 'cyan' : 'rose'}
            />
            <LabMetric
              label="Latency envelope"
              value={`${model.latencyEnvelopeMs.toFixed(0)} ms`}
              detail={`${data.defaults.nonModelLatencyMs} ms non-model + ${batchWaitMs} ms wait + ${measuredBatchLatencyMs} ms model.`}
              icon={Clock3}
              tone={model.deadlineMarginMs >= 0 ? 'amber' : 'rose'}
            />
          </div>

          <section
            className={`rounded-md border p-5 ${
              model.releaseReady
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {model.releaseReady ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
              ) : (
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {model.releaseReady ? 'Modeled release gates pass' : 'Hold this deployment'}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {releaseReason}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Inspect the arithmetic
            </h4>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Formula
                label="Values per batch"
                value={model.valuesPerBatch.toLocaleString()}
                detail={`${batchSize} x 3 x ${resolution} x ${resolution}`}
              />
              <Formula
                label="Accounted memory"
                value={`${model.accountedMemoryMiB.toFixed(1)} MiB`}
                detail={`${profiledReserveMiB} MiB reserve + ${model.stagedInputMiB.toFixed(1)} MiB inputs`}
              />
              <Formula
                label="Modeled utilization"
                value={`${(model.utilization * 100).toFixed(1)}%`}
                detail={`${arrivalFps} fps / ${model.maximumThroughputFps.toFixed(1)} fps ceiling`}
              />
              <Formula
                label="Deadline margin"
                value={`${model.deadlineMarginMs.toFixed(0)} ms`}
                detail={`${deadlineMs} ms deadline - ${model.latencyEnvelopeMs.toFixed(0)} ms envelope`}
              />
            </dl>
          </section>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <div className="flex items-start gap-3">
              <Activity aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This is an envelope, not a benchmark. The reserve and batch latency must
                come from the chosen model, export, runtime, hardware, and workload.
                The capacity equation assumes full batches; real queueing, copies,
                warm-up, contention, and post-processing still require end-to-end load
                tests.
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function Formula({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </dd>
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
      <div className="flex items-start gap-3">
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            {error ? 'Deployment model unavailable' : 'Loading deployment model'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Reading the co-located deployment assumptions.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
