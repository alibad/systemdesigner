'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Blocks,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Flame,
  Gauge,
  Layers3,
  Network,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ChallengeId =
  | 'baseline'
  | 'hotspot'
  | 'database-saturation'
  | 'cache-miss-storm'
  | 'queue-buildup'
  | 'region-loss'
  | 'recovery';

type ScaleMode = 'vertical' | 'horizontal' | 'hybrid';
type DataMode = 'scale-up' | 'read-scale' | 'sharded';
type CacheMode = 'bypass' | 'read-through' | 'shielded';
type AsyncMode = 'inline' | 'buffered' | 'guarded';
type Health = 'healthy' | 'thin' | 'breach';

type DemandInputs = {
  currentRps: number;
  annualGrowthPct: number;
  horizonMonths: number;
  peakMultiplier: number;
  readPct: number;
  configuredCacheHitPct: number;
  asyncPct: number;
  hotKeyPct: number;
};

type ArchitectureInputs = {
  scaleMode: ScaleMode;
  dataMode: DataMode;
  cacheMode: CacheMode;
  asyncMode: AsyncMode;
  appUnits: number;
  dataUnits: number;
  cacheNodes: number;
  queueWorkers: number;
  failureDomains: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  trafficMultiplier: number;
  cacheHitDelta: number;
  hotKeyFloor: number;
  databaseCapacityFactor: number;
  workerCapacityFactor: number;
  initialBacklog: number;
  lostDomains: number;
  recoveryCapacityFactor: number;
  icon: LucideIcon;
};

type Bottleneck = {
  id: 'application' | 'cache' | 'database' | 'queue';
  label: string;
  utilization: number;
  capacity: string;
  demand: string;
  consequence: string;
  action: string;
  icon: LucideIcon;
};

const DEFAULT_DEMAND: DemandInputs = {
  currentRps: 6_000,
  annualGrowthPct: 70,
  horizonMonths: 18,
  peakMultiplier: 2.5,
  readPct: 82,
  configuredCacheHitPct: 88,
  asyncPct: 30,
  hotKeyPct: 8,
};

const DEFAULT_ARCHITECTURE: ArchitectureInputs = {
  scaleMode: 'horizontal',
  dataMode: 'read-scale',
  cacheMode: 'read-through',
  asyncMode: 'buffered',
  appUnits: 10,
  dataUnits: 3,
  cacheNodes: 3,
  queueWorkers: 12,
  failureDomains: 3,
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Forecast peak',
    shortLabel: 'Healthy plan',
    description: 'Run the projected peak with every planned dependency available.',
    trafficMultiplier: 1,
    cacheHitDelta: 0,
    hotKeyFloor: 0,
    databaseCapacityFactor: 1,
    workerCapacityFactor: 1,
    initialBacklog: 0,
    lostDomains: 0,
    recoveryCapacityFactor: 1,
    icon: CheckCircle2,
  },
  {
    id: 'hotspot',
    label: 'Hot partition',
    shortLabel: '65% on one key',
    description: 'One tenant or key owns 65% of traffic while totals remain unchanged.',
    trafficMultiplier: 1,
    cacheHitDelta: 0,
    hotKeyFloor: 0.65,
    databaseCapacityFactor: 1,
    workerCapacityFactor: 1,
    initialBacklog: 0,
    lostDomains: 0,
    recoveryCapacityFactor: 1,
    icon: Flame,
  },
  {
    id: 'database-saturation',
    label: 'Database saturation',
    shortLabel: '45% capacity lost',
    description: 'Lock contention and slow storage remove 45% of usable database throughput.',
    trafficMultiplier: 1,
    cacheHitDelta: 0,
    hotKeyFloor: 0,
    databaseCapacityFactor: 0.55,
    workerCapacityFactor: 1,
    initialBacklog: 25_000,
    lostDomains: 0,
    recoveryCapacityFactor: 1,
    icon: Database,
  },
  {
    id: 'cache-miss-storm',
    label: 'Cache miss storm',
    shortLabel: 'Hit rate collapses',
    description: 'A coordinated expiry pushes cold reads back to the database at peak traffic.',
    trafficMultiplier: 1.15,
    cacheHitDelta: -68,
    hotKeyFloor: 0,
    databaseCapacityFactor: 1,
    workerCapacityFactor: 1,
    initialBacklog: 0,
    lostDomains: 0,
    recoveryCapacityFactor: 1,
    icon: Zap,
  },
  {
    id: 'queue-buildup',
    label: 'Queue buildup',
    shortLabel: 'Workers slow down',
    description: 'A downstream API slows workers and leaves 280,000 jobs waiting.',
    trafficMultiplier: 1,
    cacheHitDelta: 0,
    hotKeyFloor: 0,
    databaseCapacityFactor: 1,
    workerCapacityFactor: 0.35,
    initialBacklog: 280_000,
    lostDomains: 0,
    recoveryCapacityFactor: 1,
    icon: Clock3,
  },
  {
    id: 'region-loss',
    label: 'Region loss',
    shortLabel: 'One domain removed',
    description: 'One failure domain disappears while the projected peak continues.',
    trafficMultiplier: 1,
    cacheHitDelta: -12,
    hotKeyFloor: 0,
    databaseCapacityFactor: 1,
    workerCapacityFactor: 1,
    initialBacklog: 40_000,
    lostDomains: 1,
    recoveryCapacityFactor: 1,
    icon: ShieldAlert,
  },
  {
    id: 'recovery',
    label: 'Recovery surge',
    shortLabel: 'Cold caches + replay',
    description: 'Capacity is returning, but caches are cold and queued work must be replayed safely.',
    trafficMultiplier: 1.2,
    cacheHitDelta: -28,
    hotKeyFloor: 0,
    databaseCapacityFactor: 0.7,
    workerCapacityFactor: 0.7,
    initialBacklog: 420_000,
    lostDomains: 0,
    recoveryCapacityFactor: 0.78,
    icon: RefreshCcw,
  },
];

const APP_RPS_PER_UNIT = 1_800;
const DATABASE_RPS_PER_UNIT = 7_000;
const CACHE_RPS_PER_NODE = 30_000;
const JOBS_PER_WORKER_SECOND = 80;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(Math.max(0, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Math.max(0, value));

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return 'not recoverable';
  if (seconds < 1) return '<1 sec';
  if (seconds < 120) return `${formatNumber(seconds)} sec`;
  if (seconds < 7_200) return `${formatNumber(seconds / 60, 1)} min`;
  return `${formatNumber(seconds / 3_600, 1)} hr`;
};

const healthFromUtilization = (utilization: number): Health => {
  if (utilization > 1) return 'breach';
  if (utilization > 0.7) return 'thin';
  return 'healthy';
};

const survivalFactor = (domains: number, lostDomains: number) => {
  if (lostDomains === 0) return 1;
  if (domains <= lostDomains) return 0;
  return (domains - lostDomains) / domains;
};

function RangeControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  display,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  display: string;
  hint: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
          {label}
        </span>
        <span className="shrink-0 font-mono text-sm font-black text-neutral-950 dark:text-white">
          {display}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-cyan-600 dark:accent-cyan-400"
      />
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {hint}
      </span>
    </label>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; detail: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="grid gap-1.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-[54px] min-w-0 rounded-md border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                selected
                  ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-950'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-cyan-500 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-cyan-400 dark:hover:text-white'
              }`}
            >
              <span className="block text-sm font-bold">{option.label}</span>
              <span
                className={`mt-0.5 block text-xs leading-4 ${
                  selected
                    ? 'text-neutral-300 dark:text-neutral-600'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  detail,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'neutral' | 'cyan' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    neutral:
      'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-100',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
    amber:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100',
  };

  return (
    <div className={`min-w-0 border px-3 py-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-xl font-black tracking-normal">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function UtilizationLane({ bottleneck, primary }: { bottleneck: Bottleneck; primary: boolean }) {
  const health = healthFromUtilization(bottleneck.utilization);
  const width = `${clamp(bottleneck.utilization * 100, 2, 100)}%`;
  const tone =
    health === 'breach'
      ? 'bg-rose-500 dark:bg-rose-400'
      : health === 'thin'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-emerald-500 dark:bg-emerald-400';
  const Icon = bottleneck.icon;

  return (
    <div
      className={`min-w-0 border px-3 py-3 ${
        primary
          ? 'border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-black text-neutral-950 dark:text-white">
              {bottleneck.label}
              {primary ? (
                <span className="ml-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                  first constraint
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {bottleneck.demand} / {bottleneck.capacity}
            </p>
          </div>
        </div>
        <span className="font-mono text-sm font-black text-neutral-950 dark:text-white">
          {formatNumber(bottleneck.utilization * 100, 1)}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width }} />
      </div>
      <div className="mt-2 grid gap-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300 sm:grid-cols-2">
        <p>{bottleneck.consequence}</p>
        <p className="font-semibold text-neutral-800 dark:text-neutral-100">{bottleneck.action}</p>
      </div>
    </div>
  );
}

function TriggerCard({
  label,
  trigger,
  action,
  icon: Icon,
}: {
  label: string;
  trigger: string;
  action: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 border-l-2 border-cyan-500 bg-neutral-50 px-3 py-3 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
        <p className="text-xs font-black uppercase text-neutral-600 dark:text-neutral-300">{label}</p>
      </div>
      <p className="mt-2 text-sm font-black text-neutral-950 dark:text-white">{trigger}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{action}</p>
    </div>
  );
}

export default function ScalabilityPlannerTool() {
  const [demand, setDemand] = useState<DemandInputs>(DEFAULT_DEMAND);
  const [architecture, setArchitecture] = useState<ArchitectureInputs>(DEFAULT_ARCHITECTURE);
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');

  const updateDemand = <K extends keyof DemandInputs>(key: K, value: DemandInputs[K]) => {
    setDemand((current) => ({ ...current, [key]: value }));
  };

  const updateArchitecture = <K extends keyof ArchitectureInputs>(
    key: K,
    value: ArchitectureInputs[K],
  ) => {
    setArchitecture((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setDemand(DEFAULT_DEMAND);
    setArchitecture(DEFAULT_ARCHITECTURE);
    setChallengeId('baseline');
  };

  const result = useMemo(() => {
    const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];
    const growthFactor = Math.pow(
      1 + demand.annualGrowthPct / 100,
      demand.horizonMonths / 12,
    );
    const forecastRps = demand.currentRps * growthFactor;
    const plannedPeakRps = forecastRps * demand.peakMultiplier;
    const scenarioRps = plannedPeakRps * challenge.trafficMultiplier;
    const readRps = scenarioRps * (demand.readPct / 100);
    const writeRps = scenarioRps - readRps;
    const hotShare = Math.max(demand.hotKeyPct / 100, challenge.hotKeyFloor);

    const shieldBenefit =
      architecture.cacheMode === 'shielded' && challenge.id === 'cache-miss-storm' ? 34 : 0;
    const configuredHitRate =
      architecture.cacheMode === 'bypass' || architecture.cacheNodes === 0
        ? 0
        : demand.configuredCacheHitPct;
    const effectiveHitRate = clamp(
      (configuredHitRate + challenge.cacheHitDelta + shieldBenefit) / 100,
      0,
      0.99,
    );
    const cacheMissRps = readRps * (1 - effectiveHitRate);
    const databaseRps = writeRps + cacheMissRps;

    const appDomains =
      architecture.scaleMode === 'vertical'
        ? 1
        : Math.min(architecture.failureDomains, architecture.appUnits);
    const scaleEfficiency =
      architecture.scaleMode === 'vertical'
        ? Math.pow(architecture.appUnits, 0.84) * 1.18
        : architecture.scaleMode === 'horizontal'
          ? architecture.appUnits * 0.91
          : architecture.appUnits * 1.04;
    const inlineWorkMultiplier =
      architecture.asyncMode === 'inline' ? 1 + (demand.asyncPct / 100) * 0.65 : 1;
    const appDemandRps = scenarioRps * inlineWorkMultiplier;
    const appCapacityRps =
      APP_RPS_PER_UNIT *
      scaleEfficiency *
      survivalFactor(appDomains, challenge.lostDomains) *
      challenge.recoveryCapacityFactor;
    const appUtilization = appCapacityRps > 0 ? appDemandRps / appCapacityRps : 10;

    const cacheDomains = Math.min(
      architecture.failureDomains,
      Math.max(1, architecture.cacheNodes),
    );
    const cacheCapacityRps =
      architecture.cacheMode === 'bypass'
        ? 0
        : architecture.cacheNodes *
          CACHE_RPS_PER_NODE *
          survivalFactor(cacheDomains, challenge.lostDomains) *
          challenge.recoveryCapacityFactor;
    const cacheHotKeyRps =
      architecture.cacheMode === 'shielded' ? readRps * hotShare * 0.45 : readRps * hotShare;
    const cacheUtilization =
      architecture.cacheMode === 'bypass'
        ? 0
        : cacheCapacityRps > 0
          ? Math.max(readRps / cacheCapacityRps, cacheHotKeyRps / CACHE_RPS_PER_NODE)
          : 10;

    const dataDomains =
      architecture.dataMode === 'scale-up'
        ? 1
        : Math.min(architecture.failureDomains, Math.max(1, architecture.dataUnits));
    const databaseSurvival =
      survivalFactor(dataDomains, challenge.lostDomains) *
      challenge.databaseCapacityFactor *
      challenge.recoveryCapacityFactor;
    let databaseUtilization = 0;
    let databaseCapacityRps = 0;

    if (architecture.dataMode === 'scale-up') {
      databaseCapacityRps =
        DATABASE_RPS_PER_UNIT * Math.pow(architecture.dataUnits, 0.8) * 1.12 * databaseSurvival;
      const lockPenalty = challenge.id === 'hotspot' ? 1 + hotShare * 1.4 : 1;
      databaseUtilization =
        databaseCapacityRps > 0 ? (databaseRps * lockPenalty) / databaseCapacityRps : 10;
    } else if (architecture.dataMode === 'read-scale') {
      const writeCapacity = DATABASE_RPS_PER_UNIT * databaseSurvival;
      const readCapacity =
        DATABASE_RPS_PER_UNIT * architecture.dataUnits * 0.82 * databaseSurvival;
      const lockPenalty = challenge.id === 'hotspot' ? 1 + hotShare : 1;
      databaseCapacityRps = writeCapacity + readCapacity;
      databaseUtilization =
        databaseCapacityRps > 0
          ? Math.max(
              (writeRps * lockPenalty) / Math.max(writeCapacity, 1),
              (cacheMissRps * lockPenalty) / Math.max(readCapacity, 1),
            )
          : 10;
    } else {
      const shardCapacity = DATABASE_RPS_PER_UNIT * 0.78 * databaseSurvival;
      const evenShardLoad = databaseRps / architecture.dataUnits;
      const hotShardLoad = databaseRps * hotShare;
      databaseCapacityRps = shardCapacity * architecture.dataUnits;
      databaseUtilization =
        shardCapacity > 0 ? Math.max(evenShardLoad, hotShardLoad) / shardCapacity : 10;
    }

    const asyncArrivalRps =
      architecture.asyncMode === 'inline' ? 0 : scenarioRps * (demand.asyncPct / 100);
    const queueDomains = Math.min(
      architecture.failureDomains,
      Math.max(1, Math.ceil(architecture.queueWorkers / 4)),
    );
    const guardFactor = architecture.asyncMode === 'guarded' ? 1.35 : 1;
    const queueCapacityRps =
      architecture.asyncMode === 'inline'
        ? 0
        : architecture.queueWorkers *
          JOBS_PER_WORKER_SECOND *
          challenge.workerCapacityFactor *
          guardFactor *
          survivalFactor(queueDomains, challenge.lostDomains) *
          challenge.recoveryCapacityFactor;
    const admittedQueueRps =
      architecture.asyncMode === 'guarded'
        ? Math.min(asyncArrivalRps, queueCapacityRps * 0.9)
        : asyncArrivalRps;
    const deferredRps = Math.max(0, asyncArrivalRps - admittedQueueRps);
    const queueUtilization =
      architecture.asyncMode === 'inline'
        ? 0
        : queueCapacityRps > 0
          ? admittedQueueRps / queueCapacityRps
          : 10;
    const generatedBacklog = Math.max(0, admittedQueueRps - queueCapacityRps) * 300;
    const backlog = challenge.initialBacklog + generatedBacklog;
    const drainRps = Math.max(0, queueCapacityRps - admittedQueueRps);
    const recoverySeconds =
      backlog === 0 ? 0 : drainRps > 0 ? backlog / drainRps : Number.POSITIVE_INFINITY;

    const appCostPerUnit =
      architecture.scaleMode === 'vertical'
        ? 360
        : architecture.scaleMode === 'horizontal'
          ? 230
          : 290;
    const dataCostPerUnit =
      architecture.dataMode === 'scale-up'
        ? 920
        : architecture.dataMode === 'read-scale'
          ? 610
          : 780;
    const domainOverhead = 1 + Math.max(0, architecture.failureDomains - 1) * 0.12;
    const monthlyCost =
      (architecture.appUnits * appCostPerUnit +
        architecture.dataUnits * dataCostPerUnit +
        architecture.cacheNodes * 145 +
        architecture.queueWorkers * 58) *
      domainOverhead;

    const bottlenecks: Bottleneck[] = [
      {
        id: 'application',
        label: 'Application',
        utilization: appUtilization,
        demand: `${formatCompact(appDemandRps)} RPS`,
        capacity: `${formatCompact(appCapacityRps)} RPS`,
        consequence:
          appUtilization > 1
            ? 'Requests queue before business logic and p95 latency rises sharply.'
            : `${formatNumber(Math.max(0, 100 - appUtilization * 100), 1)}% compute headroom remains.`,
        action:
          architecture.scaleMode === 'vertical'
            ? appUtilization > 0.7
              ? 'The next size buys time, but one host still defines the outage boundary.'
              : 'Scale up only while the one-host failure boundary is acceptable.'
            : `Add ${Math.max(0, Math.ceil(appDemandRps / (APP_RPS_PER_UNIT * 0.7)) - architecture.appUnits)} unit(s) before 70% utilization.`,
        icon: Server,
      },
      {
        id: 'cache',
        label: architecture.cacheMode === 'bypass' ? 'Cache bypassed' : 'Cache layer',
        utilization: cacheUtilization,
        demand:
          architecture.cacheMode === 'bypass'
            ? `${formatCompact(readRps)} reads forwarded`
            : `${formatCompact(readRps)} lookups`,
        capacity:
          architecture.cacheMode === 'bypass'
            ? 'no cache capacity'
            : `${formatCompact(cacheCapacityRps)} lookups/s`,
        consequence:
          architecture.cacheMode === 'bypass'
            ? 'Every read reaches the database.'
            : `${formatNumber(effectiveHitRate * 100, 1)}% hit rate leaves ${formatCompact(cacheMissRps)} database reads/s.`,
        action:
          challenge.id === 'cache-miss-storm' && architecture.cacheMode !== 'shielded'
            ? 'Add request coalescing and staggered expiry before adding cache nodes.'
            : cacheUtilization > 0.7
              ? 'Add nodes or isolate the hot key; total node count alone may not help skew.'
              : 'Keep hit rate and hot-key load as separate alerts.',
        icon: Zap,
      },
      {
        id: 'database',
        label: 'Database',
        utilization: databaseUtilization,
        demand: `${formatCompact(databaseRps)} operations/s`,
        capacity: `${formatCompact(databaseCapacityRps)} modeled operations/s`,
        consequence:
          databaseUtilization > 1
            ? 'Reads stall and write latency propagates into request and worker queues.'
            : `${formatNumber(Math.max(0, 100 - databaseUtilization * 100), 1)}% database headroom remains.`,
        action:
          architecture.dataMode === 'read-scale' && writeRps / Math.max(databaseRps, 1) > 0.35
            ? 'Read replicas cannot scale this write share; prepare partitioning or write-path changes.'
            : challenge.id === 'hotspot'
              ? 'Change the partition key or split the hot tenant; adding even shards is not enough.'
              : databaseUtilization > 0.7
                ? architecture.dataMode === 'scale-up'
                  ? 'Scale up for the short term, then migrate before the single-primary ceiling.'
                  : 'Increase the chosen data units only after measuring replication and rebalancing cost.'
                : 'Validate this envelope with sustained mixed read/write load.',
        icon: Database,
      },
      {
        id: 'queue',
        label: architecture.asyncMode === 'inline' ? 'Inline work' : 'Async queue',
        utilization:
          architecture.asyncMode === 'inline' ? appUtilization : queueUtilization,
        demand:
          architecture.asyncMode === 'inline'
            ? `${formatCompact(scenarioRps * (demand.asyncPct / 100))} inline jobs/s`
            : `${formatCompact(asyncArrivalRps)} jobs/s`,
        capacity:
          architecture.asyncMode === 'inline'
            ? 'shares app capacity'
            : `${formatCompact(queueCapacityRps)} jobs/s`,
        consequence:
          architecture.asyncMode === 'inline'
            ? 'Slow background work consumes request capacity directly.'
            : backlog > 0
              ? `${formatCompact(backlog)} jobs wait; drain time is ${formatDuration(recoverySeconds)}.`
              : deferredRps > 0
                ? `${formatCompact(deferredRps)} jobs/s are deferred by admission control.`
                : 'Workers keep pace without persistent backlog.',
        action:
          architecture.asyncMode === 'inline'
            ? 'Buffer retryable work before it competes with synchronous requests.'
            : recoverySeconds === Number.POSITIVE_INFINITY
              ? 'Stop intake or add worker capacity; this backlog cannot drain.'
              : recoverySeconds > 900
                ? 'Scale workers and cap retries before replaying the backlog.'
                : 'Keep queue age, not only queue depth, as the scaling signal.',
        icon: Layers3,
      },
    ];
    bottlenecks.sort((left, right) => right.utilization - left.utilization);

    const firstBottleneck = bottlenecks[0];
    const maximumUtilization = firstBottleneck.utilization;
    const health = healthFromUtilization(maximumUtilization);
    const activePathDomains = [
      appDomains,
      dataDomains,
      ...(architecture.cacheMode === 'bypass' ? [] : [cacheDomains]),
      ...(architecture.asyncMode === 'inline' ? [] : [queueDomains]),
    ];
    const minimumDomains = Math.min(...activePathDomains);
    const survivesDomainLoss =
      architecture.failureDomains > 1 &&
      appDomains > 1 &&
      dataDomains > 1 &&
      (architecture.cacheMode === 'bypass' || cacheDomains > 1) &&
      (architecture.asyncMode === 'inline' || queueDomains > 1);

    let consequence = 'The forecast peak stays inside the modeled envelope.';
    if (challenge.id === 'region-loss' && minimumDomains <= challenge.lostDomains) {
      consequence =
        'A single-domain component removes the request path. Users see an outage, not graceful degradation.';
    } else if (databaseUtilization > 1) {
      consequence =
        'Database waits propagate upstream: reads slow, writes time out, and retries add more pressure.';
    } else if (appUtilization > 1) {
      consequence = 'Request queues grow at the application tier and users see elevated latency and 5xx errors.';
    } else if (recoverySeconds > 900 || recoverySeconds === Number.POSITIVE_INFINITY) {
      consequence =
        'Foreground traffic may recover first, while notifications, indexing, and fulfillment remain delayed.';
    } else if (maximumUtilization > 0.7) {
      consequence =
        'The system serves the peak, but scaling lag or a modest forecast error can consume the remaining reserve.';
    }

    const scalingSteps = [
      {
        title:
          firstBottleneck.id === 'database'
            ? 'Protect the data path'
            : firstBottleneck.id === 'application'
              ? 'Restore request headroom'
              : firstBottleneck.id === 'cache'
                ? 'Control miss amplification'
                : 'Stop backlog growth',
        detail: firstBottleneck.action,
        badge: 'First move',
      },
      {
        title:
          architecture.cacheMode === 'bypass' && demand.readPct > 60
            ? 'Remove avoidable reads'
            : architecture.asyncMode === 'inline' && demand.asyncPct > 15
              ? 'Separate retryable work'
              : !survivesDomainLoss
                ? 'Remove the single-domain dependency'
                : 'Re-test the whole path',
        detail:
          architecture.cacheMode === 'bypass' && demand.readPct > 60
            ? `A read-through cache can intercept part of the ${formatCompact(readRps)} read RPS before database scaling.`
            : architecture.asyncMode === 'inline' && demand.asyncPct > 15
              ? `${formatNumber(demand.asyncPct)}% of work can move behind a bounded queue.`
              : !survivesDomainLoss
                ? 'Replica count is not resilience until request, data, cache, and worker paths span domains.'
                : 'Load test the new limit with realistic reads, writes, skew, and retries.',
        badge: 'Dependency',
      },
      {
        title:
          architecture.dataMode === 'scale-up' || architecture.scaleMode === 'vertical'
            ? 'Define the scale-out migration'
            : 'Prove recovery before growth',
        detail:
          architecture.dataMode === 'scale-up' || architecture.scaleMode === 'vertical'
            ? 'Name the utilization and lead-time threshold that starts partitioning or stateless scale-out.'
            : `Rehearse region loss and backlog replay; the current modeled drain time is ${formatDuration(recoverySeconds)}.`,
        badge: 'Before the ceiling',
      },
    ];

    const triggerMonth = (utilizationAtHorizon: number) => {
      const utilizationNow =
        utilizationAtHorizon / Math.max(growthFactor * challenge.trafficMultiplier, 0.01);
      if (utilizationNow >= 0.7) return 'Trigger now';
      if (demand.annualGrowthPct <= 0 || utilizationNow <= 0) return 'No growth trigger';
      const months =
        (12 * Math.log(0.7 / utilizationNow)) / Math.log(1 + demand.annualGrowthPct / 100);
      if (!Number.isFinite(months) || months > demand.horizonMonths) {
        return `After month ${demand.horizonMonths}`;
      }
      return `Month ${Math.max(1, Math.ceil(months))}`;
    };

    return {
      challenge,
      forecastRps,
      scenarioRps,
      effectiveHitRate,
      databaseRps,
      backlog,
      recoverySeconds,
      deferredRps,
      monthlyCost,
      bottlenecks,
      firstBottleneck,
      health,
      consequence,
      survivesDomainLoss,
      appDomains,
      dataDomains,
      queueDomains,
      scalingSteps,
      triggers: {
        application: triggerMonth(appUtilization),
        database: triggerMonth(databaseUtilization),
        queue:
          architecture.asyncMode === 'inline'
            ? 'When async work exceeds 15%'
            : triggerMonth(queueUtilization),
      },
    };
  }, [architecture, challengeId, demand]);

  const healthTone =
    result.health === 'breach'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100'
      : result.health === 'thin'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
        : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100';

  const firstHeadroom = (1 - result.firstBottleneck.utilization) * 100;

  return (
    <div
      data-content-block="tools/scalability-planner"
      className="not-prose my-8 w-full min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Scalability control room
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              Find the next constraint before users do
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Forecast demand, choose a concrete architecture, then break it. Every control changes
              capacity, failure behavior, cost, and the scaling sequence.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-bold text-neutral-100 outline-none transition hover:border-cyan-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset plan
          </button>
        </div>
      </header>

      <section
        aria-labelledby="pressure-scenarios"
        className="border-b border-neutral-200 bg-neutral-50 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">
              Pressure lab
            </p>
            <h2 id="pressure-scenarios" className="mt-1 text-lg font-black">
              Challenge the healthy plan
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Select one operating state. The same demand and architecture stay in place so the
            changed consequence is visible.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
          {CHALLENGES.map((challenge) => {
            const selected = challenge.id === challengeId;
            const Icon = challenge.icon;
            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallengeId(challenge.id)}
                className={`min-h-[76px] min-w-0 rounded-md border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-rose-500 ${
                  selected
                    ? 'border-rose-700 bg-rose-700 text-white shadow-sm dark:border-rose-300 dark:bg-rose-200 dark:text-rose-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-rose-400 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-rose-500 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="mt-2 block text-xs font-black leading-4">{challenge.label}</span>
                <span
                  className={`mt-0.5 block text-[11px] leading-4 ${
                    selected
                      ? 'text-rose-100 dark:text-rose-800'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {challenge.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          <AlertTriangle
            className="mt-1 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300"
            aria-hidden="true"
          />
          <p>{result.challenge.description}</p>
        </div>
      </section>

      <div className="grid min-w-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 dark:border-neutral-800 xl:border-b-0 xl:border-r">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
            <SectionHeading
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 1"
              title="Shape the demand"
              detail="Separate sustained growth, event peaks, reads, asynchronous work, and skew. Totals alone hide the real constraint."
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <RangeControl
                label="Current sustained load"
                value={demand.currentRps}
                onChange={(value) => updateDemand('currentRps', value)}
                min={500}
                max={50_000}
                step={500}
                display={`${formatCompact(demand.currentRps)} RPS`}
                hint="Measured steady traffic before the event multiplier."
              />
              <RangeControl
                label="Annual demand growth"
                value={demand.annualGrowthPct}
                onChange={(value) => updateDemand('annualGrowthPct', value)}
                min={0}
                max={300}
                step={5}
                display={`${demand.annualGrowthPct}%`}
                hint="Compounded over the selected planning horizon."
              />
              <RangeControl
                label="Planning horizon"
                value={demand.horizonMonths}
                onChange={(value) => updateDemand('horizonMonths', value)}
                min={3}
                max={36}
                step={3}
                display={`${demand.horizonMonths} mo`}
                hint="Long enough to include architecture migration lead time."
              />
              <RangeControl
                label="Peak over sustained"
                value={demand.peakMultiplier}
                onChange={(value) => updateDemand('peakMultiplier', value)}
                min={1}
                max={6}
                step={0.5}
                display={`${demand.peakMultiplier}x`}
                hint="Launches, daily peaks, and concentrated batch traffic."
              />
              <RangeControl
                label="Read share"
                value={demand.readPct}
                onChange={(value) => updateDemand('readPct', value)}
                min={20}
                max={98}
                display={`${demand.readPct}%`}
                hint="Read scaling does not create write capacity."
              />
              <RangeControl
                label="Expected cache hit rate"
                value={demand.configuredCacheHitPct}
                onChange={(value) => updateDemand('configuredCacheHitPct', value)}
                min={0}
                max={99}
                display={`${demand.configuredCacheHitPct}%`}
                hint="Normal traffic hit rate before a cold-cache challenge."
              />
              <RangeControl
                label="Asynchronous work"
                value={demand.asyncPct}
                onChange={(value) => updateDemand('asyncPct', value)}
                min={0}
                max={70}
                display={`${demand.asyncPct}%`}
                hint="Requests that create background work or retryable jobs."
              />
              <RangeControl
                label="Largest key or tenant"
                value={demand.hotKeyPct}
                onChange={(value) => updateDemand('hotKeyPct', value)}
                min={1}
                max={80}
                display={`${demand.hotKeyPct}%`}
                hint="A skew signal that can defeat even partitioning."
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6">
            <SectionHeading
              icon={<Blocks className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 2"
              title="Choose the operating envelope"
              detail="Change how capacity is added, where state lives, and which failures the path can survive."
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <ChoiceGroup
                label="Application scaling"
                value={architecture.scaleMode}
                onChange={(value) => updateArchitecture('scaleMode', value)}
                options={[
                  {
                    value: 'vertical',
                    label: 'Vertical',
                    detail: 'Fast capacity on one larger host; one failure boundary.',
                  },
                  {
                    value: 'horizontal',
                    label: 'Horizontal',
                    detail: 'Stateless replicas with coordination overhead and domain spread.',
                  },
                  {
                    value: 'hybrid',
                    label: 'Hybrid',
                    detail: 'Larger replicas across domains; higher unit cost.',
                  },
                ]}
              />
              <RangeControl
                label={architecture.scaleMode === 'vertical' ? 'Compute size units' : 'Application units'}
                value={architecture.appUnits}
                onChange={(value) => updateArchitecture('appUnits', value)}
                min={1}
                max={24}
                display={`${architecture.appUnits}`}
                hint={
                  architecture.scaleMode === 'vertical'
                    ? 'Diminishing gains model memory, I/O, and scheduler limits.'
                    : 'Each unit adds measured capacity with coordination cost.'
                }
              />
              <ChoiceGroup
                label="Database scaling"
                value={architecture.dataMode}
                onChange={(value) => updateArchitecture('dataMode', value)}
                options={[
                  {
                    value: 'scale-up',
                    label: 'Scale up',
                    detail: 'One stronger primary; simplest path and lowest failure isolation.',
                  },
                  {
                    value: 'read-scale',
                    label: 'Read replicas',
                    detail: 'Read capacity grows; writes still share one primary ceiling.',
                  },
                  {
                    value: 'sharded',
                    label: 'Sharded',
                    detail: 'Distributed writes, but the hottest shard sets the limit.',
                  },
                ]}
              />
              <RangeControl
                label={
                  architecture.dataMode === 'scale-up'
                    ? 'Database size units'
                    : architecture.dataMode === 'read-scale'
                      ? 'Read replica units'
                      : 'Shard count'
                }
                value={architecture.dataUnits}
                onChange={(value) => updateArchitecture('dataUnits', value)}
                min={1}
                max={12}
                display={`${architecture.dataUnits}`}
                hint="The meaning changes with the selected data strategy."
              />
              <ChoiceGroup
                label="Cache protection"
                value={architecture.cacheMode}
                onChange={(value) => updateArchitecture('cacheMode', value)}
                options={[
                  {
                    value: 'bypass',
                    label: 'Bypass',
                    detail: 'No stale data, but every read reaches storage.',
                  },
                  {
                    value: 'read-through',
                    label: 'Read-through',
                    detail: 'Normal hit-rate benefit without stampede protection.',
                  },
                  {
                    value: 'shielded',
                    label: 'Shielded',
                    detail: 'Request coalescing and staggered expiry reduce miss amplification.',
                  },
                ]}
              />
              <RangeControl
                label="Cache nodes"
                value={architecture.cacheNodes}
                onChange={(value) => updateArchitecture('cacheNodes', value)}
                min={0}
                max={12}
                display={`${architecture.cacheNodes}`}
                hint="Node count grows total lookup capacity, not a single hot key."
              />
              <ChoiceGroup
                label="Background work"
                value={architecture.asyncMode}
                onChange={(value) => updateArchitecture('asyncMode', value)}
                options={[
                  {
                    value: 'inline',
                    label: 'Inline',
                    detail: 'No backlog, but slow work consumes request capacity.',
                  },
                  {
                    value: 'buffered',
                    label: 'Buffered',
                    detail: 'Absorb bursts; unbounded intake can create long recovery.',
                  },
                  {
                    value: 'guarded',
                    label: 'Guarded queue',
                    detail: 'Admission control protects recovery at the cost of deferred work.',
                  },
                ]}
              />
              <RangeControl
                label="Queue workers"
                value={architecture.queueWorkers}
                onChange={(value) => updateArchitecture('queueWorkers', value)}
                min={1}
                max={40}
                display={`${architecture.queueWorkers}`}
                hint="Worker throughput falls during downstream and recovery challenges."
              />
              <RangeControl
                label="Failure domains"
                value={architecture.failureDomains}
                onChange={(value) => updateArchitecture('failureDomains', value)}
                min={1}
                max={3}
                display={`${architecture.failureDomains}`}
                hint="A component survives domain loss only when its own replicas span domains."
              />
            </div>
          </section>
        </aside>

        <main className="min-w-0 bg-neutral-50/60 dark:bg-neutral-900/30">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className={`border px-4 py-4 ${healthTone}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase">
                    {result.health === 'breach'
                      ? 'Capacity breach'
                      : result.health === 'thin'
                        ? 'Reserve at risk'
                        : 'Inside operating envelope'}
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {result.firstBottleneck.label} is the next constraint
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6">{result.consequence}</p>
                </div>
                <div className="shrink-0 text-left md:text-right">
                  <p className="font-mono text-2xl font-black">
                    {firstHeadroom >= 0
                      ? `${formatNumber(firstHeadroom, 1)}%`
                      : `${formatNumber(Math.abs(firstHeadroom), 1)}% over`}
                  </p>
                  <p className="text-xs font-bold uppercase opacity-75">
                    {firstHeadroom >= 0 ? 'minimum headroom' : 'modeled capacity'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric
                label="Forecast traffic"
                value={`${formatCompact(result.scenarioRps)} RPS`}
                detail={`${formatCompact(result.forecastRps)} sustained before peak and challenge factors`}
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                tone="cyan"
              />
              <Metric
                label="Database pressure"
                value={`${formatCompact(result.databaseRps)} ops/s`}
                detail={`${formatNumber(result.effectiveHitRate * 100, 1)}% effective cache hit rate`}
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
                tone={result.firstBottleneck.id === 'database' ? 'rose' : 'amber'}
              />
              <Metric
                label="Recovery backlog"
                value={formatCompact(result.backlog)}
                detail={
                  result.deferredRps > 0
                    ? `${formatCompact(result.deferredRps)} jobs/s intentionally deferred`
                    : `drain time ${formatDuration(result.recoverySeconds)}`
                }
                icon={<RefreshCcw className="h-4 w-4" aria-hidden="true" />}
                tone={result.backlog > 0 ? 'amber' : 'emerald'}
              />
              <Metric
                label="Modeled run rate"
                value={formatMoney(result.monthlyCost)}
                detail="Compute, data, cache, workers, and multi-domain overhead"
                icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-black uppercase text-violet-700 dark:text-violet-300">
                Request and work path
              </p>
              <h2 className="mt-1 text-xl font-black">Watch pressure move through the system</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Cache misses become database traffic. Inline work becomes application load.
                Buffered work becomes queue age. Scaling one box can expose the next.
              </p>
            </div>

            <div
              className="mt-5 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5"
              role="img"
              aria-label={`Modeled path with ${result.firstBottleneck.label} as the highest-utilization component`}
            >
              {[
                {
                  label: 'Traffic',
                  value: `${formatCompact(result.scenarioRps)} RPS`,
                  detail: 'forecast peak',
                  icon: Users,
                },
                ...result.bottlenecks
                  .slice()
                  .sort(
                    (left, right) =>
                      ['application', 'cache', 'database', 'queue'].indexOf(left.id) -
                      ['application', 'cache', 'database', 'queue'].indexOf(right.id),
                  )
                  .map((item) => ({
                    label: item.label,
                    value: `${formatNumber(item.utilization * 100, 0)}% used`,
                    detail: item.id === result.firstBottleneck.id ? 'first constraint' : 'modeled tier',
                    icon: item.icon,
                  })),
              ].map((node, index) => {
                const Icon = node.icon;
                const highlighted = node.detail === 'first constraint';
                return (
                  <div
                    key={node.label}
                    className={`relative min-h-[112px] min-w-0 border px-3 py-3 ${
                      highlighted
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                        : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon
                        className={`h-5 w-5 ${
                          highlighted
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-cyan-700 dark:text-cyan-300'
                        }`}
                        aria-hidden="true"
                      />
                      {index < 4 ? (
                        <>
                          <ArrowRight
                            className="hidden h-4 w-4 translate-x-5 text-neutral-400 xl:block"
                            aria-hidden="true"
                          />
                          <ArrowDown
                            className="h-4 w-4 text-neutral-400 xl:hidden"
                            aria-hidden="true"
                          />
                        </>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-black text-neutral-950 dark:text-white">
                      {node.label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-neutral-700 dark:text-neutral-200">
                      {node.value}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{node.detail}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">
                  Bottleneck ledger
                </p>
                <h2 className="mt-1 text-xl font-black">Demand versus usable capacity</h2>
              </div>
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Amber begins at 70% to preserve scaling and failure reserve.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {result.bottlenecks.map((bottleneck, index) => (
                <UtilizationLane key={bottleneck.id} bottleneck={bottleneck} primary={index === 0} />
              ))}
            </div>
          </section>

          <section className="grid border-b border-neutral-200 dark:border-neutral-800 lg:grid-cols-2">
            <div className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:border-b-0 lg:border-r lg:px-8">
              <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">
                Reliability trade-off
              </p>
              <h2 className="mt-1 text-xl font-black">
                {result.survivesDomainLoss ? 'One-domain loss is designed in' : 'A single-domain path remains'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Application spans {result.appDomains}, data spans {result.dataDomains}, and workers
                span {result.queueDomains} modeled domain(s). The weakest tier sets end-to-end
                availability.
              </p>
              <div className="mt-4 flex items-start gap-3 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                {result.survivesDomainLoss ? (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <p>
                  {result.survivesDomainLoss
                    ? 'The topology has independent placement, but the region-loss challenge still verifies surviving headroom.'
                    : 'More total capacity does not fix this. Move every critical tier across failure domains and test failover.'}
                </p>
              </div>
            </div>

            <div className="px-4 py-6 sm:px-6 lg:px-8">
              <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                Cost trade-off
              </p>
              <h2 className="mt-1 text-xl font-black">{formatMoney(result.monthlyCost)} modeled monthly</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {architecture.scaleMode === 'vertical'
                  ? 'Vertical compute buys fast capacity with diminishing returns and a one-host failure boundary.'
                  : architecture.scaleMode === 'horizontal'
                    ? 'Horizontal compute adds smaller units and failure isolation, with load-balancing and coordination overhead.'
                    : 'Hybrid compute pays more per unit to combine larger nodes with failure-domain spread.'}
              </p>
              <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {architecture.dataMode === 'scale-up'
                  ? 'The database remains operationally simple, but the next tier is more expensive and migration lead time grows.'
                  : architecture.dataMode === 'read-scale'
                    ? 'Replica spend follows read load; write throughput still has a single-primary ceiling.'
                    : 'Shard spend creates write capacity only when keys distribute load and rebalancing is operationally safe.'}
              </p>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">
              Scaling sequence
            </p>
            <h2 className="mt-1 text-xl font-black">Move the constraint without creating a cascade</h2>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {result.scalingSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative min-w-0 border-t-2 border-cyan-500 bg-white px-4 py-4 dark:bg-neutral-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-black text-white dark:bg-white dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <span className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">
                      {step.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-black text-neutral-950 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                  {index < result.scalingSteps.length - 1 ? (
                    <ArrowRight
                      className="absolute -right-5 top-1/2 z-10 hidden h-5 w-5 text-cyan-600 lg:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
              <div>
                <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">
                  Migration triggers
                </p>
                <h2 className="mt-1 text-xl font-black">Start before the ceiling</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  These are lead-time signals, not emergency recommendations after saturation.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <TriggerCard
                label="Application"
                trigger={result.triggers.application}
                action={
                  architecture.scaleMode === 'vertical'
                    ? 'Begin stateless extraction when the next host size cannot preserve 30% reserve.'
                    : 'Add tested units before autoscaling lag consumes the reserve.'
                }
                icon={Server}
              />
              <TriggerCard
                label="Database"
                trigger={result.triggers.database}
                action={
                  architecture.dataMode === 'read-scale'
                    ? 'Start partition design when write utilization, not replica reads, reaches the threshold.'
                    : architecture.dataMode === 'sharded'
                      ? 'Repartition when one shard reaches 70%, even if fleet average is low.'
                      : 'Fund the scale-out migration before the final vertical tier.'
                }
                icon={Database}
              />
              <TriggerCard
                label="Async path"
                trigger={result.triggers.queue}
                action={
                  architecture.asyncMode === 'inline'
                    ? 'Introduce a bounded queue when retryable work materially competes with requests.'
                    : 'Scale from oldest-job age and recovery drain time, not queue depth alone.'
                }
                icon={Network}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
