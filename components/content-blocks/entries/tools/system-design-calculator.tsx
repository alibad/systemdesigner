'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Coins,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Network,
  RefreshCcw,
  Rocket,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ScenarioId =
  | 'baseline'
  | 'launch'
  | 'cache-outage'
  | 'zone-loss'
  | 'slow-data'
  | 'retry-storm';

type WorkloadInputs = {
  dailyUsers: number;
  actionsPerUser: number;
  peakMultiplier: number;
  responseKb: number;
  readPercent: number;
  cacheHitPercent: number;
  retentionDays: number;
};

type CapacityInputs = {
  appInstances: number;
  appRpsPerInstance: number;
  databaseNodes: number;
  databaseRpsPerNode: number;
  regions: number;
  headroomPercent: number;
  replicationFactor: number;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  demandMultiplier?: number;
  retryMultiplier?: number;
  cacheHitOverride?: number;
  databaseCapacityMultiplier?: number;
  removesDomain?: boolean;
};

type Status = 'healthy' | 'risk' | 'breach';

const DEFAULT_WORKLOAD: WorkloadInputs = {
  dailyUsers: 2_000_000,
  actionsPerUser: 40,
  peakMultiplier: 4,
  responseKb: 18,
  readPercent: 85,
  cacheHitPercent: 80,
  retentionDays: 365,
};

const DEFAULT_CAPACITY: CapacityInputs = {
  appInstances: 10,
  appRpsPerInstance: 900,
  databaseNodes: 3,
  databaseRpsPerNode: 900,
  regions: 3,
  headroomPercent: 30,
  replicationFactor: 3,
};

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: 'Expected peak',
    badge: 'Healthy day',
    description: 'Demand follows the workload assumptions and every failure domain is available.',
    icon: CheckCircle2,
  },
  {
    id: 'launch',
    label: 'Launch surge',
    badge: '2.5x demand',
    description: 'A coordinated product launch compresses a normal day into a much sharper peak.',
    icon: Rocket,
    demandMultiplier: 2.5,
  },
  {
    id: 'cache-outage',
    label: 'Cache outage',
    badge: '0% hit rate',
    description: 'Every read reaches the application and data tier while users keep arriving.',
    icon: CloudOff,
    cacheHitOverride: 0,
  },
  {
    id: 'zone-loss',
    label: 'Zone loss',
    badge: 'One domain gone',
    description: 'One failure domain disappears, reducing usable app and database capacity.',
    icon: ShieldAlert,
    removesDomain: true,
  },
  {
    id: 'slow-data',
    label: 'Slow data tier',
    badge: '55% capacity loss',
    description: 'Lock contention and storage latency cut measured database throughput.',
    icon: Database,
    databaseCapacityMultiplier: 0.45,
  },
  {
    id: 'retry-storm',
    label: 'Retry storm',
    badge: '1.8x attempts',
    description: 'Clients and services retry without enough backoff, amplifying work inside the system.',
    icon: Zap,
    retryMultiplier: 1.8,
  },
];

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);

const formatBytes = (gigabytes: number) => {
  if (gigabytes >= 1_000_000) return `${formatNumber(gigabytes / 1_000_000, 1)} PB`;
  if (gigabytes >= 1_000) return `${formatNumber(gigabytes / 1_000, 1)} TB`;
  return `${formatNumber(gigabytes, 1)} GB`;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function statusFor(utilization: number): Status {
  if (utilization >= 100) return 'breach';
  if (utilization >= 75) return 'risk';
  return 'healthy';
}

function RangeControl({
  label,
  value,
  output,
  min,
  max,
  step,
  lowLabel,
  highLabel,
  hint,
  accent,
  onChange,
}: {
  label: string;
  value: number;
  output: string;
  min: number;
  max: number;
  step: number;
  lowLabel: string;
  highLabel: string;
  hint: string;
  accent: 'blue' | 'emerald';
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
          {label}
        </span>
        <span
          className={`shrink-0 rounded px-2 py-1 font-mono text-xs font-black ${
            accent === 'blue'
              ? 'bg-blue-100 text-blue-950 dark:bg-blue-900 dark:text-blue-100'
              : 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100'
          }`}
        >
          {output}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-2 w-full cursor-pointer ${
          accent === 'blue'
            ? 'accent-blue-700 dark:accent-blue-400'
            : 'accent-emerald-700 dark:accent-emerald-400'
        }`}
      />
      <span className="mt-1 flex justify-between gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </span>
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {hint}
      </span>
    </label>
  );
}

function OptionGroup({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
      >
        {values.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`h-10 rounded-md border text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                selected
                  ? 'border-emerald-800 bg-emerald-800 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-neutral-950'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-emerald-500 hover:bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/60'
              }`}
            >
              {option}
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
  tone,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'blue' | 'emerald';
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md ${
          tone === 'blue'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p
          className={`text-xs font-black uppercase ${
            tone === 'blue'
              ? 'text-blue-800 dark:text-blue-300'
              : 'text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">{title}</h3>
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
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-50',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-50',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-50',
    amber:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function UtilizationMeter({
  label,
  utilization,
  demand,
  capacity,
}: {
  label: string;
  utilization: number;
  demand: number;
  capacity: number;
}) {
  const status = statusFor(utilization);
  const width = Math.min(100, utilization);
  const fill =
    status === 'healthy' ? 'bg-emerald-500' : status === 'risk' ? 'bg-amber-500' : 'bg-rose-500';
  const text =
    status === 'healthy'
      ? 'text-emerald-800 dark:text-emerald-300'
      : status === 'risk'
        ? 'text-amber-800 dark:text-amber-300'
        : 'text-rose-800 dark:text-rose-300';

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {formatCompact(demand)} demanded / {formatCompact(capacity)} safe RPS
          </p>
        </div>
        <p className={`font-mono text-sm font-black ${text}`}>
          {formatNumber(utilization, 0)}%
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="meter"
        aria-label={`${label} utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(utilization))}
      >
        <div className={`h-full rounded-full transition-all ${fill}`} style={{ width: `${width}%` }} />
      </div>
      {utilization > 100 ? (
        <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
          Demand exceeds the safe envelope by {formatNumber(utilization - 100)}%.
        </p>
      ) : null}
    </div>
  );
}

function FlowNode({
  icon,
  eyebrow,
  title,
  metric,
  detail,
  tone,
  status,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  tone: 'blue' | 'cyan' | 'violet' | 'emerald';
  status?: Status;
}) {
  const tones = {
    blue: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60',
    cyan: 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/60',
    violet: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/60',
    emerald:
      'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60',
  };
  const statusRing =
    status === 'breach'
      ? 'ring-2 ring-rose-500'
      : status === 'risk'
        ? 'ring-2 ring-amber-500'
        : '';

  return (
    <div className={`min-w-0 rounded-md border p-3 ${tones[tone]} ${statusRing}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-white/80 text-neutral-800 shadow-sm dark:bg-neutral-950/80 dark:text-neutral-100">
          {icon}
        </span>
        {status ? (
          <span
            className={`text-[10px] font-black uppercase ${
              status === 'healthy'
                ? 'text-emerald-800 dark:text-emerald-300'
                : status === 'risk'
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-rose-800 dark:text-rose-300'
            }`}
          >
            {status === 'healthy' ? 'Within envelope' : status === 'risk' ? 'Thin margin' : 'Overload'}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400">
        {eyebrow}
      </p>
      <p className="mt-0.5 text-sm font-black text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-2 font-mono text-lg font-black text-neutral-950 dark:text-white">{metric}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 py-1 text-neutral-400 lg:flex-col lg:px-1 lg:py-0">
      <ArrowDown className="h-4 w-4 lg:hidden" aria-hidden="true" />
      <ArrowRight className="hidden h-4 w-4 lg:block" aria-hidden="true" />
      <span className="text-center font-mono text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
    </div>
  );
}

export default function SystemDesignCalculator() {
  const [workload, setWorkload] = useState<WorkloadInputs>(DEFAULT_WORKLOAD);
  const [capacity, setCapacity] = useState<CapacityInputs>(DEFAULT_CAPACITY);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('baseline');

  const result = useMemo(() => {
    const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];
    const dailyRequests = workload.dailyUsers * workload.actionsPerUser;
    const averageRps = dailyRequests / 86_400;
    const incomingRps =
      averageRps * workload.peakMultiplier * (scenario.demandMultiplier ?? 1);
    const retryMultiplier = scenario.retryMultiplier ?? 1;
    const appDemandRps = incomingRps * retryMultiplier;
    const effectiveCacheHit =
      scenario.cacheHitOverride ?? workload.cacheHitPercent;
    const readRps = appDemandRps * (workload.readPercent / 100);
    const writeRps = appDemandRps - readRps;
    const cacheHitsRps = readRps * (effectiveCacheHit / 100);
    const databaseDemandRps = readRps - cacheHitsRps + writeRps;

    const domainLossFraction =
      scenario.removesDomain && capacity.regions > 0 ? 1 / capacity.regions : 0;
    const availableAppInstances = scenario.removesDomain
      ? Math.max(0, Math.floor(capacity.appInstances * (1 - domainLossFraction)))
      : capacity.appInstances;
    const availableDatabaseNodes = scenario.removesDomain
      ? Math.max(0, Math.floor(capacity.databaseNodes * (1 - domainLossFraction)))
      : capacity.databaseNodes;
    const operatingFactor = 1 - capacity.headroomPercent / 100;
    const appSafeCapacity =
      availableAppInstances * capacity.appRpsPerInstance * operatingFactor;
    const databaseSafeCapacity =
      availableDatabaseNodes *
      capacity.databaseRpsPerNode *
      operatingFactor *
      (scenario.databaseCapacityMultiplier ?? 1);
    const appUtilization =
      appSafeCapacity > 0 ? (appDemandRps / appSafeCapacity) * 100 : Number.POSITIVE_INFINITY;
    const databaseUtilization =
      databaseSafeCapacity > 0
        ? (databaseDemandRps / databaseSafeCapacity) * 100
        : Number.POSITIVE_INFINITY;
    const appStatus = statusFor(appUtilization);
    const databaseStatus = statusFor(databaseUtilization);
    const status: Status =
      appStatus === 'breach' || databaseStatus === 'breach'
        ? 'breach'
        : appStatus === 'risk' || databaseStatus === 'risk'
          ? 'risk'
          : 'healthy';

    const bandwidthMbps = (incomingRps * workload.responseKb * 8) / 1_000;
    const dailyWriteGb =
      (dailyRequests * (1 - workload.readPercent / 100) * 2) / (1024 * 1024);
    const logicalStorageGb = dailyWriteGb * workload.retentionDays;
    const physicalStorageGb =
      logicalStorageGb * capacity.replicationFactor * 1.25;
    const monthlyTransferGb =
      (dailyRequests * workload.responseKb * 30) / (1024 * 1024);
    const monthlyCost =
      capacity.appInstances * 180 +
      capacity.databaseNodes * 650 +
      physicalStorageGb * 0.08 +
      monthlyTransferGb * 0.05;
    const bottleneck =
      appUtilization >= databaseUtilization ? 'Application fleet' : 'Data tier';
    const capacityMargin = Math.min(
      appSafeCapacity - appDemandRps,
      databaseSafeCapacity - databaseDemandRps,
    );

    const consequences =
      status === 'healthy'
        ? [
            `${formatNumber(capacity.headroomPercent)}% reserve remains outside the safe-capacity line.`,
            `${bottleneck} is the tighter tier, so measure it first as demand changes.`,
          ]
        : status === 'risk'
          ? [
              `${bottleneck} is above 75% of its safe operating envelope.`,
              'A second disturbance or measurement error can consume the remaining reserve.',
            ]
          : [
              `${bottleneck} cannot serve the modeled attempts inside the chosen reserve.`,
              appStatus === 'breach' && databaseStatus === 'breach'
                ? 'Both tiers overload, so scaling only one tier will move rather than remove the bottleneck.'
                : 'Scale or reduce demand at the breached tier before trusting the design.',
            ];

    return {
      scenario,
      dailyRequests,
      averageRps,
      incomingRps,
      appDemandRps,
      effectiveCacheHit,
      cacheHitsRps,
      databaseDemandRps,
      availableAppInstances,
      availableDatabaseNodes,
      appSafeCapacity,
      databaseSafeCapacity,
      appUtilization,
      databaseUtilization,
      appStatus,
      databaseStatus,
      status,
      bandwidthMbps,
      logicalStorageGb,
      physicalStorageGb,
      monthlyCost,
      bottleneck,
      capacityMargin,
      consequences,
    };
  }, [capacity, scenarioId, workload]);

  const statusLabel =
    result.status === 'healthy'
      ? 'Design has reserve'
      : result.status === 'risk'
        ? 'Reserve is thin'
        : 'Capacity is breached';
  const statusStyle =
    result.status === 'healthy'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
      : result.status === 'risk'
        ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
        : 'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100';
  const outcomeTone =
    result.status === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
      : result.status === 'risk'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50';

  const updateWorkload = (key: keyof WorkloadInputs, value: number) => {
    setWorkload((current) => ({ ...current, [key]: value }));
  };
  const updateCapacity = (key: keyof CapacityInputs, value: number) => {
    setCapacity((current) => ({ ...current, [key]: value }));
  };

  return (
    <section
      data-content-block="tools/system-design-calculator"
      className="not-prose my-7 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Architecture sizing workbench
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              Turn product demand into a defensible capacity plan
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Model the user peak, trace amplification through the request path, then test whether
              the provisioned architecture keeps its operating reserve under pressure.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`min-w-0 flex-1 rounded-md border px-3 py-2 lg:flex-none ${statusStyle}`}>
              <p className="text-[11px] font-black uppercase">Evaluated outcome</p>
              <p className="mt-0.5 text-sm font-black" aria-live="polite">
                {statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWorkload(DEFAULT_WORKLOAD);
                setCapacity(DEFAULT_CAPACITY);
                setScenarioId('baseline');
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-neutral-700 text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Reset sizing assumptions"
              title="Reset sizing assumptions"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">
              Pressure test
            </p>
            <h3 className="mt-1 text-base font-black text-neutral-950 dark:text-white">
              Apply a failure or demand shock
            </h3>
          </div>
          <p className="max-w-xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Scenarios alter the evaluated request path without changing your saved assumptions.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((scenario) => {
            const Icon = scenario.icon;
            const selected = scenario.id === scenarioId;
            return (
              <button
                key={scenario.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setScenarioId(scenario.id)}
                className={`min-h-[104px] rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? 'border-cyan-800 bg-cyan-800 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-cyan-400 hover:bg-cyan-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/50'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{scenario.label}</span>
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-black uppercase ${
                      selected ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {scenario.badge}
                  </span>
                </span>
                <span
                  className={`mt-2 block text-xs leading-5 ${
                    selected
                      ? 'text-cyan-50 dark:text-neutral-900'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {scenario.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:border-b-0 xl:border-r">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
            <SectionHeading
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 1 · Demand"
              title="Shape the workload"
              detail="Change how many requests arrive and how much work survives the cache."
              tone="blue"
            />
            <div className="mt-5 space-y-5">
              <RangeControl
                label="Daily active users"
                value={workload.dailyUsers}
                output={formatCompact(workload.dailyUsers)}
                min={100_000}
                max={20_000_000}
                step={100_000}
                lowLabel="100K"
                highLabel="20M"
                hint="Unique users active during one modeled day."
                accent="blue"
                onChange={(value) => updateWorkload('dailyUsers', value)}
              />
              <RangeControl
                label="Actions per user per day"
                value={workload.actionsPerUser}
                output={`${workload.actionsPerUser}`}
                min={5}
                max={200}
                step={5}
                lowLabel="5"
                highLabel="200"
                hint="User-visible reads and writes before retries."
                accent="blue"
                onChange={(value) => updateWorkload('actionsPerUser', value)}
              />
              <RangeControl
                label="Peak-to-average ratio"
                value={workload.peakMultiplier}
                output={`${formatNumber(workload.peakMultiplier, 1)}x`}
                min={1}
                max={12}
                step={0.5}
                lowLabel="Flat traffic"
                highLabel="Sharp peak"
                hint="Converts average requests per second into the busy-hour peak."
                accent="blue"
                onChange={(value) => updateWorkload('peakMultiplier', value)}
              />
              <RangeControl
                label="Average response payload"
                value={workload.responseKb}
                output={`${workload.responseKb} KB`}
                min={1}
                max={250}
                step={1}
                lowLabel="1 KB"
                highLabel="250 KB"
                hint="Controls peak egress bandwidth and transfer cost."
                accent="blue"
                onChange={(value) => updateWorkload('responseKb', value)}
              />
              <RangeControl
                label="Read share"
                value={workload.readPercent}
                output={`${workload.readPercent}%`}
                min={20}
                max={99}
                step={1}
                lowLabel="Write heavy"
                highLabel="Read heavy"
                hint="Writes bypass the read cache and accumulate retained data."
                accent="blue"
                onChange={(value) => updateWorkload('readPercent', value)}
              />
              <RangeControl
                label="Read cache hit rate"
                value={workload.cacheHitPercent}
                output={`${workload.cacheHitPercent}%`}
                min={0}
                max={95}
                step={5}
                lowLabel="Every read misses"
                highLabel="Mostly served at edge"
                hint="Hits remove read traffic before the database."
                accent="blue"
                onChange={(value) => updateWorkload('cacheHitPercent', value)}
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6">
            <SectionHeading
              icon={<Server className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 2 · Supply"
              title="Provision the architecture"
              detail="Change benchmarked capacity, topology, and the reserve kept outside normal use."
              tone="emerald"
            />
            <div className="mt-5 space-y-5">
              <RangeControl
                label="Application instances"
                value={capacity.appInstances}
                output={`${capacity.appInstances}`}
                min={2}
                max={40}
                step={1}
                lowLabel="2"
                highLabel="40"
                hint="Provisioned instances before a failure removes capacity."
                accent="emerald"
                onChange={(value) => updateCapacity('appInstances', value)}
              />
              <RangeControl
                label="Tested RPS per instance"
                value={capacity.appRpsPerInstance}
                output={formatCompact(capacity.appRpsPerInstance)}
                min={300}
                max={5_000}
                step={100}
                lowLabel="300"
                highLabel="5K"
                hint="Use a load-test result at the latency target, not a vendor maximum."
                accent="emerald"
                onChange={(value) => updateCapacity('appRpsPerInstance', value)}
              />
              <RangeControl
                label="Database nodes"
                value={capacity.databaseNodes}
                output={`${capacity.databaseNodes}`}
                min={1}
                max={12}
                step={1}
                lowLabel="1"
                highLabel="12"
                hint="Nodes able to share the modeled read and write path."
                accent="emerald"
                onChange={(value) => updateCapacity('databaseNodes', value)}
              />
              <RangeControl
                label="Tested RPS per database node"
                value={capacity.databaseRpsPerNode}
                output={formatCompact(capacity.databaseRpsPerNode)}
                min={300}
                max={5_000}
                step={100}
                lowLabel="300"
                highLabel="5K"
                hint="Measured sustainable throughput with the intended indexes and query mix."
                accent="emerald"
                onChange={(value) => updateCapacity('databaseRpsPerNode', value)}
              />
              <RangeControl
                label="Operating headroom"
                value={capacity.headroomPercent}
                output={`${capacity.headroomPercent}%`}
                min={0}
                max={50}
                step={5}
                lowLabel="No reserve"
                highLabel="50% reserve"
                hint="Capacity deliberately kept free for variance, deploys, and recovery."
                accent="emerald"
                onChange={(value) => updateCapacity('headroomPercent', value)}
              />
              <OptionGroup
                label="Independent failure domains"
                value={capacity.regions}
                values={[1, 2, 3, 4]}
                onChange={(value) => updateCapacity('regions', value)}
              />
              <OptionGroup
                label="Storage replication factor"
                value={capacity.replicationFactor}
                values={[1, 2, 3, 4, 5]}
                onChange={(value) => updateCapacity('replicationFactor', value)}
              />
              <RangeControl
                label="Data retention"
                value={workload.retentionDays}
                output={`${workload.retentionDays} days`}
                min={30}
                max={1_825}
                step={30}
                lowLabel="30 days"
                highLabel="5 years"
                hint="Changes retained logical and replicated physical storage."
                accent="emerald"
                onChange={(value) => updateWorkload('retentionDays', value)}
              />
            </div>
          </section>
        </aside>

        <div className="min-w-0 bg-neutral-50 dark:bg-neutral-900/40">
          <section
            className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8"
            aria-live="polite"
          >
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <Metric
                label="Incoming peak"
                value={`${formatCompact(result.incomingRps)} RPS`}
                detail={`${formatCompact(result.dailyRequests)} requests/day before retries`}
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                tone="blue"
              />
              <Metric
                label="Database demand"
                value={`${formatCompact(result.databaseDemandRps)} RPS`}
                detail={`${result.effectiveCacheHit}% effective read-cache hit rate`}
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
                tone="cyan"
              />
              <Metric
                label="Tightest margin"
                value={`${result.capacityMargin >= 0 ? '+' : ''}${formatCompact(result.capacityMargin)} RPS`}
                detail={`${result.bottleneck} is the limiting tier`}
                icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                tone={
                  result.status === 'healthy'
                    ? 'emerald'
                    : result.status === 'risk'
                      ? 'amber'
                      : 'rose'
                }
              />
              <Metric
                label="Modeled monthly cost"
                value={`$${formatCompact(result.monthlyCost)}`}
                detail={`${formatBytes(result.physicalStorageGb)} physical storage`}
                icon={<Coins className="h-4 w-4" aria-hidden="true" />}
                tone="amber"
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-800 dark:text-cyan-300">
                  <Network className="h-4 w-4" aria-hidden="true" />
                  Live request path
                </div>
                <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  Follow demand as each tier transforms it
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  The selected scenario changes attempts, available nodes, or measured throughput.
                  Node rings identify the tiers closest to or beyond their safe envelope.
                </p>
              </div>
              <div className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-right dark:border-neutral-700 dark:bg-neutral-950">
                <p className="text-[11px] font-black uppercase text-neutral-500 dark:text-neutral-400">
                  Active scenario
                </p>
                <p className="mt-0.5 text-sm font-black text-neutral-950 dark:text-white">
                  {result.scenario.label} · {result.scenario.badge}
                </p>
              </div>
            </div>

            <div className="mt-5 grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
              <FlowNode
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Demand"
                title="Users and clients"
                metric={`${formatCompact(result.incomingRps)} RPS`}
                detail={`${formatNumber(result.bandwidthMbps)} Mbps peak response bandwidth`}
                tone="blue"
              />
              <FlowArrow label={`${formatCompact(result.appDemandRps)} attempts`} />
              <FlowNode
                icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Demand shaping"
                title="Cache and request layer"
                metric={`${result.effectiveCacheHit}% hits`}
                detail={`${formatCompact(result.cacheHitsRps)} reads stop before the database`}
                tone="cyan"
              />
              <FlowArrow label={`${formatCompact(result.appDemandRps)} app RPS`} />
              <FlowNode
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Compute"
                title="Application fleet"
                metric={`${result.availableAppInstances}/${capacity.appInstances} live`}
                detail={`${formatNumber(result.appUtilization)}% of safe capacity`}
                tone="violet"
                status={result.appStatus}
              />
              <FlowArrow label={`${formatCompact(result.databaseDemandRps)} origin RPS`} />
              <FlowNode
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
                eyebrow="State"
                title="Database tier"
                metric={`${result.availableDatabaseNodes}/${capacity.databaseNodes} live`}
                detail={`${formatNumber(result.databaseUtilization)}% of safe capacity`}
                tone="emerald"
                status={result.databaseStatus}
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Capacity envelope
            </div>
            <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
              Compare demand with safe operating capacity
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Safe capacity subtracts your headroom before utilization is evaluated. A tier can be
              below its benchmark maximum and still violate the operating policy.
            </p>
            <div className="mt-5 grid gap-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 lg:grid-cols-2">
              <UtilizationMeter
                label="Application fleet"
                utilization={result.appUtilization}
                demand={result.appDemandRps}
                capacity={result.appSafeCapacity}
              />
              <UtilizationMeter
                label="Database tier"
                utilization={result.databaseUtilization}
                demand={result.databaseDemandRps}
                capacity={result.databaseSafeCapacity}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Average load"
                value={`${formatCompact(result.averageRps)} RPS`}
                detail={`${formatNumber(workload.peakMultiplier, 1)}x peak ratio before scenario pressure`}
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                tone="blue"
              />
              <Metric
                label="Peak bandwidth"
                value={`${formatNumber(result.bandwidthMbps)} Mbps`}
                detail={`${workload.responseKb} KB average response payload`}
                icon={<Network className="h-4 w-4" aria-hidden="true" />}
                tone="cyan"
              />
              <Metric
                label="Logical retained data"
                value={formatBytes(result.logicalStorageGb)}
                detail={`${workload.retentionDays} days at 2 KB per write`}
                icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
                tone="emerald"
              />
              <Metric
                label="Physical retained data"
                value={formatBytes(result.physicalStorageGb)}
                detail={`${capacity.replicationFactor}x replication plus 25% index overhead`}
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
                tone="amber"
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className={`rounded-md border p-4 ${outcomeTone}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/80 text-neutral-900 shadow-sm dark:bg-neutral-950/70 dark:text-white">
                    {result.status === 'breach' ? (
                      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    ) : result.status === 'risk' ? (
                      <Gauge className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase text-neutral-600 dark:text-neutral-300">
                      Architecture verdict
                    </p>
                    <h3 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                      {statusLabel}
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {result.scenario.description}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 rounded-md border border-neutral-300 bg-white/80 px-3 py-2 text-left dark:border-neutral-700 dark:bg-neutral-950/70 md:text-right">
                  <p className="text-[11px] font-black uppercase text-neutral-500 dark:text-neutral-400">
                    First constraint
                  </p>
                  <p className="mt-0.5 text-sm font-black text-neutral-950 dark:text-white">
                    {result.bottleneck}
                  </p>
                </div>
              </div>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-800 dark:text-neutral-100 md:grid-cols-2">
                {result.consequences.map((consequence) => (
                  <li key={consequence} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    <span>{consequence}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-black text-neutral-950 dark:text-white">
                  <Server className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                  Application capacity equation
                </div>
                <p className="mt-3 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.availableAppInstances} live instances ×{' '}
                  {formatNumber(capacity.appRpsPerInstance)} tested RPS ×{' '}
                  {formatNumber(100 - capacity.headroomPercent)}% operating share
                </p>
                <p className="mt-2 text-sm font-black text-neutral-950 dark:text-white">
                  = {formatCompact(result.appSafeCapacity)} safe RPS
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-black text-neutral-950 dark:text-white">
                  <Database className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                  Database capacity equation
                </div>
                <p className="mt-3 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.availableDatabaseNodes} live nodes ×{' '}
                  {formatNumber(capacity.databaseRpsPerNode)} tested RPS ×{' '}
                  {formatNumber(100 - capacity.headroomPercent)}% operating share
                </p>
                <p className="mt-2 text-sm font-black text-neutral-950 dark:text-white">
                  = {formatCompact(result.databaseSafeCapacity)} safe RPS
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
