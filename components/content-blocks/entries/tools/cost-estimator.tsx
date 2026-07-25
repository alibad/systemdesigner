'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Database,
  Gauge,
  Globe2,
  HardDrive,
  RefreshCcw,
  Server,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

type ScenarioId = 'baseline' | 'traffic-spike' | 'replication-growth' | 'egress-shock' | 'zone-loss';
type RegionProfile = 'reference' | 'costlier' | 'lower-cost' | 'custom';

type EstimatorInputs = {
  averageRps: number;
  peakMultiplier: number;
  instanceCapacityRps: number;
  targetUtilizationPct: number;
  reservePct: number;
  primaryStorageGb: number;
  monthlyStorageGrowthPct: number;
  forecastMonths: number;
  replicationFactor: number;
  monthlyEgressGb: number;
  instanceHourlyPrice: number;
  storageGbMonthlyPrice: number;
  egressGbPrice: number;
  managedPlatformMonthlyPrice: number;
  operationsPct: number;
  regionMultiplier: number;
  committedComputePct: number;
  commitmentDiscountPct: number;
  uncertaintyPct: number;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  compactLabel: string;
  description: string;
  demandMultiplier: number;
  replicaDelta: number;
  egressMultiplier: number;
  survivingFleetPct: number;
  icon: typeof Activity;
};

type CostDriver = {
  id: string;
  label: string;
  value: number;
  formula: string;
  color: string;
};

const HOURS_PER_MONTH = 730;

const DEFAULT_INPUTS: EstimatorInputs = {
  averageRps: 1_200,
  peakMultiplier: 3.2,
  instanceCapacityRps: 650,
  targetUtilizationPct: 65,
  reservePct: 25,
  primaryStorageGb: 4_500,
  monthlyStorageGrowthPct: 6,
  forecastMonths: 12,
  replicationFactor: 3,
  monthlyEgressGb: 12_000,
  instanceHourlyPrice: 0.14,
  storageGbMonthlyPrice: 0.025,
  egressGbPrice: 0.065,
  managedPlatformMonthlyPrice: 350,
  operationsPct: 8,
  regionMultiplier: 1,
  committedComputePct: 70,
  commitmentDiscountPct: 20,
  uncertaintyPct: 15,
};

const LIMITS: Record<keyof EstimatorInputs, { min: number; max: number }> = {
  averageRps: { min: 1, max: 10_000_000 },
  peakMultiplier: { min: 1, max: 20 },
  instanceCapacityRps: { min: 1, max: 1_000_000 },
  targetUtilizationPct: { min: 20, max: 90 },
  reservePct: { min: 0, max: 100 },
  primaryStorageGb: { min: 0, max: 1_000_000_000 },
  monthlyStorageGrowthPct: { min: 0, max: 100 },
  forecastMonths: { min: 1, max: 60 },
  replicationFactor: { min: 1, max: 7 },
  monthlyEgressGb: { min: 0, max: 1_000_000_000 },
  instanceHourlyPrice: { min: 0, max: 10_000 },
  storageGbMonthlyPrice: { min: 0, max: 100 },
  egressGbPrice: { min: 0, max: 100 },
  managedPlatformMonthlyPrice: { min: 0, max: 1_000_000 },
  operationsPct: { min: 0, max: 50 },
  regionMultiplier: { min: 0.5, max: 3 },
  committedComputePct: { min: 0, max: 100 },
  commitmentDiscountPct: { min: 0, max: 80 },
  uncertaintyPct: { min: 0, max: 100 },
};

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: 'Planned demand',
    compactLabel: 'Baseline',
    description: 'Price the architecture at the planned peak with the selected failure reserve intact.',
    demandMultiplier: 1,
    replicaDelta: 0,
    egressMultiplier: 1,
    survivingFleetPct: 1,
    icon: CheckCircle2,
  },
  {
    id: 'traffic-spike',
    label: 'Traffic spike',
    compactLabel: '2.4x traffic',
    description: 'A launch drives 2.4x peak traffic and outbound transfer through the same planned fleet.',
    demandMultiplier: 2.4,
    replicaDelta: 0,
    egressMultiplier: 2.4,
    survivingFleetPct: 1,
    icon: Zap,
  },
  {
    id: 'replication-growth',
    label: 'Replication growth',
    compactLabel: '+2 replicas',
    description: 'A durability requirement adds two full data copies and 25% more replication transfer.',
    demandMultiplier: 1,
    replicaDelta: 2,
    egressMultiplier: 1.25,
    survivingFleetPct: 1,
    icon: Database,
  },
  {
    id: 'egress-shock',
    label: 'Egress shock',
    compactLabel: '3.5x transfer',
    description: 'A distribution change pushes 3.5x normal outbound data without changing compute demand.',
    demandMultiplier: 1,
    replicaDelta: 0,
    egressMultiplier: 3.5,
    survivingFleetPct: 1,
    icon: Globe2,
  },
  {
    id: 'zone-loss',
    label: 'Zone failure',
    compactLabel: '33% fleet loss',
    description: 'One of three zones fails at peak, so the surviving fleet must carry the full workload.',
    demandMultiplier: 1,
    replicaDelta: 0,
    egressMultiplier: 1,
    survivingFleetPct: 2 / 3,
    icon: AlertTriangle,
  },
];

const REGION_PROFILES: Array<{
  id: Exclude<RegionProfile, 'custom'>;
  label: string;
  multiplier: number;
}> = [
  { id: 'lower-cost', label: 'Lower-cost 0.88x', multiplier: 0.88 },
  { id: 'reference', label: 'Reference 1.00x', multiplier: 1 },
  { id: 'costlier', label: 'Costlier 1.18x', multiplier: 1.18 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);

const formatMoney = (value: number, maximumFractionDigits = value < 10 ? 2 : 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);

function sanitizeInputs(inputs: EstimatorInputs): EstimatorInputs {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => {
      const limit = LIMITS[key as keyof EstimatorInputs];
      const safeValue = Number.isFinite(value) ? value : limit.min;
      return [key, clamp(safeValue, limit.min, limit.max)];
    }),
  ) as EstimatorInputs;
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
  onCommit,
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
  onCommit: () => void;
}) {
  const invalid = !Number.isFinite(value) || value < min || value > max;

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </span>
      <span
        className={`grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-md border bg-white transition focus-within:ring-2 dark:bg-neutral-950 ${
          invalid
            ? 'border-rose-500 focus-within:ring-rose-500/20'
            : 'border-neutral-300 focus-within:border-cyan-600 focus-within:ring-cyan-600/20 dark:border-neutral-700 dark:focus-within:border-cyan-400'
        }`}
      >
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          aria-invalid={invalid}
          onBlur={onCommit}
          onChange={(event) =>
            onChange(event.currentTarget.value === '' ? Number.NaN : event.currentTarget.valueAsNumber)
          }
          className="min-w-0 bg-transparent px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none dark:text-white"
        />
        <span className="flex min-w-14 items-center justify-center border-l border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {unit}
        </span>
      </span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span> : null}
      {invalid ? (
        <span className="mt-1 block text-xs font-medium text-rose-700 dark:text-rose-300">
          Use {formatNumber(min, 2)} to {formatNumber(max, 2)}.
        </span>
      ) : null}
    </label>
  );
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</span>
        <output
          htmlFor={id}
          className="min-w-16 rounded-md bg-neutral-200 px-2 py-1 text-center font-mono text-sm font-bold text-neutral-950 dark:bg-neutral-800 dark:text-white"
        >
          {formatNumber(value, step < 1 ? 1 : 0)}
          {suffix}
        </output>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className="h-2 w-full cursor-pointer accent-cyan-600 dark:accent-cyan-400"
      />
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span>
    </label>
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
      <div>
        <h3 className="text-sm font-bold text-neutral-950 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function DriverBar({ driver, total }: { driver: CostDriver; total: number }) {
  const share = total > 0 ? (driver.value / total) * 100 : 0;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{driver.label}</p>
          <p className="mt-0.5 break-words text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {driver.formula}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold text-neutral-950 dark:text-white">
            {formatMoney(driver.value)}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatNumber(share, 1)}%</p>
        </div>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`${driver.label}: ${formatMoney(driver.value)}, ${formatNumber(share, 1)} percent of monthly cost`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${driver.color}`}
          style={{ width: `${Math.max(share > 0 ? 1.5 : 0, share)}%` }}
        />
      </div>
    </div>
  );
}

export default function CostEstimator() {
  const [inputs, setInputs] = useState<EstimatorInputs>(DEFAULT_INPUTS);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('baseline');
  const [regionProfile, setRegionProfile] = useState<RegionProfile>('reference');

  const safe = sanitizeInputs(inputs);
  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId) ?? SCENARIOS[0];

  const updateInput = (key: keyof EstimatorInputs, value: number) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const commitInput = (key: keyof EstimatorInputs) => {
    const limit = LIMITS[key];
    const value = inputs[key];
    updateInput(key, clamp(Number.isFinite(value) ? value : DEFAULT_INPUTS[key], limit.min, limit.max));
  };

  const baselinePeakRps = safe.averageRps * safe.peakMultiplier;
  const scenarioPeakRps = baselinePeakRps * scenario.demandMultiplier;
  const usableRpsPerInstance = safe.instanceCapacityRps * (safe.targetUtilizationPct / 100);
  const baselineServingInstances = Math.max(1, Math.ceil(baselinePeakRps / usableRpsPerInstance));
  const baselineFleet = Math.max(
    1,
    Math.ceil(baselineServingInstances * (1 + safe.reservePct / 100)),
  );
  const scenarioServingInstances = Math.max(1, Math.ceil(scenarioPeakRps / usableRpsPerInstance));
  const scenarioReadyFleet = Math.max(
    1,
    Math.ceil(
      (scenarioServingInstances * (1 + safe.reservePct / 100)) / scenario.survivingFleetPct,
    ),
  );
  const currentSurvivingFleet = Math.max(1, Math.floor(baselineFleet * scenario.survivingFleetPct));
  const currentScenarioCapacityRps = currentSurvivingFleet * usableRpsPerInstance;
  const overloaded = currentScenarioCapacityRps < scenarioPeakRps;
  const currentUtilizationPct = (scenarioPeakRps / currentScenarioCapacityRps) * 100;
  const fleetDelta = Math.max(0, scenarioReadyFleet - baselineFleet);

  const projectedPrimaryStorageGb =
    safe.primaryStorageGb *
    Math.pow(1 + safe.monthlyStorageGrowthPct / 100, safe.forecastMonths);
  const scenarioReplicaCount = safe.replicationFactor + scenario.replicaDelta;
  const replicatedStorageGb = projectedPrimaryStorageGb * scenarioReplicaCount;
  const scenarioEgressGb = safe.monthlyEgressGb * scenario.egressMultiplier;

  const grossComputeCost =
    scenarioReadyFleet *
    HOURS_PER_MONTH *
    safe.instanceHourlyPrice *
    safe.regionMultiplier;
  const commitmentSavings =
    grossComputeCost *
    (safe.committedComputePct / 100) *
    (safe.commitmentDiscountPct / 100);
  const computeCost = grossComputeCost - commitmentSavings;
  const storageCost =
    replicatedStorageGb *
    safe.storageGbMonthlyPrice *
    safe.regionMultiplier;
  const egressCost = scenarioEgressGb * safe.egressGbPrice * safe.regionMultiplier;
  const platformCost = safe.managedPlatformMonthlyPrice * safe.regionMultiplier;
  const infrastructureSubtotal = computeCost + storageCost + egressCost + platformCost;
  const operationsCost = infrastructureSubtotal * (safe.operationsPct / 100);
  const monthlyTotal = infrastructureSubtotal + operationsCost;
  const lowEstimate = monthlyTotal * (1 - safe.uncertaintyPct / 100);
  const highEstimate = monthlyTotal * (1 + safe.uncertaintyPct / 100);
  const annualizedCost = monthlyTotal * 12;

  const costDrivers: CostDriver[] = [
    {
      id: 'compute',
      label: 'Compute fleet',
      value: computeCost,
      formula: `${scenarioReadyFleet} instances × 730 h × ${formatMoney(safe.instanceHourlyPrice, 3)}/h × ${safe.regionMultiplier.toFixed(2)} region factor − ${formatMoney(commitmentSavings)} commitment savings`,
      color: 'bg-cyan-500',
    },
    {
      id: 'storage',
      label: 'Replicated storage',
      value: storageCost,
      formula: `${formatCompact(replicatedStorageGb)} GB-copies × ${formatMoney(safe.storageGbMonthlyPrice, 3)}/GB-month × ${safe.regionMultiplier.toFixed(2)}`,
      color: 'bg-violet-500',
    },
    {
      id: 'egress',
      label: 'Outbound transfer',
      value: egressCost,
      formula: `${formatCompact(scenarioEgressGb)} GB × ${formatMoney(safe.egressGbPrice, 3)}/GB × ${safe.regionMultiplier.toFixed(2)}`,
      color: 'bg-amber-500',
    },
    {
      id: 'platform',
      label: 'Managed platform',
      value: platformCost,
      formula: `${formatMoney(safe.managedPlatformMonthlyPrice)} editable base assumption × ${safe.regionMultiplier.toFixed(2)}`,
      color: 'bg-emerald-500',
    },
    {
      id: 'operations',
      label: 'Operations and telemetry',
      value: operationsCost,
      formula: `${formatNumber(safe.operationsPct, 1)}% × ${formatMoney(infrastructureSubtotal)} infrastructure subtotal`,
      color: 'bg-rose-500',
    },
  ];

  const largestDriver = [...costDrivers].sort((left, right) => right.value - left.value)[0];
  const replicaPremium =
    projectedPrimaryStorageGb *
    Math.max(0, scenarioReplicaCount - 1) *
    safe.storageGbMonthlyPrice *
    safe.regionMultiplier;
  const onDemandTotal = monthlyTotal + commitmentSavings * (1 + safe.operationsPct / 100);
  const ScenarioIcon = scenario.icon;

  const status = overloaded
    ? {
        label: 'Planned fleet overloads',
        detail: `${fleetDelta} additional instances are required to restore the utilization target and reserve.`,
        classes:
          'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
        icon: AlertTriangle,
      }
    : scenario.id === 'baseline'
      ? {
          label: 'Failure reserve intact',
          detail: `${baselineFleet - baselineServingInstances} instances remain above the serving requirement at the planned peak.`,
          classes:
            'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100',
          icon: ShieldCheck,
        }
      : {
          label: 'Planned fleet can serve demand',
          detail: 'The challenge changes cost or durability without exceeding the current serving envelope.',
          classes:
            'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100',
          icon: Gauge,
        };
  const StatusIcon = status.icon;

  return (
    <section
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-neutral-950">
              <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-cyan-300">Architecture economics lab</p>
              <h2 className="mt-1 text-2xl font-bold tracking-normal text-white">
                Price the operating envelope
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-300">
                Size the resources first, then apply editable unit economics. Challenge the plan to see
                which cost and reliability assumptions break.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputs(DEFAULT_INPUTS);
              setScenarioId('baseline');
              setRegionProfile('reference');
            }}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-white transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label="Reset cost estimator"
            title="Reset cost estimator"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-5 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Challenge the healthy plan
            </p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Each scenario changes a different architecture or pricing driver.
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 sm:flex">
            <ScenarioIcon className="h-4 w-4" aria-hidden="true" />
            {scenario.compactLabel}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Cost challenge scenario">
          {SCENARIOS.map((candidate) => {
            const Icon = candidate.icon;
            const selected = candidate.id === scenarioId;
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setScenarioId(candidate.id)}
                className={`min-h-20 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950'
                    : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-900'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {candidate.label}
                </span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected
                      ? 'text-cyan-50 dark:text-neutral-800'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {candidate.compactLabel}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300" aria-live="polite">
          <span className="font-semibold text-neutral-950 dark:text-white">{scenario.label}:</span>{' '}
          {scenario.description}
        </p>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.42fr)]">
        <div className="min-w-0 border-b border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/35 xl:border-b-0 xl:border-r">
          <div className="space-y-5 border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
            <LoopHeading
              number="1"
              title="Workload shapes the architecture"
              description="Demand, storage growth, and reserve targets determine the resources the design must carry."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="cost-average-rps"
                label="Average traffic"
                value={inputs.averageRps}
                min={LIMITS.averageRps.min}
                max={LIMITS.averageRps.max}
                unit="req/s"
                onChange={(value) => updateInput('averageRps', value)}
                onCommit={() => commitInput('averageRps')}
              />
              <NumberField
                id="cost-peak-multiplier"
                label="Peak multiplier"
                value={inputs.peakMultiplier}
                min={LIMITS.peakMultiplier.min}
                max={LIMITS.peakMultiplier.max}
                step={0.1}
                unit="× avg"
                onChange={(value) => updateInput('peakMultiplier', value)}
                onCommit={() => commitInput('peakMultiplier')}
              />
              <NumberField
                id="cost-instance-capacity"
                label="Tested instance capacity"
                value={inputs.instanceCapacityRps}
                min={LIMITS.instanceCapacityRps.min}
                max={LIMITS.instanceCapacityRps.max}
                unit="req/s"
                hint="Use a measured sustained rate, not a vendor maximum."
                onChange={(value) => updateInput('instanceCapacityRps', value)}
                onCommit={() => commitInput('instanceCapacityRps')}
              />
              <NumberField
                id="cost-storage"
                label="Primary data now"
                value={inputs.primaryStorageGb}
                min={LIMITS.primaryStorageGb.min}
                max={LIMITS.primaryStorageGb.max}
                unit="GB"
                onChange={(value) => updateInput('primaryStorageGb', value)}
                onCommit={() => commitInput('primaryStorageGb')}
              />
              <NumberField
                id="cost-storage-growth"
                label="Monthly data growth"
                value={inputs.monthlyStorageGrowthPct}
                min={LIMITS.monthlyStorageGrowthPct.min}
                max={LIMITS.monthlyStorageGrowthPct.max}
                step={0.5}
                unit="%"
                onChange={(value) => updateInput('monthlyStorageGrowthPct', value)}
                onCommit={() => commitInput('monthlyStorageGrowthPct')}
              />
              <NumberField
                id="cost-forecast-months"
                label="Forecast horizon"
                value={inputs.forecastMonths}
                min={LIMITS.forecastMonths.min}
                max={LIMITS.forecastMonths.max}
                unit="months"
                onChange={(value) => updateInput('forecastMonths', value)}
                onCommit={() => commitInput('forecastMonths')}
              />
              <NumberField
                id="cost-replication"
                label="Stored copies"
                value={inputs.replicationFactor}
                min={LIMITS.replicationFactor.min}
                max={LIMITS.replicationFactor.max}
                unit="copies"
                hint="Includes the primary copy."
                onChange={(value) => updateInput('replicationFactor', value)}
                onCommit={() => commitInput('replicationFactor')}
              />
              <NumberField
                id="cost-egress"
                label="Monthly outbound transfer"
                value={inputs.monthlyEgressGb}
                min={LIMITS.monthlyEgressGb.min}
                max={LIMITS.monthlyEgressGb.max}
                unit="GB"
                onChange={(value) => updateInput('monthlyEgressGb', value)}
                onCommit={() => commitInput('monthlyEgressGb')}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <RangeField
                id="cost-target-utilization"
                label="Target utilization"
                value={safe.targetUtilizationPct}
                min={LIMITS.targetUtilizationPct.min}
                max={LIMITS.targetUtilizationPct.max}
                suffix="%"
                hint="A lower target buys latency headroom with more instances."
                onChange={(value) => updateInput('targetUtilizationPct', value)}
              />
              <RangeField
                id="cost-reserve"
                label="Failure reserve"
                value={safe.reservePct}
                min={LIMITS.reservePct.min}
                max={LIMITS.reservePct.max}
                suffix="%"
                hint="Capacity held above the serving requirement."
                onChange={(value) => updateInput('reservePct', value)}
              />
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <LoopHeading
              number="2"
              title="Assumptions shape unit economics"
              description="Edit every price. These are neutral teaching assumptions, not a provider quote."
            />
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100">
              <p className="font-bold">Illustrative USD assumptions · revised July 25, 2026</p>
              <p className="mt-1 text-cyan-800 dark:text-cyan-200">
                Excludes taxes, support contracts, free tiers, migration labor, and negotiated pricing.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Region cost profile
              </p>
              <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Region cost profile">
                {REGION_PROFILES.map((profile) => {
                  const selected = regionProfile === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setRegionProfile(profile.id);
                        updateInput('regionMultiplier', profile.multiplier);
                      }}
                      className={`min-h-11 rounded-md border px-2 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        selected
                          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      {profile.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="cost-region-multiplier"
                label="Region multiplier"
                value={inputs.regionMultiplier}
                min={LIMITS.regionMultiplier.min}
                max={LIMITS.regionMultiplier.max}
                step={0.01}
                unit="× base"
                onChange={(value) => {
                  setRegionProfile('custom');
                  updateInput('regionMultiplier', value);
                }}
                onCommit={() => commitInput('regionMultiplier')}
              />
              <NumberField
                id="cost-instance-price"
                label="Compute unit price"
                value={inputs.instanceHourlyPrice}
                min={LIMITS.instanceHourlyPrice.min}
                max={LIMITS.instanceHourlyPrice.max}
                step={0.001}
                unit="$/hour"
                onChange={(value) => updateInput('instanceHourlyPrice', value)}
                onCommit={() => commitInput('instanceHourlyPrice')}
              />
              <NumberField
                id="cost-storage-price"
                label="Storage unit price"
                value={inputs.storageGbMonthlyPrice}
                min={LIMITS.storageGbMonthlyPrice.min}
                max={LIMITS.storageGbMonthlyPrice.max}
                step={0.001}
                unit="$/GB-mo"
                onChange={(value) => updateInput('storageGbMonthlyPrice', value)}
                onCommit={() => commitInput('storageGbMonthlyPrice')}
              />
              <NumberField
                id="cost-egress-price"
                label="Egress unit price"
                value={inputs.egressGbPrice}
                min={LIMITS.egressGbPrice.min}
                max={LIMITS.egressGbPrice.max}
                step={0.001}
                unit="$/GB"
                onChange={(value) => updateInput('egressGbPrice', value)}
                onCommit={() => commitInput('egressGbPrice')}
              />
              <NumberField
                id="cost-platform-price"
                label="Managed platform base"
                value={inputs.managedPlatformMonthlyPrice}
                min={LIMITS.managedPlatformMonthlyPrice.min}
                max={LIMITS.managedPlatformMonthlyPrice.max}
                unit="$/month"
                onChange={(value) => updateInput('managedPlatformMonthlyPrice', value)}
                onCommit={() => commitInput('managedPlatformMonthlyPrice')}
              />
              <NumberField
                id="cost-operations-pct"
                label="Operations and telemetry"
                value={inputs.operationsPct}
                min={LIMITS.operationsPct.min}
                max={LIMITS.operationsPct.max}
                step={0.5}
                unit="% infra"
                onChange={(value) => updateInput('operationsPct', value)}
                onCommit={() => commitInput('operationsPct')}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <RangeField
                id="cost-commitment-coverage"
                label="Committed compute"
                value={safe.committedComputePct}
                min={LIMITS.committedComputePct.min}
                max={LIMITS.committedComputePct.max}
                suffix="%"
                hint="Only stable baseline usage should be committed."
                onChange={(value) => updateInput('committedComputePct', value)}
              />
              <RangeField
                id="cost-commitment-discount"
                label="Assumed commitment discount"
                value={safe.commitmentDiscountPct}
                min={LIMITS.commitmentDiscountPct.min}
                max={LIMITS.commitmentDiscountPct.max}
                suffix="%"
                hint="Editable scenario input, not a vendor promise."
                onChange={(value) => updateInput('commitmentDiscountPct', value)}
              />
              <RangeField
                id="cost-uncertainty"
                label="Estimate uncertainty"
                value={safe.uncertaintyPct}
                min={LIMITS.uncertaintyPct.min}
                max={LIMITS.uncertaintyPct.max}
                suffix="%"
                hint="Widens the result around uncertain usage and pricing."
                onChange={(value) => updateInput('uncertaintyPct', value)}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  Scenario-ready monthly run rate
                </p>
                <p className="mt-2 text-4xl font-bold tracking-normal text-neutral-950 dark:text-white sm:text-5xl">
                  {formatMoney(monthlyTotal)}
                </p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {formatMoney(annualizedCost)} annualized at month {safe.forecastMonths}
                </p>
              </div>
              <div className={`max-w-lg rounded-md border p-4 ${status.classes}`} aria-live="polite">
                <div className="flex gap-3">
                  <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold">{status.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">{status.detail}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">Confidence envelope</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    ±{formatNumber(safe.uncertaintyPct)}% around the modeled run rate
                  </p>
                </div>
                <p className="text-right font-mono text-sm font-bold text-neutral-950 dark:text-white">
                  {formatMoney(lowEstimate)}–{formatMoney(highEstimate)}
                </p>
              </div>
              <div className="relative mt-4 h-8" role="img" aria-label={`Cost range from ${formatMoney(lowEstimate)} to ${formatMoney(highEstimate)}`}>
                <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="absolute inset-x-[8%] top-2 h-4 rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-amber-400 opacity-80" />
                <span className="absolute left-1/2 top-0 h-8 w-0.5 -translate-x-1/2 bg-neutral-950 dark:bg-white" />
              </div>
              <div className="flex justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Lower case</span>
                <span>Modeled</span>
                <span>Upper case</span>
              </div>
            </div>
          </div>

          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Architecture consequence</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  The selected challenge flows through capacity, data copies, and transfer.
                </p>
              </div>
              <span className="hidden rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 sm:block">
                Current plan: {baselineFleet} instances
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-h-32 border-t-4 border-cyan-500 bg-cyan-50 p-4 dark:bg-cyan-950/30">
                <Activity className="h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold uppercase text-cyan-800 dark:text-cyan-200">1 · Peak demand</p>
                <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                  {formatCompact(scenarioPeakRps)} req/s
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {scenario.demandMultiplier.toFixed(1)}× planned demand
                </p>
              </div>
              <div className="min-h-32 border-t-4 border-violet-500 bg-violet-50 p-4 dark:bg-violet-950/30">
                <Server className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold uppercase text-violet-800 dark:text-violet-200">2 · Compute fleet</p>
                <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                  {scenarioReadyFleet} instances
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {fleetDelta > 0 ? `Add ${fleetDelta} to survive this case` : 'Existing plan is sufficient'}
                </p>
              </div>
              <div className="min-h-32 border-t-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <HardDrive className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">3 · Durable state</p>
                <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                  {formatCompact(replicatedStorageGb)} GB
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {scenarioReplicaCount} copies at month {safe.forecastMonths}
                </p>
              </div>
              <div className="min-h-32 border-t-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30">
                <Cloud className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">4 · Outbound path</p>
                <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                  {formatCompact(scenarioEgressGb)} GB/mo
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {scenario.egressMultiplier.toFixed(1)}× transfer assumption
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/60 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Current surviving capacity</p>
                <p className="mt-1 font-bold text-neutral-950 dark:text-white">
                  {currentSurvivingFleet} instances · {formatCompact(currentScenarioCapacityRps)} req/s
                </p>
              </div>
              <ArrowRight className="h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Challenge utilization</p>
                <p className={`mt-1 font-bold ${overloaded ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {formatNumber(currentUtilizationPct, 1)}% of safe serving capacity
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 border-b border-neutral-200 dark:border-neutral-800 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <div className="min-w-0 border-b border-neutral-200 p-5 dark:border-neutral-800 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Monthly cost drivers</h3>
              </div>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Every bar exposes the units and formula behind the estimate.
              </p>
              <div className="mt-5 space-y-5">
                {costDrivers.map((driver) => (
                  <DriverBar key={driver.id} driver={driver} total={monthlyTotal} />
                ))}
              </div>
            </div>

            <div className="min-w-0 p-5 sm:p-6">
              <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Decision trade-offs</h3>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Optimization changes risk ownership, not just the bill.
              </p>
              <div className="mt-5 divide-y divide-neutral-200 dark:divide-neutral-800">
                <div className="pb-4">
                  <div className="flex items-start gap-3">
                    <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">Commit stable compute</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        Saves {formatMoney(onDemandTotal - monthlyTotal)}/month in this model, but
                        committed capacity remains payable when demand falls.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">Keep durability explicit</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        Extra copies cost {formatMoney(replicaPremium)}/month. Reducing them lowers
                        storage cost while narrowing failure tolerance.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-4">
                  <div className="flex items-start gap-3">
                    <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">Protect latency headroom</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        The {safe.targetUtilizationPct}% target and {safe.reservePct}% reserve drive{' '}
                        {scenarioReadyFleet} instances. Raising utilization reduces cost but increases
                        queueing risk.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="flex items-start gap-3">
                    <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">Attack the largest driver first</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {largestDriver.label} is currently largest at {formatMoney(largestDriver.value)}/month.
                        Optimize its unit or volume without hiding the architecture consequence.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950 p-5 text-white sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold">
                  <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  Model boundary
                </p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-300">
                  This estimate is a transparent comparison model, not a quote. Validate sustained
                  throughput, billing granularity, data transfer paths, discounts, and operational labor
                  against your actual architecture before making a commitment.
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs uppercase text-neutral-400">Scenario</p>
                <p className="mt-1 text-sm font-bold text-cyan-300">{scenario.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
