'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Gauge,
  HardDrive,
  RefreshCcw,
  Server,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ChallengeId = 'baseline' | 'launch-spike' | 'retention-shock' | 'zone-loss';

type PlannerInputs = {
  currentUsers: number;
  annualGrowthPct: number;
  horizonMonths: number;
  dailyDataPerUserKb: number;
  retentionDays: number;
  replicationFactor: number;
  activeUserPct: number;
  requestsPerActiveUserMinute: number;
  peakMultiplier: number;
  responseSizeKb: number;
  testedInstanceRps: number;
  provisionedInstances: number;
  reservePct: number;
  uncertaintyPct: number;
  instanceMonthlyCost: number;
  storageTbMonthlyCost: number;
  egressGbCost: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  demandMultiplier: number;
  retentionMultiplier: number;
  survivingCapacity: number;
  icon: typeof Gauge;
};

const DEFAULT_INPUTS: PlannerInputs = {
  currentUsers: 1_000_000,
  annualGrowthPct: 35,
  horizonMonths: 24,
  dailyDataPerUserKb: 180,
  retentionDays: 90,
  replicationFactor: 3,
  activeUserPct: 12,
  requestsPerActiveUserMinute: 8,
  peakMultiplier: 3,
  responseSizeKb: 24,
  testedInstanceRps: 2_500,
  provisionedInstances: 56,
  reservePct: 30,
  uncertaintyPct: 20,
  instanceMonthlyCost: 180,
  storageTbMonthlyCost: 24,
  egressGbCost: 0.08,
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Planned peak',
    shortLabel: 'Baseline',
    description: 'All provisioned capacity is available at the forecast peak.',
    demandMultiplier: 1,
    retentionMultiplier: 1,
    survivingCapacity: 1,
    icon: CheckCircle2,
  },
  {
    id: 'launch-spike',
    label: 'Launch spike',
    shortLabel: '2.2x demand',
    description: 'A product launch drives 2.2x the planned peak through the same fleet.',
    demandMultiplier: 2.2,
    retentionMultiplier: 1,
    survivingCapacity: 1,
    icon: Zap,
  },
  {
    id: 'retention-shock',
    label: 'Retention shock',
    shortLabel: '1.8x retention',
    description: 'A policy hold extends retained history by 80% without reducing replication.',
    demandMultiplier: 1,
    retentionMultiplier: 1.8,
    survivingCapacity: 1,
    icon: HardDrive,
  },
  {
    id: 'zone-loss',
    label: 'Zone loss',
    shortLabel: '33% fleet loss',
    description: 'One of three zones is unavailable while the planned peak continues.',
    demandMultiplier: 1,
    retentionMultiplier: 1,
    survivingCapacity: 2 / 3,
    icon: AlertTriangle,
  },
];

const LIMITS: Record<keyof PlannerInputs, { min: number; max: number }> = {
  currentUsers: { min: 1, max: 10_000_000_000 },
  annualGrowthPct: { min: -90, max: 500 },
  horizonMonths: { min: 1, max: 120 },
  dailyDataPerUserKb: { min: 0, max: 10_000_000 },
  retentionDays: { min: 1, max: 3_650 },
  replicationFactor: { min: 1, max: 7 },
  activeUserPct: { min: 0.1, max: 100 },
  requestsPerActiveUserMinute: { min: 0.01, max: 100_000 },
  peakMultiplier: { min: 1, max: 20 },
  responseSizeKb: { min: 0.01, max: 1_000_000 },
  testedInstanceRps: { min: 1, max: 10_000_000 },
  provisionedInstances: { min: 1, max: 100_000 },
  reservePct: { min: 0, max: 80 },
  uncertaintyPct: { min: 0, max: 100 },
  instanceMonthlyCost: { min: 0, max: 1_000_000 },
  storageTbMonthlyCost: { min: 0, max: 1_000_000 },
  egressGbCost: { min: 0, max: 10_000 },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);

function safeInputs(inputs: PlannerInputs): PlannerInputs {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => {
      const limit = LIMITS[key as keyof PlannerInputs];
      return [key, clamp(Number.isFinite(value) ? value : limit.min, limit.min, limit.max)];
    }),
  ) as unknown as PlannerInputs;
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const invalid = !Number.isFinite(value) || value < min || value > max;

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        {unit ? <span className="font-normal text-neutral-500 dark:text-neutral-400">{unit}</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid}
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:ring-2 focus:ring-blue-500/30 dark:bg-neutral-950 dark:text-white ${
          invalid
            ? 'border-rose-500 focus:border-rose-500'
            : 'border-neutral-300 focus:border-blue-600 dark:border-neutral-700 dark:focus:border-blue-400'
        }`}
      />
      {hint ? <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span> : null}
      {invalid ? (
        <span className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-300">
          Enter a value from {formatNumber(min, 2)} to {formatNumber(max, 2)}.
        </span>
      ) : null}
    </label>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="font-mono text-sm font-bold text-neutral-950 dark:text-white">
          {formatNumber(value, step < 1 ? 1 : 0)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-600 dark:accent-blue-400"
      />
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span>
    </label>
  );
}

function OptionGroup<T extends number>({
  label,
  value,
  values,
  onChange,
  format,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-900">
        {values.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`min-h-9 rounded px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selected
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
              }`}
            >
              {format(option)}
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
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{title}</h2>
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
  tone?: 'neutral' | 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  };

  return (
    <div className={`min-w-0 border px-3 py-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-xl font-black tracking-normal">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function ForecastChart({
  points,
  uncertaintyPct,
}: {
  points: Array<{ month: number; users: number }>;
  uncertaintyPct: number;
}) {
  const width = 680;
  const height = 220;
  const inset = { top: 22, right: 20, bottom: 38, left: 52 };
  const innerWidth = width - inset.left - inset.right;
  const innerHeight = height - inset.top - inset.bottom;
  const maximum = Math.max(...points.map((point) => point.users * (1 + uncertaintyPct / 100)), 1);
  const x = (month: number) => inset.left + (month / Math.max(points.at(-1)?.month ?? 1, 1)) * innerWidth;
  const y = (users: number) => inset.top + innerHeight - (users / maximum) * innerHeight;
  const expectedPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.month)} ${y(point.users)}`)
    .join(' ');
  const upper = points
    .map((point) => `${x(point.month)},${y(point.users * (1 + uncertaintyPct / 100))}`)
    .join(' ');
  const lower = [...points]
    .reverse()
    .map((point) => `${x(point.month)},${y(point.users * Math.max(0, 1 - uncertaintyPct / 100))}`)
    .join(' ');

  return (
    <div className="overflow-hidden" role="img" aria-label={`Projected users with a plus or minus ${uncertaintyPct} percent planning band`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full min-w-[560px]" aria-hidden="true">
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={inset.left}
              x2={width - inset.right}
              y1={inset.top + innerHeight * ratio}
              y2={inset.top + innerHeight * ratio}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth="1"
            />
            <text
              x={inset.left - 10}
              y={inset.top + innerHeight * ratio + 4}
              textAnchor="end"
              className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
            >
              {formatCompact(maximum * (1 - ratio))}
            </text>
          </g>
        ))}
        <polygon points={`${upper} ${lower}`} className="fill-blue-100/80 dark:fill-blue-950/80" />
        <path d={expectedPath} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="4" />
        {points.map((point, index) => (
          <circle
            key={point.month}
            cx={x(point.month)}
            cy={y(point.users)}
            r={index === points.length - 1 ? 6 : 3}
            className="fill-white stroke-blue-600 dark:fill-neutral-950 dark:stroke-blue-400"
            strokeWidth="3"
          />
        ))}
        <text x={inset.left} y={height - 12} className="fill-neutral-500 text-[11px] dark:fill-neutral-400">
          Now
        </text>
        <text
          x={width - inset.right}
          y={height - 12}
          textAnchor="end"
          className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
        >
          Month {points.at(-1)?.month}
        </text>
      </svg>
    </div>
  );
}

export default function CapacityPlanningTool() {
  const [inputs, setInputs] = useState<PlannerInputs>(DEFAULT_INPUTS);
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');
  const [showCostAssumptions, setShowCostAssumptions] = useState(false);

  const updateInput = <K extends keyof PlannerInputs>(key: K, value: PlannerInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const commitInput = <K extends keyof PlannerInputs>(key: K) => {
    const limit = LIMITS[key];
    setInputs((current) => ({
      ...current,
      [key]: clamp(Number.isFinite(current[key]) ? current[key] : limit.min, limit.min, limit.max),
    }));
  };

  const result = useMemo(() => {
    const model = safeInputs(inputs);
    const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];
    const projectedUsers =
      model.currentUsers * Math.pow(1 + model.annualGrowthPct / 100, model.horizonMonths / 12);
    const effectiveRetentionDays = model.retentionDays * challenge.retentionMultiplier;
    const rawStorageTb =
      (projectedUsers * model.dailyDataPerUserKb * effectiveRetentionDays) / 1_000_000_000;
    const replicatedStorageTb = rawStorageTb * model.replicationFactor;
    const activeUsers = projectedUsers * (model.activeUserPct / 100);
    const averageRps = (activeUsers * model.requestsPerActiveUserMinute) / 60;
    const plannedPeakRps = averageRps * model.peakMultiplier;
    const scenarioRps = plannedPeakRps * challenge.demandMultiplier;
    const survivingInstances = Math.max(
      1,
      Math.floor(model.provisionedInstances * challenge.survivingCapacity),
    );
    const testedFleetCapacity = survivingInstances * model.testedInstanceRps;
    const targetCapacity = testedFleetCapacity * (1 - model.reservePct / 100);
    const utilization = scenarioRps / Math.max(testedFleetCapacity, 1);
    const headroomPct = (1 - utilization) * 100;
    const requiredInstances = Math.ceil(
      scenarioRps / Math.max(model.testedInstanceRps * (1 - model.reservePct / 100), 1),
    );
    const extraInstances = Math.max(0, requiredInstances - survivingInstances);
    const peakBandwidthMbps = (scenarioRps * model.responseSizeKb * 8) / 1_000;
    const monthlyEgressGb =
      (averageRps * model.responseSizeKb * 60 * 60 * 24 * 30) / 1_000_000;
    const computeCost = model.provisionedInstances * model.instanceMonthlyCost;
    const storageCost = replicatedStorageTb * model.storageTbMonthlyCost;
    const egressCost = monthlyEgressGb * model.egressGbCost;
    const monthlyCost = computeCost + storageCost + egressCost;
    const status =
      utilization > 1 ? 'overloaded' : scenarioRps > targetCapacity ? 'thin' : 'healthy';
    const statusCopy =
      status === 'overloaded'
        ? 'Demand exceeds tested fleet capacity. Requests will queue, shed, or time out.'
        : status === 'thin'
          ? 'The fleet serves demand, but the configured reserve has been consumed.'
          : 'Demand stays inside the tested operating envelope with reserve intact.';
    const bottleneck =
      status === 'overloaded'
        ? 'Request capacity'
        : challenge.id === 'retention-shock' && replicatedStorageTb > 1
          ? 'Storage retention'
          : peakBandwidthMbps > 100_000
            ? 'Network egress'
            : headroomPct < model.reservePct + 10
              ? 'Fleet headroom'
              : 'No immediate bottleneck';
    const recommendation =
      status === 'overloaded'
        ? `Add at least ${extraInstances} tested instances or reduce peak work before this scenario is accepted.`
        : status === 'thin'
          ? `Add ${Math.max(extraInstances, 1)} instance${Math.max(extraInstances, 1) === 1 ? '' : 's'} to restore the ${formatNumber(model.reservePct)}% reserve target.`
          : challenge.id === 'retention-shock'
            ? 'Confirm lifecycle, archive, and legal-hold tiers before paying to keep all copies in the serving store.'
            : 'Keep the load test, autoscaling threshold, and observed saturation metric aligned with this envelope.';
    const pointCount = 7;
    const forecastPoints = Array.from({ length: pointCount }, (_, index) => {
      const month = (model.horizonMonths / (pointCount - 1)) * index;
      return {
        month,
        users: model.currentUsers * Math.pow(1 + model.annualGrowthPct / 100, month / 12),
      };
    });

    return {
      model,
      challenge,
      projectedUsers,
      effectiveRetentionDays,
      rawStorageTb,
      replicatedStorageTb,
      activeUsers,
      averageRps,
      plannedPeakRps,
      scenarioRps,
      survivingInstances,
      testedFleetCapacity,
      targetCapacity,
      utilization,
      headroomPct,
      requiredInstances,
      extraInstances,
      peakBandwidthMbps,
      monthlyEgressGb,
      computeCost,
      storageCost,
      egressCost,
      monthlyCost,
      status,
      statusCopy,
      bottleneck,
      recommendation,
      forecastPoints,
    };
  }, [challengeId, inputs]);

  const invalidFields = (Object.keys(inputs) as Array<keyof PlannerInputs>).filter((key) => {
    const value = inputs[key];
    return !Number.isFinite(value) || value < LIMITS[key].min || value > LIMITS[key].max;
  });
  const statusTone =
    result.status === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100'
      : result.status === 'thin'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-100';
  const statusLabel =
    result.status === 'healthy' ? 'Reserve intact' : result.status === 'thin' ? 'Reserve consumed' : 'Overloaded';
  const metricTone = result.status === 'healthy' ? 'emerald' : result.status === 'thin' ? 'amber' : 'rose';
  const rawShare = 100 / result.model.replicationFactor;
  const demandWidth = Math.min(result.utilization * 100, 100);
  const reserveLine = 100 - result.model.reservePct;

  return (
    <div
      data-content-block="tools/capacity-planning"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-300">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Capacity control room
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              Plan for demand, then break the plan
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Forecast retained data and peak traffic, size against tested limits, and inject a failure
              before the real launch does.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`min-w-0 flex-1 rounded-md border px-3 py-2 lg:flex-none ${statusTone}`}>
              <p className="text-[11px] font-bold uppercase">Scenario status</p>
              <p className="mt-0.5 text-sm font-black">{statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputs(DEFAULT_INPUTS);
                setChallengeId('baseline');
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-neutral-700 text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Reset capacity plan"
              title="Reset capacity plan"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Challenge the envelope</p>
            <h2 className="mt-1 text-base font-bold text-neutral-950 dark:text-white">Operational scenario</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Scenario factors affect demand, retention, or surviving capacity. They do not silently alter your inputs.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CHALLENGES.map((challenge) => {
            const Icon = challenge.icon;
            const selected = challengeId === challenge.id;
            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallengeId(challenge.id)}
                className={`min-h-[92px] rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-400 dark:bg-blue-400 dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/50'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {challenge.label}
                  </span>
                  <span className={`text-[10px] font-bold uppercase ${selected ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {challenge.shortLabel}
                  </span>
                </span>
                <span className={`mt-2 block text-xs leading-5 ${selected ? 'text-blue-50 dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {challenge.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {invalidFields.length > 0 ? (
        <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100 sm:px-6 lg:px-8">
          <span className="font-bold">Some inputs are outside their supported range.</span> Calculations use the nearest valid boundary until those fields are corrected.
        </div>
      ) : null}

      <div className="grid min-w-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:border-b-0 xl:border-r">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
            <SectionHeading
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 1"
              title="Growth and storage"
              detail="Change the audience or retention contract and watch the forecast and replicated footprint move."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                label="Current users"
                value={inputs.currentUsers}
                onChange={(value) => updateInput('currentUsers', value)}
                onCommit={() => commitInput('currentUsers')}
                {...LIMITS.currentUsers}
                step={1000}
                unit="users"
              />
              <RangeControl
                label="Annual growth"
                value={result.model.annualGrowthPct}
                onChange={(value) => updateInput('annualGrowthPct', value)}
                min={-50}
                max={200}
                suffix="%"
                hint="Compounded across the selected horizon."
              />
              <OptionGroup
                label="Planning horizon"
                value={result.model.horizonMonths}
                values={[12, 24, 36]}
                onChange={(value) => updateInput('horizonMonths', value)}
                format={(value) => `${value} mo`}
              />
              <NumberField
                label="New data per user"
                value={inputs.dailyDataPerUserKb}
                onChange={(value) => updateInput('dailyDataPerUserKb', value)}
                onCommit={() => commitInput('dailyDataPerUserKb')}
                {...LIMITS.dailyDataPerUserKb}
                step={10}
                unit="KB / day"
                hint="Logical data created before replication."
              />
              <RangeControl
                label="Retention"
                value={result.model.retentionDays}
                onChange={(value) => updateInput('retentionDays', value)}
                min={7}
                max={730}
                suffix=" days"
                hint="Serving-store retention before archival or deletion."
              />
              <OptionGroup
                label="Replication factor"
                value={result.model.replicationFactor}
                values={[1, 2, 3]}
                onChange={(value) => updateInput('replicationFactor', value)}
                format={(value) => `${value}x`}
              />
              <RangeControl
                label="Forecast uncertainty"
                value={result.model.uncertaintyPct}
                onChange={(value) => updateInput('uncertaintyPct', value)}
                min={0}
                max={50}
                suffix="%"
                hint="Visible planning band, not fake precision."
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6">
            <SectionHeading
              icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 2"
              title="Traffic and headroom"
              detail="Tie peak demand to measured per-instance throughput and an explicit reserve target."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <RangeControl
                label="Active users at once"
                value={result.model.activeUserPct}
                onChange={(value) => updateInput('activeUserPct', value)}
                min={1}
                max={100}
                suffix="%"
                hint="Concurrent active share of projected users."
              />
              <NumberField
                label="Requests per active user"
                value={inputs.requestsPerActiveUserMinute}
                onChange={(value) => updateInput('requestsPerActiveUserMinute', value)}
                onCommit={() => commitInput('requestsPerActiveUserMinute')}
                {...LIMITS.requestsPerActiveUserMinute}
                step={0.1}
                unit="requests / min"
              />
              <OptionGroup
                label="Peak over average"
                value={result.model.peakMultiplier}
                values={[2, 3, 5]}
                onChange={(value) => updateInput('peakMultiplier', value)}
                format={(value) => `${value}x`}
              />
              <NumberField
                label="Average response"
                value={inputs.responseSizeKb}
                onChange={(value) => updateInput('responseSizeKb', value)}
                onCommit={() => commitInput('responseSizeKb')}
                {...LIMITS.responseSizeKb}
                step={1}
                unit="KB"
                hint="Used to estimate outbound network demand."
              />
              <NumberField
                label="Tested instance throughput"
                value={inputs.testedInstanceRps}
                onChange={(value) => updateInput('testedInstanceRps', value)}
                onCommit={() => commitInput('testedInstanceRps')}
                {...LIMITS.testedInstanceRps}
                step={100}
                unit="RPS / instance"
                hint="Use a sustained load-test result, not a vendor maximum."
              />
              <NumberField
                label="Provisioned instances"
                value={inputs.provisionedInstances}
                onChange={(value) => updateInput('provisionedInstances', value)}
                onCommit={() => commitInput('provisionedInstances')}
                {...LIMITS.provisionedInstances}
                unit="instances"
              />
              <RangeControl
                label="Required reserve"
                value={result.model.reservePct}
                onChange={(value) => updateInput('reservePct', value)}
                min={0}
                max={60}
                suffix="%"
                hint="Unused tested capacity kept for failures and scaling lag."
              />
            </div>
          </section>
        </aside>

        <div className="min-w-0 bg-neutral-50/70 dark:bg-neutral-900/30">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">Forecast outcome</p>
                <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                  {formatCompact(result.projectedUsers)} users at month {formatNumber(result.model.horizonMonths)}
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Shaded range is the configured +/-{formatNumber(result.model.uncertaintyPct)}% planning band.
                </p>
              </div>
              <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                users = current x (1 + annual growth)<sup>months / 12</sup>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto overscroll-x-contain">
              <ForecastChart points={result.forecastPoints} uncertaintyPct={result.model.uncertaintyPct} />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">Retained footprint</p>
                <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                  {formatNumber(result.replicatedStorageTb, 2)} TB across {result.model.replicationFactor} copies
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {formatNumber(result.effectiveRetentionDays)} effective retained days under {result.challenge.label.toLowerCase()}.
                </p>
              </div>
              <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                users x daily KB x retained days x replicas / 1B
              </div>
            </div>

            <div className="mt-5">
              <div className="flex h-12 w-full overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
                <div
                  className="grid min-w-[72px] place-items-center bg-emerald-600 px-2 text-xs font-bold text-white dark:bg-emerald-400 dark:text-neutral-950"
                  style={{ width: `${rawShare}%` }}
                >
                  Raw {formatNumber(result.rawStorageTb, 2)} TB
                </div>
                {result.model.replicationFactor > 1 ? (
                  <div
                    className="grid place-items-center bg-teal-100 px-2 text-center text-xs font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-100"
                    style={{ width: `${100 - rawShare}%` }}
                  >
                    Replica overhead {formatNumber(result.replicatedStorageTb - result.rawStorageTb, 2)} TB
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Logical data is shown separately from availability copies.</span>
                <span>{formatCompact(result.projectedUsers)} users x {formatNumber(result.model.dailyDataPerUserKb)} KB/day</span>
              </div>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase text-violet-700 dark:text-violet-300">Serving envelope</p>
                <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                  {formatCompact(result.scenarioRps)} scenario RPS through {formatNumber(result.survivingInstances)} surviving instances
                </h2>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {result.statusCopy}
                </p>
              </div>
              <div className={`rounded-md border px-3 py-2 text-sm font-bold ${statusTone}`}>
                {result.headroomPct >= 0
                  ? `${formatNumber(result.headroomPct, 1)}% headroom`
                  : `${formatNumber(Math.abs(result.headroomPct), 1)}% over capacity`}
              </div>
            </div>

            <div className="mt-6">
              <div className="relative h-16 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-100 dark:bg-emerald-950/70"
                  style={{ width: `${reserveLine}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-amber-100 dark:bg-amber-950/70"
                  style={{ left: `${reserveLine}%`, right: 0 }}
                />
                <div
                  className={`absolute inset-y-3 left-0 transition-[width] duration-300 ${
                    result.status === 'healthy'
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : result.status === 'thin'
                        ? 'bg-amber-500 dark:bg-amber-400'
                        : 'bg-rose-600 dark:bg-rose-400'
                  }`}
                  style={{ width: `${demandWidth}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-neutral-950 dark:bg-white"
                  style={{ left: `${reserveLine}%` }}
                  aria-hidden="true"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-950 dark:text-white">
                  Demand {formatCompact(result.scenarioRps)} RPS
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>0</span>
                <span className="text-center">Reserve starts at {formatCompact(result.targetCapacity)} RPS</span>
                <span className="text-right">Tested {formatCompact(result.testedFleetCapacity)} RPS</span>
              </div>
            </div>

            <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
              <Metric
                label="Average demand"
                value={`${formatCompact(result.averageRps)} RPS`}
                detail={`${formatCompact(result.activeUsers)} concurrently active users`}
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
                tone="blue"
              />
              <Metric
                label="Scenario peak"
                value={`${formatCompact(result.scenarioRps)} RPS`}
                detail={`${formatCompact(result.peakBandwidthMbps)} Mbps outbound at peak`}
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                tone={metricTone}
              />
              <Metric
                label="Required fleet"
                value={`${formatNumber(result.requiredInstances)} nodes`}
                detail={`At ${formatNumber(result.model.reservePct)}% reserve and tested throughput`}
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                tone={result.extraInstances > 0 ? 'amber' : 'emerald'}
              />
              <Metric
                label="First constraint"
                value={result.bottleneck}
                detail={result.recommendation}
                icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                tone={metricTone}
              />
            </div>

            <div className="mt-6 grid items-center gap-3 text-sm sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                <p className="text-xs font-bold uppercase">Projected workload</p>
                <p className="mt-1 font-black">{formatCompact(result.plannedPeakRps)} planned peak RPS</p>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" aria-hidden="true" />
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100">
                <p className="text-xs font-bold uppercase">{result.challenge.label}</p>
                <p className="mt-1 font-black">{formatCompact(result.scenarioRps)} RPS presented</p>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" aria-hidden="true" />
              <div className={`rounded-md border p-3 ${statusTone}`}>
                <p className="text-xs font-bold uppercase">Serving result</p>
                <p className="mt-1 font-black">{statusLabel}</p>
              </div>
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                  <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                  Illustrative run rate
                </p>
                <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                  {formatMoney(result.monthlyCost)} per month
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Rates are editable planning assumptions, not a vendor quote. Peak challenge duration is not added to the monthly egress estimate.
                </p>
              </div>
              <button
                type="button"
                aria-expanded={showCostAssumptions}
                onClick={() => setShowCostAssumptions((current) => !current)}
                className="min-h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                {showCostAssumptions ? 'Hide rate assumptions' : 'Edit rate assumptions'}
              </button>
            </div>

            <div className="mt-5 grid gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
              <Metric
                label="Compute"
                value={formatMoney(result.computeCost)}
                detail={`${formatNumber(result.model.provisionedInstances)} provisioned x ${formatMoney(result.model.instanceMonthlyCost)}`}
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
              />
              <Metric
                label="Replicated storage"
                value={formatMoney(result.storageCost)}
                detail={`${formatNumber(result.replicatedStorageTb, 2)} TB x ${formatMoney(result.model.storageTbMonthlyCost)}`}
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
              />
              <Metric
                label="Average egress"
                value={formatMoney(result.egressCost)}
                detail={`${formatCompact(result.monthlyEgressGb)} GB x ${formatMoney(result.model.egressGbCost)}`}
                icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              />
            </div>

            {showCostAssumptions ? (
              <div className="mt-5 grid gap-4 border-l-2 border-blue-500 pl-4 sm:grid-cols-3">
                <NumberField
                  label="Instance rate"
                  value={inputs.instanceMonthlyCost}
                  onChange={(value) => updateInput('instanceMonthlyCost', value)}
                  onCommit={() => commitInput('instanceMonthlyCost')}
                  {...LIMITS.instanceMonthlyCost}
                  step={1}
                  unit="USD / month"
                />
                <NumberField
                  label="Storage rate"
                  value={inputs.storageTbMonthlyCost}
                  onChange={(value) => updateInput('storageTbMonthlyCost', value)}
                  onCommit={() => commitInput('storageTbMonthlyCost')}
                  {...LIMITS.storageTbMonthlyCost}
                  step={1}
                  unit="USD / TB-month"
                />
                <NumberField
                  label="Egress rate"
                  value={inputs.egressGbCost}
                  onChange={(value) => updateInput('egressGbCost', value)}
                  onCommit={() => commitInput('egressGbCost')}
                  {...LIMITS.egressGbCost}
                  step={0.01}
                  unit="USD / GB"
                />
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 border-t border-neutral-200 pt-5 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300 md:grid-cols-3">
              <p>
                <span className="font-bold text-neutral-950 dark:text-white">Traffic formula:</span>{' '}
                users x active share x requests/min / 60 x peak factors.
              </p>
              <p>
                <span className="font-bold text-neutral-950 dark:text-white">Fleet formula:</span>{' '}
                ceil(scenario RPS / tested node RPS / (1 - reserve)).
              </p>
              <p>
                <span className="font-bold text-neutral-950 dark:text-white">Excluded:</span>{' '}
                databases, queues, support, taxes, discounts, and workload-specific amplification.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
