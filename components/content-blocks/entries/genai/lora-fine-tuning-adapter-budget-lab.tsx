'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircuitBoard,
  Gauge,
  Layers3,
  MemoryStick,
  Sigma,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Dimension = 'hidden' | 'intermediate';

type Projection = {
  label: string;
  countPerLayer: number;
  inputDimension: Dimension;
  outputDimension: Dimension;
};

type ModelFixture = {
  id: string;
  label: string;
  detail: string;
  parameterBillions: number;
  hiddenSize: number;
  intermediateSize: number;
  layers: number;
  activationGiBPer1024TokensPerExample: number;
};

type TargetFixture = {
  id: string;
  label: string;
  detail: string;
  projections: Projection[];
};

type PrecisionFixture = {
  id: string;
  label: string;
  detail: string;
  effectiveBitsPerWeight: number;
};

type BudgetData = {
  blockId: string;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    modelId: string;
    targetId: string;
    precisionId: string;
    rank: number;
    alpha: number;
    sequenceLength: number;
    microBatch: number;
    gpuMemoryGiB: number;
  };
  trainingStateBytesPerParameter: number;
  safeUtilizationPct: number;
  models: ModelFixture[];
  targets: TargetFixture[];
  precisions: PrecisionFixture[];
  rankOptions: number[];
  alphaOptions: number[];
  sequenceOptions: number[];
  microBatchOptions: number[];
  gpuMemoryOptionsGiB: number[];
};

const BLOCK_ID = 'genai/lora-fine-tuning-adapter-budget-lab';
const DEFAULT_DATA_FILE = '/api/content/genai/lora-fine-tuning/data/adapter-budget-model.json';
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDimension(value: unknown): value is Dimension {
  return value === 'hidden' || value === 'intermediate';
}

function isBudgetData(value: unknown): value is BudgetData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<BudgetData>;

  return Boolean(
    data.blockId === BLOCK_ID
      && data.title
      && data.description
      && data.modelNote
      && data.defaults
      && isFiniteNumber(data.trainingStateBytesPerParameter)
      && isFiniteNumber(data.safeUtilizationPct)
      && Array.isArray(data.models)
      && data.models.length >= 3
      && data.models.every((model) => (
        typeof model.id === 'string'
          && isFiniteNumber(model.parameterBillions)
          && isFiniteNumber(model.hiddenSize)
          && isFiniteNumber(model.intermediateSize)
          && isFiniteNumber(model.layers)
          && isFiniteNumber(model.activationGiBPer1024TokensPerExample)
      ))
      && Array.isArray(data.targets)
      && data.targets.length >= 3
      && data.targets.every((target) => (
        typeof target.id === 'string'
          && Array.isArray(target.projections)
          && target.projections.length > 0
          && target.projections.every((projection) => (
            isFiniteNumber(projection.countPerLayer)
              && isDimension(projection.inputDimension)
              && isDimension(projection.outputDimension)
          ))
      ))
      && Array.isArray(data.precisions)
      && data.precisions.length >= 3
      && data.precisions.every((precision) => (
        typeof precision.id === 'string'
          && isFiniteNumber(precision.effectiveBitsPerWeight)
      ))
      && Array.isArray(data.rankOptions)
      && data.rankOptions.every(isFiniteNumber)
      && Array.isArray(data.alphaOptions)
      && data.alphaOptions.every(isFiniteNumber)
      && Array.isArray(data.sequenceOptions)
      && data.sequenceOptions.every(isFiniteNumber)
      && Array.isArray(data.microBatchOptions)
      && data.microBatchOptions.every(isFiniteNumber)
      && Array.isArray(data.gpuMemoryOptionsGiB)
      && data.gpuMemoryOptionsGiB.every(isFiniteNumber),
  );
}

export default function LoraFineTuningAdapterBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modelId, setModelId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [precisionId, setPrecisionId] = useState('');
  const [rank, setRank] = useState(16);
  const [alpha, setAlpha] = useState(32);
  const [sequenceLength, setSequenceLength] = useState(2048);
  const [microBatch, setMicroBatch] = useState(2);
  const [gpuMemoryGiB, setGpuMemoryGiB] = useState(24);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isBudgetData(payload)) throw new Error('Adapter budget data is incomplete.');

        setData(payload);
        setModelId(payload.defaults.modelId);
        setTargetId(payload.defaults.targetId);
        setPrecisionId(payload.defaults.precisionId);
        setRank(payload.defaults.rank);
        setAlpha(payload.defaults.alpha);
        setSequenceLength(payload.defaults.sequenceLength);
        setMicroBatch(payload.defaults.microBatch);
        setGpuMemoryGiB(payload.defaults.gpuMemoryGiB);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the adapter budget.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const model = data?.models.find((item) => item.id === modelId) ?? data?.models[0];
  const target = data?.targets.find((item) => item.id === targetId) ?? data?.targets[0];
  const precision = data?.precisions.find((item) => item.id === precisionId)
    ?? data?.precisions[0];

  const result = useMemo(() => {
    if (!data || !model || !target || !precision) return null;

    const dimension = (name: Dimension) => (
      name === 'hidden' ? model.hiddenSize : model.intermediateSize
    );
    const parameterCount = model.layers * target.projections.reduce((total, projection) => (
      total
        + projection.countPerLayer
        * rank
        * (dimension(projection.inputDimension) + dimension(projection.outputDimension))
    ), 0);
    const baseGiB = (
      model.parameterBillions
      * 1_000_000_000
      * precision.effectiveBitsPerWeight
      / 8
      / GIB
    );
    const trainingStateGiB = parameterCount * data.trainingStateBytesPerParameter / GIB;
    const activationGiB = (
      model.activationGiBPer1024TokensPerExample
      * (sequenceLength / 1024)
      * microBatch
    );
    const estimatedFloorGiB = baseGiB + trainingStateGiB + activationGiB;
    const safeBudgetGiB = gpuMemoryGiB * data.safeUtilizationPct / 100;
    const headroomGiB = safeBudgetGiB - estimatedFloorGiB;
    const adapterMiB = parameterCount * 2 / MIB;
    const trainableSharePct = parameterCount / (model.parameterBillions * 1_000_000_000) * 100;
    const updateScale = alpha / rank;
    const fits = headroomGiB >= 0;
    const pressure = estimatedFloorGiB / safeBudgetGiB * 100;
    const recommendation = !fits
      ? precision.id !== 'nf4'
        ? 'The planning floor exceeds the safe budget. Quantizing the frozen base is the largest available lever before changing the learning problem.'
        : sequenceLength > 2048 || microBatch > 1
          ? 'The 4-bit base is not enough for this request shape. Reduce microbatch or context, then use gradient accumulation or checkpointing and profile again.'
          : model.id === 'large-70b'
            ? 'This single-device fixture still does not fit. Use a larger device or a measured distributed loading and training strategy.'
            : 'The configuration needs a profiler-backed memory reduction; the simplified model omits temporary peaks.'
      : rank >= 64 && target.id === 'all-linear'
        ? 'The run fits, but broad targeting and high rank create a large adaptation surface. Prove the extra capacity on held-out slices.'
        : precision.id === 'nf4'
          ? 'The run fits this teaching budget because the frozen base is quantized. Keep a higher-precision baseline for numerical and quality comparison.'
          : 'The planning floor fits with headroom. Confirm peak allocated and reserved memory on the real kernel, context distribution, and hardware.';

    return {
      activationGiB,
      adapterMiB,
      baseGiB,
      estimatedFloorGiB,
      fits,
      headroomGiB,
      parameterCount,
      pressure,
      recommendation,
      safeBudgetGiB,
      trainableSharePct,
      trainingStateGiB,
      updateScale,
    };
  }, [alpha, data, gpuMemoryGiB, microBatch, model, precision, rank, sequenceLength, target]);

  function reset() {
    if (!data) return;
    setModelId(data.defaults.modelId);
    setTargetId(data.defaults.targetId);
    setPrecisionId(data.defaults.precisionId);
    setRank(data.defaults.rank);
    setAlpha(data.defaults.alpha);
    setSequenceLength(data.defaults.sequenceLength);
    setMicroBatch(data.defaults.microBatch);
    setGpuMemoryGiB(data.defaults.gpuMemoryGiB);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Adapter capacity lab"
          title={data?.title ?? 'Expose the real adapter and memory budget'}
          description={data?.description ?? 'Loading model shapes and planning assumptions...'}
          icon={Sigma}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !model || !target || !precision || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Architecture fixture
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.models.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === model.id}
                        label={item.label}
                        detail={item.detail}
                        icon={CircuitBoard}
                        accent={item.id === 'small-1b' ? 'cyan' : item.id === 'mid-8b' ? 'violet' : 'amber'}
                        onClick={() => setModelId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Adaptation surface
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.targets.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === target.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Layers3}
                        accent={item.id === 'qv-only' ? 'cyan' : item.id === 'attention-all' ? 'blue' : 'amber'}
                        onClick={() => setTargetId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Low-rank width"
                  value={rank}
                  output={`r = ${rank}`}
                  min={Math.min(...data.rankOptions)}
                  max={Math.max(...data.rankOptions)}
                  step={4}
                  accent="violet"
                  lowLabel="narrow delta"
                  highLabel="more capacity"
                  onChange={setRank}
                />

                <LabRange
                  label="LoRA alpha"
                  value={alpha}
                  output={`alpha = ${alpha}`}
                  min={Math.min(...data.alphaOptions)}
                  max={Math.max(...data.alphaOptions)}
                  step={4}
                  accent="blue"
                  lowLabel="smaller scale"
                  highLabel="larger scale"
                  onChange={setAlpha}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Frozen-base precision
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.precisions.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === precision.id}
                        label={item.label}
                        detail={item.detail}
                        icon={MemoryStick}
                        accent={item.id === 'bf16' ? 'blue' : item.id === 'int8' ? 'emerald' : 'violet'}
                        onClick={() => setPrecisionId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <SelectControl
                  label="Sequence length"
                  value={sequenceLength}
                  options={data.sequenceOptions}
                  format={(value) => `${value.toLocaleString()} tokens`}
                  onChange={setSequenceLength}
                />
                <SelectControl
                  label="Microbatch per device"
                  value={microBatch}
                  options={data.microBatchOptions}
                  format={(value) => `${value} example${value === 1 ? '' : 's'}`}
                  onChange={setMicroBatch}
                />
                <SelectControl
                  label="GPU memory"
                  value={gpuMemoryGiB}
                  options={data.gpuMemoryOptionsGiB}
                  format={(value) => `${value} GiB`}
                  onChange={setGpuMemoryGiB}
                />
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Trainable delta"
                value={result.parameterCount.toLocaleString()}
                detail={`${result.trainableSharePct.toFixed(3)}% of the fixture parameters`}
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Adapter weights"
                value={`${result.adapterMiB.toFixed(1)} MiB`}
                detail="BF16 checkpoint estimate; metadata excluded"
                icon={MemoryStick}
                tone="blue"
              />
              <LabMetric
                label="Update scale"
                value={result.updateScale.toFixed(2)}
                detail="original alpha divided by rank"
                icon={Gauge}
                tone="amber"
              />
              <LabMetric
                label="Planning result"
                value={result.fits ? 'Fits floor' : 'Over budget'}
                detail={`${Math.abs(result.headroomGiB).toFixed(1)} GiB ${result.fits ? 'headroom' : 'over safe budget'}`}
                icon={result.fits ? CheckCircle2 : AlertTriangle}
                tone={result.fits ? 'emerald' : 'rose'}
              />
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Modeled device memory
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.estimatedFloorGiB.toFixed(1)} GiB floor against {result.safeBudgetGiB.toFixed(1)} GiB safe budget
                  </h4>
                </div>
                <span className="text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                  Safe budget = {data.safeUtilizationPct}% of device memory
                </span>
              </div>

              <div className="mt-4 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full ${result.fits ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, result.pressure)}%` }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-5 space-y-4">
                <MemoryRow
                  label="Frozen base weights"
                  valueGiB={result.baseGiB}
                  totalGiB={result.estimatedFloorGiB}
                  tone="bg-blue-500"
                  detail={`${precision.effectiveBitsPerWeight} effective bits per parameter`}
                />
                <MemoryRow
                  label="Adapter training state"
                  valueGiB={result.trainingStateGiB}
                  totalGiB={result.estimatedFloorGiB}
                  tone="bg-violet-500"
                  detail={`${data.trainingStateBytesPerParameter} bytes per trainable parameter`}
                />
                <MemoryRow
                  label="Illustrative activations"
                  valueGiB={result.activationGiB}
                  totalGiB={result.estimatedFloorGiB}
                  tone="bg-amber-500"
                  detail={`${sequenceLength.toLocaleString()} tokens x ${microBatch} microbatch`}
                />
              </div>
            </div>

            <div className={`mt-6 rounded-md border p-5 ${
              result.fits
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {result.fits
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
                  <p className="mt-1 text-sm font-semibold leading-6">{result.recommendation}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Projection arithmetic
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {target.projections.map((projection) => (
                  <div
                    key={projection.label}
                    className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {projection.label}
                    </p>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {projection.countPerLayer} x {rank} x (
                      {projection.inputDimension === 'hidden' ? model.hiddenSize.toLocaleString() : model.intermediateSize.toLocaleString()}
                      {' + '}
                      {projection.outputDimension === 'hidden' ? model.hiddenSize.toLocaleString() : model.intermediateSize.toLocaleString()}
                      ) per layer
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {data.modelNote}
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>{format(option)}</option>
        ))}
      </select>
    </label>
  );
}

function MemoryRow({
  label,
  valueGiB,
  totalGiB,
  tone,
  detail,
}: {
  label: string;
  valueGiB: number;
  totalGiB: number;
  tone: string;
  detail: string;
}) {
  const percent = totalGiB > 0 ? valueGiB / totalGiB * 100 : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
          {valueGiB.toFixed(2)} GiB
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(1, percent)}%` }} />
      </div>
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
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {error ? 'The adapter budget could not be loaded.' : 'Loading adapter budget...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
