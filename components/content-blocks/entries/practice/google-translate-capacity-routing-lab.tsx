'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Globe2,
  Languages,
  MessageCircle,
  Server,
  ShieldAlert,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type WorkloadId = 'conversation' | 'web' | 'document';
type ModelId = 'compact' | 'adapter' | 'quality';

type Workload = {
  id: WorkloadId;
  label: string;
  detail: string;
  budgetMs: number;
  averageTokens: number;
  qualityFloor: number;
  icon: LucideIcon;
};

type ModelTier = {
  id: ModelId;
  label: string;
  detail: string;
  baseMs: number;
  requestsPerSecond: number;
  quality: number;
  cost: number;
  icon: LucideIcon;
};

const workloads: Workload[] = [
  {
    id: 'conversation',
    label: 'Live conversation',
    detail: 'Short phrases on a tight turn-taking deadline',
    budgetMs: 100,
    averageTokens: 12,
    qualityFloor: 74,
    icon: MessageCircle,
  },
  {
    id: 'web',
    label: 'Web text',
    detail: 'Interactive snippets with balanced quality and speed',
    budgetMs: 200,
    averageTokens: 60,
    qualityFloor: 82,
    icon: Globe2,
  },
  {
    id: 'document',
    label: 'Documents',
    detail: 'Longer jobs where quality can use an asynchronous path',
    budgetMs: 1200,
    averageTokens: 640,
    qualityFloor: 90,
    icon: BookOpen,
  },
];

const modelTiers: ModelTier[] = [
  {
    id: 'compact',
    label: 'Compact multilingual',
    detail: 'Quantized default for short interactive requests',
    baseMs: 48,
    requestsPerSecond: 42,
    quality: 76,
    cost: 1,
    icon: Zap,
  },
  {
    id: 'adapter',
    label: 'Language adapter',
    detail: 'Shared model plus a pair or domain adapter',
    baseMs: 92,
    requestsPerSecond: 28,
    quality: 88,
    cost: 1.8,
    icon: Languages,
  },
  {
    id: 'quality',
    label: 'Quality ensemble',
    detail: 'Reranking and richer decoding for patient workloads',
    baseMs: 230,
    requestsPerSecond: 10,
    quality: 95,
    cost: 4.6,
    icon: Sparkles,
  },
];

const compactNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
};

export default function GoogleTranslateCapacityRoutingLab() {
  const [workloadId, setWorkloadId] = useState<WorkloadId>('web');
  const [modelId, setModelId] = useState<ModelId>('adapter');
  const [dailyMillions, setDailyMillions] = useState(1000);
  const [peakMultiplier, setPeakMultiplier] = useState(3);
  const [cacheHitRate, setCacheHitRate] = useState(30);
  const [fleetSize, setFleetSize] = useState(1200);
  const [zoneFailure, setZoneFailure] = useState(false);

  const result = useMemo(() => {
    const workload = workloads.find((item) => item.id === workloadId) ?? workloads[1];
    const model = modelTiers.find((item) => item.id === modelId) ?? modelTiers[1];
    const averageQps = (dailyMillions * 1_000_000) / 86_400;
    const peakQps = averageQps * peakMultiplier;
    const inferenceQps = peakQps * (1 - cacheHitRate / 100);
    const liveFleet = Math.max(1, Math.floor(fleetSize * (zoneFailure ? 2 / 3 : 1)));
    const capacityQps = liveFleet * model.requestsPerSecond;
    const utilization = inferenceQps / capacityQps;
    const queueMs = utilization <= 0.65
      ? 8
      : Math.min(1400, 8 + Math.pow((utilization - 0.65) * 8, 2) * 58);
    const modeledP95 = Math.round(22 + model.baseMs + workload.averageTokens * 0.18 + queueMs);
    const requiredFleet = Math.ceil(
      inferenceQps / (model.requestsPerSecond * 0.7 * (zoneFailure ? 2 / 3 : 1)),
    );
    const latencyPass = modeledP95 <= workload.budgetMs;
    const qualityPass = model.quality >= workload.qualityFloor;
    const capacityPass = fleetSize >= requiredFleet;
    const healthy = latencyPass && qualityPass && capacityPass;

    let decision = 'Serve this route';
    let explanation = 'The selected tier clears the workload quality floor, deadline, and failure-aware capacity target.';
    if (!capacityPass) {
      decision = 'Add capacity or shed work';
      explanation = `Provision at least ${requiredFleet.toLocaleString()} accelerators at 70% target utilization for this traffic shape.`;
    } else if (!latencyPass) {
      decision = workload.id === 'document' ? 'Move the job to an asynchronous queue' : 'Choose a faster tier or reduce work';
      explanation = 'Throughput is available, but queueing and inference consume more than the user-visible deadline.';
    } else if (!qualityPass) {
      decision = 'Route to a stronger quality tier';
      explanation = 'Fast output is not a success when the selected model misses the workload quality floor.';
    }

    return {
      workload,
      model,
      averageQps,
      peakQps,
      inferenceQps,
      liveFleet,
      capacityQps,
      utilization,
      modeledP95,
      requiredFleet,
      latencyPass,
      qualityPass,
      capacityPass,
      healthy,
      decision,
      explanation,
    };
  }, [cacheHitRate, dailyMillions, fleetSize, modelId, peakMultiplier, workloadId, zoneFailure]);

  const reset = () => {
    setWorkloadId('web');
    setModelId('adapter');
    setDailyMillions(1000);
    setPeakMultiplier(3);
    setCacheHitRate(30);
    setFleetSize(1200);
    setZoneFailure(false);
  };

  const controls = (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold text-neutral-950 dark:text-white">1. Choose the workload</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {workloads.map((item) => (
            <LabChoice
              key={item.id}
              selected={item.id === workloadId}
              label={item.label}
              detail={`${item.detail}. ${item.budgetMs} ms / quality ${item.qualityFloor}+.`}
              icon={item.icon}
              accent="cyan"
              onClick={() => setWorkloadId(item.id)}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-5">
        <LabRange label="Daily requests" value={dailyMillions} output={`${dailyMillions}M`} min={200} max={1500} step={100} accent="cyan" onChange={setDailyMillions} />
        <LabRange label="Peak factor" value={peakMultiplier} output={`${peakMultiplier}x`} min={2} max={5} accent="amber" onChange={setPeakMultiplier} />
        <LabRange label="Cache hit rate" value={cacheHitRate} output={`${cacheHitRate}%`} min={0} max={80} step={5} accent="emerald" onChange={setCacheHitRate} />
        <LabRange label="Accelerators" value={fleetSize} output={fleetSize.toLocaleString()} min={300} max={2400} step={100} accent="violet" onChange={setFleetSize} />
      </div>

      <button
        type="button"
        aria-pressed={zoneFailure}
        onClick={() => setZoneFailure((value) => !value)}
        className={zoneFailure
          ? 'flex w-full items-center justify-between gap-3 rounded-md border border-rose-500 bg-rose-50 p-3 text-left text-rose-950 ring-1 ring-rose-500 dark:border-rose-300 dark:bg-rose-950 dark:text-rose-50 dark:ring-rose-300'
          : 'flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-700 hover:border-rose-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-rose-500'}
      >
        <span><span className="block text-sm font-semibold">Lose one serving zone</span><span className="mt-1 block text-xs opacity-75">Remove one third of live capacity.</span></span>
        <ShieldAlert aria-hidden="true" className="size-5 shrink-0" />
      </button>
    </div>
  );

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and routing lab"
        title="Fit the right model inside the request deadline"
        description="Change the workload, demand, cache, model tier, and fleet. A route is healthy only when quality, latency, and failure headroom pass together."
        icon={Languages}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody controls={controls}>
          <fieldset>
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">2. Route to a model tier</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {modelTiers.map((model) => {
                const Icon = model.icon;
                const selected = model.id === modelId;
                return (
                  <LabChoice key={model.id} selected={selected} label={model.label} detail={`${model.detail}. ${model.cost.toFixed(1)}x relative cost.`} icon={Icon} accent="violet" onClick={() => setModelId(model.id)} />
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric icon={Gauge} label="Peak inference" value={`${compactNumber(result.inferenceQps)}/s`} tone="cyan" />
            <LabMetric icon={Clock3} label="Modeled p95" value={`${result.modeledP95} ms`} tone={result.latencyPass ? 'emerald' : 'rose'} />
            <LabMetric icon={Sparkles} label="Quality index" value={`${result.model.quality}/100`} tone={result.qualityPass ? 'violet' : 'amber'} />
            <LabMetric icon={Server} label="Needed fleet" value={result.requiredFleet.toLocaleString()} tone={result.capacityPass ? 'blue' : 'rose'} />
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">Failure-aware capacity envelope</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Target at most 70% utilization; current live fleet: {result.liveFleet.toLocaleString()}.</p></div>
              <span className={result.utilization <= 0.7 ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-300' : 'text-sm font-semibold text-rose-700 dark:text-rose-300'}>{Math.round(result.utilization * 100)}% utilized</span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`Fleet utilization ${Math.round(result.utilization * 100)} percent`}>
              <div className={`h-full transition-[width] ${result.utilization <= 0.7 ? 'bg-emerald-500' : result.utilization <= 1 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, result.utilization * 100)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400"><span>{compactNumber(result.inferenceQps)}/s demanded</span><span>{compactNumber(result.capacityQps)}/s available</span></div>
          </div>

          <div className={result.healthy
            ? 'mt-5 border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:border-emerald-300 dark:bg-emerald-950/60'
            : 'mt-5 border-l-4 border-amber-500 bg-amber-50 p-4 dark:border-amber-300 dark:bg-amber-950/60'}>
            <div className="flex items-start gap-3">
              {result.healthy ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-200" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-200" />}
              <div><p className="font-semibold">{result.decision}</p><p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p></div>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">{result.decision}. Latency is {result.modeledP95} milliseconds and modeled quality is {result.model.quality} out of 100.</p>
      </LearningLabBody>
    </LearningLab>
  );
}
