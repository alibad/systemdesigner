'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  GitBranch,
  Layers3,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type WorkloadId = 'catalog' | 'feed' | 'profile' | 'session';
type ConsistencyId = 'strict' | 'bounded' | 'relaxed';
type InvalidationId = 'ttl' | 'event' | 'write-through' | 'versioned';
type ChallengeId = 'healthy' | 'stampede' | 'stale-reads' | 'write-amplification' | 'cache-outage';
type RiskTone = 'healthy' | 'watch' | 'danger';

interface Workload {
  id: WorkloadId;
  label: string;
  detail: string;
  requestRps: number;
  originLatencyMs: number;
  originCapacityRps: number;
  hitAdjustment: number;
  icon: LucideIcon;
}

interface Choice<T extends string> {
  id: T;
  label: string;
  detail: string;
}

interface PlannerResult {
  effectiveHitRatio: number;
  originRps: number;
  originLoadPercent: number;
  p99LatencyMs: number;
  staleExposurePercent: number;
  invalidationOpsPerSecond: number;
  availabilityPercent: number;
  riskTone: RiskTone;
  riskLabel: string;
  riskDetail: string;
  title: string;
  summary: string;
  placement: string;
  fillPolicy: string;
  ttlGuidance: string;
  fallback: string;
  fitReasons: string[];
  guardrails: string[];
  flowStatus: string;
  invalidationStatus: string;
}

const WORKLOADS: Workload[] = [
  {
    id: 'catalog',
    label: 'Product catalog',
    detail: 'Skewed reads with price and inventory updates.',
    requestRps: 12000,
    originLatencyMs: 160,
    originCapacityRps: 4200,
    hitAdjustment: 0.08,
    icon: Layers3,
  },
  {
    id: 'feed',
    label: 'Personalized feed',
    detail: 'High fan-out reads with continuously arriving items.',
    requestRps: 24000,
    originLatencyMs: 210,
    originCapacityRps: 6400,
    hitAdjustment: 0.02,
    icon: Activity,
  },
  {
    id: 'profile',
    label: 'User profile',
    detail: 'Moderate reads where updates must become visible quickly.',
    requestRps: 8000,
    originLatencyMs: 140,
    originCapacityRps: 3200,
    hitAdjustment: 0,
    icon: Database,
  },
  {
    id: 'session',
    label: 'Session state',
    detail: 'Small hot objects with strict ownership and expiry.',
    requestRps: 11000,
    originLatencyMs: 95,
    originCapacityRps: 5200,
    hitAdjustment: -0.06,
    icon: ShieldCheck,
  },
];

const CONSISTENCY_CHOICES: Choice<ConsistencyId>[] = [
  {
    id: 'strict',
    label: 'Strict',
    detail: 'A read must not return an older committed value.',
  },
  {
    id: 'bounded',
    label: 'Bounded',
    detail: 'Seconds of staleness are acceptable and measured.',
  },
  {
    id: 'relaxed',
    label: 'Relaxed',
    detail: 'Availability and hit rate take priority over freshness.',
  },
];

const INVALIDATION_CHOICES: Choice<InvalidationId>[] = [
  {
    id: 'ttl',
    label: 'TTL expiry',
    detail: 'Simple ownership, but freshness follows a timer.',
  },
  {
    id: 'event',
    label: 'Event invalidation',
    detail: 'Mutations publish targeted cache invalidations.',
  },
  {
    id: 'write-through',
    label: 'Write-through',
    detail: 'The write path updates cache and source together.',
  },
  {
    id: 'versioned',
    label: 'Versioned keys',
    detail: 'New versions become new immutable cache identities.',
  },
];

const CHALLENGES: Array<Choice<ChallengeId> & { icon: LucideIcon }> = [
  {
    id: 'healthy',
    label: 'Healthy',
    detail: 'Normal cache and origin behavior.',
    icon: CheckCircle2,
  },
  {
    id: 'stampede',
    label: 'Stampede',
    detail: 'Many hot keys expire together.',
    icon: Zap,
  },
  {
    id: 'stale-reads',
    label: 'Stale reads',
    detail: 'Invalidation delivery is delayed.',
    icon: Clock3,
  },
  {
    id: 'write-amplification',
    label: 'Write amplification',
    detail: 'One mutation fans out to many cache writes.',
    icon: RotateCcw,
  },
  {
    id: 'cache-outage',
    label: 'Cache outage',
    detail: 'The cache tier stops accepting traffic.',
    icon: TriangleAlert,
  },
];

const riskStyles: Record<RiskTone, {
  panel: string;
  text: string;
  icon: LucideIcon;
}> = {
  healthy: {
    panel: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
    text: 'text-emerald-900 dark:text-emerald-100',
    icon: CheckCircle2,
  },
  watch: {
    panel: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    text: 'text-amber-950 dark:text-amber-100',
    icon: AlertTriangle,
  },
  danger: {
    panel: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
    text: 'text-rose-950 dark:text-rose-100',
    icon: TriangleAlert,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function calculatePlan({
  workload,
  readPercent,
  mutationsPerMinute,
  consistency,
  invalidation,
  challenge,
  requestCoalescing,
  failOpen,
}: {
  workload: Workload;
  readPercent: number;
  mutationsPerMinute: number;
  consistency: ConsistencyId;
  invalidation: InvalidationId;
  challenge: ChallengeId;
  requestCoalescing: boolean;
  failOpen: boolean;
}): PlannerResult {
  const readRps = Math.round(workload.requestRps * (readPercent / 100));
  const consistencyAdjustment = {
    strict: -0.12,
    bounded: 0,
    relaxed: 0.1,
  }[consistency];
  const invalidationAdjustment = {
    ttl: 0.07,
    event: 0.04,
    'write-through': -0.02,
    versioned: -0.06,
  }[invalidation];
  const mutationPenalty = Math.min(0.22, mutationsPerMinute / 8500);
  const normalHitRatio = clamp(
    0.5
      + (readPercent - 50) * 0.006
      + workload.hitAdjustment
      + consistencyAdjustment
      + invalidationAdjustment
      - mutationPenalty,
    0.12,
    0.96,
  );

  const servingHitRatio = challenge === 'cache-outage'
    ? 0
    : clamp(
        normalHitRatio
          - (challenge === 'stampede' ? 0.16 : 0)
          - (challenge === 'stale-reads' ? 0.03 : 0)
          - (challenge === 'write-amplification' ? 0.04 : 0),
        0,
        0.96,
      );

  const missRps = readRps * (1 - servingHitRatio);
  const stampedeMultiplier = challenge === 'stampede'
    ? requestCoalescing ? 1.3 : 4.8
    : 1;
  const originRps = Math.round(missRps * stampedeMultiplier);
  const originLoadPercent = Math.round((originRps / workload.originCapacityRps) * 100);

  const invalidationBase = {
    ttl: 0.18,
    event: 1,
    'write-through': 2.2,
    versioned: 1.35,
  }[invalidation];
  const invalidationOpsPerSecond = Math.round(
    (mutationsPerMinute / 60)
      * invalidationBase
      * (challenge === 'write-amplification' ? 5.5 : 1),
  );

  const freshnessBase = {
    ttl: 8,
    event: 1.8,
    'write-through': 0.55,
    versioned: 0.18,
  }[invalidation];
  const consistencyFactor = {
    strict: 0.45,
    bounded: 0.9,
    relaxed: 1.45,
  }[consistency];
  const staleExposurePercent = challenge === 'cache-outage'
    ? 0
    : clamp(
        freshnessBase
          * consistencyFactor
          * (1 + mutationsPerMinute / 1800)
          * (challenge === 'stale-reads' ? 5 : 1),
        0,
        100,
      );

  const cacheLatencyMs = workload.id === 'feed' ? 18 : 7;
  let p99LatencyMs = Math.round(
    cacheLatencyMs
      + (1 - servingHitRatio) * workload.originLatencyMs * 1.7
      + Math.max(0, originLoadPercent - 75) * 1.8,
  );

  if (challenge === 'stampede') {
    p99LatencyMs += requestCoalescing ? 90 : 620;
  }
  if (challenge === 'cache-outage') {
    p99LatencyMs = failOpen
      ? Math.round(workload.originLatencyMs * 2.4 + Math.max(0, originLoadPercent - 100) * 2)
      : 1200;
  }

  let availabilityPercent = 99.99;
  if (originLoadPercent > 100) {
    availabilityPercent -= Math.min(18, (originLoadPercent - 100) * 0.08);
  }
  if (challenge === 'cache-outage') {
    availabilityPercent = failOpen
      ? Math.max(82, 99.4 - Math.max(0, originLoadPercent - 100) * 0.06)
      : 61.5;
  }
  if (challenge === 'stampede' && !requestCoalescing) {
    availabilityPercent -= 4.8;
  }
  availabilityPercent = clamp(availabilityPercent, 0, 99.99);

  const staleLimit = {
    strict: 0.5,
    bounded: 3,
    relaxed: 10,
  }[consistency];
  const freshnessBreach = staleExposurePercent > staleLimit;
  const overloaded = originLoadPercent > 100;
  const invalidationOverload = invalidationOpsPerSecond > Math.max(500, workload.requestRps * 0.08);
  const unsafeOutage = challenge === 'cache-outage' && !failOpen;

  let riskTone: RiskTone = 'healthy';
  let riskLabel = 'Resilient plan';
  let riskDetail = 'The selected policy stays inside the modeled freshness and origin budgets.';

  if (overloaded || freshnessBreach || invalidationOverload || unsafeOutage) {
    riskTone = 'danger';
    riskLabel = unsafeOutage
      ? 'Cache failure becomes an outage'
      : freshnessBreach
        ? 'Freshness contract is breached'
        : invalidationOverload
          ? 'Writes overwhelm the cache path'
          : 'Origin capacity is exceeded';
    riskDetail = unsafeOutage
      ? 'Requests cannot bypass the unavailable cache, so healthy origin capacity is stranded.'
      : freshnessBreach
        ? 'The modeled stale-read exposure is higher than this consistency contract permits.'
        : invalidationOverload
          ? 'Invalidation work grows faster than the mutation stream and competes with reads.'
          : 'Misses and retries push the source of truth beyond its modeled serving capacity.';
  } else if (
    originLoadPercent > 70
    || staleExposurePercent > staleLimit * 0.65
    || challenge !== 'healthy'
  ) {
    riskTone = 'watch';
    riskLabel = 'Guardrail required';
    riskDetail = 'The path remains serviceable, but the injected condition consumes most of a safety margin.';
  }

  const strict = consistency === 'strict';
  const relaxed = consistency === 'relaxed';
  const highMutation = mutationsPerMinute >= 900;
  const globalPlacement = workload.id === 'catalog' || workload.id === 'feed';

  const title = strict
    ? 'Version-aware read-through cache'
    : relaxed
      ? 'Tiered cache-aside with stale-while-revalidate'
      : highMutation
        ? 'Event-invalidated application cache'
        : 'Bounded cache-aside with targeted invalidation';

  const placement = strict
    ? 'Regional application cache beside the owning service'
    : globalPlacement
      ? 'Edge cache for shared objects plus an application cache'
      : 'Application cache in front of the source of truth';

  const fillPolicy = strict
    ? 'Read-through with version checks before a value becomes visible'
    : relaxed
      ? 'Cache-aside with background refresh and negative caching'
      : 'Cache-aside with single-flight fills on misses';

  const ttlGuidance = strict
    ? '30-120 second safety TTL; correctness must not depend on expiry'
    : highMutation
      ? '1-5 minute safety TTL backed by mutation events'
      : relaxed
        ? '15-60 minute TTL with stale-while-revalidate'
        : '5-15 minute TTL with measured staleness';

  const fallback = challenge === 'cache-outage'
    ? failOpen
      ? 'Bypass cache through a rate-limited origin path'
      : 'Fail closed until the cache tier recovers'
    : challenge === 'stampede'
      ? requestCoalescing
        ? 'One fill owns each hot key while peers wait'
        : 'Every miss may race to the origin'
      : 'Circuit-break slow origin reads and preserve a bounded stale option';

  const fitReasons = [
    readPercent >= 85
      ? 'The read-heavy shape can reuse enough values to justify cache complexity.'
      : 'The moderate read share keeps the design to the minimum useful cache tier.',
    strict
      ? 'Version checks keep cache visibility aligned with the committed source value.'
      : 'The freshness budget allows reuse without turning every read into an origin query.',
    highMutation
      ? 'Mutation-aware invalidation prevents a long TTL from becoming the only freshness mechanism.'
      : 'The mutation rate leaves room for a bounded TTL as a recovery mechanism.',
  ];

  const guardrails = [
    challenge === 'stampede'
      ? requestCoalescing
        ? 'Keep request coalescing enabled and cap waiter time per key.'
        : 'Add per-key request coalescing before this traffic shape reaches production.'
      : 'Measure fill concurrency and protect hot keys with single-flight loading.',
    challenge === 'cache-outage'
      ? failOpen
        ? 'Rate-limit bypass traffic so the origin survives loss of the cache tier.'
        : 'Define a controlled bypass or an explicit degraded response contract.'
      : 'Set an origin load budget and alarm on cache-miss amplification.',
    freshnessBreach
      ? 'Shorten the invalidation path or move to versioned keys for this freshness contract.'
      : 'Record cache age and invalidation lag as first-class telemetry.',
  ];

  const summary = strict
    ? 'Treat the cache as an acceleration index, never as the authority. A version or ownership check decides whether a cached value is visible.'
    : relaxed
      ? 'Use multiple reuse points, but make stale serving explicit and refresh asynchronously before popular objects expire.'
      : 'Keep the cache close to the owning service and use mutation events to bound stale exposure without coupling every write to every reader.';

  const flowStatus = challenge === 'cache-outage'
    ? failOpen
      ? 'Cache bypass active'
      : 'Requests stop at cache'
    : challenge === 'stampede'
      ? requestCoalescing
        ? 'Misses collapse by key'
        : 'Duplicate fills reach origin'
      : Math.round(servingHitRatio * 100) + '% served before origin';

  const invalidationStatus = challenge === 'stale-reads'
    ? 'Invalidation delivery delayed'
    : challenge === 'write-amplification'
      ? formatCompact(invalidationOpsPerSecond) + ' cache writes/s'
      : invalidation === 'ttl'
        ? 'Expiry owns freshness'
        : formatCompact(invalidationOpsPerSecond) + ' invalidations/s';

  return {
    effectiveHitRatio: servingHitRatio * 100,
    originRps,
    originLoadPercent,
    p99LatencyMs,
    staleExposurePercent,
    invalidationOpsPerSecond,
    availabilityPercent,
    riskTone,
    riskLabel,
    riskDetail,
    title,
    summary,
    placement,
    fillPolicy,
    ttlGuidance,
    fallback,
    fitReasons,
    guardrails,
    flowStatus,
    invalidationStatus,
  };
}

function ChoiceButton({
  selected,
  label,
  detail,
  onClick,
  icon: Icon,
}: {
  selected: boolean;
  label: string;
  detail: string;
  onClick: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'min-h-[76px] w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ' +
        (selected
          ? 'border-cyan-700 bg-cyan-950 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-100 dark:text-cyan-950'
          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600')
      }
    >
      <span className="flex items-start gap-2.5">
        {Icon ? <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span
            className={
              'mt-1 block text-xs leading-5 ' +
              (selected ? 'text-cyan-100 dark:text-cyan-900' : 'text-neutral-500 dark:text-neutral-400')
            }
          >
            {detail}
          </span>
        </span>
      </span>
    </button>
  );
}

function ToggleControl({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-[62px] w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-left text-neutral-900 transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:hover:border-neutral-600"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {detail}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={
          'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
          (checked ? 'bg-cyan-600 dark:bg-cyan-400' : 'bg-neutral-300 dark:bg-neutral-700')
        }
      >
        <span
          className={
            'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-950 ' +
            (checked ? 'translate-x-6' : 'translate-x-1')
          }
        />
      </span>
    </button>
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
  tone: 'cyan' | 'emerald' | 'amber' | 'violet';
}) {
  const styles = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
  }[tone];

  return (
    <div className={'min-h-[112px] rounded-md border p-4 ' + styles}>
      <p className="text-xs font-semibold uppercase text-current opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  eyebrow,
  title,
  metric,
  detail,
  state = 'normal',
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  state?: 'normal' | 'active' | 'warning' | 'failed';
}) {
  const styles = {
    normal: 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white',
    active: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100',
    warning: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
  }[state];

  return (
    <div className={'flex min-h-[128px] min-w-0 flex-col rounded-md border p-3.5 ' + styles}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-auto pt-3 text-base font-semibold tabular-nums">{metric}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function HorizontalConnector({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1">
      <span className="max-w-[58px] text-center text-[10px] font-semibold uppercase leading-4 text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <ArrowRight
        aria-hidden="true"
        className={
          'h-5 w-5 ' +
          (active ? 'text-cyan-600 dark:text-cyan-300' : 'text-neutral-300 dark:text-neutral-700')
        }
      />
    </div>
  );
}

function VerticalConnector({ label }: { label: string }) {
  return (
    <div className="flex h-12 items-center gap-3 pl-5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
      <ArrowDown aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
      {label}
    </div>
  );
}

export default function CacheStrategyPlanner() {
  const [workloadId, setWorkloadId] = useState<WorkloadId>('catalog');
  const [readPercent, setReadPercent] = useState(92);
  const [mutationsPerMinute, setMutationsPerMinute] = useState(180);
  const [consistency, setConsistency] = useState<ConsistencyId>('bounded');
  const [invalidation, setInvalidation] = useState<InvalidationId>('event');
  const [challenge, setChallenge] = useState<ChallengeId>('healthy');
  const [requestCoalescing, setRequestCoalescing] = useState(true);
  const [failOpen, setFailOpen] = useState(true);

  const workload = WORKLOADS.find((option) => option.id === workloadId) ?? WORKLOADS[0];

  const result = useMemo(
    () => calculatePlan({
      workload,
      readPercent,
      mutationsPerMinute,
      consistency,
      invalidation,
      challenge,
      requestCoalescing,
      failOpen,
    }),
    [
      workload,
      readPercent,
      mutationsPerMinute,
      consistency,
      invalidation,
      challenge,
      requestCoalescing,
      failOpen,
    ],
  );

  const reset = () => {
    setWorkloadId('catalog');
    setReadPercent(92);
    setMutationsPerMinute(180);
    setConsistency('bounded');
    setInvalidation('event');
    setChallenge('healthy');
    setRequestCoalescing(true);
    setFailOpen(true);
  };

  const RiskIcon = riskStyles[result.riskTone].icon;
  const cacheFailed = challenge === 'cache-outage';
  const originWarning = result.originLoadPercent > 100;
  const invalidationWarning = challenge === 'stale-reads' || challenge === 'write-amplification';
  const readRps = Math.round(workload.requestRps * (readPercent / 100));

  return (
    <section
      data-content-block="tools/cache-strategy-planner"
      className="not-prose my-7 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <GitBranch aria-hidden="true" className="h-4 w-4 shrink-0" />
              Cache decision workbench
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
              Design the path, then break it
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Shape the workload and freshness contract, choose who owns invalidation,
              then inject pressure to see which dependency absorbs the consequence.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(310px,380px)_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-neutral-50 lg:border-b-0 lg:border-r dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                <Gauge aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                  1. Shape the workload
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  These controls change reuse potential, freshness risk, and origin demand.
                </p>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Workload
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {WORKLOADS.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    selected={workloadId === option.id}
                    label={option.label}
                    detail={option.detail}
                    icon={option.icon}
                    onClick={() => setWorkloadId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="mt-5">
              <label htmlFor="cache-read-share" className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Read share
                </span>
                <output
                  htmlFor="cache-read-share"
                  className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white"
                >
                  {readPercent}%
                </output>
              </label>
              <input
                id="cache-read-share"
                type="range"
                min="50"
                max="99"
                step="1"
                value={readPercent}
                onChange={(event) => setReadPercent(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-cyan-600"
              />
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Balanced</span>
                <span>Read dominated</span>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="cache-mutations" className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Mutations per minute
                </span>
                <output
                  htmlFor="cache-mutations"
                  className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white"
                >
                  {formatCompact(mutationsPerMinute)}
                </output>
              </label>
              <input
                id="cache-mutations"
                type="range"
                min="10"
                max="3000"
                step="10"
                value={mutationsPerMinute}
                onChange={(event) => setMutationsPerMinute(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
              />
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Mostly stable</span>
                <span>Rapid change</span>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Freshness contract
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {CONSISTENCY_CHOICES.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    selected={consistency === option.id}
                    label={option.label}
                    detail={option.detail}
                    onClick={() => setConsistency(option.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                  2. Own invalidation
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Change the policy to see freshness and write-path costs move independently.
                </p>
              </div>
            </div>
            <fieldset className="mt-5">
              <legend className="sr-only">Invalidation policy</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {INVALIDATION_CHOICES.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    selected={invalidation === option.id}
                    label={option.label}
                    detail={option.detail}
                    onClick={() => setInvalidation(option.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                  3. Challenge the design
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Failure injection changes the active path, recommendation, and risk state.
                </p>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="sr-only">Challenge mode</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {CHALLENGES.map((option) => (
                  <ChoiceButton
                    key={option.id}
                    selected={challenge === option.id}
                    label={option.label}
                    detail={option.detail}
                    icon={option.icon}
                    onClick={() => setChallenge(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="mt-4 space-y-2">
              <ToggleControl
                checked={requestCoalescing}
                label="Request coalescing"
                detail="Let only one fill own a missing hot key."
                onChange={() => setRequestCoalescing((value) => !value)}
              />
              <ToggleControl
                checked={failOpen}
                label="Fail-open cache bypass"
                detail="Route around an unavailable cache with origin rate limits."
                onChange={() => setFailOpen((value) => !value)}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-neutral-200 p-5 md:p-6 dark:border-neutral-800">
            <div
              aria-live="polite"
              className={
                'rounded-md border p-4 ' +
                riskStyles[result.riskTone].panel +
                ' ' +
                riskStyles[result.riskTone].text
              }
            >
              <div className="flex items-start gap-3">
                <RiskIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Current verdict</p>
                  <h3 className="mt-1 text-lg font-semibold">{result.riskLabel}</h3>
                  <p className="mt-1 text-sm leading-6 opacity-85">{result.riskDetail}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric
                label="Effective hit rate"
                value={Math.round(result.effectiveHitRatio) + '%'}
                detail={formatCompact(readRps) + ' reads/s enter the path'}
                tone="cyan"
              />
              <Metric
                label="Origin load"
                value={result.originLoadPercent + '%'}
                detail={formatCompact(result.originRps) + ' origin reads/s'}
                tone={result.originLoadPercent > 100 ? 'amber' : 'emerald'}
              />
              <Metric
                label="Modeled p99"
                value={formatCompact(result.p99LatencyMs) + ' ms'}
                detail={result.availabilityPercent.toFixed(2) + '% availability'}
                tone="violet"
              />
              <Metric
                label="Stale exposure"
                value={result.staleExposurePercent.toFixed(1) + '%'}
                detail={formatCompact(result.invalidationOpsPerSecond) + ' invalidation ops/s'}
                tone={result.staleExposurePercent > 3 ? 'amber' : 'emerald'}
              />
            </div>
          </div>

          <div className="border-b border-neutral-200 p-5 md:p-6 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
              <Layers3 aria-hidden="true" className="h-4 w-4" />
              Recommended architecture
            </div>
            <h3 className="mt-2 text-xl font-semibold text-neutral-950 md:text-2xl dark:text-white">
              {result.title}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {result.summary}
            </p>

            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="border-l-2 border-cyan-500 pl-3">
                <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Placement
                </dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-neutral-950 dark:text-white">
                  {result.placement}
                </dd>
              </div>
              <div className="border-l-2 border-violet-500 pl-3">
                <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Fill policy
                </dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-neutral-950 dark:text-white">
                  {result.fillPolicy}
                </dd>
              </div>
              <div className="border-l-2 border-amber-500 pl-3">
                <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Expiry
                </dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-neutral-950 dark:text-white">
                  {result.ttlGuidance}
                </dd>
              </div>
              <div className="border-l-2 border-emerald-500 pl-3">
                <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Failure fallback
                </dt>
                <dd className="mt-1 text-sm font-medium leading-6 text-neutral-950 dark:text-white">
                  {result.fallback}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-b border-neutral-200 p-5 md:p-6 dark:border-neutral-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                  <GitBranch aria-hidden="true" className="h-4 w-4" />
                  Request and data flow
                </div>
                <h3 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                  Follow the consequence through the path
                </h3>
              </div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {result.flowStatus}
              </p>
            </div>

            <div className="mt-5 hidden min-w-0 xl:block">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)]">
                <FlowNode
                  icon={Activity}
                  eyebrow="Demand"
                  title="Client requests"
                  metric={formatCompact(readRps) + ' reads/s'}
                  detail={workload.label}
                  state="normal"
                />
                <HorizontalConnector label="lookup" />
                <FlowNode
                  icon={Layers3}
                  eyebrow="Reuse"
                  title="Cache tier"
                  metric={cacheFailed ? 'Unavailable' : Math.round(result.effectiveHitRatio) + '% hits'}
                  detail={result.flowStatus}
                  state={cacheFailed ? 'failed' : 'active'}
                />
                <HorizontalConnector label={cacheFailed && !failOpen ? 'blocked' : 'miss'} active={!cacheFailed || failOpen} />
                <FlowNode
                  icon={Server}
                  eyebrow="Compute"
                  title="Origin service"
                  metric={result.originLoadPercent + '% load'}
                  detail={formatCompact(result.originRps) + ' reads/s'}
                  state={originWarning ? 'warning' : 'normal'}
                />
                <HorizontalConnector label="query" active={!cacheFailed || failOpen} />
                <FlowNode
                  icon={Database}
                  eyebrow="Authority"
                  title="Source of truth"
                  metric={formatCompact(mutationsPerMinute) + ' writes/min'}
                  detail={consistency + ' freshness contract'}
                  state="normal"
                />
              </div>

              <div className="mt-4 border-t border-dashed border-neutral-300 pt-4 dark:border-neutral-700">
                <div className="grid grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)]">
                  <FlowNode
                    icon={Database}
                    eyebrow="Mutation"
                    title="Committed change"
                    metric={formatCompact(mutationsPerMinute) + ' per min'}
                    detail="The source remains authoritative"
                    state="normal"
                  />
                  <HorizontalConnector label="publish" />
                  <FlowNode
                    icon={RotateCcw}
                    eyebrow="Policy"
                    title={INVALIDATION_CHOICES.find((option) => option.id === invalidation)?.label ?? invalidation}
                    metric={result.invalidationStatus}
                    detail="Freshness ownership is explicit"
                    state={invalidationWarning ? 'warning' : 'active'}
                  />
                  <HorizontalConnector label="refresh" active={!cacheFailed} />
                  <FlowNode
                    icon={Layers3}
                    eyebrow="Cache state"
                    title={cacheFailed ? 'Refresh unavailable' : 'Key state updated'}
                    metric={cacheFailed ? 'No cache writes' : formatCompact(result.invalidationOpsPerSecond) + ' ops/s'}
                    detail={cacheFailed ? 'Recovery must rebuild hot keys' : 'Readers observe the next cache state'}
                    state={cacheFailed ? 'failed' : invalidationWarning ? 'warning' : 'normal'}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 xl:hidden">
              <FlowNode
                icon={Activity}
                eyebrow="Demand"
                title="Client requests"
                metric={formatCompact(readRps) + ' reads/s'}
                detail={workload.label}
              />
              <VerticalConnector label="Lookup" />
              <FlowNode
                icon={Layers3}
                eyebrow="Reuse"
                title="Cache tier"
                metric={cacheFailed ? 'Unavailable' : Math.round(result.effectiveHitRatio) + '% hits'}
                detail={result.flowStatus}
                state={cacheFailed ? 'failed' : 'active'}
              />
              <VerticalConnector label={cacheFailed && !failOpen ? 'Requests blocked' : 'Miss or bypass'} />
              <FlowNode
                icon={Server}
                eyebrow="Compute"
                title="Origin service"
                metric={result.originLoadPercent + '% load'}
                detail={formatCompact(result.originRps) + ' reads/s'}
                state={originWarning ? 'warning' : 'normal'}
              />
              <VerticalConnector label="Authoritative query" />
              <FlowNode
                icon={Database}
                eyebrow="Authority"
                title="Source of truth"
                metric={formatCompact(mutationsPerMinute) + ' writes/min'}
                detail={consistency + ' freshness contract'}
              />

              <div className="my-5 border-t border-dashed border-neutral-300 dark:border-neutral-700" />

              <FlowNode
                icon={Database}
                eyebrow="Mutation"
                title="Committed change"
                metric={formatCompact(mutationsPerMinute) + ' per min'}
                detail="The source remains authoritative"
              />
              <VerticalConnector label="Publish change" />
              <FlowNode
                icon={RotateCcw}
                eyebrow="Policy"
                title={INVALIDATION_CHOICES.find((option) => option.id === invalidation)?.label ?? invalidation}
                metric={result.invalidationStatus}
                detail="Freshness ownership is explicit"
                state={invalidationWarning ? 'warning' : 'active'}
              />
              <VerticalConnector label="Refresh cache state" />
              <FlowNode
                icon={Layers3}
                eyebrow="Cache state"
                title={cacheFailed ? 'Refresh unavailable' : 'Key state updated'}
                metric={cacheFailed ? 'No cache writes' : formatCompact(result.invalidationOpsPerSecond) + ' ops/s'}
                detail={cacheFailed ? 'Recovery must rebuild hot keys' : 'Readers observe the next cache state'}
                state={cacheFailed ? 'failed' : invalidationWarning ? 'warning' : 'normal'}
              />
            </div>
          </div>

          <div className="grid min-w-0 md:grid-cols-2">
            <section className="min-w-0 border-b border-neutral-200 p-5 md:border-b-0 md:border-r md:p-6 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Why this fits
              </div>
              <ul className="mt-4 space-y-3">
                {result.fitReasons.map((reason) => (
                  <li key={reason} className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="min-w-0 p-5 md:p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                Guardrails now
              </div>
              <ul className="mt-4 space-y-3">
                {result.guardrails.map((guardrail) => (
                  <li key={guardrail} className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{guardrail}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
