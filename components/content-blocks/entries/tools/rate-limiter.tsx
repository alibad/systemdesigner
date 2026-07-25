'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Network,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  ShieldX,
  TimerReset,
  Users,
} from 'lucide-react';

type Algorithm =
  | 'token_bucket'
  | 'fixed_window'
  | 'sliding_window'
  | 'leaky_bucket';
type IdentityKey = 'tenant' | 'ip' | 'global';
type FailurePolicy = 'open' | 'closed';
type ScenarioId =
  | 'healthy'
  | 'burst'
  | 'abusive'
  | 'counter_lag'
  | 'retry_storm'
  | 'store_outage'
  | 'recovery'
  | 'custom';

type Policy = {
  algorithm: Algorithm;
  limit: number;
  windowSeconds: number;
  burstCapacity: number;
  queueCapacity: number;
  identityKey: IdentityKey;
  failurePolicy: FailurePolicy;
};

type Workload = {
  requestsPerSecond: number;
  tenantCount: number;
  abusiveSharePct: number;
  regions: number;
  counterLagMs: number;
  retries: number;
  backendCapacityRps: number;
};

type Scenario = {
  id: Exclude<ScenarioId, 'custom'>;
  label: string;
  shortLabel: string;
  detail: string;
  workload: Workload;
  burstMultiplier: number;
  burstSeconds: number;
  storeHealthy: boolean;
  recoveryFactor: number;
};

type GroupOutcome = {
  attempted: number;
  admitted: number;
  processed: number;
  queued: number;
  rejected: number;
};

type Model = {
  baseRequests: number;
  retryRequests: number;
  totalAttempts: number;
  admitted: number;
  rejected: number;
  queued: number;
  processed: number;
  overshoot: number;
  normal: GroupOutcome;
  abusive: GroupOutcome;
  normalAcceptancePct: number;
  abusiveAcceptancePct: number;
  backendRps: number;
  backendUtilizationPct: number;
  queueWaitMs: number;
  remainingUnits: number;
  remainingForExampleCaller: number;
  limiterUtilizationPct: number;
  retryAfterSeconds: number;
  statusCode: string;
  statusLabel: string;
  consequence: string;
  consequenceTone: 'healthy' | 'warning' | 'critical';
  distributionLabel: string;
  timeline: Array<{
    second: number;
    demand: number;
    admitted: number;
    rejected: number;
  }>;
};

type RangeControlProps = {
  id: string;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  leftLabel: string;
  rightLabel: string;
  onChange: (value: number) => void;
};

const HORIZON_SECONDS = 10;

const DEFAULT_POLICY: Policy = {
  algorithm: 'token_bucket',
  limit: 60,
  windowSeconds: 10,
  burstCapacity: 25,
  queueCapacity: 40,
  identityKey: 'tenant',
  failurePolicy: 'closed',
};

const DEFAULT_WORKLOAD: Workload = {
  requestsPerSecond: 105,
  tenantCount: 20,
  abusiveSharePct: 6,
  regions: 2,
  counterLagMs: 50,
  retries: 0,
  backendCapacityRps: 150,
};

const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    label: 'Healthy baseline',
    shortLabel: 'Healthy',
    detail: 'Balanced tenants and synchronized counters.',
    workload: DEFAULT_WORKLOAD,
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: true,
    recoveryFactor: 1,
  },
  {
    id: 'burst',
    label: 'Launch burst',
    shortLabel: 'Burst',
    detail: 'Traffic triples for two seconds.',
    workload: { ...DEFAULT_WORKLOAD, requestsPerSecond: 120 },
    burstMultiplier: 3,
    burstSeconds: 2,
    storeHealthy: true,
    recoveryFactor: 1,
  },
  {
    id: 'abusive',
    label: 'Abusive tenant',
    shortLabel: 'Abusive tenant',
    detail: 'One tenant generates most requests.',
    workload: {
      ...DEFAULT_WORKLOAD,
      requestsPerSecond: 170,
      abusiveSharePct: 72,
      tenantCount: 16,
    },
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: true,
    recoveryFactor: 1,
  },
  {
    id: 'counter_lag',
    label: 'Distributed-counter lag',
    shortLabel: 'Counter lag',
    detail: 'Four regions admit against stale state.',
    workload: {
      ...DEFAULT_WORKLOAD,
      requestsPerSecond: 185,
      abusiveSharePct: 38,
      regions: 4,
      counterLagMs: 900,
    },
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: true,
    recoveryFactor: 1,
  },
  {
    id: 'retry_storm',
    label: 'Retry storm',
    shortLabel: 'Retry storm',
    detail: 'Rejected callers retry three times.',
    workload: {
      ...DEFAULT_WORKLOAD,
      requestsPerSecond: 190,
      abusiveSharePct: 28,
      retries: 3,
    },
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: true,
    recoveryFactor: 1,
  },
  {
    id: 'store_outage',
    label: 'Counter-store outage',
    shortLabel: 'Store outage',
    detail: 'The limiter cannot read shared state.',
    workload: {
      ...DEFAULT_WORKLOAD,
      requestsPerSecond: 185,
      abusiveSharePct: 42,
      regions: 3,
    },
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: false,
    recoveryFactor: 1,
  },
  {
    id: 'recovery',
    label: 'Controlled recovery',
    shortLabel: 'Recovery',
    detail: 'Counters return while admission ramps.',
    workload: {
      ...DEFAULT_WORKLOAD,
      requestsPerSecond: 90,
      abusiveSharePct: 18,
      regions: 3,
      counterLagMs: 180,
      retries: 1,
    },
    burstMultiplier: 1,
    burstSeconds: 0,
    storeHealthy: true,
    recoveryFactor: 0.7,
  },
];

const ALGORITHM_COPY: Record<
  Algorithm,
  {
    label: string;
    contract: string;
    stateLabel: string;
    strength: string;
    risk: string;
  }
> = {
  token_bucket: {
    label: 'Token bucket',
    contract: 'Spend one token per request; refill continuously.',
    stateLabel: 'tokens available',
    strength: 'Absorbs short bursts while preserving a sustained rate.',
    risk: 'An oversized bucket sends a sharp burst downstream.',
  },
  fixed_window: {
    label: 'Fixed window',
    contract: 'Count requests inside aligned time windows.',
    stateLabel: 'window budget left',
    strength: 'Cheap counters and a simple client contract.',
    risk: 'A boundary burst can admit nearly two windows at once.',
  },
  sliding_window: {
    label: 'Sliding window',
    contract: 'Weight recent counters over a moving interval.',
    stateLabel: 'rolling budget left',
    strength: 'Smooths boundary behavior with bounded state.',
    risk: 'Approximation and replication lag can still overshoot.',
  },
  leaky_bucket: {
    label: 'Leaky bucket',
    contract: 'Queue arrivals and drain them at a fixed rate.',
    stateLabel: 'queue slots available',
    strength: 'Protects a backend with predictable output.',
    risk: 'Queueing turns overload into user-visible latency.',
  },
};

const TONE_CLASSES = {
  healthy:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100',
  critical:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function allocateGroup(
  attempted: number,
  identityCount: number,
  capacityPerIdentity: number,
  algorithm: Algorithm,
  queueCapacity: number,
  recoveryFactor: number,
): GroupOutcome {
  const processingCapacity =
    capacityPerIdentity * identityCount * recoveryFactor;
  const processed = Math.min(attempted, processingCapacity);
  const queueRoom =
    algorithm === 'leaky_bucket'
      ? queueCapacity * identityCount * recoveryFactor
      : 0;
  const queued = Math.min(Math.max(0, attempted - processed), queueRoom);
  const admitted = processed + queued;

  return {
    attempted,
    admitted,
    processed,
    queued,
    rejected: Math.max(0, attempted - admitted),
  };
}

function buildModel(
  policy: Policy,
  workload: Workload,
  scenario: Scenario,
): Model {
  const ratePerIdentity = policy.limit / policy.windowSeconds;
  const normalIdentityCount =
    policy.identityKey === 'global' ? 1 : Math.max(1, workload.tenantCount - 1);
  const abusiveIdentityCount =
    policy.identityKey === 'global'
      ? 1
      : policy.identityKey === 'ip'
        ? 6
        : 1;
  const identityBuckets =
    policy.identityKey === 'global'
      ? 1
      : normalIdentityCount + abusiveIdentityCount;
  const burstCapacity =
    policy.algorithm === 'token_bucket' ? policy.burstCapacity : 0;
  const capacityPerIdentity =
    ratePerIdentity * HORIZON_SECONDS + burstCapacity;

  const steadySeconds = HORIZON_SECONDS - scenario.burstSeconds;
  const baseRequests =
    workload.requestsPerSecond * steadySeconds +
    workload.requestsPerSecond *
      scenario.burstMultiplier *
      scenario.burstSeconds;
  const abusiveBase = baseRequests * (workload.abusiveSharePct / 100);
  const normalBase = baseRequests - abusiveBase;

  let normalInitial: GroupOutcome;
  let abusiveInitial: GroupOutcome;

  if (policy.identityKey === 'global') {
    const combined = allocateGroup(
      baseRequests,
      1,
      capacityPerIdentity,
      policy.algorithm,
      policy.queueCapacity,
      scenario.recoveryFactor,
    );
    const normalRatio = normalBase / Math.max(1, baseRequests);
    normalInitial = {
      attempted: normalBase,
      admitted: combined.admitted * normalRatio,
      processed: combined.processed * normalRatio,
      queued: combined.queued * normalRatio,
      rejected: combined.rejected * normalRatio,
    };
    abusiveInitial = {
      attempted: abusiveBase,
      admitted: combined.admitted * (1 - normalRatio),
      processed: combined.processed * (1 - normalRatio),
      queued: combined.queued * (1 - normalRatio),
      rejected: combined.rejected * (1 - normalRatio),
    };
  } else {
    normalInitial = allocateGroup(
      normalBase,
      normalIdentityCount,
      capacityPerIdentity,
      policy.algorithm,
      policy.queueCapacity,
      scenario.recoveryFactor,
    );
    abusiveInitial = allocateGroup(
      abusiveBase,
      abusiveIdentityCount,
      capacityPerIdentity,
      policy.algorithm,
      policy.queueCapacity,
      scenario.recoveryFactor,
    );
  }

  const initialRejected = normalInitial.rejected + abusiveInitial.rejected;
  const retryRequests = !scenario.storeHealthy
    ? policy.failurePolicy === 'closed'
      ? baseRequests * workload.retries * 0.7
      : 0
    : initialRejected * workload.retries * 0.7;
  const normalRejectedShare = !scenario.storeHealthy
    ? normalBase / Math.max(1, baseRequests)
    : normalInitial.rejected / Math.max(1, initialRejected);
  const normalAttempts =
    normalBase + retryRequests * normalRejectedShare;
  const abusiveAttempts =
    abusiveBase + retryRequests * (1 - normalRejectedShare);
  const totalAttempts = normalAttempts + abusiveAttempts;

  let normal = normalInitial;
  let abusive = abusiveInitial;

  if (retryRequests > 0) {
    if (policy.identityKey === 'global') {
      const combined = allocateGroup(
        totalAttempts,
        1,
        capacityPerIdentity,
        policy.algorithm,
        policy.queueCapacity,
        scenario.recoveryFactor,
      );
      const normalRatio = normalAttempts / Math.max(1, totalAttempts);
      normal = {
        attempted: normalAttempts,
        admitted: combined.admitted * normalRatio,
        processed: combined.processed * normalRatio,
        queued: combined.queued * normalRatio,
        rejected: combined.rejected * normalRatio,
      };
      abusive = {
        attempted: abusiveAttempts,
        admitted: combined.admitted * (1 - normalRatio),
        processed: combined.processed * (1 - normalRatio),
        queued: combined.queued * (1 - normalRatio),
        rejected: combined.rejected * (1 - normalRatio),
      };
    } else {
      normal = allocateGroup(
        normalAttempts,
        normalIdentityCount,
        capacityPerIdentity,
        policy.algorithm,
        policy.queueCapacity,
        scenario.recoveryFactor,
      );
      abusive = allocateGroup(
        abusiveAttempts,
        abusiveIdentityCount,
        capacityPerIdentity,
        policy.algorithm,
        policy.queueCapacity,
        scenario.recoveryFactor,
      );
    }
  }

  let admitted = normal.admitted + abusive.admitted;
  let processed = normal.processed + abusive.processed;
  let queued = normal.queued + abusive.queued;
  let rejected = normal.rejected + abusive.rejected;
  let overshoot = 0;

  if (!scenario.storeHealthy) {
    if (policy.failurePolicy === 'open') {
      admitted = totalAttempts;
      processed = totalAttempts;
      queued = 0;
      rejected = 0;
      normal = {
        attempted: normalAttempts,
        admitted: normalAttempts,
        processed: normalAttempts,
        queued: 0,
        rejected: 0,
      };
      abusive = {
        attempted: abusiveAttempts,
        admitted: abusiveAttempts,
        processed: abusiveAttempts,
        queued: 0,
        rejected: 0,
      };
    } else {
      admitted = 0;
      processed = 0;
      queued = 0;
      rejected = totalAttempts;
      normal = {
        attempted: normalAttempts,
        admitted: 0,
        processed: 0,
        queued: 0,
        rejected: normalAttempts,
      };
      abusive = {
        attempted: abusiveAttempts,
        admitted: 0,
        processed: 0,
        queued: 0,
        rejected: abusiveAttempts,
      };
    }
  } else {
    const lagSeconds = workload.counterLagMs / 1000;
    const lagExposure =
      totalAttempts *
      (lagSeconds / HORIZON_SECONDS) *
      ((workload.regions - 1) / workload.regions);
    const boundaryExposure =
      policy.algorithm === 'fixed_window' && scenario.id === 'burst'
        ? policy.limit * identityBuckets * 0.5
        : 0;
    const rejectedBeforeOvershoot = rejected;
    overshoot = Math.min(
      rejectedBeforeOvershoot,
      Math.max(0, lagExposure + boundaryExposure),
    );
    const normalOvershoot =
      overshoot * (normal.rejected / Math.max(1, rejectedBeforeOvershoot));
    const abusiveOvershoot = overshoot - normalOvershoot;
    normal = {
      ...normal,
      admitted: normal.admitted + normalOvershoot,
      processed: normal.processed + normalOvershoot,
      rejected: Math.max(0, normal.rejected - normalOvershoot),
    };
    abusive = {
      ...abusive,
      admitted: abusive.admitted + abusiveOvershoot,
      processed: abusive.processed + abusiveOvershoot,
      rejected: Math.max(0, abusive.rejected - abusiveOvershoot),
    };
    admitted += overshoot;
    processed += overshoot;
    rejected -= overshoot;
  }

  const backendRps = processed / HORIZON_SECONDS;
  const backendUtilizationPct = percent(
    backendRps,
    workload.backendCapacityRps,
  );
  const queueWaitMs =
    queued > 0
      ? (queued / Math.max(1, backendRps) / 2) * 1000
      : 0;
  const normalAcceptancePct = percent(normal.admitted, normal.attempted);
  const abusiveAcceptancePct = percent(
    abusive.admitted,
    abusive.attempted,
  );
  const totalStateUnits =
    policy.algorithm === 'leaky_bucket'
      ? policy.queueCapacity * identityBuckets
      : capacityPerIdentity * identityBuckets;
  const consumedUnits =
    policy.algorithm === 'leaky_bucket' ? queued : admitted;
  const remainingUnits = Math.max(0, totalStateUnits - consumedUnits);
  const normalAttemptRatePerIdentity =
    normal.attempted /
    HORIZON_SECONDS /
    Math.max(1, normalIdentityCount);
  const normalUnitsInCurrentWindow =
    normalAttemptRatePerIdentity *
    Math.min(policy.windowSeconds, HORIZON_SECONDS);
  const remainingForExampleCaller = Math.max(
    0,
    Math.min(policy.limit, policy.limit - normalUnitsInCurrentWindow),
  );
  const limiterUtilizationPct = clamp(
    percent(consumedUnits, totalStateUnits),
    0,
    100,
  );
  const retryAfterSeconds =
    policy.algorithm === 'token_bucket'
      ? Math.max(
          1,
          Math.ceil(rejected / Math.max(1, ratePerIdentity * identityBuckets)),
        )
      : policy.windowSeconds;

  let statusCode = rejected > 0 ? '429' : '200';
  let statusLabel = rejected > 0 ? 'Rate limited' : 'Within contract';
  let consequence =
    'The limiter preserves backend headroom and callers complete without throttling.';
  let consequenceTone: Model['consequenceTone'] = 'healthy';

  if (!scenario.storeHealthy && policy.failurePolicy === 'closed') {
    statusCode = '503';
    statusLabel = 'Limiter unavailable';
    consequence =
      'Fail-closed protects the backend, but every caller loses availability until shared state recovers.';
    consequenceTone = 'critical';
  } else if (!scenario.storeHealthy && policy.failurePolicy === 'open') {
    statusCode = '200';
    statusLabel = 'Unrestricted';
    consequence =
      'Fail-open preserves caller availability but sends unbounded traffic to the backend while enforcement is blind.';
    consequenceTone = 'critical';
  } else if (backendUtilizationPct > 100) {
    consequence =
      'Limiter overshoot or an overly permissive policy exceeds tested backend capacity; latency and failures now propagate to users.';
    consequenceTone = 'critical';
  } else if (queued > 0 && queueWaitMs > 500) {
    consequence =
      'The backend is protected, but queued callers wait long enough to threaten their latency budget.';
    consequenceTone = 'warning';
  } else if (rejected > 0 && normalAcceptancePct < 90) {
    consequence =
      'Healthy callers are being throttled with the noisy tenant; change the identity key or restore more capacity.';
    consequenceTone = 'warning';
  } else if (rejected > 0) {
    consequence =
      'Excess requests receive an explicit retry contract while admitted work stays inside backend capacity.';
    consequenceTone = 'healthy';
  } else if (scenario.id === 'recovery') {
    consequence =
      'Admission is deliberately ramped while counters converge; this avoids releasing a retry backlog all at once.';
    consequenceTone = 'healthy';
  }

  const timeline = Array.from({ length: HORIZON_SECONDS }, (_, index) => {
    const burstActive =
      scenario.burstSeconds > 0 &&
      index >= 3 &&
      index < 3 + scenario.burstSeconds;
    const demand =
      workload.requestsPerSecond *
      (burstActive ? scenario.burstMultiplier : 1);
    const attemptMultiplier = totalAttempts / Math.max(1, baseRequests);
    const attempts = demand * attemptMultiplier;
    const admittedForSecond =
      attempts * percent(admitted, totalAttempts) / 100;

    return {
      second: index + 1,
      demand: attempts,
      admitted: admittedForSecond,
      rejected: Math.max(0, attempts - admittedForSecond),
    };
  });

  const distributionLabel =
    policy.identityKey === 'tenant'
      ? `${workload.tenantCount} tenant budgets`
      : policy.identityKey === 'ip'
        ? `${identityBuckets} source-IP budgets`
        : 'one shared global budget';

  return {
    baseRequests,
    retryRequests,
    totalAttempts,
    admitted,
    rejected,
    queued,
    processed,
    overshoot,
    normal,
    abusive,
    normalAcceptancePct,
    abusiveAcceptancePct,
    backendRps,
    backendUtilizationPct,
    queueWaitMs,
    remainingUnits,
    remainingForExampleCaller,
    limiterUtilizationPct,
    retryAfterSeconds,
    statusCode,
    statusLabel,
    consequence,
    consequenceTone,
    distributionLabel,
    timeline,
  };
}

function RangeControl({
  id,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  leftLabel,
  rightLabel,
  onChange,
}: RangeControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="text-sm font-semibold text-neutral-950 dark:text-white"
          >
            {label}
          </label>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
        <output
          htmlFor={id}
          className="shrink-0 rounded-md bg-neutral-100 px-2.5 py-1 text-sm font-bold text-neutral-950 dark:bg-neutral-800 dark:text-white"
        >
          {value.toLocaleString()}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer accent-cyan-700 dark:accent-cyan-400"
      />
      <div className="flex justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{leftLabel}</span>
        <span className="text-right">{rightLabel}</span>
      </div>
    </div>
  );
}

function ChoiceButton({
  selected,
  label,
  detail,
  onClick,
}: {
  selected: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-16 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:focus-visible:ring-cyan-400 ${
        selected
          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
      }`}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span
        className={`mt-1 block text-xs leading-4 ${
          selected
            ? 'text-neutral-300 dark:text-neutral-600'
            : 'text-neutral-500 dark:text-neutral-400'
        }`}
      >
        {detail}
      </span>
    </button>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'cyan';
}) {
  const valueClass = {
    neutral: 'text-neutral-950 dark:text-white',
    green: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
    red: 'text-rose-700 dark:text-rose-300',
    cyan: 'text-cyan-700 dark:text-cyan-300',
  }[tone];

  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tracking-normal ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div
      className="flex items-center justify-center text-neutral-400 dark:text-neutral-600"
      aria-hidden="true"
    >
      <ArrowRight className="hidden h-5 w-5 md:block" />
      <ArrowDown className="h-5 w-5 md:hidden" />
    </div>
  );
}

function FlowNode({
  icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'cyan' | 'violet' | 'green' | 'red';
}) {
  const classes = {
    cyan: 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40',
    violet:
      'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40',
    green:
      'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    red: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
  }[tone];

  return (
    <div className={`min-h-32 rounded-md border p-4 ${classes}`}>
      <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
        {icon}
        <p className="text-xs font-bold uppercase tracking-normal">{eyebrow}</p>
      </div>
      <p className="mt-4 text-lg font-bold text-neutral-950 dark:text-white">
        {title}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {detail}
      </p>
    </div>
  );
}

export default function RateLimiterWorkbench() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [workload, setWorkload] = useState<Workload>(DEFAULT_WORKLOAD);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('healthy');
  const [scenarioState, setScenarioState] = useState<Scenario>(SCENARIOS[0]);

  const model = useMemo(
    () => buildModel(policy, workload, scenarioState),
    [policy, scenarioState, workload],
  );
  const algorithm = ALGORITHM_COPY[policy.algorithm];

  const updatePolicy = <K extends keyof Policy>(
    key: K,
    value: Policy[K],
  ) => {
    setPolicy((current) => ({ ...current, [key]: value }));
    setScenarioId('custom');
  };

  const updateWorkload = <K extends keyof Workload>(
    key: K,
    value: Workload[K],
  ) => {
    setWorkload((current) => ({ ...current, [key]: value }));
    setScenarioId('custom');
  };

  const applyScenario = (id: Exclude<ScenarioId, 'custom'>) => {
    const next = SCENARIOS.find((item) => item.id === id);
    if (!next) return;
    setScenarioId(id);
    setScenarioState(next);
    setWorkload(next.workload);
  };

  const reset = () => {
    setPolicy(DEFAULT_POLICY);
    setWorkload(DEFAULT_WORKLOAD);
    setScenarioId('healthy');
    setScenarioState(SCENARIOS[0]);
  };

  const maxTimelineDemand = Math.max(
    ...model.timeline.map((item) => item.demand),
    1,
  );
  const fairnessProtected =
    model.normalAcceptancePct >= 90 &&
    model.normalAcceptancePct > model.abusiveAcceptancePct + 10;
  const fairnessHasNoPressure = model.rejected < 0.5;
  const backendTone =
    model.backendUtilizationPct > 100
      ? 'red'
      : model.backendUtilizationPct > 80
        ? 'amber'
        : 'green';

  return (
    <section
      data-content-block="tools/rate-limiter"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-300 text-neutral-950">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-normal text-cyan-300">
                Traffic protection workbench
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-normal sm:text-2xl">
                Make the admission contract visible
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-300">
                Tune the limiter, shape caller behavior, and inject distributed
                failures to trace exactly who is admitted, delayed, or rejected.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-600 px-3 py-2 text-sm font-semibold text-white hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
              Challenge the healthy policy
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Each preset changes traffic or shared-state health. Policy choices stay
              under your control, so the same outage can be tested fail-open and
              fail-closed.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
          {SCENARIOS.map((item) => (
            <ChoiceButton
              key={item.id}
              selected={scenarioId === item.id}
              label={item.shortLabel}
              detail={item.detail}
              onClick={() => applyScenario(item.id)}
            />
          ))}
        </div>
      </section>

      <div className="grid border-b border-neutral-200 dark:border-neutral-800 xl:grid-cols-2">
        <section className="border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 xl:border-b-0 xl:border-r">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-xs font-bold text-white dark:bg-cyan-300 dark:text-neutral-950">
              1
            </span>
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Define the admission policy
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Algorithm, rate, burst state, and identity decide the budget each
                caller can consume.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
              Algorithm
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(ALGORITHM_COPY) as Algorithm[]).map((id) => (
                <ChoiceButton
                  key={id}
                  selected={policy.algorithm === id}
                  label={ALGORITHM_COPY[id].label}
                  detail={ALGORITHM_COPY[id].contract}
                  onClick={() => updatePolicy('algorithm', id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <RangeControl
              id="rate-limit"
              label="Requests per window"
              description="Budget assigned to each identity."
              value={policy.limit}
              min={10}
              max={240}
              step={10}
              suffix=""
              leftLabel="10"
              rightLabel="240"
              onChange={(value) => updatePolicy('limit', value)}
            />
            <RangeControl
              id="rate-window"
              label="Window duration"
              description={`${(policy.limit / policy.windowSeconds).toFixed(1)} req/s sustained per identity.`}
              value={policy.windowSeconds}
              min={1}
              max={60}
              suffix="s"
              leftLabel="1 second"
              rightLabel="60 seconds"
              onChange={(value) => updatePolicy('windowSeconds', value)}
            />
            {policy.algorithm === 'leaky_bucket' ? (
              <RangeControl
                id="rate-queue"
                label="Queue slots per identity"
                description="Excess accepted now and drained later."
                value={policy.queueCapacity}
                min={0}
                max={120}
                step={5}
                suffix=""
                leftLabel="Drop immediately"
                rightLabel="120 slots"
                onChange={(value) => updatePolicy('queueCapacity', value)}
              />
            ) : (
              <RangeControl
                id="rate-burst"
                label="Burst allowance"
                description={
                  policy.algorithm === 'token_bucket'
                    ? 'Tokens initially available above sustained refill.'
                    : 'Only token bucket spends this allowance.'
                }
                value={policy.burstCapacity}
                min={0}
                max={120}
                step={5}
                suffix=""
                leftLabel="No burst"
                rightLabel="120 requests"
                onChange={(value) => updatePolicy('burstCapacity', value)}
              />
            )}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Identity key
              </p>
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The boundary that receives one independent budget.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['tenant', 'Tenant'],
                    ['ip', 'Source IP'],
                    ['global', 'Global'],
                  ] as const
                ).map(([id, label]) => {
                  const selected = policy.identityKey === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updatePolicy('identityKey', id)}
                      className={`min-h-10 rounded-md border px-2 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:focus-visible:ring-cyan-400 ${
                        selected
                          ? 'border-cyan-800 bg-cyan-800 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start gap-3">
              <Gauge
                className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-neutral-950 dark:text-white">
                  {algorithm.label}: {algorithm.stateLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {formatNumber(model.remainingUnits)} units remain across{' '}
                  {model.distributionLabel}. {algorithm.strength}
                </p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-cyan-600 dark:bg-cyan-400"
                style={{ width: `${model.limiterUtilizationPct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{model.limiterUtilizationPct.toFixed(0)}% consumed</span>
              <span className="text-right">{algorithm.risk}</span>
            </div>
          </div>
        </section>

        <section className="bg-white p-4 dark:bg-neutral-950 sm:p-6">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white dark:bg-violet-300 dark:text-neutral-950">
              2
            </span>
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Shape callers and distributed state
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Demand, identity skew, retries, regions, and synchronization change
                both fairness and backend pressure.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <RangeControl
              id="rate-traffic"
              label="Base request rate"
              value={workload.requestsPerSecond}
              min={20}
              max={400}
              step={5}
              suffix="/s"
              leftLabel="20 req/s"
              rightLabel="400 req/s"
              onChange={(value) => updateWorkload('requestsPerSecond', value)}
            />
            <RangeControl
              id="rate-tenants"
              label="Active tenants"
              description="One tenant is modeled as the noisy caller."
              value={workload.tenantCount}
              min={2}
              max={60}
              suffix=""
              leftLabel="2 tenants"
              rightLabel="60 tenants"
              onChange={(value) => updateWorkload('tenantCount', value)}
            />
            <RangeControl
              id="rate-abusive-share"
              label="Noisy-tenant traffic share"
              value={workload.abusiveSharePct}
              min={2}
              max={90}
              step={2}
              suffix="%"
              leftLabel="2% balanced"
              rightLabel="90% abusive"
              onChange={(value) => updateWorkload('abusiveSharePct', value)}
            />
            <RangeControl
              id="rate-retries"
              label="Retries after rejection"
              description="70% of rejected requests retry per configured attempt."
              value={workload.retries}
              min={0}
              max={4}
              suffix=""
              leftLabel="No retry"
              rightLabel="4 retries"
              onChange={(value) => updateWorkload('retries', value)}
            />
            <RangeControl
              id="rate-regions"
              label="Admission regions"
              value={workload.regions}
              min={1}
              max={6}
              suffix=""
              leftLabel="One region"
              rightLabel="Six regions"
              onChange={(value) => updateWorkload('regions', value)}
            />
            <RangeControl
              id="rate-counter-lag"
              label="Counter propagation lag"
              value={workload.counterLagMs}
              min={0}
              max={2000}
              step={50}
              suffix="ms"
              leftLabel="Atomic"
              rightLabel="2 seconds stale"
              onChange={(value) => updateWorkload('counterLagMs', value)}
            />
            <RangeControl
              id="rate-backend"
              label="Tested backend capacity"
              value={workload.backendCapacityRps}
              min={40}
              max={400}
              step={10}
              suffix="/s"
              leftLabel="40 req/s"
              rightLabel="400 req/s"
              onChange={(value) =>
                updateWorkload('backendCapacityRps', value)
              }
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Counter-store failure
              </p>
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Used when the Store outage challenge is active.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['closed', 'Fail closed'],
                    ['open', 'Fail open'],
                  ] as const
                ).map(([id, label]) => {
                  const selected = policy.failurePolicy === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updatePolicy('failurePolicy', id)}
                      className={`min-h-10 rounded-md border px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-400 ${
                        selected
                          ? 'border-violet-800 bg-violet-800 text-white dark:border-violet-300 dark:bg-violet-300 dark:text-neutral-950'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
                Retry amplification
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  model.retryRequests > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                +{formatNumber(model.retryRequests)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                extra attempts over {HORIZON_SECONDS}s
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
                Distributed overshoot
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  model.overshoot > 0
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {formatNumber(model.overshoot)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                requests admitted on stale evidence
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="border-b border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
              Request path | {scenarioId === 'custom' ? 'Custom pressure' : scenarioState.label}
            </p>
            <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
              Trace admission, rejection, and backend load
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              Values cover a deterministic {HORIZON_SECONDS}-second observation. Queue
              depth is accepted work waiting to drain; it is not backend throughput.
            </p>
          </div>
          <div
            className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${TONE_CLASSES[model.consequenceTone]}`}
            role="status"
            aria-live="polite"
          >
            {model.consequenceTone === 'healthy' ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            )}
            {model.statusCode} | {model.statusLabel}
          </div>
        </div>

        <div
          className="mt-6 grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)]"
          role="img"
          aria-label={`${formatNumber(model.totalAttempts)} caller attempts reach the limiter. ${formatNumber(model.admitted)} are admitted, ${formatNumber(model.rejected)} are rejected, and the backend receives ${model.backendRps.toFixed(1)} requests per second.`}
        >
          <FlowNode
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            eyebrow="Callers"
            title={`${formatNumber(model.totalAttempts)} attempts`}
            detail={`${formatNumber(model.baseRequests)} original + ${formatNumber(model.retryRequests)} retries`}
            tone="violet"
          />
          <FlowArrow />
          <FlowNode
            icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            eyebrow={algorithm.label}
            title={`${formatNumber(model.admitted)} admitted`}
            detail={`${model.distributionLabel}; ${formatNumber(model.queued)} queued`}
            tone="cyan"
          />
          <FlowArrow />
          <FlowNode
            icon={<Server className="h-4 w-4" aria-hidden="true" />}
            eyebrow="Protected backend"
            title={`${model.backendRps.toFixed(1)} req/s`}
            detail={`${model.backendUtilizationPct.toFixed(0)}% of tested capacity`}
            tone={model.backendUtilizationPct > 100 ? 'red' : 'green'}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)]">
          <div className="hidden md:block" />
          <div className="hidden md:block" />
          {model.rejected > 0 ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/40">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
                <Ban className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-normal">
                  Rejection path
                </p>
              </div>
              <p className="mt-2 text-sm font-bold text-rose-950 dark:text-rose-100">
                {formatNumber(model.rejected)} requests stopped
              </p>
              <p className="mt-1 text-xs leading-5 text-rose-800 dark:text-rose-200">
                Return {model.statusCode} with retry guidance; do not immediately
                replay the same rejected load.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-normal">
                  Admission result
                </p>
              </div>
              <p className="mt-2 text-sm font-bold text-emerald-950 dark:text-emerald-100">
                No requests rejected
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                Every caller remains within the configured admission contract.
              </p>
            </div>
          )}
          <div className="hidden md:block" />
          <div className="hidden md:block" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Admitted"
            value={formatNumber(model.admitted)}
            detail={`${percent(model.admitted, model.totalAttempts).toFixed(1)}% of attempts`}
            tone="green"
          />
          <Metric
            label="Rejected"
            value={formatNumber(model.rejected)}
            detail={
              model.rejected > 0
                ? `${percent(model.rejected, model.totalAttempts).toFixed(1)}% receive ${model.statusCode}`
                : 'No client throttling'
            }
            tone={model.rejected > 0 ? 'red' : 'green'}
          />
          <Metric
            label="Queue"
            value={formatNumber(model.queued)}
            detail={
              model.queued > 0
                ? `${model.queueWaitMs.toFixed(0)}ms estimated average wait`
                : 'No admitted request is waiting'
            }
            tone={model.queueWaitMs > 500 ? 'amber' : 'neutral'}
          />
          <Metric
            label="Backend load"
            value={`${model.backendUtilizationPct.toFixed(0)}%`}
            detail={`${model.backendRps.toFixed(1)} of ${workload.backendCapacityRps} req/s`}
            tone={backendTone}
          />
        </div>
      </section>

      <section className="grid border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <Activity
              className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                See demand collide with the budget
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Each bar is one second. Violet is admitted work; rose is rejected
                demand. The burst preset raises seconds four and five.
              </p>
            </div>
          </div>
          <div className="mt-6 grid h-48 grid-cols-10 items-end gap-1.5 sm:gap-2">
            {model.timeline.map((point) => {
              const admittedHeight =
                (point.admitted / maxTimelineDemand) * 100;
              const rejectedHeight =
                (point.rejected / maxTimelineDemand) * 100;
              return (
                <div
                  key={point.second}
                  className="flex h-full min-w-0 flex-col justify-end"
                  title={`Second ${point.second}: ${formatNumber(point.demand)} demand, ${formatNumber(point.admitted)} admitted, ${formatNumber(point.rejected)} rejected`}
                >
                  <div className="flex h-40 flex-col justify-end overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900">
                    <div
                      className="w-full bg-rose-500 dark:bg-rose-400"
                      style={{ height: `${rejectedHeight}%` }}
                    />
                    <div
                      className="w-full bg-violet-600 dark:bg-violet-400"
                      style={{ height: `${admittedHeight}%` }}
                    />
                  </div>
                  <span className="mt-2 text-center text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                    {point.second}s
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-600 dark:bg-violet-400" />
              Admitted
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 dark:bg-rose-400" />
              Rejected
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Users
              className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Inspect noisy-neighbor isolation
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Compare completion rates directly; a single global budget cannot
                protect normal tenants from an abusive caller.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {[
              {
                label: 'Normal tenants',
                value: model.normalAcceptancePct,
                detail: `${formatNumber(model.normal.admitted)} of ${formatNumber(model.normal.attempted)} attempts`,
                color: 'bg-cyan-600 dark:bg-cyan-400',
              },
              {
                label: 'Noisy tenant',
                value: model.abusiveAcceptancePct,
                detail: `${formatNumber(model.abusive.admitted)} of ${formatNumber(model.abusive.attempted)} attempts`,
                color: 'bg-violet-600 dark:bg-violet-400',
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-neutral-950 dark:text-white">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {item.detail}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-neutral-950 dark:text-white">
                    {item.value.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${clamp(item.value, 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-6 rounded-md border p-4 ${
              fairnessHasNoPressure || fairnessProtected
                ? TONE_CLASSES.healthy
                : model.normalAcceptancePct < 90
                  ? TONE_CLASSES.warning
                  : 'border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {fairnessHasNoPressure || fairnessProtected ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Users className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {fairnessHasNoPressure
                    ? 'All callers are within contract'
                    : fairnessProtected
                      ? 'Normal tenants are isolated'
                    : policy.identityKey === 'global'
                      ? 'Callers share one fate'
                      : 'Isolation needs more headroom'}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {fairnessHasNoPressure
                    ? "No caller group needs to consume another group's budget in this observation."
                    : policy.identityKey === 'ip'
                    ? 'Source IPs can be rotated or shared. Use authenticated tenant or API-key identity when that is the real fairness boundary.'
                    : policy.identityKey === 'global'
                      ? 'The abusive caller consumes the same global budget as healthy callers.'
                      : 'Tenant-scoped budgets make the noisy caller spend only its own allowance.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid bg-neutral-50 dark:bg-neutral-900 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <TimerReset
              className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Return a usable client contract
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Clients need an explicit limit, remaining budget, reset time, and
                retry delay. Add jitter and cap retries.
              </p>
            </div>
          </div>
          <dl className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950">
            {[
              ['HTTP status', model.statusCode],
              [
                'RateLimit-Limit',
                `${policy.limit};w=${policy.windowSeconds}`,
              ],
              [
                'RateLimit-Remaining',
                formatNumber(model.remainingForExampleCaller),
              ],
              ['RateLimit-Reset', `${policy.windowSeconds}`],
              [
                'Retry-After',
                model.rejected > 0 ? `${model.retryAfterSeconds}` : 'not sent',
              ],
            ].map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-800"
              >
                <dt className="min-w-0 break-words text-neutral-500 dark:text-neutral-400">
                  {term}
                </dt>
                <dd className="font-bold text-neutral-950 dark:text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <RefreshCw
              className="mt-0.5 h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-300">
              Retry after the advertised delay with exponential backoff and jitter.
              Immediate retries convert intentional load shedding into a retry storm.
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Network
              className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Read the operational consequence
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The limiter is correct only when its availability policy, identity
                boundary, and backend budget match the product contract.
              </p>
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-5 ${TONE_CLASSES[model.consequenceTone]}`}>
            <div className="flex items-start gap-3">
              {model.consequenceTone === 'healthy' ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : model.consequenceTone === 'critical' ? (
                <ShieldX className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {model.consequenceTone === 'healthy'
                    ? 'Protection contract holds'
                    : model.consequenceTone === 'critical'
                      ? 'Users or the backend are exposed'
                      : 'Policy needs adjustment'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-90">
                  {model.consequence}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                <Database className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-normal">
                  Shared-state verdict
                </p>
              </div>
              <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">
                {!scenarioState.storeHealthy
                  ? `Unavailable | fail ${policy.failurePolicy}`
                  : workload.counterLagMs > 500
                    ? 'Stale counters'
                    : scenarioId === 'recovery'
                      ? 'Converging cautiously'
                      : 'Synchronized'}
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {workload.regions} region{workload.regions === 1 ? '' : 's'} |{' '}
                {workload.counterLagMs}ms propagation
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-bold uppercase tracking-normal">
                  Recovery guidance
                </p>
              </div>
              <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">
                Ramp, do not release
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Refill budgets gradually, expire retry backlogs, and verify counters
                converge before restoring full admission.
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
