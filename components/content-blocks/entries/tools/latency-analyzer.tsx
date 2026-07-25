'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  GitBranch,
  Hourglass,
  Layers3,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldAlert,
  TimerOff,
  Workflow,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';

type StageKey = 'edge' | 'application' | 'database' | 'dependency';
type ExecutionMode = 'serial' | 'parallel';
type ChallengeId =
  | 'baseline'
  | 'slow-dependency'
  | 'queue-buildup'
  | 'retry-amplification'
  | 'timeout'
  | 'partial-failure';

type StageConfig = {
  label: string;
  shortLabel: string;
  p50: number;
  budget: number;
  tone: 'cyan' | 'violet' | 'amber' | 'rose';
};

type StageMap = Record<StageKey, StageConfig>;

type PressureInputs = {
  arrivalRps: number;
  workerSlots: number;
  dependencyCapacityRps: number;
  dependencyFailurePct: number;
  maxRetries: number;
  timeoutMs: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  badge: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  modifiers: string[];
  arrivalMultiplier?: number;
  workerMultiplier?: number;
  dependencyLatencyMultiplier?: number;
  dependencyCapacityMultiplier?: number;
  minimumFailurePct?: number;
  minimumRetries?: number;
  timeoutCapMs?: number;
};

type SimulationResult = {
  p50: number;
  p95: number;
  p99: number;
  successPct: number;
  timeoutPct: number;
  failedPct: number;
  targetBreachPct: number;
  workerUtilization: number;
  dependencyUtilization: number;
  expectedConcurrency: number;
  effectiveArrivalRps: number;
  effectiveWorkers: number;
  effectiveDependencyCapacity: number;
  effectiveFailurePct: number;
  effectiveRetries: number;
  effectiveTimeoutMs: number;
  expectedAttempts: number;
  queueP99: number;
  queueMean: number;
  dependencyQueueMean: number;
  stageP95: Record<StageKey, number>;
  stageP99: Record<StageKey, number>;
  allocatedBudget: number;
  serviceP50: number;
  dominantStage: StageKey;
};

const DEFAULT_STAGES: StageMap = {
  edge: {
    label: 'Edge and network',
    shortLabel: 'Edge',
    p50: 35,
    budget: 70,
    tone: 'cyan',
  },
  application: {
    label: 'Application service',
    shortLabel: 'Application',
    p50: 45,
    budget: 90,
    tone: 'violet',
  },
  database: {
    label: 'Database',
    shortLabel: 'Database',
    p50: 55,
    budget: 110,
    tone: 'amber',
  },
  dependency: {
    label: 'Remote dependency',
    shortLabel: 'Dependency',
    p50: 85,
    budget: 160,
    tone: 'rose',
  },
};

const DEFAULT_PRESSURE: PressureInputs = {
  arrivalRps: 420,
  workerSlots: 96,
  dependencyCapacityRps: 700,
  dependencyFailurePct: 2,
  maxRetries: 1,
  timeoutMs: 650,
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Planned peak',
    badge: 'Reference',
    description: 'Traffic and dependencies remain inside their tested envelopes.',
    icon: CheckCircle2,
    modifiers: ['No scenario override', 'Configured values remain unchanged'],
  },
  {
    id: 'slow-dependency',
    label: 'Slow dependency',
    badge: '3.2x service time',
    description: 'The remote dependency slows down and begins returning more errors.',
    icon: Hourglass,
    dependencyLatencyMultiplier: 3.2,
    minimumFailurePct: 8,
    modifiers: ['Dependency service time × 3.2', 'Failure rate at least 8%'],
  },
  {
    id: 'queue-buildup',
    label: 'Queue buildup',
    badge: 'Burst + lost workers',
    description: 'A traffic burst arrives while half of the worker pool is unavailable.',
    icon: Layers3,
    arrivalMultiplier: 2.8,
    workerMultiplier: 0.5,
    modifiers: ['Arrival rate × 2.8', 'Available workers × 0.5'],
  },
  {
    id: 'retry-amplification',
    label: 'Retry amplification',
    badge: 'Failure feedback',
    description: 'Elevated errors trigger multiple immediate retries against a constrained dependency.',
    icon: RotateCcw,
    dependencyCapacityMultiplier: 0.78,
    minimumFailurePct: 35,
    minimumRetries: 3,
    modifiers: ['Failure rate at least 35%', 'At least 3 retries', 'Dependency capacity × 0.78'],
  },
  {
    id: 'timeout',
    label: 'Timeout squeeze',
    badge: '220 ms deadline',
    description: 'A short client deadline collides with a dependency slowdown.',
    icon: TimerOff,
    dependencyLatencyMultiplier: 1.8,
    timeoutCapMs: 220,
    modifiers: ['Client timeout capped at 220 ms', 'Dependency service time × 1.8'],
  },
  {
    id: 'partial-failure',
    label: 'Partial failure',
    badge: 'One dependency impaired',
    description: 'The application stays reachable while its remote dependency fails intermittently.',
    icon: ShieldAlert,
    dependencyCapacityMultiplier: 0.55,
    minimumFailurePct: 55,
    modifiers: ['Failure rate at least 55%', 'Dependency capacity × 0.55'],
  },
];

const STAGE_KEYS: StageKey[] = ['edge', 'application', 'database', 'dependency'];
const SAMPLE_COUNT = 1_600;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatMs = (value: number) => `${formatNumber(value, value < 10 ? 1 : 0)} ms`;
const formatPct = (value: number) => `${formatNumber(value, value < 10 ? 1 : 0)}%`;

function quantile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleLogNormal(p50: number, p99Multiplier: number, random: () => number) {
  const first = Math.max(random(), 1e-9);
  const second = Math.max(random(), 1e-9);
  const normal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  const sigma = Math.log(p99Multiplier) / 2.326347874;
  return p50 * Math.exp(sigma * normal);
}

function stagePercentile(p50: number, p99Multiplier: number, zScore: number) {
  const sigma = Math.log(p99Multiplier) / 2.326347874;
  return p50 * Math.exp(sigma * zScore);
}

function expectedAttemptCount(failureRate: number, retries: number) {
  let attempts = 1;
  let retryProbability = failureRate;
  for (let retry = 0; retry < retries; retry += 1) {
    attempts += retryProbability;
    retryProbability *= failureRate;
  }
  return attempts;
}

function queueDelayMean(serviceP50: number, utilization: number) {
  if (utilization <= 0) return 0;
  if (utilization < 0.82) return serviceP50 * Math.pow(utilization, 4) * 0.012;
  if (utilization < 0.98) {
    return serviceP50 * ((utilization - 0.8) / Math.max(0.02, 1 - utilization)) * 0.12;
  }
  return serviceP50 * (1 + Math.max(0, utilization - 0.98) * 5);
}

function simulate({
  stages,
  pressure,
  executionMode,
  challenge,
  targetMs,
  p99Multiplier,
}: {
  stages: StageMap;
  pressure: PressureInputs;
  executionMode: ExecutionMode;
  challenge: Challenge;
  targetMs: number;
  p99Multiplier: number;
}): SimulationResult {
  const effectiveArrivalRps = clamp(
    pressure.arrivalRps * (challenge.arrivalMultiplier ?? 1),
    1,
    100_000,
  );
  const effectiveWorkers = Math.max(
    1,
    Math.round(pressure.workerSlots * (challenge.workerMultiplier ?? 1)),
  );
  const effectiveDependencyCapacity = Math.max(
    1,
    pressure.dependencyCapacityRps * (challenge.dependencyCapacityMultiplier ?? 1),
  );
  const effectiveFailurePct = clamp(
    Math.max(pressure.dependencyFailurePct, challenge.minimumFailurePct ?? 0),
    0,
    95,
  );
  const effectiveRetries = clamp(
    Math.max(pressure.maxRetries, challenge.minimumRetries ?? 0),
    0,
    5,
  );
  const effectiveTimeoutMs = clamp(
    challenge.timeoutCapMs
      ? Math.min(pressure.timeoutMs, challenge.timeoutCapMs)
      : pressure.timeoutMs,
    50,
    5_000,
  );

  const dependencyP50 = stages.dependency.p50 * (challenge.dependencyLatencyMultiplier ?? 1);
  const serviceP50 =
    stages.edge.p50 +
    stages.application.p50 +
    (executionMode === 'parallel'
      ? Math.max(stages.database.p50, dependencyP50)
      : stages.database.p50 + dependencyP50);
  const allocatedBudget =
    stages.edge.budget +
    stages.application.budget +
    (executionMode === 'parallel'
      ? Math.max(stages.database.budget, stages.dependency.budget)
      : stages.database.budget + stages.dependency.budget);

  const expectedConcurrency = (effectiveArrivalRps * serviceP50) / 1_000;
  const workerUtilization = expectedConcurrency / effectiveWorkers;
  const queueMean = queueDelayMean(serviceP50, workerUtilization);

  const failureRate = effectiveFailurePct / 100;
  const expectedAttempts = expectedAttemptCount(failureRate, effectiveRetries);
  const dependencyUtilization =
    (effectiveArrivalRps * expectedAttempts) / effectiveDependencyCapacity;
  const dependencyQueueMean = queueDelayMean(dependencyP50, dependencyUtilization);

  const random = createRandom(0x20260725);
  const observedDurations: number[] = [];
  const queueDurations: number[] = [];
  let successCount = 0;
  let timeoutCount = 0;
  let failedCount = 0;
  let targetBreachCount = 0;

  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const edge = sampleLogNormal(stages.edge.p50, p99Multiplier, random);
    const application = sampleLogNormal(stages.application.p50, p99Multiplier, random);
    const database = sampleLogNormal(stages.database.p50, p99Multiplier, random);
    const dependency = sampleLogNormal(dependencyP50, p99Multiplier, random);
    const queue =
      queueMean <= 0 ? 0 : -Math.log(Math.max(1e-9, 1 - random())) * queueMean;
    const dependencyQueue =
      dependencyQueueMean <= 0
        ? 0
        : -Math.log(Math.max(1e-9, 1 - random())) * dependencyQueueMean;

    let failed = random() < failureRate;
    let retryDuration = 0;
    let attempts = 1;

    while (failed && attempts <= effectiveRetries) {
      retryDuration +=
        sampleLogNormal(dependencyP50, p99Multiplier, random) + 15 * attempts;
      attempts += 1;
      failed = random() < failureRate;
    }

    const branchDuration =
      executionMode === 'parallel'
        ? Math.max(database, dependency + dependencyQueue)
        : database + dependency + dependencyQueue;
    const rawDuration = edge + application + branchDuration + queue + retryDuration;
    const timedOut = rawDuration >= effectiveTimeoutMs;

    observedDurations.push(Math.min(rawDuration, effectiveTimeoutMs));
    queueDurations.push(queue + dependencyQueue);
    if (rawDuration > targetMs) targetBreachCount += 1;
    if (timedOut) timeoutCount += 1;
    if (failed) failedCount += 1;
    if (!timedOut && !failed) successCount += 1;
  }

  observedDurations.sort((left, right) => left - right);
  queueDurations.sort((left, right) => left - right);

  const stageP95: Record<StageKey, number> = {
    edge: stagePercentile(stages.edge.p50, p99Multiplier, 1.644853627),
    application: stagePercentile(stages.application.p50, p99Multiplier, 1.644853627),
    database: stagePercentile(stages.database.p50, p99Multiplier, 1.644853627),
    dependency: stagePercentile(dependencyP50, p99Multiplier, 1.644853627),
  };
  const stageP99: Record<StageKey, number> = {
    edge: stagePercentile(stages.edge.p50, p99Multiplier, 2.326347874),
    application: stagePercentile(stages.application.p50, p99Multiplier, 2.326347874),
    database: stagePercentile(stages.database.p50, p99Multiplier, 2.326347874),
    dependency: stagePercentile(dependencyP50, p99Multiplier, 2.326347874),
  };
  const dominantStage = STAGE_KEYS.reduce((dominant, stageKey) =>
    stageP99[stageKey] > stageP99[dominant] ? stageKey : dominant,
  );

  return {
    p50: quantile(observedDurations, 0.5),
    p95: quantile(observedDurations, 0.95),
    p99: quantile(observedDurations, 0.99),
    successPct: (successCount / SAMPLE_COUNT) * 100,
    timeoutPct: (timeoutCount / SAMPLE_COUNT) * 100,
    failedPct: (failedCount / SAMPLE_COUNT) * 100,
    targetBreachPct: (targetBreachCount / SAMPLE_COUNT) * 100,
    workerUtilization,
    dependencyUtilization,
    expectedConcurrency,
    effectiveArrivalRps,
    effectiveWorkers,
    effectiveDependencyCapacity,
    effectiveFailurePct,
    effectiveRetries,
    effectiveTimeoutMs,
    expectedAttempts,
    queueP99: quantile(queueDurations, 0.99),
    queueMean,
    dependencyQueueMean,
    stageP95,
    stageP99,
    allocatedBudget,
    serviceP50,
    dominantStage,
  };
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
          {label}
        </span>
        <span className="font-mono text-sm font-black text-neutral-950 dark:text-white">
          {valueLabel}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        className="h-2 w-full cursor-pointer accent-cyan-600 dark:accent-cyan-400"
      />
      {hint ? (
        <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'cyan' | 'amber' | 'rose' | 'emerald';
}) {
  const toneClass = {
    neutral: 'text-neutral-950 dark:text-white',
    cyan: 'text-cyan-800 dark:text-cyan-300',
    amber: 'text-amber-800 dark:text-amber-300',
    rose: 'text-rose-800 dark:text-rose-300',
    emerald: 'text-emerald-800 dark:text-emerald-300',
  }[tone];

  return (
    <div className="min-w-0 border-l-2 border-neutral-300 pl-3 dark:border-neutral-700">
      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function UtilizationLane({
  label,
  utilization,
  demand,
  capacity,
}: {
  label: string;
  utilization: number;
  demand: string;
  capacity: string;
}) {
  const percentage = utilization * 100;
  const tone =
    percentage >= 100
      ? 'bg-rose-600 dark:bg-rose-400'
      : percentage >= 80
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-emerald-600 dark:bg-emerald-400';

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-neutral-950 dark:text-white">{label}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {demand} demand · {capacity} capacity
          </p>
        </div>
        <span className="font-mono text-sm font-black text-neutral-950 dark:text-white">
          {formatPct(percentage)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone}`}
          style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
        />
      </div>
      {percentage > 100 ? (
        <p className="mt-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          Demand exceeds tested capacity by {formatPct(percentage - 100)}.
        </p>
      ) : null}
    </div>
  );
}

function StageNode({
  stage,
  p95,
  p99,
  dominant,
}: {
  stage: StageConfig;
  p95: number;
  p99: number;
  dominant: boolean;
}) {
  const tone = {
    cyan: 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/35',
    violet: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/35',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35',
  }[stage.tone];

  return (
    <div className={`min-w-0 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black text-neutral-950 dark:text-white">{stage.shortLabel}</p>
        {dominant ? (
          <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-black uppercase text-white dark:bg-white dark:text-neutral-950">
            Dominant
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-xs font-bold text-neutral-700 dark:text-neutral-200">
        P95 {formatMs(p95)}
      </p>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
        P99 {formatMs(p99)} · budget {formatMs(stage.budget)}
      </p>
    </div>
  );
}

export default function LatencyAnalyzer() {
  const [stages, setStages] = useState<StageMap>(DEFAULT_STAGES);
  const [pressure, setPressure] = useState<PressureInputs>(DEFAULT_PRESSURE);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('parallel');
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');
  const [targetMs, setTargetMs] = useState(450);
  const [p99Multiplier, setP99Multiplier] = useState(2.8);

  const challenge =
    CHALLENGES.find((candidate) => candidate.id === challengeId) ?? CHALLENGES[0];
  const result = useMemo(
    () =>
      simulate({
        stages,
        pressure,
        executionMode,
        challenge,
        targetMs,
        p99Multiplier,
      }),
    [stages, pressure, executionMode, challenge, targetMs, p99Multiplier],
  );

  const updateStage = (stageKey: StageKey, field: 'p50' | 'budget', value: number) => {
    setStages((current) => ({
      ...current,
      [stageKey]: {
        ...current[stageKey],
        [field]: clamp(value, 5, field === 'p50' ? 250 : 400),
      },
    }));
  };

  const updatePressure = <Key extends keyof PressureInputs>(
    key: Key,
    value: PressureInputs[Key],
  ) => {
    setPressure((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setStages(DEFAULT_STAGES);
    setPressure(DEFAULT_PRESSURE);
    setExecutionMode('parallel');
    setChallengeId('baseline');
    setTargetMs(450);
    setP99Multiplier(2.8);
  };

  const status =
    result.successPct < 95 || result.timeoutPct >= 5
      ? 'critical'
      : result.p95 > targetMs || result.workerUtilization >= 0.8
        ? 'warning'
        : 'healthy';
  const statusCopy = {
    healthy: {
      label: 'Within the modeled envelope',
      summary: `P95 stays inside the ${formatMs(targetMs)} target with capacity reserve.`,
      className:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
      icon: CheckCircle2,
    },
    warning: {
      label: 'Tail or capacity risk',
      summary: `The path is reachable, but ${formatPct(result.targetBreachPct)} of modeled requests exceed the target.`,
      className:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
      icon: AlertTriangle,
    },
    critical: {
      label: 'User-visible degradation',
      summary: `${formatPct(result.timeoutPct)} time out and modeled success falls to ${formatPct(result.successPct)}.`,
      className:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
      icon: ShieldAlert,
    },
  }[status];
  const StatusIcon = statusCopy.icon;
  const percentileScale = Math.max(result.p99, targetMs, result.effectiveTimeoutMs, 1);
  const budgetHeadroom = targetMs - result.allocatedBudget;
  const criticalPath =
    executionMode === 'parallel'
      ? `Edge → Application → ${result.stageP99.database >= result.stageP99.dependency ? 'Database' : 'Dependency'} branch`
      : 'Edge → Application → Database → Dependency';

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-950 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
              <Activity className="h-4 w-4" />
              Latency analysis workbench
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">Trace the request, not an average</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Allocate a latency budget, compose serial or parallel work, then pressure the
              same path with queueing, retries, deadlines, and dependency failures.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-neutral-600 px-3 text-sm font-bold text-white transition hover:border-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset model
          </button>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="P50 observed"
            value={formatMs(result.p50)}
            detail="Median user wait"
            tone="cyan"
          />
          <Metric
            label="P95 observed"
            value={formatMs(result.p95)}
            detail={
              result.timeoutPct >= 5
                ? 'Capped by client timeout'
                : `${result.p95 <= targetMs ? 'Inside' : 'Above'} target`
            }
            tone={result.timeoutPct >= 5 ? 'rose' : result.p95 <= targetMs ? 'emerald' : 'amber'}
          />
          <Metric
            label="P99 observed"
            value={formatMs(result.p99)}
            detail="Includes waits capped by timeout"
            tone={result.p99 < result.effectiveTimeoutMs ? 'neutral' : 'rose'}
          />
          <Metric
            label="Successful requests"
            value={formatPct(result.successPct)}
            detail={`${formatPct(result.timeoutPct)} timed out`}
            tone={result.successPct >= 99 ? 'emerald' : result.successPct >= 95 ? 'amber' : 'rose'}
          />
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.62fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/35 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="space-y-7">
            <section aria-labelledby="latency-boundaries-heading">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                <h3
                  id="latency-boundaries-heading"
                  className="text-sm font-black uppercase text-neutral-950 dark:text-white"
                >
                  Boundaries
                </h3>
              </div>
              <div className="space-y-5">
                <RangeControl
                  label="P95 user target"
                  value={targetMs}
                  min={150}
                  max={2_000}
                  step={25}
                  valueLabel={formatMs(targetMs)}
                  hint="The service-level objective this model tests."
                  onChange={setTargetMs}
                />
                <RangeControl
                  label="Client timeout"
                  value={pressure.timeoutMs}
                  min={200}
                  max={2_500}
                  step={25}
                  valueLabel={formatMs(pressure.timeoutMs)}
                  hint="Observed duration stops here even when backend work continues."
                  onChange={(value) => updatePressure('timeoutMs', value)}
                />
                <RangeControl
                  label="Tail spread"
                  value={p99Multiplier}
                  min={1.5}
                  max={6}
                  step={0.1}
                  valueLabel={`${p99Multiplier.toFixed(1)}× P50 at P99`}
                  hint="A log-normal stage model turns median service time into a tail distribution."
                  onChange={setP99Multiplier}
                />
              </div>
            </section>

            <section aria-labelledby="execution-heading">
              <div className="mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                <h3
                  id="execution-heading"
                  className="text-sm font-black uppercase text-neutral-950 dark:text-white"
                >
                  Work composition
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Work composition">
                {(['parallel', 'serial'] as ExecutionMode[]).map((mode) => {
                  const selected = executionMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setExecutionMode(mode)}
                      className={`rounded-md border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        selected
                          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      <span className="block text-sm font-black capitalize">{mode}</span>
                      <span className={`mt-1 block text-xs ${selected ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {mode === 'parallel' ? 'Wait for slower branch' : 'Add both branches'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="pressure-heading">
              <div className="mb-4 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <h3
                  id="pressure-heading"
                  className="text-sm font-black uppercase text-neutral-950 dark:text-white"
                >
                  Load and recovery
                </h3>
              </div>
              <div className="space-y-5">
                <RangeControl
                  label="Arrival rate"
                  value={pressure.arrivalRps}
                  min={50}
                  max={2_000}
                  step={10}
                  valueLabel={`${formatNumber(pressure.arrivalRps)} req/s`}
                  onChange={(value) => updatePressure('arrivalRps', value)}
                />
                <RangeControl
                  label="Worker slots"
                  value={pressure.workerSlots}
                  min={8}
                  max={256}
                  step={4}
                  valueLabel={formatNumber(pressure.workerSlots)}
                  onChange={(value) => updatePressure('workerSlots', value)}
                />
                <RangeControl
                  label="Dependency capacity"
                  value={pressure.dependencyCapacityRps}
                  min={100}
                  max={3_000}
                  step={50}
                  valueLabel={`${formatNumber(pressure.dependencyCapacityRps)} req/s`}
                  onChange={(value) => updatePressure('dependencyCapacityRps', value)}
                />
                <RangeControl
                  label="Dependency failure"
                  value={pressure.dependencyFailurePct}
                  min={0}
                  max={60}
                  step={1}
                  valueLabel={formatPct(pressure.dependencyFailurePct)}
                  onChange={(value) => updatePressure('dependencyFailurePct', value)}
                />
                <RangeControl
                  label="Maximum retries"
                  value={pressure.maxRetries}
                  min={0}
                  max={4}
                  step={1}
                  valueLabel={formatNumber(pressure.maxRetries)}
                  onChange={(value) => updatePressure('maxRetries', value)}
                />
              </div>
            </section>
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="space-y-8">
            <section aria-labelledby="challenge-heading">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">
                    Challenge mode
                  </p>
                  <h3 id="challenge-heading" className="mt-1 text-xl font-black">
                    Inject pressure into the same request path
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Selected scenarios override only the values they name.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {CHALLENGES.map((candidate) => {
                  const Icon = candidate.icon;
                  const selected = candidate.id === challengeId;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChallengeId(candidate.id)}
                      className={`min-h-28 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        selected
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-950'
                          : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Icon className={`h-4 w-4 shrink-0 ${selected ? '' : 'text-rose-700 dark:text-rose-300'}`} />
                        <span className={`text-[10px] font-black uppercase ${selected ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                          {candidate.badge}
                        </span>
                      </div>
                      <span className="mt-3 block text-sm font-black">{candidate.label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${selected ? 'opacity-80' : 'text-neutral-600 dark:text-neutral-300'}`}>
                        {candidate.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="stage-budget-heading">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">
                    Feedback loop 1
                  </p>
                  <h3 id="stage-budget-heading" className="mt-1 text-xl font-black">
                    Allocate budget, then shape each stage
                  </h3>
                </div>
                <div className="text-left text-xs sm:text-right">
                  <p className="font-bold text-neutral-900 dark:text-white">
                    Path allocation {formatMs(result.allocatedBudget)}
                  </p>
                  <p className={budgetHeadroom >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                    {budgetHeadroom >= 0
                      ? `${formatMs(budgetHeadroom)} unallocated`
                      : `${formatMs(Math.abs(budgetHeadroom))} over target`}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-300 dark:divide-neutral-800 dark:border-neutral-700">
                {STAGE_KEYS.map((stageKey) => {
                  const stage = stages[stageKey];
                  return (
                    <div key={stageKey} className="grid gap-4 p-4 xl:grid-cols-[minmax(150px,0.7fr)_1fr_1fr] xl:items-center">
                      <div>
                        <p className="text-sm font-black text-neutral-950 dark:text-white">{stage.label}</p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Modeled P95 {formatMs(result.stageP95[stageKey])}
                        </p>
                      </div>
                      <RangeControl
                        label="P50 service time"
                        value={stage.p50}
                        min={5}
                        max={250}
                        step={5}
                        valueLabel={formatMs(stage.p50)}
                        onChange={(value) => updateStage(stageKey, 'p50', value)}
                      />
                      <RangeControl
                        label="Stage budget"
                        value={stage.budget}
                        min={10}
                        max={400}
                        step={10}
                        valueLabel={formatMs(stage.budget)}
                        onChange={(value) => updateStage(stageKey, 'budget', value)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="critical-path-heading">
              <div className="mb-4">
                <p className="text-xs font-black uppercase text-violet-700 dark:text-violet-300">
                  Request topology
                </p>
                <h3 id="critical-path-heading" className="mt-1 text-xl font-black">
                  Critical path under {executionMode} execution
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {executionMode === 'parallel'
                    ? 'Database and dependency work start together. The slower branch gates the response; their latencies are not added.'
                    : 'Database and dependency work happen one after another, so both contribute to the request path.'}
                </p>
              </div>

              <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.5fr)_auto_minmax(0,0.9fr)]">
                <StageNode
                  stage={stages.edge}
                  p95={result.stageP95.edge}
                  p99={result.stageP99.edge}
                  dominant={result.dominantStage === 'edge'}
                />
                <ArrowRight className="hidden h-5 w-5 self-center text-neutral-400 lg:block" />
                <StageNode
                  stage={stages.application}
                  p95={result.stageP95.application}
                  p99={result.stageP99.application}
                  dominant={result.dominantStage === 'application'}
                />
                <ArrowRight className="hidden h-5 w-5 self-center text-neutral-400 lg:block" />
                {executionMode === 'parallel' ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <StageNode
                      stage={stages.database}
                      p95={result.stageP95.database}
                      p99={result.stageP99.database}
                      dominant={result.dominantStage === 'database'}
                    />
                    <StageNode
                      stage={stages.dependency}
                      p95={result.stageP95.dependency}
                      p99={result.stageP99.dependency}
                      dominant={result.dominantStage === 'dependency'}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <StageNode
                      stage={stages.database}
                      p95={result.stageP95.database}
                      p99={result.stageP99.database}
                      dominant={result.dominantStage === 'database'}
                    />
                    <StageNode
                      stage={stages.dependency}
                      p95={result.stageP95.dependency}
                      p99={result.stageP99.dependency}
                      dominant={result.dominantStage === 'dependency'}
                    />
                  </div>
                )}
                <ArrowRight className="hidden h-5 w-5 self-center text-neutral-400 lg:block" />
                <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                  <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Response</p>
                  <p className="mt-2 text-lg font-black">{formatMs(result.p95)} P95</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {criticalPath}
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="pressure-feedback-heading" className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <div className="min-w-0">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                    Feedback loop 2
                  </p>
                  <h3 id="pressure-feedback-heading" className="mt-1 text-xl font-black">
                    See queueing and retry pressure accumulate
                  </h3>
                </div>
                <div className="space-y-5 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
                  <UtilizationLane
                    label="Worker pool"
                    utilization={result.workerUtilization}
                    demand={`${formatNumber(result.expectedConcurrency, 1)} concurrent`}
                    capacity={`${formatNumber(result.effectiveWorkers)} slots`}
                  />
                  <UtilizationLane
                    label="Remote dependency"
                    utilization={result.dependencyUtilization}
                    demand={`${formatNumber(result.effectiveArrivalRps * result.expectedAttempts)} attempts/s`}
                    capacity={`${formatNumber(result.effectiveDependencyCapacity)} attempts/s`}
                  />
                  <div className="grid gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Queue P99</p>
                      <p className="mt-1 font-mono text-lg font-black">{formatMs(result.queueP99)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Attempt multiplier</p>
                      <p className="mt-1 font-mono text-lg font-black">{result.expectedAttempts.toFixed(2)}×</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Failure after retries</p>
                      <p className="mt-1 font-mono text-lg font-black">{formatPct(result.failedPct)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">
                    User-visible result
                  </p>
                  <h3 className="mt-1 text-xl font-black">Latency envelope</h3>
                </div>
                <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
                  <div className="space-y-4">
                    {[
                      { label: 'P50', value: result.p50, color: 'bg-cyan-600 dark:bg-cyan-400' },
                      { label: 'P95', value: result.p95, color: 'bg-violet-600 dark:bg-violet-400' },
                      { label: 'P99', value: result.p99, color: 'bg-rose-600 dark:bg-rose-400' },
                    ].map((percentile) => (
                      <div key={percentile.label} className="grid grid-cols-[42px_minmax(0,1fr)_64px] items-center gap-2">
                        <span className="text-xs font-black text-neutral-600 dark:text-neutral-300">
                          {percentile.label}
                        </span>
                        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${percentile.color}`}
                            style={{
                              width: `${Math.max(2, (percentile.value / percentileScale) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-right font-mono text-xs font-black">{formatMs(percentile.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-xs dark:border-neutral-800 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-500 dark:text-neutral-400">P95 target</span>
                      <span className="font-bold">{formatMs(targetMs)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-500 dark:text-neutral-400">Effective timeout</span>
                      <span className="font-bold">{formatMs(result.effectiveTimeoutMs)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`rounded-lg border p-4 ${statusCopy.className}`} aria-live="polite">
              <div className="flex items-start gap-3">
                <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-black">{statusCopy.label}</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{statusCopy.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold">
                    <span>{formatPct(result.targetBreachPct)} above target</span>
                    <span>{formatPct(result.timeoutPct)} time out</span>
                    <span>{formatPct(result.failedPct)} fail after retries</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800 lg:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                  <h3 className="text-sm font-black uppercase">Applied scenario</h3>
                </div>
                <p className="mt-2 text-sm font-bold">{challenge.label}</p>
                <ul className="mt-2 space-y-1.5 pl-5 text-sm text-neutral-600 marker:text-rose-600 dark:text-neutral-300 dark:marker:text-rose-300">
                  {challenge.modifiers.map((modifier) => (
                    <li key={modifier}>{modifier}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                  <h3 className="text-sm font-black uppercase">Modeling assumptions</h3>
                </div>
                <ul className="mt-2 space-y-1.5 pl-5 text-sm text-neutral-600 marker:text-cyan-600 dark:text-neutral-300 dark:marker:text-cyan-300">
                  <li>1,600 deterministic request samples; values are illustrative, not production telemetry.</li>
                  <li>Each stage is log-normal and calibrated from its P50 and selected P99 multiplier.</li>
                  <li>Parallel branches use the slower sampled branch; percentiles are measured after composition.</li>
                  <li>Queue delay is a bounded capacity approximation; observed waits stop at the client timeout.</li>
                  <li>Timeout and final-failure rates can overlap; a request succeeds only when neither occurs.</li>
                </ul>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-md bg-neutral-100 px-3 py-2 text-xs leading-5 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
              <Server className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Use real traces to calibrate stage distributions and correlation before making a
                production capacity decision. This workbench teaches path composition and pressure
                behavior; it does not replace load testing.
              </p>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
