'use client';

import { useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudOff,
  Coins,
  Database,
  Gauge,
  Globe2,
  Layers3,
  Network,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react';

const MONTH_SECONDS = 30 * 24 * 60 * 60;

type ChallengeId = 'healthy' | 'cache-purge' | 'low-hit-rate' | 'regional-loss' | 'origin-outage';
type PathMode = 'direct' | 'shielded';
type Status = 'healthy' | 'pressure' | 'critical';

type Challenge = {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

const DEFAULTS = {
  requestsPerSecond: 12_000,
  peakMultiplier: 2.2,
  payloadKB: 180,
  cacheHitRatePct: 88,
  edgeLatencyMs: 24,
  originLatencyMs: 180,
  originCapacityRps: 3_200,
  regions: 3,
  edgeCapacityPerRegionRps: 11_000,
  pathMode: 'shielded' as PathMode,
  shieldReusePct: 42,
  staleCoveragePct: 70,
  edgeEgressPerGB: 0.035,
  originEgressPerGB: 0.075,
  requestCostPerMillion: 0.55,
};

const CHALLENGES: Challenge[] = [
  {
    id: 'healthy',
    label: 'Normal delivery',
    shortLabel: 'Normal',
    description: 'Caches are warm, all configured regions route traffic, and the origin is healthy.',
    icon: CheckCircle2,
  },
  {
    id: 'cache-purge',
    label: 'Global cache purge',
    shortLabel: 'Purge',
    description: 'A broad invalidation temporarily drops the effective hit rate and creates a refill wave.',
    icon: RefreshCw,
  },
  {
    id: 'low-hit-rate',
    label: 'Low-hit workload',
    shortLabel: 'Low hit',
    description: 'Personalized or fragmented cache keys cap reuse even when the configured target is higher.',
    icon: Layers3,
  },
  {
    id: 'regional-loss',
    label: 'Regional degradation',
    shortLabel: 'Region loss',
    description: 'One edge region is unavailable, so healthy regions absorb its traffic over longer paths.',
    icon: CloudOff,
  },
  {
    id: 'origin-outage',
    label: 'Origin outage',
    shortLabel: 'Origin down',
    description: 'Origin requests fail unless an edge or shield can serve an eligible stale object.',
    icon: TriangleAlert,
  },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(Math.round(value));
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatLatency(value: number) {
  if (!Number.isFinite(value) || value >= 10_000) return 'Unavailable';
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1_000 ? 0 : 2,
  });
}

function formatData(valueGB: number) {
  if (valueGB >= 1_000_000) return `${(valueGB / 1_000_000).toFixed(1)}PB`;
  if (valueGB >= 1_000) return `${(valueGB / 1_000).toFixed(1)}TB`;
  return `${Math.round(valueGB).toLocaleString()}GB`;
}

function RangeField({
  id,
  label,
  value,
  output,
  min,
  max,
  step = 1,
  lowLabel,
  highLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  output: string;
  min: number;
  max: number;
  step?: number;
  lowLabel: string;
  highLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
        <output
          htmlFor={id}
          className="min-w-16 rounded-md bg-neutral-200 px-2 py-1 text-center text-sm font-bold tabular-nums text-neutral-950 dark:bg-neutral-800 dark:text-white"
        >
          {output}
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
        className="h-2 w-full cursor-pointer accent-cyan-600 dark:accent-cyan-400"
      />
      <div className="flex justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{lowLabel}</span>
        <span className="text-right">{highLabel}</span>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-md border border-neutral-300 bg-white transition focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-cyan-400">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => {
            const nextValue = event.currentTarget.valueAsNumber;
            if (Number.isFinite(nextValue)) {
              onChange(clamp(nextValue, min, max));
            }
          }}
          className="min-w-0 bg-transparent px-3 py-2.5 text-sm font-semibold tabular-nums text-neutral-950 outline-none dark:text-white"
        />
        <span className="flex min-w-14 items-center justify-center border-l border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {unit}
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function LoopHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-neutral-950 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  tone: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const toneClasses = {
    cyan: 'border-cyan-500 text-cyan-700 dark:text-cyan-300',
    emerald: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-500 text-amber-800 dark:text-amber-200',
    rose: 'border-rose-500 text-rose-700 dark:text-rose-300',
    violet: 'border-violet-500 text-violet-700 dark:text-violet-300',
  }[tone];

  return (
    <div className={`min-h-32 border-l-4 bg-white p-4 dark:bg-neutral-950 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-2xl font-bold tracking-normal tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function PressureBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const safeValue = Math.max(0, value);
  const width = clamp(safeValue, 0, 120) / 1.2;
  const tone =
    safeValue > 100
      ? 'bg-rose-500'
      : safeValue > 75
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</span>
        <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
          {formatPercent(safeValue)}
        </span>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={120}
        aria-valuenow={Math.round(safeValue)}
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width: `${width}%` }} />
        <span className="absolute bottom-0 left-[83.333%] top-0 w-px bg-neutral-950/50 dark:bg-white/60" />
      </div>
      <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <>
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 shrink-0 text-neutral-400 sm:block" />
      <ArrowDown aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 sm:hidden" />
    </>
  );
}

function FlowNode({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  failed = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  tone: 'blue' | 'cyan' | 'violet' | 'amber';
  failed?: boolean;
}) {
  const toneClasses = {
    blue: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/55 dark:text-blue-100',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/55 dark:text-cyan-100',
    violet:
      'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/55 dark:text-violet-100',
    amber:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/55 dark:text-amber-100',
  }[tone];

  return (
    <div
      className={`min-w-0 flex-1 rounded-md border p-3 ${failed ? 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-100' : toneClasses}`}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase">{label}</span>
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

export default function CdnPerformanceTool() {
  const [requestsPerSecond, setRequestsPerSecond] = useState(DEFAULTS.requestsPerSecond);
  const [peakMultiplier, setPeakMultiplier] = useState(DEFAULTS.peakMultiplier);
  const [payloadKB, setPayloadKB] = useState(DEFAULTS.payloadKB);
  const [cacheHitRatePct, setCacheHitRatePct] = useState(DEFAULTS.cacheHitRatePct);
  const [edgeLatencyMs, setEdgeLatencyMs] = useState(DEFAULTS.edgeLatencyMs);
  const [originLatencyMs, setOriginLatencyMs] = useState(DEFAULTS.originLatencyMs);
  const [originCapacityRps, setOriginCapacityRps] = useState(DEFAULTS.originCapacityRps);
  const [regions, setRegions] = useState(DEFAULTS.regions);
  const [edgeCapacityPerRegionRps, setEdgeCapacityPerRegionRps] = useState(
    DEFAULTS.edgeCapacityPerRegionRps,
  );
  const [pathMode, setPathMode] = useState<PathMode>(DEFAULTS.pathMode);
  const [shieldReusePct, setShieldReusePct] = useState(DEFAULTS.shieldReusePct);
  const [staleCoveragePct, setStaleCoveragePct] = useState(DEFAULTS.staleCoveragePct);
  const [edgeEgressPerGB, setEdgeEgressPerGB] = useState(DEFAULTS.edgeEgressPerGB);
  const [originEgressPerGB, setOriginEgressPerGB] = useState(DEFAULTS.originEgressPerGB);
  const [requestCostPerMillion, setRequestCostPerMillion] = useState(
    DEFAULTS.requestCostPerMillion,
  );
  const [challengeId, setChallengeId] = useState<ChallengeId>('healthy');

  const selectedChallenge =
    CHALLENGES.find((challenge) => challenge.id === challengeId) ?? CHALLENGES[0];

  const plannedRps = Math.max(1, requestsPerSecond) * Math.max(1, peakMultiplier);
  const configuredHitRate = clamp(cacheHitRatePct, 0, 100);
  const effectiveHitRatePct =
    challengeId === 'cache-purge'
      ? Math.min(configuredHitRate, 18)
      : challengeId === 'low-hit-rate'
        ? Math.min(configuredHitRate, 35)
        : configuredHitRate;
  const effectiveHitRate = effectiveHitRatePct / 100;

  const activeRegions = Math.max(1, regions - (challengeId === 'regional-loss' && regions > 1 ? 1 : 0));
  const routingImbalance = challengeId === 'regional-loss' ? 1.2 : 1;
  const totalEdgeCapacityRps = activeRegions * Math.max(1, edgeCapacityPerRegionRps);
  const edgeDemandRps = plannedRps * routingImbalance;
  const edgeUtilizationPct = (edgeDemandRps / totalEdgeCapacityRps) * 100;
  const edgeCapacityRatio = clamp(totalEdgeCapacityRps / edgeDemandRps, 0, 1);
  const admittedRps = plannedRps * edgeCapacityRatio;
  const edgeRejectedRps = Math.max(0, plannedRps - admittedRps);

  const edgeHitsRps = admittedRps * effectiveHitRate;
  const edgeMissesRps = admittedRps - edgeHitsRps;
  const shieldHitsRps = pathMode === 'shielded' ? edgeMissesRps * (shieldReusePct / 100) : 0;
  const requestedFromOriginRps = Math.max(0, edgeMissesRps - shieldHitsRps);
  const originAvailable = challengeId !== 'origin-outage';
  const effectiveOriginCapacityRps = originAvailable ? Math.max(1, originCapacityRps) : 0;
  const originUtilizationPct =
    effectiveOriginCapacityRps > 0
      ? (requestedFromOriginRps / effectiveOriginCapacityRps) * 100
      : requestedFromOriginRps > 0
        ? 999
        : 0;

  const originServedRps = originAvailable
    ? Math.min(requestedFromOriginRps, effectiveOriginCapacityRps)
    : 0;
  const staleFallbackRps =
    challengeId === 'origin-outage' ? requestedFromOriginRps * (staleCoveragePct / 100) : 0;
  const failedOriginRps = Math.max(0, requestedFromOriginRps - originServedRps - staleFallbackRps);
  const successfulRps = Math.max(0, admittedRps - failedOriginRps);
  const availabilityPct = clamp((successfulRps / plannedRps) * 100, 0, 100);
  const originOffloadPct = clamp((1 - requestedFromOriginRps / Math.max(1, admittedRps)) * 100, 0, 100);

  const edgePressurePenalty =
    edgeUtilizationPct > 65 ? Math.pow((edgeUtilizationPct - 65) / 35, 2) * 85 : 0;
  const regionalPenaltyMs = challengeId === 'regional-loss' ? 45 : 0;
  const effectiveEdgeLatencyMs = edgeLatencyMs + regionalPenaltyMs + edgePressurePenalty;
  const originPressurePenalty =
    originUtilizationPct > 65 && originAvailable
      ? Math.pow((originUtilizationPct - 65) / 35, 2) * originLatencyMs * 1.6
      : 0;
  const shieldHopMs = pathMode === 'shielded' ? 12 : 0;
  const missPathLatencyMs = originAvailable
    ? effectiveEdgeLatencyMs + shieldHopMs + originLatencyMs + originPressurePenalty
    : effectiveEdgeLatencyMs + shieldHopMs + 3_000;
  const stalePathLatencyMs = effectiveEdgeLatencyMs + shieldHopMs + 18;

  const p95LatencyMs =
    effectiveHitRatePct >= 95
      ? effectiveEdgeLatencyMs * 1.25
      : challengeId === 'origin-outage' && staleCoveragePct >= 95
        ? stalePathLatencyMs * 1.2
        : missPathLatencyMs * 1.12;
  const p99LatencyMs =
    effectiveHitRatePct >= 99
      ? effectiveEdgeLatencyMs * 1.5
      : challengeId === 'origin-outage' && staleCoveragePct >= 99
        ? stalePathLatencyMs * 1.35
        : missPathLatencyMs * 1.35;

  const monthlyRequests = plannedRps * MONTH_SECONDS;
  const deliveredGB = (successfulRps * Math.max(1, payloadKB) * MONTH_SECONDS) / 1_000_000;
  const originEgressGB = (originServedRps * Math.max(1, payloadKB) * MONTH_SECONDS) / 1_000_000;
  const edgeDeliveryCost = deliveredGB * Math.max(0, edgeEgressPerGB);
  const originEgressCost = originEgressGB * Math.max(0, originEgressPerGB);
  const requestCost = (monthlyRequests / 1_000_000) * Math.max(0, requestCostPerMillion);
  const monthlyRunRate = edgeDeliveryCost + originEgressCost + requestCost;
  const maxCostPart = Math.max(edgeDeliveryCost, originEgressCost, requestCost, 1);

  const failurePct = 100 - availabilityPct;
  let status: Status = 'healthy';
  if (
    failurePct >= 1 ||
    edgeUtilizationPct > 100 ||
    originUtilizationPct > 100 ||
    challengeId === 'origin-outage'
  ) {
    status = 'critical';
  } else if (
    edgeUtilizationPct > 75 ||
    originUtilizationPct > 75 ||
    p99LatencyMs > 350 ||
    effectiveHitRatePct < 60
  ) {
    status = 'pressure';
  }

  const statusStyles = {
    healthy: {
      icon: CheckCircle2,
      label: 'Plan is within the modeled envelope',
      detail: 'Both edge and origin retain headroom at the selected demand.',
      classes:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
    },
    pressure: {
      icon: AlertTriangle,
      label: 'Plan is operating under pressure',
      detail: 'Tail latency or capacity headroom is outside the recommended planning range.',
      classes:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
    },
    critical: {
      icon: TriangleAlert,
      label: 'Requests are at risk',
      detail: 'The modeled path is saturated or cannot serve every request during this scenario.',
      classes:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
    },
  }[status];
  const StatusIcon = statusStyles.icon;

  const reset = () => {
    setRequestsPerSecond(DEFAULTS.requestsPerSecond);
    setPeakMultiplier(DEFAULTS.peakMultiplier);
    setPayloadKB(DEFAULTS.payloadKB);
    setCacheHitRatePct(DEFAULTS.cacheHitRatePct);
    setEdgeLatencyMs(DEFAULTS.edgeLatencyMs);
    setOriginLatencyMs(DEFAULTS.originLatencyMs);
    setOriginCapacityRps(DEFAULTS.originCapacityRps);
    setRegions(DEFAULTS.regions);
    setEdgeCapacityPerRegionRps(DEFAULTS.edgeCapacityPerRegionRps);
    setPathMode(DEFAULTS.pathMode);
    setShieldReusePct(DEFAULTS.shieldReusePct);
    setStaleCoveragePct(DEFAULTS.staleCoveragePct);
    setEdgeEgressPerGB(DEFAULTS.edgeEgressPerGB);
    setOriginEgressPerGB(DEFAULTS.originEgressPerGB);
    setRequestCostPerMillion(DEFAULTS.requestCostPerMillion);
    setChallengeId('healthy');
  };

  return (
    <section
      data-content-block="tools/cdn-performance"
      className="not-prose my-7 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Network aria-hidden="true" className="h-4 w-4" />
              Editable CDN planning model
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-normal text-white md:text-2xl">
              Trace every request from edge to origin
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Change demand, cache behavior, routing, capacity, and unit costs. The figures are
              illustrative assumptions, not vendor quotes or performance claims.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset assumptions
          </button>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-white p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-3 flex items-center gap-2">
          <Zap aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          <h3 className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
            Challenge the healthy path
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="CDN challenge scenario">
          {CHALLENGES.map((challenge) => {
            const Icon = challenge.icon;
            const selected = challenge.id === challengeId;

            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallengeId(challenge.id)}
                className={`min-h-20 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? 'border-neutral-950 bg-neutral-950 text-white ring-1 ring-neutral-950 dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950 dark:ring-cyan-300'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {challenge.shortLabel}
                </span>
                <span className={`mt-1 block text-xs leading-5 ${selected ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {challenge.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-neutral-50 p-5 xl:border-b-0 xl:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="space-y-7">
            <section aria-labelledby="cdn-loop-traffic" className="space-y-5">
              <LoopHeading
                number="1"
                title="Shape traffic and cache reuse"
                description="Demand, object size, cache hits, and origin service time determine how much work reaches the origin."
              />
              <div id="cdn-loop-traffic" className="space-y-5">
                <NumberField
                  id="cdn-rps"
                  label="Average requests"
                  value={requestsPerSecond}
                  min={100}
                  max={1_000_000}
                  step={100}
                  unit="req/s"
                  onChange={setRequestsPerSecond}
                />
                <RangeField
                  id="cdn-peak"
                  label="Peak multiplier"
                  value={peakMultiplier}
                  output={`${peakMultiplier.toFixed(1)}x`}
                  min={1}
                  max={8}
                  step={0.1}
                  lowLabel="Steady"
                  highLabel="Event spike"
                  onChange={setPeakMultiplier}
                />
                <NumberField
                  id="cdn-payload"
                  label="Average response"
                  value={payloadKB}
                  min={1}
                  max={10_000}
                  unit="KB"
                  onChange={setPayloadKB}
                />
                <RangeField
                  id="cdn-hit-rate"
                  label="Configured cache hit rate"
                  value={cacheHitRatePct}
                  output={`${cacheHitRatePct}%`}
                  min={5}
                  max={99}
                  lowLabel="Mostly dynamic"
                  highLabel="Highly reusable"
                  onChange={setCacheHitRatePct}
                />
                <NumberField
                  id="cdn-origin-latency"
                  label="Origin service latency"
                  value={originLatencyMs}
                  min={20}
                  max={2_000}
                  step={5}
                  unit="ms"
                  onChange={setOriginLatencyMs}
                />
                <NumberField
                  id="cdn-origin-capacity"
                  label="Origin capacity"
                  value={originCapacityRps}
                  min={100}
                  max={500_000}
                  step={100}
                  unit="req/s"
                  hint="Capacity before queues and retries amplify tail latency."
                  onChange={setOriginCapacityRps}
                />
              </div>
            </section>

            <div className="border-t border-neutral-200 dark:border-neutral-800" />

            <section aria-labelledby="cdn-loop-path" className="space-y-5">
              <LoopHeading
                number="2"
                title="Design the delivery path"
                description="Footprint, shield reuse, failover coverage, and editable unit costs change headroom and run-rate independently."
              />
              <div id="cdn-loop-path" className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    Active edge regions
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 3, 6].map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={regions === count}
                        onClick={() => setRegions(count)}
                        className={`h-10 rounded-md border text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          regions === count
                            ? 'border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <NumberField
                  id="cdn-edge-capacity"
                  label="Capacity per region"
                  value={edgeCapacityPerRegionRps}
                  min={1_000}
                  max={500_000}
                  step={1_000}
                  unit="req/s"
                  onChange={setEdgeCapacityPerRegionRps}
                />
                <NumberField
                  id="cdn-edge-latency"
                  label="Healthy edge latency"
                  value={edgeLatencyMs}
                  min={5}
                  max={200}
                  step={1}
                  unit="ms"
                  onChange={setEdgeLatencyMs}
                />

                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    Miss path
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {([
                      {
                        id: 'direct',
                        label: 'Direct to origin',
                        detail: 'Every edge miss reaches the origin.',
                        icon: Route,
                      },
                      {
                        id: 'shielded',
                        label: 'Origin shield',
                        detail: 'A shared tier can reuse misses across edge regions.',
                        icon: ShieldCheck,
                      },
                    ] as const).map((option) => {
                      const Icon = option.icon;
                      const selected = pathMode === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setPathMode(option.id)}
                          className={`rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                            selected
                              ? 'border-violet-700 bg-violet-700 text-white dark:border-violet-300 dark:bg-violet-300 dark:text-neutral-950'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-bold">
                            <Icon aria-hidden="true" className="h-4 w-4" />
                            {option.label}
                          </span>
                          <span className={`mt-1 block text-xs leading-5 ${selected ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                            {option.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {pathMode === 'shielded' ? (
                  <RangeField
                    id="cdn-shield-reuse"
                    label="Shield reuse on edge misses"
                    value={shieldReusePct}
                    output={`${shieldReusePct}%`}
                    min={0}
                    max={90}
                    lowLabel="No shared reuse"
                    highLabel="Strong reuse"
                    onChange={setShieldReusePct}
                  />
                ) : null}

                <RangeField
                  id="cdn-stale-coverage"
                  label="Stale-on-error coverage"
                  value={staleCoveragePct}
                  output={`${staleCoveragePct}%`}
                  min={0}
                  max={100}
                  lowLabel="Strict freshness"
                  highLabel="Broad fallback"
                  onChange={setStaleCoveragePct}
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <NumberField
                    id="cdn-edge-cost"
                    label="Edge delivery rate"
                    value={edgeEgressPerGB}
                    min={0}
                    max={1}
                    step={0.005}
                    unit="$/GB"
                    onChange={setEdgeEgressPerGB}
                  />
                  <NumberField
                    id="cdn-origin-cost"
                    label="Origin egress rate"
                    value={originEgressPerGB}
                    min={0}
                    max={1}
                    step={0.005}
                    unit="$/GB"
                    onChange={setOriginEgressPerGB}
                  />
                  <NumberField
                    id="cdn-request-cost"
                    label="Request processing rate"
                    value={requestCostPerMillion}
                    min={0}
                    max={20}
                    step={0.05}
                    unit="$/1M"
                    onChange={setRequestCostPerMillion}
                  />
                </div>
              </div>
            </section>
          </div>
        </aside>

        <div className="min-w-0 bg-white p-5 md:p-6 dark:bg-neutral-950">
          <div className={`rounded-md border p-4 ${statusStyles.classes}`} role="status" aria-live="polite">
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold">{statusStyles.label}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{statusStyles.detail}</p>
                <p className="mt-1 text-xs font-semibold uppercase opacity-70">
                  Scenario: {selectedChallenge.label}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
            <Metric
              label="Origin offload"
              value={formatPercent(originOffloadPct, 1)}
              detail={`${compact(requestedFromOriginRps)} of ${compact(admittedRps)} req/s reach origin`}
              icon={ShieldCheck}
              tone="emerald"
            />
            <Metric
              label="p95 latency"
              value={formatLatency(p95LatencyMs)}
              detail="Fast path unless more than 5% of requests miss"
              icon={Clock3}
              tone={p95LatencyMs > 350 ? 'rose' : 'cyan'}
            />
            <Metric
              label="p99 latency"
              value={formatLatency(p99LatencyMs)}
              detail="Tail follows the miss or failure path"
              icon={Activity}
              tone={p99LatencyMs > 500 ? 'rose' : 'violet'}
            />
            <Metric
              label="Availability"
              value={formatPercent(availabilityPct, availabilityPct >= 99 ? 2 : 1)}
              detail={`${compact(edgeRejectedRps + failedOriginRps)} req/s cannot be served`}
              icon={Gauge}
              tone={availabilityPct < 99 ? 'rose' : 'emerald'}
            />
            <Metric
              label="Monthly egress"
              value={formatData(deliveredGB)}
              detail={`${formatData(originEgressGB)} leaves the origin`}
              icon={Globe2}
              tone="cyan"
            />
            <Metric
              label="Monthly run-rate"
              value={formatMoney(monthlyRunRate)}
              detail="Selected conditions projected for 30 days"
              icon={Coins}
              tone="amber"
            />
          </div>

          <section className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800" aria-labelledby="request-route-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">Live request map</p>
                <h3 id="request-route-heading" className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                  Where the peak load is served
                </h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {compact(plannedRps)} incoming req/s · {effectiveHitRatePct.toFixed(0)}% effective hit rate
              </p>
            </div>

            <div className="mt-4 flex min-w-0 flex-col items-stretch gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900">
              <FlowNode
                label="Users"
                value={`${compact(plannedRps)} req/s`}
                detail={`${peakMultiplier.toFixed(1)}x peak demand`}
                icon={Globe2}
                tone="blue"
              />
              <FlowArrow />
              <FlowNode
                label={`${activeRegions} edge region${activeRegions === 1 ? '' : 's'}`}
                value={`${compact(edgeHitsRps)} hits`}
                detail={`${formatPercent(edgeUtilizationPct)} capacity used`}
                icon={Cloud}
                tone="cyan"
                failed={edgeUtilizationPct > 100}
              />
              <FlowArrow />
              {pathMode === 'shielded' ? (
                <>
                  <FlowNode
                    label="Origin shield"
                    value={`${compact(shieldHitsRps)} reused`}
                    detail={`${shieldReusePct}% of edge misses`}
                    icon={ShieldCheck}
                    tone="violet"
                  />
                  <FlowArrow />
                </>
              ) : null}
              <FlowNode
                label="Origin"
                value={originAvailable ? `${compact(requestedFromOriginRps)} req/s` : 'Unavailable'}
                detail={
                  originAvailable
                    ? `${formatPercent(originUtilizationPct)} capacity used`
                    : `${compact(staleFallbackRps)} req/s served stale`
                }
                icon={Database}
                tone="amber"
                failed={!originAvailable || originUtilizationPct > 100}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <h4 className="text-sm font-bold text-neutral-950 dark:text-white">Request disposition</h4>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      label: 'Served at edge',
                      value: edgeHitsRps,
                      total: plannedRps,
                      color: 'bg-cyan-500',
                      detail: `${formatPercent((edgeHitsRps / plannedRps) * 100, 1)} of incoming demand`,
                    },
                    {
                      label: 'Reused at shield',
                      value: shieldHitsRps,
                      total: plannedRps,
                      color: 'bg-violet-500',
                      detail: pathMode === 'shielded' ? 'Misses absorbed before origin' : 'Shield is disabled',
                    },
                    {
                      label: 'Served by origin',
                      value: originServedRps,
                      total: plannedRps,
                      color: 'bg-amber-500',
                      detail: `${compact(originServedRps)} req/s consume origin capacity`,
                    },
                    {
                      label: 'Failed or rejected',
                      value: edgeRejectedRps + failedOriginRps,
                      total: plannedRps,
                      color: 'bg-rose-500',
                      detail: `${compact(edgeRejectedRps + failedOriginRps)} req/s are not served`,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">{item.label}</span>
                        <span className="font-bold tabular-nums text-neutral-950 dark:text-white">
                          {compact(item.value)} req/s
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${item.color}`}
                          style={{ width: `${clamp((item.value / item.total) * 100, 0, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <h4 className="text-sm font-bold text-neutral-950 dark:text-white">Capacity envelope</h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The marker indicates 100% physical capacity. Plan below 75% to preserve recovery headroom.
                </p>
                <div className="mt-5 space-y-5">
                  <PressureBar
                    label="Edge saturation"
                    value={edgeUtilizationPct}
                    detail={`${activeRegions} active × ${compact(edgeCapacityPerRegionRps)} req/s per region`}
                  />
                  <PressureBar
                    label="Origin saturation"
                    value={originUtilizationPct}
                    detail={
                      originAvailable
                        ? `${compact(requestedFromOriginRps)} demand / ${compact(originCapacityRps)} req/s capacity`
                        : 'Origin has no serving capacity during the outage'
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800" aria-labelledby="cost-heading">
            <div>
              <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300">Editable cost model</p>
              <h3 id="cost-heading" className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                What creates the monthly run-rate
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                These inputs are illustrative planning assumptions. Replace them with your own contract,
                region, and workload values.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Edge delivery',
                  value: edgeDeliveryCost,
                  detail: `${formatData(deliveredGB)} × ${formatMoney(edgeEgressPerGB)}/GB`,
                  color: 'bg-cyan-500',
                },
                {
                  label: 'Origin egress',
                  value: originEgressCost,
                  detail: `${formatData(originEgressGB)} × ${formatMoney(originEgressPerGB)}/GB`,
                  color: 'bg-amber-500',
                },
                {
                  label: 'Request processing',
                  value: requestCost,
                  detail: `${compact(monthlyRequests / 1_000_000)}M × ${formatMoney(requestCostPerMillion)}`,
                  color: 'bg-violet-500',
                },
              ].map((part) => (
                <div key={part.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-sm ${part.color}`} />
                    <span className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      {part.label}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold tabular-nums text-neutral-950 dark:text-white">
                    {formatMoney(part.value)}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${part.color}`}
                      style={{ width: `${(part.value / maxCostPart) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{part.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800" aria-labelledby="decision-heading">
            <div className="grid gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-[auto_minmax(0,1fr)] dark:border-neutral-800 dark:bg-neutral-900">
              <div className={`flex h-10 w-10 items-center justify-center rounded-md ${
                status === 'healthy'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : status === 'pressure'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              }`}>
                <Server aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 id="decision-heading" className="font-bold text-neutral-950 dark:text-white">
                  Planning consequence
                </h3>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {challengeId === 'origin-outage'
                    ? `${formatPercent(staleCoveragePct)} stale coverage preserves ${compact(staleFallbackRps)} req/s, but ${compact(failedOriginRps)} req/s still fail. Increase safe stale coverage or add a tested alternate origin.`
                    : edgeUtilizationPct > 100
                      ? `The edge footprint is short by ${compact(edgeDemandRps - totalEdgeCapacityRps)} req/s after routing imbalance. Add regional capacity before tuning the origin.`
                      : originUtilizationPct > 100
                        ? `Cache misses exceed origin capacity by ${compact(requestedFromOriginRps - originCapacityRps)} req/s. Raise reusable hit rate, increase shield reuse, or scale the origin.`
                        : effectiveHitRatePct < 60
                          ? `Only ${formatPercent(effectiveHitRatePct)} of admitted requests are edge hits. Review cache keys and cacheability before relying on more edge capacity.`
                          : `The modeled path serves ${formatPercent(availabilityPct, 2)} of peak demand with ${formatPercent(originOffloadPct, 1)} origin offload. Preserve the remaining headroom for deploys, retries, and regional failover.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  <span className="rounded-md bg-white px-2 py-1 dark:bg-neutral-950">
                    Effective hit {formatPercent(effectiveHitRatePct)}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 dark:bg-neutral-950">
                    Edge headroom {formatPercent(Math.max(0, 100 - edgeUtilizationPct))}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 dark:bg-neutral-950">
                    Origin headroom {originAvailable ? formatPercent(Math.max(0, 100 - originUtilizationPct)) : 'none'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
