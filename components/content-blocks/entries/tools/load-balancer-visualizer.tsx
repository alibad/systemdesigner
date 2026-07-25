'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Gauge,
  GitBranch,
  HeartPulse,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  Server,
  ShieldCheck,
  ShieldX,
  Timer,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';

type Algorithm = 'round-robin' | 'capacity-aware' | 'weighted' | 'latency-aware';
type HealthPolicy = 'passive' | 'active';
type RetryPolicy = 'none' | 'bounded' | 'aggressive';
type Challenge =
  | 'baseline'
  | 'node-failure'
  | 'slow-instance'
  | 'hotspot'
  | 'zone-loss'
  | 'retry-storm'
  | 'recovery';
type BackendStatus = 'healthy' | 'warm' | 'slow' | 'saturated' | 'ejected';

interface BackendInput {
  id: string;
  name: string;
  zone: 'zone-a' | 'zone-b';
  capacity: number;
  weight: number;
  baseLatency: number;
  enabled: boolean;
}

interface BackendResult extends BackendInput {
  effectiveCapacity: number;
  observedLatency: number;
  share: number;
  incoming: number;
  served: number;
  queued: number;
  saturation: number;
  status: BackendStatus;
  ejectionReason: string | null;
}

interface ModelResult {
  backends: BackendResult[];
  effectiveRps: number;
  retryRate: number;
  availability: number;
  p95: number;
  queueDepth: number;
  droppedRps: number;
  ejectedCount: number;
  summary: string;
  consequence: string;
  action: string;
  severity: 'healthy' | 'warning' | 'critical';
}

const INITIAL_BACKENDS: BackendInput[] = [
  {
    id: 'api-a1',
    name: 'API A1',
    zone: 'zone-a',
    capacity: 460,
    weight: 3,
    baseLatency: 48,
    enabled: true,
  },
  {
    id: 'api-a2',
    name: 'API A2',
    zone: 'zone-a',
    capacity: 360,
    weight: 2,
    baseLatency: 64,
    enabled: true,
  },
  {
    id: 'api-b1',
    name: 'API B1',
    zone: 'zone-b',
    capacity: 520,
    weight: 4,
    baseLatency: 42,
    enabled: true,
  },
  {
    id: 'api-b2',
    name: 'API B2',
    zone: 'zone-b',
    capacity: 410,
    weight: 3,
    baseLatency: 58,
    enabled: true,
  },
];

const ALGORITHMS: Array<{
  id: Algorithm;
  label: string;
  description: string;
}> = [
  {
    id: 'round-robin',
    label: 'Round robin',
    description: 'Equal turns across every backend still in the pool.',
  },
  {
    id: 'capacity-aware',
    label: 'Capacity aware',
    description: 'More proven throughput earns a larger request share.',
  },
  {
    id: 'weighted',
    label: 'Weighted',
    description: 'Operator weights define the intended traffic split.',
  },
  {
    id: 'latency-aware',
    label: 'Latency aware',
    description: 'Faster observed backends receive more new work.',
  },
];

const CHALLENGES = [
  {
    id: 'baseline' as const,
    label: 'Healthy',
    description: 'All backends are available.',
    icon: ShieldCheck,
  },
  {
    id: 'node-failure' as const,
    label: 'Node failure',
    description: 'API A2 stops responding.',
    icon: ShieldX,
  },
  {
    id: 'slow-instance' as const,
    label: 'Slow instance',
    description: 'API B1 stalls at 390 ms.',
    icon: Timer,
  },
  {
    id: 'hotspot' as const,
    label: 'Hotspot',
    description: 'One affinity shard dominates.',
    icon: Zap,
  },
  {
    id: 'zone-loss' as const,
    label: 'Zone loss',
    description: 'Every Zone A backend disappears.',
    icon: WifiOff,
  },
  {
    id: 'retry-storm' as const,
    label: 'Retry storm',
    description: 'Clients multiply attempts.',
    icon: RefreshCw,
  },
  {
    id: 'recovery' as const,
    label: 'Recovery',
    description: 'Zone A returns while caches warm.',
    icon: HeartPulse,
  },
];

const STATUS_STYLES: Record<
  BackendStatus,
  {
    label: string;
    dot: string;
    border: string;
    surface: string;
    text: string;
    route: string;
  }
> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    border: 'border-emerald-300 dark:border-emerald-700',
    surface: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-200',
    route: 'text-emerald-500 dark:text-emerald-400',
  },
  warm: {
    label: 'Warming',
    dot: 'bg-cyan-500',
    border: 'border-cyan-300 dark:border-cyan-700',
    surface: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-800 dark:text-cyan-200',
    route: 'text-cyan-500 dark:text-cyan-400',
  },
  slow: {
    label: 'Slow',
    dot: 'bg-amber-500',
    border: 'border-amber-300 dark:border-amber-700',
    surface: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-900 dark:text-amber-200',
    route: 'text-amber-500 dark:text-amber-400',
  },
  saturated: {
    label: 'Saturated',
    dot: 'bg-orange-500',
    border: 'border-orange-300 dark:border-orange-700',
    surface: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-900 dark:text-orange-200',
    route: 'text-orange-500 dark:text-orange-400',
  },
  ejected: {
    label: 'Ejected',
    dot: 'bg-rose-500',
    border: 'border-rose-300 dark:border-rose-800',
    surface: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-900 dark:text-rose-200',
    route: 'text-rose-400 dark:text-rose-500',
  },
};

const NODE_POSITIONS: Record<string, { y: number; top: string }> = {
  'api-a1': { y: 68, top: '4%' },
  'api-a2': { y: 154, top: '25%' },
  'api-b1': { y: 280, top: '55%' },
  'api-b2': { y: 366, top: '76%' },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function getScenarioState(
  backend: BackendInput,
  challenge: Challenge,
  healthPolicy: HealthPolicy,
) {
  const scenarioFailure =
    (challenge === 'node-failure' && backend.id === 'api-a2') ||
    (challenge === 'zone-loss' && backend.zone === 'zone-a');
  const scenarioSlow = challenge === 'slow-instance' && backend.id === 'api-b1';
  const warming = challenge === 'recovery' && backend.zone === 'zone-a';
  const observedLatency =
    backend.baseLatency + (scenarioSlow ? 348 : 0) + (warming ? 96 : 0);
  const ejectedForLatency = healthPolicy === 'active' && observedLatency >= 220;
  const ejected = !backend.enabled || scenarioFailure || ejectedForLatency;

  let ejectionReason: string | null = null;
  if (!backend.enabled) ejectionReason = 'Manually removed from rotation';
  else if (scenarioFailure) ejectionReason = 'Health check failed';
  else if (ejectedForLatency) ejectionReason = 'Latency threshold exceeded';

  const latencyPenalty = clamp(backend.baseLatency / observedLatency, 0.24, 1);
  const warmupPenalty = warming ? 0.58 : 1;

  return {
    observedLatency,
    ejected,
    ejectionReason,
    warming,
    effectiveCapacity: ejected
      ? 0
      : backend.capacity * latencyPenalty * warmupPenalty,
  };
}

function getRouteScore(
  backend: BackendInput,
  algorithm: Algorithm,
  effectiveCapacity: number,
  observedLatency: number,
) {
  if (algorithm === 'capacity-aware') return effectiveCapacity;
  if (algorithm === 'weighted') return backend.weight;
  if (algorithm === 'latency-aware') return 1000 / observedLatency;
  return 1;
}

function deriveModel({
  backends,
  algorithm,
  challenge,
  trafficRps,
  healthPolicy,
  retryPolicy,
  stickySessions,
}: {
  backends: BackendInput[];
  algorithm: Algorithm;
  challenge: Challenge;
  trafficRps: number;
  healthPolicy: HealthPolicy;
  retryPolicy: RetryPolicy;
  stickySessions: boolean;
}): ModelResult {
  const scenarioBackends = backends.map((backend) => ({
    backend,
    ...getScenarioState(backend, challenge, healthPolicy),
  }));
  const eligible = scenarioBackends.filter((backend) => !backend.ejected);
  const failedFraction = 1 - eligible.length / backends.length;
  const retryBase =
    retryPolicy === 'none'
      ? 0
      : retryPolicy === 'bounded'
        ? failedFraction > 0
          ? 0.12
          : 0.02
        : 0.26 + failedFraction * 0.28;
  const retryRate = clamp(
    retryBase +
      (challenge === 'retry-storm' ? 0.78 : 0) +
      (challenge === 'recovery' ? 0.08 : 0),
    0,
    1.35,
  );
  const effectiveRps = trafficRps * (1 + retryRate);

  const routeScores = new Map<string, number>();
  for (const item of eligible) {
    let score = getRouteScore(
      item.backend,
      algorithm,
      item.effectiveCapacity,
      item.observedLatency,
    );

    if (stickySessions) {
      const affinityBias: Record<string, number> = {
        'api-a1': 1.22,
        'api-a2': 0.86,
        'api-b1': 1.12,
        'api-b2': 0.8,
      };
      score *= affinityBias[item.backend.id];
    }

    if (challenge === 'hotspot' && item.backend.id === 'api-a1') {
      score *= stickySessions ? 4.4 : 2.5;
    }

    routeScores.set(item.backend.id, score);
  }

  const scoreTotal = Array.from(routeScores.values()).reduce(
    (sum, score) => sum + score,
    0,
  );

  const results: BackendResult[] = scenarioBackends.map((item) => {
    const share =
      scoreTotal === 0 ? 0 : (routeScores.get(item.backend.id) ?? 0) / scoreTotal;
    const incoming = effectiveRps * share;
    const served = Math.min(incoming, item.effectiveCapacity);
    const queued = Math.max(0, incoming - item.effectiveCapacity);
    const saturation =
      item.effectiveCapacity === 0 ? 0 : incoming / item.effectiveCapacity;

    let status: BackendStatus = 'healthy';
    if (item.ejected) status = 'ejected';
    else if (saturation >= 1) status = 'saturated';
    else if (item.observedLatency >= 220) status = 'slow';
    else if (item.warming) status = 'warm';

    return {
      ...item.backend,
      effectiveCapacity: item.effectiveCapacity,
      observedLatency: item.observedLatency,
      share,
      incoming,
      served,
      queued,
      saturation,
      status,
      ejectionReason: item.ejectionReason,
    };
  });

  const totalServedAttempts = results.reduce(
    (sum, backend) => sum + backend.served,
    0,
  );
  const completedOriginalRps = Math.min(
    trafficRps,
    totalServedAttempts / Math.max(1, 1 + retryRate),
  );
  const availability =
    trafficRps === 0 ? 100 : (completedOriginalRps / trafficRps) * 100;
  const queueDepth = results.reduce((sum, backend) => sum + backend.queued, 0);
  const droppedRps = Math.max(0, trafficRps - completedOriginalRps);
  const routedRps = results.reduce((sum, backend) => sum + backend.incoming, 0);
  const weightedLatency =
    routedRps === 0
      ? 0
      : results.reduce((sum, backend) => {
          const queuePenalty = Math.max(0, backend.saturation - 0.72) * 360;
          return sum + (backend.observedLatency + queuePenalty) * backend.incoming;
        }, 0) / routedRps;
  const p95 = clamp(weightedLatency + (100 - availability) * 7, 0, 2500);
  const ejectedCount = results.filter(
    (backend) => backend.status === 'ejected',
  ).length;

  let severity: ModelResult['severity'] = 'healthy';
  if (availability < 95 || queueDepth > trafficRps * 0.25) severity = 'critical';
  else if (availability < 99.9 || p95 > 220 || queueDepth > 0) severity = 'warning';

  const outcomeByChallenge: Record<
    Challenge,
    Pick<ModelResult, 'summary' | 'consequence' | 'action'>
  > = {
    baseline: {
      summary: 'The pool is serving the declared traffic.',
      consequence:
        severity === 'healthy'
          ? 'Users see stable response times and the fleet keeps usable headroom.'
          : 'The healthy topology is still underprovisioned for this traffic shape.',
      action:
        severity === 'healthy'
          ? 'Raise traffic or change the algorithm to find the first pressure point.'
          : 'Add capacity or reduce affinity skew before treating the baseline as safe.',
    },
    'node-failure': {
      summary: 'One backend has been removed from the serving pool.',
      consequence:
        availability >= 99.9
          ? 'Users stay online, but the surviving nodes absorb the lost capacity.'
          : 'Some requests queue or time out while traffic is redistributed.',
      action:
        'Keep failure detection fast, preserve spare capacity, and bound retries during redistribution.',
    },
    'slow-instance': {
      summary:
        healthPolicy === 'active'
          ? 'The slow backend is ejected before it can dominate tail latency.'
          : 'The slow backend remains eligible and accumulates work.',
      consequence:
        p95 > 220
          ? 'A subset of users sees long waits even when average capacity looks adequate.'
          : 'The latency threshold contains the slow-node impact.',
      action:
        healthPolicy === 'active'
          ? 'Tune the threshold against real latency distributions to avoid false ejections.'
          : 'Switch to active latency ejection or remove the slow backend manually.',
    },
    hotspot: {
      summary: 'Affinity has concentrated requests on one backend.',
      consequence:
        queueDepth > 0
          ? 'Users mapped to the hot shard queue while other capacity sits underused.'
          : 'The pool absorbs the skew, but the hottest node has the least headroom.',
      action:
        'Rebalance the key space, cap tenant traffic, or use bounded-load hashing.',
    },
    'zone-loss': {
      summary: 'Half of the failure domains are unavailable.',
      consequence:
        availability >= 99.9
          ? 'The remaining zone carries traffic without crossing the user SLO.'
          : 'Users see errors because regional reserve is below the offered load.',
      action:
        'Provision N+1 zone capacity and test whether retry budgets survive a full-zone loss.',
    },
    'retry-storm': {
      summary: 'Retries are consuming the same capacity needed for original requests.',
      consequence:
        availability >= 99.9
          ? 'The fleet absorbs amplification, but reserve disappears quickly.'
          : 'Retry amplification turns latency into user-visible timeouts and dropped work.',
      action:
        'Use bounded attempts, exponential backoff, jitter, and a retry budget at the caller.',
    },
    recovery: {
      summary: 'Recovered backends are warming caches and rebuilding connections.',
      consequence:
        queueDepth > 0
          ? 'Sending full traffic immediately creates another latency spike.'
          : 'Gradual re-entry keeps the recovery path inside the serving budget.',
      action:
        'Ramp weight slowly, verify health under real traffic, then restore normal retry policy.',
    },
  };

  return {
    backends: results,
    effectiveRps,
    retryRate,
    availability,
    p95,
    queueDepth,
    droppedRps,
    ejectedCount,
    severity,
    ...outcomeByChallenge[challenge],
  };
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
  tone: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const valueColor = {
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-800 dark:text-amber-300',
    rose: 'text-rose-700 dark:text-rose-300',
    violet: 'text-violet-700 dark:text-violet-300',
  }[tone];

  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function BackendButton({
  backend,
  selected,
  onSelect,
  compact = false,
}: {
  backend: BackendResult;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const style = STATUS_STYLES[backend.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${backend.name}, ${style.label}, ${Math.round(
        backend.share * 100,
      )}% of attempts`}
      className={`border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-neutral-950 ${
        compact ? 'min-h-24 p-3' : 'h-[74px] px-4 py-3'
      } ${style.border} ${style.surface} ${
        selected
          ? 'ring-2 ring-blue-600 ring-offset-2 dark:ring-blue-400 dark:ring-offset-neutral-950'
          : 'hover:border-neutral-500 dark:hover:border-neutral-400'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-neutral-950 dark:text-white">
          {backend.name}
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-bold ${style.text}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
          {style.label}
        </span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <span>{Math.round(backend.share * 100)}% routed</span>
        <span className="font-mono">{formatCompact(backend.incoming)} rps</span>
      </span>
      {compact ? (
        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
          {backend.queued > 0
            ? `${formatCompact(backend.queued)} queued`
            : `${Math.round(backend.saturation * 100)}% utilized`}
        </span>
      ) : null}
    </button>
  );
}

function DesktopTopology({
  model,
  algorithmLabel,
  selectedBackendId,
  routingMotion,
  onSelectBackend,
}: {
  model: ModelResult;
  algorithmLabel: string;
  selectedBackendId: string;
  routingMotion: boolean;
  onSelectBackend: (id: string) => void;
}) {
  return (
    <div className="relative hidden h-[430px] min-w-[760px] md:block">
      <div className="absolute inset-y-4 right-2 w-[31%] border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">
          Zone A
        </p>
      </div>
      <div className="absolute bottom-4 right-2 h-[45%] w-[31%] border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/30">
        <p className="text-xs font-bold uppercase text-violet-700 dark:text-violet-300">
          Zone B
        </p>
      </div>

      <svg
        viewBox="0 0 1000 430"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M 190 215 C 230 215, 275 215, 322 215"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`text-blue-500 dark:text-blue-400 ${
            routingMotion ? 'lb-route-line' : ''
          }`}
          vectorEffect="non-scaling-stroke"
        />
        {model.backends.map((backend) => {
          const position = NODE_POSITIONS[backend.id];
          const status = STATUS_STYLES[backend.status];
          return (
            <path
              key={backend.id}
              d={`M 475 215 C 555 215, 600 ${position.y}, 694 ${position.y}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={Math.max(2, 2 + backend.share * 8)}
              className={`${status.route} ${
                routingMotion && backend.status !== 'ejected' ? 'lb-route-line' : ''
              } ${backend.status === 'ejected' ? 'opacity-40' : ''}`}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div className="absolute left-[2%] top-[40%] w-[17%] border border-blue-300 bg-white px-4 py-4 shadow-sm dark:border-blue-800 dark:bg-neutral-900">
        <span className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Clients
        </span>
        <span className="mt-2 block text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
          {formatCompact(model.effectiveRps)}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          attempts / second
        </span>
      </div>

      <div className="absolute left-[32%] top-[36%] w-[17%] border border-neutral-300 bg-neutral-950 px-4 py-5 text-white shadow-md dark:border-neutral-700 dark:bg-white dark:text-neutral-950">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Network className="h-4 w-4 text-cyan-400 dark:text-cyan-600" />
          Load balancer
        </span>
        <span className="mt-2 block text-xs leading-5 text-neutral-300 dark:text-neutral-600">
          {algorithmLabel}
        </span>
      </div>

      {model.backends.map((backend) => (
        <div
          key={backend.id}
          className="absolute left-[70%] z-10 w-[28%]"
          style={{ top: NODE_POSITIONS[backend.id].top }}
        >
          <BackendButton
            backend={backend}
            selected={selectedBackendId === backend.id}
            onSelect={() => onSelectBackend(backend.id)}
          />
        </div>
      ))}
    </div>
  );
}

function MobileTopology({
  model,
  algorithmLabel,
  selectedBackendId,
  routingMotion,
  onSelectBackend,
}: {
  model: ModelResult;
  algorithmLabel: string;
  selectedBackendId: string;
  routingMotion: boolean;
  onSelectBackend: (id: string) => void;
}) {
  return (
    <div className="md:hidden">
      <div className="mx-auto w-full max-w-64 border border-blue-300 bg-white p-4 text-center dark:border-blue-800 dark:bg-neutral-900">
        <span className="flex items-center justify-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          {formatCompact(model.effectiveRps)} attempts / second
        </span>
      </div>
      <div className="relative mx-auto h-10 w-3" aria-hidden="true">
        <span className="absolute left-1 top-0 h-full border-l-2 border-dashed border-blue-400 dark:border-blue-600" />
        {routingMotion ? <span className="lb-request-dot absolute left-0 top-0 h-3 w-3 rounded-full bg-blue-600" /> : null}
      </div>
      <div className="mx-auto w-full max-w-64 border border-neutral-300 bg-neutral-950 p-4 text-center text-white dark:border-neutral-700 dark:bg-white dark:text-neutral-950">
        <span className="flex items-center justify-center gap-2 text-sm font-bold">
          <Network className="h-4 w-4 text-cyan-400 dark:text-cyan-600" />
          Load balancer
        </span>
        <span className="mt-1 block text-xs text-neutral-300 dark:text-neutral-600">
          {algorithmLabel}
        </span>
      </div>
      <div className="mx-auto h-8 w-px border-l-2 border-dashed border-neutral-300 dark:border-neutral-700" />
      <div className="grid grid-cols-2 gap-3">
        {model.backends.map((backend) => (
          <BackendButton
            key={backend.id}
            backend={backend}
            selected={selectedBackendId === backend.id}
            onSelect={() => onSelectBackend(backend.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div
        className="grid gap-1 border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-900"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={selected}
              className={`min-h-10 px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LoadBalancerVisualizer() {
  const [backends, setBackends] = useState<BackendInput[]>(INITIAL_BACKENDS);
  const [algorithm, setAlgorithm] = useState<Algorithm>('capacity-aware');
  const [challenge, setChallenge] = useState<Challenge>('baseline');
  const [trafficRps, setTrafficRps] = useState(1250);
  const [healthPolicy, setHealthPolicy] = useState<HealthPolicy>('active');
  const [retryPolicy, setRetryPolicy] = useState<RetryPolicy>('bounded');
  const [stickySessions, setStickySessions] = useState(false);
  const [selectedBackendId, setSelectedBackendId] = useState('api-a1');
  const [routingMotion, setRoutingMotion] = useState(true);

  const model = useMemo(
    () =>
      deriveModel({
        backends,
        algorithm,
        challenge,
        trafficRps,
        healthPolicy,
        retryPolicy,
        stickySessions,
      }),
    [
      algorithm,
      backends,
      challenge,
      healthPolicy,
      retryPolicy,
      stickySessions,
      trafficRps,
    ],
  );

  const selectedBackend =
    backends.find((backend) => backend.id === selectedBackendId) ?? backends[0];
  const selectedResult =
    model.backends.find((backend) => backend.id === selectedBackend.id) ??
    model.backends[0];
  const algorithmDetail =
    ALGORITHMS.find((item) => item.id === algorithm) ?? ALGORITHMS[0];
  const currentChallenge =
    CHALLENGES.find((item) => item.id === challenge) ?? CHALLENGES[0];

  const updateBackend = (
    id: string,
    patch: Partial<Pick<BackendInput, 'capacity' | 'weight' | 'enabled'>>,
  ) => {
    setBackends((current) =>
      current.map((backend) => (backend.id === id ? { ...backend, ...patch } : backend)),
    );
  };

  const reset = () => {
    setBackends(INITIAL_BACKENDS);
    setAlgorithm('capacity-aware');
    setChallenge('baseline');
    setTrafficRps(1250);
    setHealthPolicy('active');
    setRetryPolicy('bounded');
    setStickySessions(false);
    setSelectedBackendId('api-a1');
    setRoutingMotion(true);
  };

  const outcomeStyle = {
    healthy:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    warning:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    critical:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
  }[model.severity];
  const OutcomeIcon = model.severity === 'healthy' ? CheckCircle2 : AlertTriangle;

  return (
    <article
      data-tool-surface="load-balancer-visualizer"
      className="overflow-hidden border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="bg-neutral-950 px-5 py-5 text-white dark:bg-black sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-cyan-300">
              <Route className="h-4 w-4" />
              Live routing workbench
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Route traffic, then break the pool
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Compare routing policy, backend pressure, health ejection, and the user
              impact of retries without hiding the failure path.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRoutingMotion((current) => !current)}
              aria-pressed={routingMotion}
              className="inline-flex h-10 items-center gap-2 border border-neutral-700 px-3 text-sm font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {routingMotion ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {routingMotion ? 'Pause routes' : 'Show routes'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 border border-neutral-700 px-3 text-sm font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-neutral-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-neutral-800">
        <Metric
          label="Availability"
          value={`${model.availability.toFixed(2)}%`}
          detail={`${formatCompact(model.droppedRps)} user rps lost`}
          tone={model.availability >= 99.9 ? 'emerald' : 'rose'}
        />
        <Metric
          label="Estimated p95"
          value={`${formatCompact(model.p95)} ms`}
          detail="routing plus queue delay"
          tone={model.p95 <= 220 ? 'blue' : 'amber'}
        />
        <Metric
          label="Queued"
          value={`${formatCompact(model.queueDepth)} rps`}
          detail="attempts above capacity"
          tone={model.queueDepth === 0 ? 'emerald' : 'amber'}
        />
        <Metric
          label="Ejected"
          value={`${model.ejectedCount} / ${model.backends.length}`}
          detail="not eligible for new work"
          tone={model.ejectedCount === 0 ? 'violet' : 'rose'}
        />
        <Metric
          label="Retry load"
          value={`+${Math.round(model.retryRate * 100)}%`}
          detail={`${formatCompact(model.effectiveRps)} total attempts`}
          tone={model.retryRate <= 0.12 ? 'blue' : 'rose'}
        />
      </div>

      <section aria-labelledby="topology-heading" className="px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">
              Request topology
            </p>
            <h3 id="topology-heading" className="mt-1 text-xl font-bold">
              Where every attempt goes
            </h3>
          </div>
          <p className="max-w-lg text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Line width represents routing share. Select a backend to tune its capacity
            and weight.
          </p>
        </div>

        <div className="border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-5">
          <DesktopTopology
            model={model}
            algorithmLabel={algorithmDetail.label}
            selectedBackendId={selectedBackendId}
            routingMotion={routingMotion}
            onSelectBackend={setSelectedBackendId}
          />
          <MobileTopology
            model={model}
            algorithmLabel={algorithmDetail.label}
            selectedBackendId={selectedBackendId}
            routingMotion={routingMotion}
            onSelectBackend={setSelectedBackendId}
          />
        </div>
      </section>

      <section
        aria-labelledby="challenge-heading"
        className="border-t border-neutral-200 px-4 py-5 dark:border-neutral-800 sm:px-7"
      >
        <div className="mb-4">
          <p className="text-xs font-bold uppercase text-rose-700 dark:text-rose-300">
            Failure laboratory
          </p>
          <h3 id="challenge-heading" className="mt-1 text-xl font-bold">
            Inject a production condition
          </h3>
        </div>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"
          role="group"
          aria-label="Failure scenarios"
        >
            {CHALLENGES.map((item) => {
              const Icon = item.icon;
              const selected = challenge === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setChallenge(item.id)}
                  aria-pressed={selected}
                  className={`min-h-24 border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    selected
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-400 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-5 ${
                      selected
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {item.description}
                  </span>
                </button>
              );
            })}
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <CircleDot className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          Active condition: <strong>{currentChallenge.label}</strong>
        </p>
      </section>

      <section
        aria-labelledby="controls-heading"
        className="border-t border-neutral-200 dark:border-neutral-800"
      >
        <div className="px-4 pt-5 sm:px-7">
          <p className="text-xs font-bold uppercase text-violet-700 dark:text-violet-300">
            Two control loops
          </p>
          <h3 id="controls-heading" className="mt-1 text-xl font-bold">
            Separate routing intent from failure behavior
          </h3>
        </div>

        <div className="mt-5 grid lg:grid-cols-2 lg:divide-x lg:divide-neutral-200 dark:lg:divide-neutral-800">
          <div className="px-4 pb-6 sm:px-7">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <GitBranch className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-bold">1. Traffic and routing</h4>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Arrival rate and algorithm change distribution before any health
                  policy is applied.
                </p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="flex items-center justify-between gap-4 text-sm font-bold">
                Offered traffic
                <span className="font-mono text-blue-700 dark:text-blue-300">
                  {formatCompact(trafficRps)} rps
                </span>
              </span>
              <input
                type="range"
                min="300"
                max="2600"
                step="25"
                value={trafficRps}
                onChange={(event) => setTrafficRps(Number(event.target.value))}
                className="mt-3 w-full accent-blue-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>300</span>
                <span>2,600 requests / second</span>
              </span>
            </label>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                Routing algorithm
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALGORITHMS.map((item) => {
                  const selected = algorithm === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAlgorithm(item.id)}
                      aria-pressed={selected}
                      className={`min-h-20 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        selected
                          ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-300 dark:bg-blue-300 dark:text-blue-950'
                          : 'border-neutral-300 text-neutral-700 hover:border-blue-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-blue-400'
                      }`}
                    >
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span
                        className={`mt-1 block text-xs leading-5 ${
                          selected
                            ? 'text-blue-100 dark:text-blue-900'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => setStickySessions((current) => !current)}
              aria-pressed={stickySessions}
              className={`mt-4 flex w-full items-center justify-between border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                stickySessions
                  ? 'border-violet-700 bg-violet-700 text-white dark:border-violet-300 dark:bg-violet-300 dark:text-violet-950'
                  : 'border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300'
              }`}
            >
              <span>
                <span className="block text-sm font-bold">Session affinity</span>
                <span
                  className={`mt-1 block text-xs ${
                    stickySessions
                      ? 'text-violet-100 dark:text-violet-900'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Preserve backend ownership, including uneven session populations.
                </span>
              </span>
              <span className="ml-4 shrink-0 text-xs font-bold">
                {stickySessions ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <div className="border-t border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-7 lg:border-t-0 lg:pt-0">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-bold">2. Health and recovery</h4>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Ejection and retry policy determine whether a fault stays isolated or
                  multiplies.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <SegmentedChoice<HealthPolicy>
                label="Health ejection"
                value={healthPolicy}
                options={[
                  { id: 'passive', label: 'Failures only' },
                  { id: 'active', label: 'Latency + failure' },
                ]}
                onChange={setHealthPolicy}
              />
              <SegmentedChoice<RetryPolicy>
                label="Caller retry policy"
                value={retryPolicy}
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'bounded', label: 'Bounded' },
                  { id: 'aggressive', label: 'Aggressive' },
                ]}
                onChange={setRetryPolicy}
              />
            </div>

            <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                    Selected backend
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-bold">
                    <Server className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    {selectedBackend.name}
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      {selectedBackend.zone === 'zone-a' ? 'Zone A' : 'Zone B'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateBackend(selectedBackend.id, {
                      enabled: !selectedBackend.enabled,
                    })
                  }
                  aria-pressed={!selectedBackend.enabled}
                  className={`min-h-10 border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    selectedBackend.enabled
                      ? 'border-rose-300 text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950'
                      : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {selectedBackend.enabled ? 'Remove from pool' : 'Restore to pool'}
                </button>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="flex items-center justify-between gap-3 text-sm font-bold">
                    Tested capacity
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      {selectedBackend.capacity} rps
                    </span>
                  </span>
                  <input
                    type="range"
                    min="180"
                    max="720"
                    step="10"
                    value={selectedBackend.capacity}
                    onChange={(event) =>
                      updateBackend(selectedBackend.id, {
                        capacity: Number(event.target.value),
                      })
                    }
                    className="mt-3 w-full accent-emerald-600"
                  />
                </label>
                <label>
                  <span className="flex items-center justify-between gap-3 text-sm font-bold">
                    Routing weight
                    <span className="font-mono text-violet-700 dark:text-violet-300">
                      {selectedBackend.weight}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={selectedBackend.weight}
                    onChange={(event) =>
                      updateBackend(selectedBackend.id, {
                        weight: Number(event.target.value),
                      })
                    }
                    className="mt-3 w-full accent-violet-600"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-l-4 border-neutral-300 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div>
                  <p className="text-sm font-bold">
                    {STATUS_STYLES[selectedResult.status].label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {selectedResult.ejectionReason ??
                      `${Math.round(selectedResult.saturation * 100)}% utilized at ${formatCompact(
                        selectedResult.observedLatency,
                      )} ms observed latency`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold">
                  {formatCompact(selectedResult.queued)} queued
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="pressure-heading"
        className="border-t border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-7"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-orange-700 dark:text-orange-300">
              Pool pressure
            </p>
            <h3 id="pressure-heading" className="mt-1 text-xl font-bold">
              Distribution, saturation, and queueing
            </h3>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            The marker at 100% is the tested capacity boundary.
          </p>
        </div>

        <div className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {model.backends.map((backend) => {
            const status = STATUS_STYLES[backend.status];
            const saturationWidth = clamp(backend.saturation * 100, 0, 130);
            return (
              <div
                key={backend.id}
                className="grid gap-3 py-4 sm:grid-cols-[130px_minmax(0,1fr)_190px] sm:items-center"
              >
                <div>
                  <p className="font-bold">{backend.name}</p>
                  <p className={`mt-1 flex items-center gap-2 text-xs font-bold ${status.text}`}>
                    <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                    {status.label}
                  </p>
                </div>
                <div>
                  <div className="relative h-3 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={`h-full ${
                        backend.status === 'ejected'
                          ? 'bg-rose-500'
                          : backend.saturation >= 1
                            ? 'bg-orange-500'
                            : backend.saturation >= 0.8
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                      }`}
                      style={{ width: `${(saturationWidth / 130) * 100}%` }}
                    />
                    <span className="absolute bottom-0 left-[76.92%] top-0 border-l-2 border-neutral-950 dark:border-white" />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{Math.round(backend.share * 100)}% distribution</span>
                    <span>{Math.round(backend.saturation * 100)}% saturation</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:text-right">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatCompact(backend.incoming)} in
                  </span>
                  <span
                    className={`font-bold ${
                      backend.queued > 0
                        ? 'text-orange-700 dark:text-orange-300'
                        : 'text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    {formatCompact(backend.queued)} queued
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-live="polite"
        aria-labelledby="outcome-heading"
        className={`m-4 border p-5 sm:m-7 sm:p-6 ${outcomeStyle}`}
      >
        <div className="flex items-start gap-3">
          <OutcomeIcon className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase opacity-70">Observed outcome</p>
            <h3 id="outcome-heading" className="mt-1 text-xl font-bold">
              {model.summary}
            </h3>
            <p className="mt-2 text-sm leading-6">{model.consequence}</p>
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold leading-6">
              <ArrowRight className="mt-1 h-4 w-4 shrink-0" />
              {model.action}
            </p>
          </div>
        </div>
      </section>

      <footer className="grid gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-4 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 sm:grid-cols-3 sm:px-7">
        <span className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Capacity is a tested per-backend throughput, not CPU percentage.
        </span>
        <span className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Queueing begins when attempts exceed effective capacity.
        </span>
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          This is a teaching model, not a production sizing guarantee.
        </span>
      </footer>

      <style>{`
        .lb-route-line {
          stroke-dasharray: 10 12;
          animation: lb-route-dash 1.1s linear infinite;
        }

        .lb-request-dot {
          animation: lb-request-drop 1.1s linear infinite;
        }

        @keyframes lb-route-dash {
          to {
            stroke-dashoffset: -44;
          }
        }

        @keyframes lb-request-drop {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(28px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lb-route-line {
            animation: none;
            stroke-dasharray: none;
          }

          .lb-request-dot {
            animation: none;
            transform: translateY(13px);
          }
        }
      `}</style>
    </article>
  );
}
