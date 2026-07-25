'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  MemoryStick,
  Microchip,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/flashattention-memory-optimization-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/flashattention-memory-optimization/data/attention-memory-budget.json';
const GIB = 1024 ** 3;

type ImplementationId = 'materialized' | 'tiled';

type DType = {
  id: string;
  label: string;
  detail: string;
  bytes: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  mode: 'training' | 'serving';
  layers: number;
  residentActivationLayers: number;
  queryHeads: number;
  kvHeads: number;
  headDimension: number;
  modelStateGb: number;
  runtimeReserveGb: number;
  nonAttentionBytesPerTokenPerLayer: number;
  storesKvCache: boolean;
};

type Accelerator = {
  id: string;
  label: string;
  detail: string;
  memoryGb: number;
  systemReserveFraction: number;
};

type MemoryData = {
  kind: 'attention-memory-budget';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  assumptions: {
    materializedScoreCopies: number;
    flashStatsBytesPerQuery: number;
  };
  controls: {
    sequence: { min: number; max: number; step: number };
    batch: { min: number; max: number; step: number };
  };
  defaults: {
    workloadId: string;
    acceleratorId: string;
    dtypeId: string;
    implementationId: ImplementationId;
    sequenceLength: number;
    batchSize: number;
  };
  dtypes: DType[];
  workloads: Workload[];
  accelerators: Accelerator[];
  note: string;
};

type BudgetPart = {
  id: string;
  label: string;
  bytes: number;
  color: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMemoryData(value: unknown): value is MemoryData {
  if (
    !isRecord(value) ||
    value.kind !== 'attention-memory-budget' ||
    value.blockId !== BLOCK_ID ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.note !== 'string' ||
    !isRecord(value.assumptions) ||
    !isFiniteNumber(value.assumptions.materializedScoreCopies) ||
    !isFiniteNumber(value.assumptions.flashStatsBytesPerQuery) ||
    !isRecord(value.controls) ||
    !isRecord(value.controls.sequence) ||
    !isRecord(value.controls.batch) ||
    !isRecord(value.defaults) ||
    typeof value.defaults.workloadId !== 'string' ||
    typeof value.defaults.acceleratorId !== 'string' ||
    typeof value.defaults.dtypeId !== 'string' ||
    (value.defaults.implementationId !== 'materialized' &&
      value.defaults.implementationId !== 'tiled') ||
    !isFiniteNumber(value.defaults.sequenceLength) ||
    !isFiniteNumber(value.defaults.batchSize) ||
    !Array.isArray(value.dtypes) ||
    !Array.isArray(value.workloads) ||
    !Array.isArray(value.accelerators)
  ) {
    return false;
  }

  const dtypesValid = value.dtypes.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.detail === 'string' &&
      isFiniteNumber(item.bytes) &&
      item.bytes > 0,
  );
  const workloadsValid = value.workloads.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.detail === 'string' &&
      (item.mode === 'training' || item.mode === 'serving') &&
      isFiniteNumber(item.layers) &&
      isFiniteNumber(item.residentActivationLayers) &&
      isFiniteNumber(item.queryHeads) &&
      isFiniteNumber(item.kvHeads) &&
      isFiniteNumber(item.headDimension) &&
      isFiniteNumber(item.modelStateGb) &&
      isFiniteNumber(item.runtimeReserveGb) &&
      isFiniteNumber(item.nonAttentionBytesPerTokenPerLayer) &&
      typeof item.storesKvCache === 'boolean',
  );
  const acceleratorsValid = value.accelerators.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.detail === 'string' &&
      isFiniteNumber(item.memoryGb) &&
      isFiniteNumber(item.systemReserveFraction),
  );

  return (
    dtypesValid &&
    workloadsValid &&
    acceleratorsValid &&
    value.dtypes.length >= 2 &&
    value.workloads.length >= 2 &&
    value.accelerators.length >= 2
  );
}

function formatBytes(bytes: number) {
  const gib = bytes / GIB;
  if (gib >= 1) return `${gib.toFixed(gib >= 10 ? 1 : 2)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes < 100 * 1024 ** 2 ? 1 : 0)} MiB`;
}

function LabState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[420px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : 'status'}
        aria-label={error ? 'Attention memory lab unavailable' : 'Loading attention memory lab'}
      >
        {error ? (
          <>
            <p className="font-semibold">Attention memory lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function FlashAttentionMemoryOptimizationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMemoryData(payload)) {
          throw new Error('The memory-planning data does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the memory lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabState error={error} />;
  if (!data) return <LabState />;
  return <MemoryBudgetLab data={data} />;
}

function MemoryBudgetLab({ data }: { data: MemoryData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [acceleratorId, setAcceleratorId] = useState(data.defaults.acceleratorId);
  const [dtypeId, setDtypeId] = useState(data.defaults.dtypeId);
  const [implementationId, setImplementationId] = useState<ImplementationId>(
    data.defaults.implementationId,
  );
  const [sequenceLength, setSequenceLength] = useState(data.defaults.sequenceLength);
  const [batchSize, setBatchSize] = useState(data.defaults.batchSize);

  const model = useMemo(() => {
    const workload =
      data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const accelerator =
      data.accelerators.find((item) => item.id === acceleratorId) ??
      data.accelerators[0];
    const dtype = data.dtypes.find((item) => item.id === dtypeId) ?? data.dtypes[0];
    if (!workload || !accelerator || !dtype) return null;

    const rows = batchSize * workload.queryHeads * sequenceLength;
    const qkvOutputPerLayer =
      batchSize *
      sequenceLength *
      workload.headDimension *
      (2 * workload.queryHeads + 2 * workload.kvHeads) *
      dtype.bytes;
    const materializedAuxPerLayer =
      rows *
      sequenceLength *
      dtype.bytes *
      data.assumptions.materializedScoreCopies;
    const tiledAuxPerLayer = rows * data.assumptions.flashStatsBytesPerQuery;
    const commonAttentionBytes =
      qkvOutputPerLayer * workload.residentActivationLayers;
    const materializedAttentionBytes =
      materializedAuxPerLayer * workload.residentActivationLayers;
    const tiledAttentionBytes = tiledAuxPerLayer * workload.residentActivationLayers;
    const nonAttentionBytes =
      batchSize *
      sequenceLength *
      workload.nonAttentionBytesPerTokenPerLayer *
      workload.residentActivationLayers;
    const kvCacheBytes = workload.storesKvCache
      ? 2 *
        batchSize *
        sequenceLength *
        workload.kvHeads *
        workload.headDimension *
        workload.layers *
        dtype.bytes
      : 0;
    const modelStateBytes = workload.modelStateGb * GIB;
    const runtimeReserveBytes = workload.runtimeReserveGb * GIB;
    const baseBytes =
      modelStateBytes +
      runtimeReserveBytes +
      kvCacheBytes +
      nonAttentionBytes +
      commonAttentionBytes;
    const materializedTotalBytes = baseBytes + materializedAttentionBytes;
    const tiledTotalBytes = baseBytes + tiledAttentionBytes;
    const selectedAuxBytes =
      implementationId === 'materialized'
        ? materializedAttentionBytes
        : tiledAttentionBytes;
    const selectedTotalBytes =
      implementationId === 'materialized'
        ? materializedTotalBytes
        : tiledTotalBytes;
    const usableBytes =
      accelerator.memoryGb * (1 - accelerator.systemReserveFraction) * GIB;
    const fits = selectedTotalBytes <= usableBytes;
    const marginBytes = usableBytes - selectedTotalBytes;
    const savedBytes = materializedTotalBytes - tiledTotalBytes;
    const parts: BudgetPart[] = [
      {
        id: 'model',
        label: workload.mode === 'training' ? 'Sharded model and optimizer state' : 'Weights',
        bytes: modelStateBytes,
        color: 'bg-neutral-700 dark:bg-neutral-300',
      },
      {
        id: 'runtime',
        label: 'Runtime and non-attention reserve',
        bytes: runtimeReserveBytes + nonAttentionBytes,
        color: 'bg-blue-500',
      },
      {
        id: 'kv',
        label: 'KV cache',
        bytes: kvCacheBytes,
        color: 'bg-violet-500',
      },
      {
        id: 'qkv',
        label: 'Q, K, V, and output activations',
        bytes: commonAttentionBytes,
        color: 'bg-emerald-500',
      },
      {
        id: 'attention',
        label:
          implementationId === 'materialized'
            ? 'Score and probability matrices'
            : 'Tiled normalization state',
        bytes: selectedAuxBytes,
        color: implementationId === 'materialized' ? 'bg-rose-500' : 'bg-cyan-500',
      },
    ].filter((part) => part.bytes > 0);

    return {
      accelerator,
      dtype,
      fits,
      marginBytes,
      materializedAttentionBytes,
      materializedTotalBytes,
      parts,
      savedBytes,
      selectedTotalBytes,
      tiledAttentionBytes,
      tiledTotalBytes,
      usableBytes,
      workload,
    };
  }, [
    acceleratorId,
    batchSize,
    data,
    dtypeId,
    implementationId,
    sequenceLength,
    workloadId,
  ]);

  if (!model) {
    return <LabState error="The selected workload, accelerator, or dtype is missing." />;
  }

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setAcceleratorId(data.defaults.acceleratorId);
    setDtypeId(data.defaults.dtypeId);
    setImplementationId(data.defaults.implementationId);
    setSequenceLength(data.defaults.sequenceLength);
    setBatchSize(data.defaults.batchSize);
  };
  const OutcomeIcon = model.fits ? CheckCircle2 : AlertTriangle;
  const outcomeTone = model.fits
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="End-to-end memory lab"
          title={data.title}
          description={data.description}
          icon={MemoryStick}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload envelope
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workload.id === model.workload.id}
                      label={workload.label}
                      icon={workload.mode === 'training' ? Layers3 : Database}
                      accent="blue"
                      onClick={() => setWorkloadId(workload.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 rounded-md border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs leading-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100">
                  {model.workload.detail}
                </p>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Numeric and device budget
                </legend>
                <p className="mt-3 text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Activation dtype
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {data.dtypes.map((dtype) => (
                    <LabChoice
                      key={dtype.id}
                      selected={dtype.id === model.dtype.id}
                      label={dtype.label}
                      icon={Boxes}
                      accent="violet"
                      onClick={() => setDtypeId(dtype.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 rounded-md border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs leading-5 text-violet-950 dark:border-violet-900 dark:bg-violet-950/25 dark:text-violet-100">
                  {model.dtype.detail}
                </p>

                <p className="mt-4 text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Device budget
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {data.accelerators.map((accelerator) => (
                    <LabChoice
                      key={accelerator.id}
                      selected={accelerator.id === model.accelerator.id}
                      label={accelerator.label}
                      icon={Microchip}
                      accent="emerald"
                      onClick={() => setAcceleratorId(accelerator.id)}
                    />
                  ))}
                </div>
                <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs leading-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-100">
                  {model.accelerator.detail}
                </p>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Attention execution
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <LabChoice
                    selected={implementationId === 'materialized'}
                    label="Materialized attention"
                    icon={Layers3}
                    accent="rose"
                    onClick={() => setImplementationId('materialized')}
                  />
                  <LabChoice
                    selected={implementationId === 'tiled'}
                    label="IO-aware tiled attention"
                    icon={Gauge}
                    accent="cyan"
                    onClick={() => setImplementationId('tiled')}
                  />
                </div>
                <p className="mt-2 rounded-md border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs leading-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/25 dark:text-cyan-100">
                  {implementationId === 'materialized'
                    ? 'Budget two N by N tensors per resident attention layer.'
                    : 'Keep row statistics and recompute tiles instead of storing the full score surface.'}
                </p>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <section className="mb-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Tune the request envelope
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Sequence length expands the score surface quadratically; microbatch scales the modeled rows linearly.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <LabRange
                  label="Sequence length (N)"
                  value={sequenceLength}
                  output={sequenceLength.toLocaleString()}
                  min={data.controls.sequence.min}
                  max={data.controls.sequence.max}
                  step={data.controls.sequence.step}
                  accent="cyan"
                  lowLabel="Short context"
                  highLabel="Quadratic score surface"
                  onChange={setSequenceLength}
                />
                <LabRange
                  label="Microbatch (B)"
                  value={batchSize}
                  output={`${batchSize}`}
                  min={data.controls.batch.min}
                  max={data.controls.batch.max}
                  step={data.controls.batch.step}
                  accent="violet"
                  lowLabel="One sequence"
                  highLabel="More rows at once"
                  onChange={setBatchSize}
                />
              </div>
            </section>

            <div className={`rounded-md border p-4 ${outcomeTone}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {model.fits ? 'Fits the planning budget' : 'Exceeds the planning budget'}
                  </p>
                  <p className="mt-1 text-sm leading-6">
                    {formatBytes(model.selectedTotalBytes)} selected against{' '}
                    {formatBytes(model.usableBytes)} usable.{' '}
                    {model.fits
                      ? `${formatBytes(model.marginBytes)} remains for unmodeled peaks.`
                      : `${formatBytes(Math.abs(model.marginBytes))} must be removed before this run.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric
                label="Materialized total"
                value={formatBytes(model.materializedTotalBytes)}
                detail="Includes two score-sized tensors per resident attention layer"
                icon={Layers3}
                tone="rose"
              />
              <LabMetric
                label="Tiled total"
                value={formatBytes(model.tiledTotalBytes)}
                detail="Same exact attention math with compact row statistics"
                icon={Gauge}
                tone="cyan"
              />
              <LabMetric
                label="Budget difference"
                value={formatBytes(model.savedBytes)}
                detail="Modeled memory avoided, not a promised throughput gain"
                icon={MemoryStick}
                tone="emerald"
              />
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Selected budget composition
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                    B={batchSize}, Hq={model.workload.queryHeads}, Hkv=
                    {model.workload.kvHeads}, N={sequenceLength.toLocaleString()}, d=
                    {model.workload.headDimension}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {formatBytes(model.selectedTotalBytes)}
                </span>
              </div>

              <div className="mt-4 flex h-8 w-full overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                {model.parts.map((part) => (
                  <div
                    key={part.id}
                    className={`${part.color} min-w-px transition-[width] duration-300 motion-reduce:transition-none`}
                    style={{
                      width: `${Math.max(
                        0.4,
                        (part.bytes / Math.max(model.selectedTotalBytes, model.usableBytes)) *
                          100,
                      )}%`,
                    }}
                    title={`${part.label}: ${formatBytes(part.bytes)}`}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                {model.parts.map((part) => (
                  <div key={part.id} className="flex min-w-0 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${part.color}`}
                    />
                    <div className="min-w-0 text-xs">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {part.label}
                      </p>
                      <p className="mt-0.5 tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatBytes(part.bytes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="N by N intermediates"
                value={formatBytes(model.materializedAttentionBytes)}
                detail="Quadratic in sequence length and linear in batch and query heads"
                icon={Layers3}
                tone="rose"
              />
              <LabMetric
                label="Tiled row state"
                value={formatBytes(model.tiledAttentionBytes)}
                detail="Linear row statistics in this planning model"
                icon={Gauge}
                tone="cyan"
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.note}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
