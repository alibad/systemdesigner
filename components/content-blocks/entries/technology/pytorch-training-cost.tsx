'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Cpu,
  Gauge,
  Layers3,
  MemoryStick,
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
type Precision = {
  id: string;
  label: string;
  detail: string;
  weightBytes: number;
  gradientBytes: number;
  masterWeightBytes: number;
  throughputFactor: number;
};
type Strategy = {
  id: string;
  label: string;
  detail: string;
  stateShardFactor: 'one' | 'world-size';
  efficiency: number;
};
type Profile = {
  id: string;
  label: string;
  detail: string;
  modelParametersMillions: number;
  trainablePercent: number;
  sequenceLength: number;
  microBatch: number;
  accumulationSteps: number;
  gpuCount: number;
  gpuMemoryGiB: number;
  examplesMillions: number;
  epochs: number;
  activationGiBPerSampleAtBaseSequence: number;
  samplesPerSecondPerGpuAtBaseSequence: number;
};
type TrainingEnvelopeData = {
  title: string;
  description: string;
  assumptions: {
    baseSequenceLength: number;
    optimizerBytesPerTrainableParameter: number;
    workspaceGiB: number;
    usableMemoryPercent: number;
    checkpointActivationFactor: number;
  };
  bounds: {
    modelParametersMillions: Bound;
    trainablePercent: Bound;
    sequenceLength: Bound;
    microBatch: Bound;
    accumulationSteps: Bound;
    gpuCount: Bound;
    gpuMemoryGiB: Bound;
    hourlyGpuRate: Bound;
  };
  defaults: {
    profileId: string;
    precisionId: string;
    strategyId: string;
    hourlyGpuRate: number;
    activationCheckpointing: boolean;
  };
  precisions: Precision[];
  strategies: Strategy[];
  profiles: Profile[];
};

const BLOCK_ID = 'technology/pytorch-training-cost';
const DEFAULT_DATA_FILE = '/api/content/technology/pytorch/data/training-envelope.json';

function isTrainingEnvelopeData(value: unknown): value is TrainingEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrainingEnvelopeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.assumptions?.baseSequenceLength
      && candidate.bounds?.modelParametersMillions
      && candidate.defaults?.profileId
      && Array.isArray(candidate.precisions)
      && candidate.precisions.length > 0
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length > 0
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function duration(hours: number) {
  if (!Number.isFinite(hours)) return 'No finite estimate';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function PyTorchTrainingCost({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TrainingEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [precisionId, setPrecisionId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [modelParametersMillions, setModelParametersMillions] = useState(1300);
  const [trainablePercent, setTrainablePercent] = useState(100);
  const [sequenceLength, setSequenceLength] = useState(1024);
  const [microBatch, setMicroBatch] = useState(2);
  const [accumulationSteps, setAccumulationSteps] = useState(8);
  const [gpuCount, setGpuCount] = useState(4);
  const [gpuMemoryGiB, setGpuMemoryGiB] = useState(80);
  const [hourlyGpuRate, setHourlyGpuRate] = useState(4);
  const [activationCheckpointing, setActivationCheckpointing] = useState(true);

  function applyProfile(model: TrainingEnvelopeData, profile: Profile) {
    setProfileId(profile.id);
    setPrecisionId(model.defaults.precisionId);
    setStrategyId(model.defaults.strategyId);
    setModelParametersMillions(profile.modelParametersMillions);
    setTrainablePercent(profile.trainablePercent);
    setSequenceLength(profile.sequenceLength);
    setMicroBatch(profile.microBatch);
    setAccumulationSteps(profile.accumulationSteps);
    setGpuCount(profile.gpuCount);
    setGpuMemoryGiB(profile.gpuMemoryGiB);
    setHourlyGpuRate(model.defaults.hourlyGpuRate);
    setActivationCheckpointing(model.defaults.activationCheckpointing);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTrainingEnvelopeData(payload)) {
          throw new Error('The training-envelope model is incomplete.');
        }
        setData(payload);
        const profile = payload.profiles.find(
          (candidate) => candidate.id === payload.defaults.profileId,
        ) ?? payload.profiles[0];
        applyProfile(payload, profile);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load training data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const profile = data?.profiles.find((candidate) => candidate.id === profileId)
    ?? data?.profiles[0]
    ?? null;
  const precision = data?.precisions.find((candidate) => candidate.id === precisionId)
    ?? data?.precisions[0]
    ?? null;
  const strategy = data?.strategies.find((candidate) => candidate.id === strategyId)
    ?? data?.strategies[0]
    ?? null;

  const result = useMemo(() => {
    if (!data || !profile || !precision || !strategy) return null;

    const totalParameters = modelParametersMillions * 1_000_000;
    const trainableParameters = totalParameters * (trainablePercent / 100);
    const frozenParameters = totalParameters - trainableParameters;
    const trainableBytes = trainableParameters * (
      precision.weightBytes
      + precision.gradientBytes
      + precision.masterWeightBytes
      + data.assumptions.optimizerBytesPerTrainableParameter
    );
    const frozenBytes = frozenParameters * precision.weightBytes;
    const stateShard = strategy.stateShardFactor === 'world-size' ? gpuCount : 1;
    const modelStateGiB = (trainableBytes + frozenBytes) / stateShard / (1024 ** 3);
    const modelScale = modelParametersMillions / profile.modelParametersMillions;
    const sequenceFactor = sequenceLength / data.assumptions.baseSequenceLength;
    const checkpointFactor = activationCheckpointing
      ? data.assumptions.checkpointActivationFactor
      : 1;
    const activationGiB = profile.activationGiBPerSampleAtBaseSequence
      * modelScale
      * sequenceFactor
      * microBatch
      * checkpointFactor;
    const estimatedMemoryGiB = modelStateGiB + activationGiB + data.assumptions.workspaceGiB;
    const usableMemoryGiB = gpuMemoryGiB * (data.assumptions.usableMemoryPercent / 100);
    const memoryUtilizationPct = (estimatedMemoryGiB / gpuMemoryGiB) * 100;
    const globalBatch = microBatch * accumulationSteps * gpuCount;
    const throughput = profile.samplesPerSecondPerGpuAtBaseSequence
      * gpuCount
      * precision.throughputFactor
      * strategy.efficiency
      / modelScale
      * (data.assumptions.baseSequenceLength / sequenceLength)
      * (activationCheckpointing ? 0.78 : 1);
    const totalExamples = profile.examplesMillions * 1_000_000 * profile.epochs;
    const optimizerSteps = Math.ceil(totalExamples / globalBatch);
    const trainingHours = totalExamples / throughput / 3600;
    const estimatedCost = trainingHours * gpuCount * hourlyGpuRate;

    if (estimatedMemoryGiB > usableMemoryGiB) {
      return {
        activationGiB,
        estimatedCost,
        estimatedMemoryGiB,
        globalBatch,
        memoryUtilizationPct,
        modelStateGiB,
        optimizerSteps,
        throughput,
        trainingHours,
        tone: 'rose' as const,
        status: 'The run is outside the memory envelope',
        verdict: `Each rank needs about ${estimatedMemoryGiB.toFixed(1)} GiB against a ${usableMemoryGiB.toFixed(1)} GiB planning limit. Reduce the micro-batch, checkpoint activations, freeze parameters, or shard model state before buying more throughput.`,
      };
    }

    if (memoryUtilizationPct > data.assumptions.usableMemoryPercent - 5) {
      return {
        activationGiB,
        estimatedCost,
        estimatedMemoryGiB,
        globalBatch,
        memoryUtilizationPct,
        modelStateGiB,
        optimizerSteps,
        throughput,
        trainingHours,
        tone: 'amber' as const,
        status: 'The run fits with thin memory headroom',
        verdict: `The estimate leaves less than five percentage points below the planning limit. Profile a real step because allocator fragmentation, temporary kernels, and input variation can still trigger an out-of-memory failure.`,
      };
    }

    return {
      activationGiB,
      estimatedCost,
      estimatedMemoryGiB,
      globalBatch,
      memoryUtilizationPct,
      modelStateGiB,
      optimizerSteps,
      throughput,
      trainingHours,
      tone: 'emerald' as const,
      status: 'The modeled run fits the planning envelope',
      verdict: `The configuration keeps ${(usableMemoryGiB - estimatedMemoryGiB).toFixed(1)} GiB of planned headroom per rank. Benchmark representative batches before launch; this estimate is a capacity model, not a hardware promise.`,
    };
  }, [
    accumulationSteps,
    activationCheckpointing,
    data,
    gpuCount,
    gpuMemoryGiB,
    hourlyGpuRate,
    microBatch,
    modelParametersMillions,
    precision,
    profile,
    sequenceLength,
    strategy,
    trainablePercent,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Training envelope lab"
          title={data?.title ?? 'Can this PyTorch run fit and finish?'}
          description={data?.description ?? 'Loading the training model.'}
          icon={Gauge}
          accent="violet"
          onReset={data ? () => {
            const defaultProfile = data.profiles.find(
              (candidate) => candidate.id === data.defaults.profileId,
            ) ?? data.profiles[0];
            applyProfile(data, defaultProfile);
          } : undefined}
        />

        {!data || !profile || !precision || !strategy || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload profile
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === profileId}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Boxes}
                        accent="violet"
                        onClick={() => applyProfile(data, candidate)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Parallel strategy
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.strategies.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === strategyId}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Layers3}
                        accent="blue"
                        onClick={() => setStrategyId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Numeric precision
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {data.precisions.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === precisionId}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Cpu}
                        accent="cyan"
                        onClick={() => setPrecisionId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabChoice
                  selected={activationCheckpointing}
                  label="Activation checkpointing"
                  detail="Store fewer forward activations and recompute them during backward."
                  icon={MemoryStick}
                  accent="amber"
                  onClick={() => setActivationCheckpointing((value) => !value)}
                />

                <LabRange
                  label="Model parameters"
                  value={modelParametersMillions}
                  output={`${compact(modelParametersMillions * 1_000_000)}`}
                  {...data.bounds.modelParametersMillions}
                  accent="violet"
                  lowLabel="Compact"
                  highLabel="Large state"
                  onChange={setModelParametersMillions}
                />
                <LabRange
                  label="Trainable parameters"
                  value={trainablePercent}
                  output={`${trainablePercent}%`}
                  {...data.bounds.trainablePercent}
                  accent="emerald"
                  lowLabel="Adapter or frozen base"
                  highLabel="Full training"
                  onChange={setTrainablePercent}
                />
                <LabRange
                  label="Sequence length"
                  value={sequenceLength}
                  output={`${sequenceLength.toLocaleString()} tokens`}
                  {...data.bounds.sequenceLength}
                  accent="amber"
                  lowLabel="Short context"
                  highLabel="Long context"
                  onChange={setSequenceLength}
                />
                <LabRange
                  label="Micro-batch per rank"
                  value={microBatch}
                  output={`${microBatch}`}
                  {...data.bounds.microBatch}
                  accent="blue"
                  lowLabel="Less activation memory"
                  highLabel="More work per step"
                  onChange={setMicroBatch}
                />
                <LabRange
                  label="Accumulation steps"
                  value={accumulationSteps}
                  output={`${accumulationSteps}`}
                  {...data.bounds.accumulationSteps}
                  accent="cyan"
                  lowLabel="Frequent optimizer steps"
                  highLabel="Larger effective batch"
                  onChange={setAccumulationSteps}
                />
                <LabRange
                  label="GPU count"
                  value={gpuCount}
                  output={`${gpuCount}`}
                  {...data.bounds.gpuCount}
                  accent="violet"
                  lowLabel="Single rank"
                  highLabel="Distributed run"
                  onChange={setGpuCount}
                />
                <LabRange
                  label="Memory per GPU"
                  value={gpuMemoryGiB}
                  output={`${gpuMemoryGiB} GiB`}
                  {...data.bounds.gpuMemoryGiB}
                  accent="rose"
                  lowLabel="Small device"
                  highLabel="Large device"
                  onChange={setGpuMemoryGiB}
                />
                <LabRange
                  label="Hourly rate per GPU"
                  value={hourlyGpuRate}
                  output={`$${hourlyGpuRate.toFixed(2)}`}
                  {...data.bounds.hourlyGpuRate}
                  accent="emerald"
                  lowLabel="Owned or reserved"
                  highLabel="Premium capacity"
                  onChange={setHourlyGpuRate}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-5" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Per-rank memory"
                  value={`${result.estimatedMemoryGiB.toFixed(1)} GiB`}
                  detail={`${Math.round(result.memoryUtilizationPct)}% of physical memory`}
                  icon={MemoryStick}
                  tone={result.tone}
                />
                <LabMetric
                  label="Global batch"
                  value={result.globalBatch.toLocaleString()}
                  detail={`${microBatch} x ${accumulationSteps} x ${gpuCount}`}
                  icon={Layers3}
                  tone="blue"
                />
                <LabMetric
                  label="Modeled duration"
                  value={duration(result.trainingHours)}
                  detail={`${compact(result.optimizerSteps)} optimizer steps`}
                  icon={Clock3}
                  tone="cyan"
                />
                <LabMetric
                  label="Compute cost"
                  value={`$${compact(result.estimatedCost)}`}
                  detail={`${gpuCount} GPUs at $${hourlyGpuRate.toFixed(2)}/hour`}
                  icon={Coins}
                  tone="amber"
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Memory stack per rank</span>
                  <span className="text-right tabular-nums">
                    {result.estimatedMemoryGiB.toFixed(1)} / {gpuMemoryGiB} GiB
                  </span>
                </div>
                <div className="mt-4 flex h-5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" role="img" aria-label={`Estimated memory is ${Math.round(result.memoryUtilizationPct)} percent of GPU memory`}>
                  <div className="bg-violet-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, (result.modelStateGiB / gpuMemoryGiB) * 100)}%` }} />
                  <div className="bg-amber-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, (result.activationGiB / gpuMemoryGiB) * 100)}%` }} />
                  <div className="bg-cyan-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, (data.assumptions.workspaceGiB / gpuMemoryGiB) * 100)}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-3 dark:text-neutral-300">
                  <Legend tone="bg-violet-500" label="Model, gradients, optimizer" value={`${result.modelStateGiB.toFixed(1)} GiB`} />
                  <Legend tone="bg-amber-500" label="Saved activations" value={`${result.activationGiB.toFixed(1)} GiB`} />
                  <Legend tone="bg-cyan-500" label="Runtime workspace" value={`${data.assumptions.workspaceGiB.toFixed(1)} GiB`} />
                </div>
              </section>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <FlowNode icon={Boxes} eyebrow="Local work" title={`${microBatch} samples per rank`} detail={`${sequenceLength.toLocaleString()} tokens each`} tone="blue" />
                <FlowArrow />
                <FlowNode icon={Layers3} eyebrow="Accumulation" title={`${result.globalBatch} effective samples`} detail={`${accumulationSteps} micro-steps across ${gpuCount} ranks`} tone="violet" />
                <FlowArrow />
                <FlowNode icon={Gauge} eyebrow="Optimizer" title={`${result.throughput.toFixed(1)} samples/s`} detail={`${compact(result.optimizerSteps)} updates for the selected profile`} tone="emerald" />
              </div>

              <section className={`border-l-4 p-4 ${result.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="font-semibold">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">{result.verdict}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function Legend({ tone, label, value }: { tone: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${tone}`} />
      <span><strong className="block font-semibold text-neutral-900 dark:text-white">{value}</strong>{label}</span>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: typeof Gauge;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  };
  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{eyebrow}</div>
      <p className="mt-2 font-semibold tabular-nums">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return <div aria-hidden="true" className="hidden items-center text-neutral-300 md:flex dark:text-neutral-700">→</div>;
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-48 items-center justify-center text-center">
        <div>
          <Cpu aria-hidden="true" className="mx-auto h-7 w-7 text-violet-500" />
          <p className="mt-3 font-semibold">{error ? 'Training data could not load' : 'Loading training assumptions'}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{error ?? 'Preparing profiles, bounds, and memory assumptions.'}</p>
          {error ? <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:hover:bg-neutral-900">Retry</button> : null}
        </div>
      </div>
    </LearningLabBody>
  );
}
