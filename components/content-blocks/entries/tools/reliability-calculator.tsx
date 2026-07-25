'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CloudOff,
  GitBranch,
  HeartPulse,
  Layers3,
  Network,
  RefreshCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Wrench,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ChallengeId =
  | 'baseline'
  | 'common-mode'
  | 'zone-loss'
  | 'slow-recovery'
  | 'maintenance'
  | 'cascade';

type ReliabilityInputs = {
  serialStages: number;
  replicasPerStage: number;
  requiredReplicas: number;
  failureDomains: number;
  commonModePct: number;
  mtbfHours: number;
  repairMttrHours: number;
  detectionMinutes: number;
  failoverMinutes: number;
  restoreMinutes: number;
  replicationLagMinutes: number;
  rtoTargetMinutes: number;
  rpoTargetMinutes: number;
  sloPct: number;
  plannedImpactMinutes: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  badge: string;
  description: string;
  icon: typeof Activity;
};

type ScenarioStatus = 'healthy' | 'risk' | 'breach';

const DEFAULT_INPUTS: ReliabilityInputs = {
  serialStages: 3,
  replicasPerStage: 3,
  requiredReplicas: 2,
  failureDomains: 3,
  commonModePct: 8,
  mtbfHours: 2_000,
  repairMttrHours: 2,
  detectionMinutes: 2,
  failoverMinutes: 4,
  restoreMinutes: 18,
  replicationLagMinutes: 2,
  rtoTargetMinutes: 30,
  rpoTargetMinutes: 5,
  sloPct: 99.95,
  plannedImpactMinutes: 2,
};

const LIMITS: Record<keyof ReliabilityInputs, { min: number; max: number }> = {
  serialStages: { min: 1, max: 5 },
  replicasPerStage: { min: 1, max: 5 },
  requiredReplicas: { min: 1, max: 5 },
  failureDomains: { min: 1, max: 5 },
  commonModePct: { min: 0, max: 90 },
  mtbfHours: { min: 10, max: 100_000 },
  repairMttrHours: { min: 0.05, max: 168 },
  detectionMinutes: { min: 0, max: 120 },
  failoverMinutes: { min: 0, max: 240 },
  restoreMinutes: { min: 0, max: 720 },
  replicationLagMinutes: { min: 0, max: 240 },
  rtoTargetMinutes: { min: 1, max: 1_440 },
  rpoTargetMinutes: { min: 0, max: 240 },
  sloPct: { min: 90, max: 99.999 },
  plannedImpactMinutes: { min: 0, max: 240 },
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Healthy plan',
    badge: 'Expected month',
    description: 'All failure domains are available and the configured recovery path works.',
    icon: CheckCircle2,
  },
  {
    id: 'common-mode',
    label: 'Common-mode failure',
    badge: '75% correlated',
    description: 'A shared control plane, credential, or network path defeats replica independence.',
    icon: CloudOff,
  },
  {
    id: 'zone-loss',
    label: 'Zone loss',
    badge: 'One domain removed',
    description: 'Every replica placed in one failure domain disappears at the same time.',
    icon: ShieldAlert,
  },
  {
    id: 'slow-recovery',
    label: 'Slow recovery',
    badge: '4x repair time',
    description: 'Detection, failover, repair, and restoration take longer than the runbook assumes.',
    icon: TimerReset,
  },
  {
    id: 'maintenance',
    label: 'Maintenance overlap',
    badge: 'One replica drained',
    description: 'Planned work removes capacity while the service still has to satisfy quorum.',
    icon: Wrench,
  },
  {
    id: 'cascade',
    label: 'Dependency cascade',
    badge: '+2 serial stages',
    description: 'A retrying downstream path adds critical dependencies and extends recovery.',
    icon: Zap,
  },
];

const MONTH_MINUTES = 30 * 24 * 60;
const YEAR_MINUTES = 365 * 24 * 60;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatAvailability = (value: number) => {
  const percentage = clamp(value, 0, 1) * 100;
  if (percentage > 99.999) return '>99.999%';
  const digits = percentage >= 99.9 ? 3 : 2;
  return `${formatNumber(percentage, digits)}%`;
};

const formatMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, minutes);
  if (safeMinutes < 1) return `${formatNumber(safeMinutes * 60, 0)} sec`;
  if (safeMinutes < 120) return `${formatNumber(safeMinutes, 1)} min`;
  if (safeMinutes < 2_880) return `${formatNumber(safeMinutes / 60, 1)} hr`;
  return `${formatNumber(safeMinutes / 1_440, 1)} days`;
};

const factorial = (value: number) => {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
};

const combination = (total: number, selected: number) =>
  factorial(total) / (factorial(selected) * factorial(total - selected));

const probabilityAtLeast = (
  total: number,
  required: number,
  successProbability: number,
) => {
  if (total < required) return 0;
  let result = 0;
  for (let healthy = required; healthy <= total; healthy += 1) {
    result +=
      combination(total, healthy) *
      Math.pow(successProbability, healthy) *
      Math.pow(1 - successProbability, total - healthy);
  }
  return clamp(result, 0, 1);
};

function safeInputs(inputs: ReliabilityInputs): ReliabilityInputs {
  const safe = Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => {
      const limit = LIMITS[key as keyof ReliabilityInputs];
      const finiteValue = Number.isFinite(value) ? value : limit.min;
      return [key, clamp(finiteValue, limit.min, limit.max)];
    }),
  ) as unknown as ReliabilityInputs;

  safe.requiredReplicas = Math.min(safe.requiredReplicas, safe.replicasPerStage);
  safe.failureDomains = Math.min(safe.failureDomains, safe.replicasPerStage);
  return safe;
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
  unit: string;
  hint: string;
}) {
  const invalid = !Number.isFinite(value) || value < min || value > max;

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="font-normal text-neutral-500 dark:text-neutral-400">{unit}</span>
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid}
        onBlur={onCommit}
        onChange={(event) =>
          onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))
        }
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:ring-2 dark:bg-neutral-950 dark:text-white ${
          invalid
            ? 'border-rose-500 focus:ring-rose-300 dark:border-rose-500 dark:focus:ring-rose-900'
            : 'border-neutral-300 focus:border-teal-600 focus:ring-teal-200 dark:border-neutral-700 dark:focus:border-teal-400 dark:focus:ring-teal-900'
        }`}
      />
      <span className={`mt-1 block text-xs leading-5 ${invalid ? 'text-rose-700 dark:text-rose-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {invalid ? `Use a value from ${min} to ${max}.` : hint}
      </span>
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
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="rounded bg-neutral-100 px-2 py-1 font-black text-neutral-950 dark:bg-neutral-800 dark:text-white">
          {formatNumber(value, step < 1 ? 2 : 0)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-teal-700 dark:accent-teal-400"
      />
      <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
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
  format,
}: {
  label: string;
  value: number;
  values: number[];
  onChange: (value: number) => void;
  format: (value: number) => string;
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
              className={`min-h-10 rounded-md border px-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                selected
                  ? 'border-teal-800 bg-teal-800 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-neutral-950'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-teal-500 hover:bg-teal-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-teal-600 dark:hover:bg-teal-950/50'
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
    <div>
      <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-800 dark:text-teal-300">
        {icon}
        {eyebrow}
      </div>
      <h3 className="mt-1 text-base font-black text-neutral-950 dark:text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
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
  tone?: 'neutral' | 'teal' | 'amber' | 'rose';
}) {
  const toneStyle = {
    neutral: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
    teal: 'border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/60',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60',
  }[tone];

  return (
    <div className={`min-w-0 rounded-md border p-4 ${toneStyle}`}>
      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 whitespace-nowrap text-lg font-black text-neutral-950 dark:text-white sm:text-xl xl:text-lg 2xl:text-xl">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function ProgressLane({
  label,
  used,
  available,
  detail,
}: {
  label: string;
  used: number;
  available: number;
  detail: string;
}) {
  const ratio = available <= 0 ? (used <= 0 ? 0 : 1.1) : used / available;
  const width = clamp(ratio * 100, 0, 100);
  const tone =
    ratio <= 0.7
      ? 'bg-teal-600 dark:bg-teal-400'
      : ratio <= 1
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-600 dark:bg-rose-400';

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-black text-neutral-950 dark:text-white">{label}</p>
        <p className="text-right text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          {formatMinutes(used)} / {formatMinutes(available)}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

export default function ReliabilityCalculator() {
  const [inputs, setInputs] = useState<ReliabilityInputs>(DEFAULT_INPUTS);
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');

  const updateInput = (key: keyof ReliabilityInputs, value: number) => {
    setInputs((current) => {
      const next = { ...current, [key]: value };
      if (key === 'replicasPerStage' && Number.isFinite(value)) {
        next.requiredReplicas = Math.min(next.requiredReplicas, value);
        next.failureDomains = Math.min(next.failureDomains, value);
      }
      return next;
    });
  };

  const commitInput = (key: keyof ReliabilityInputs) => {
    setInputs((current) => {
      const value = current[key];
      const limit = LIMITS[key];
      const safeValue = clamp(Number.isFinite(value) ? value : limit.min, limit.min, limit.max);
      return { ...current, [key]: safeValue };
    });
  };

  const result = useMemo(() => {
    const model = safeInputs(inputs);
    let stages = model.serialStages;
    let effectiveReplicas = model.replicasPerStage;
    let commonModePct = model.commonModePct;
    let repairMttrHours = model.repairMttrHours;
    let detectionMinutes = model.detectionMinutes;
    let failoverMinutes = model.failoverMinutes;
    let restoreMinutes = model.restoreMinutes;
    let observedRpoMinutes = model.replicationLagMinutes;
    let plannedImpactMinutes = model.plannedImpactMinutes;
    let failedReplicas = 0;
    let scenarioEventMinutes = 0;
    let scenarioHeadline = 'The configured path keeps its modeled error-budget reserve.';
    let scenarioDetail =
      'Use measured failure-domain correlation and incident data before treating the estimate as a commitment.';

    if (challengeId === 'common-mode') {
      commonModePct = Math.max(commonModePct, 75);
      scenarioEventMinutes = detectionMinutes + failoverMinutes + restoreMinutes;
      observedRpoMinutes = Math.max(observedRpoMinutes * 4, 15);
      failedReplicas = model.replicasPerStage;
      scenarioHeadline = 'Shared infrastructure removes most of the redundancy benefit.';
      scenarioDetail =
        'Replica count does not protect a journey when every copy depends on the same control plane, network path, credential, or release.';
    }

    if (challengeId === 'zone-loss') {
      failedReplicas = Math.ceil(model.replicasPerStage / model.failureDomains);
      effectiveReplicas = Math.max(0, model.replicasPerStage - failedReplicas);
      observedRpoMinutes *= 2;
      scenarioEventMinutes =
        effectiveReplicas >= model.requiredReplicas
          ? Math.max(1, failoverMinutes)
          : detectionMinutes + failoverMinutes + restoreMinutes;
      scenarioHeadline =
        effectiveReplicas >= model.requiredReplicas
          ? 'Quorum survives, but the path pays a failover interruption.'
          : 'The remaining replicas cannot satisfy the success rule.';
      scenarioDetail =
        effectiveReplicas >= model.requiredReplicas
          ? 'The architecture stays available only if traffic steering and the surviving domain have enough capacity.'
          : 'Add another failure domain, lower the required successes only when correctness permits, or add replicas.';
    }

    if (challengeId === 'slow-recovery') {
      repairMttrHours *= 4;
      detectionMinutes *= 2;
      failoverMinutes *= 2;
      restoreMinutes *= 3;
      scenarioEventMinutes = detectionMinutes + failoverMinutes + restoreMinutes;
      scenarioHeadline = 'Recovery speed, not replica count, becomes the dominant risk.';
      scenarioDetail =
        'Long detection and restoration windows increase both steady-state unavailability and the chance of exhausting the monthly budget.';
    }

    if (challengeId === 'maintenance') {
      failedReplicas = 1;
      effectiveReplicas = Math.max(0, model.replicasPerStage - 1);
      if (effectiveReplicas < model.requiredReplicas) {
        plannedImpactMinutes += 45;
        scenarioEventMinutes = 45;
        scenarioHeadline = 'The maintenance drain breaks the configured quorum.';
        scenarioDetail =
          'A safe maintenance policy must preserve the required successes after one replica is removed.';
      } else {
        scenarioEventMinutes = Math.max(1, failoverMinutes / 2);
        scenarioHeadline = 'Maintenance preserves quorum but consumes failure headroom.';
        scenarioDetail =
          'The service can continue, but another failure during the drain would leave less recovery margin.';
      }
    }

    if (challengeId === 'cascade') {
      stages += 2;
      commonModePct = Math.min(90, commonModePct + 15);
      failoverMinutes *= 1.5;
      restoreMinutes *= 1.5;
      observedRpoMinutes *= 2;
      scenarioEventMinutes = detectionMinutes + failoverMinutes;
      scenarioHeadline = 'The longer critical path compounds small dependency risks.';
      scenarioDetail =
        'Retries and hidden synchronous calls add serial failure opportunities; isolate or remove the new critical dependencies.';
    }

    const componentAvailability = model.mtbfHours / (model.mtbfHours + repairMttrHours);
    const independentGroupAvailability = probabilityAtLeast(
      effectiveReplicas,
      model.requiredReplicas,
      componentAvailability,
    );
    const componentUnavailability = 1 - componentAvailability;
    const independentGroupUnavailability = 1 - independentGroupAvailability;
    const correlatedShare = commonModePct / 100;
    const correlatedGroupUnavailability =
      correlatedShare * componentUnavailability +
      (1 - correlatedShare) * independentGroupUnavailability;
    const correlatedGroupAvailability = clamp(1 - correlatedGroupUnavailability, 0, 1);
    const independentJourneyAvailability = Math.pow(independentGroupAvailability, stages);
    const journeyAvailability = Math.pow(correlatedGroupAvailability, stages);
    const expectedDowntimeMinutes =
      (1 - journeyAvailability) * MONTH_MINUTES + plannedImpactMinutes;
    const independentDowntimeMinutes =
      (1 - independentJourneyAvailability) * MONTH_MINUTES + plannedImpactMinutes;
    const annualDowntimeMinutes =
      (1 - journeyAvailability) * YEAR_MINUTES + plannedImpactMinutes * 12;
    const sloBudgetMinutes = (1 - model.sloPct / 100) * MONTH_MINUTES;
    const scenarioMonthImpact = expectedDowntimeMinutes + scenarioEventMinutes;
    const remainingBudgetMinutes = sloBudgetMinutes - scenarioMonthImpact;
    const budgetBurnPct =
      sloBudgetMinutes > 0 ? (scenarioMonthImpact / sloBudgetMinutes) * 100 : 100;
    const recoveryDurationMinutes = detectionMinutes + failoverMinutes + restoreMinutes;
    const rtoMet = recoveryDurationMinutes <= model.rtoTargetMinutes;
    const rpoMet = observedRpoMinutes <= model.rpoTargetMinutes;
    const eventAvailableReplicas = Math.max(0, model.replicasPerStage - failedReplicas);
    const structureSurvives = eventAvailableReplicas >= model.requiredReplicas;
    const status: ScenarioStatus =
      !structureSurvives || budgetBurnPct > 100 || !rtoMet || !rpoMet
        ? 'breach'
        : budgetBurnPct > 70
          ? 'risk'
          : 'healthy';
    const replicaBenefitMinutes = Math.max(
      0,
      expectedDowntimeMinutes - independentDowntimeMinutes,
    );
    const replicasPerDomain = Math.ceil(model.replicasPerStage / model.failureDomains);

    const consequences = [
      structureSurvives
        ? `${eventAvailableReplicas} of ${model.replicasPerStage} replicas remain; the ${model.requiredReplicas}-of-${model.replicasPerStage} success rule can still complete.`
        : `Only ${eventAvailableReplicas} replicas remain, below the ${model.requiredReplicas} required for a successful stage.`,
      commonModePct > 20
        ? `${formatNumber(commonModePct)}% of replica unavailability is modeled as shared, so independent-only math understates downtime by about ${formatMinutes(replicaBenefitMinutes)} per month.`
        : `Shared failure accounts for ${formatNumber(commonModePct)}% of replica unavailability; verify this assumption with incident and placement data.`,
      rtoMet
        ? `The ${formatMinutes(recoveryDurationMinutes)} recovery path fits the ${formatMinutes(model.rtoTargetMinutes)} RTO.`
        : `The recovery path misses RTO by ${formatMinutes(recoveryDurationMinutes - model.rtoTargetMinutes)}.`,
      rpoMet
        ? `The ${formatMinutes(observedRpoMinutes)} replication exposure fits the ${formatMinutes(model.rpoTargetMinutes)} RPO.`
        : `The data-loss exposure misses RPO by ${formatMinutes(observedRpoMinutes - model.rpoTargetMinutes)}.`,
    ];

    return {
      model,
      stages,
      effectiveReplicas,
      eventAvailableReplicas,
      failedReplicas,
      replicasPerDomain,
      commonModePct,
      repairMttrHours,
      detectionMinutes,
      failoverMinutes,
      restoreMinutes,
      observedRpoMinutes,
      plannedImpactMinutes,
      scenarioEventMinutes,
      scenarioHeadline,
      scenarioDetail,
      componentAvailability,
      independentGroupAvailability,
      correlatedGroupAvailability,
      independentJourneyAvailability,
      journeyAvailability,
      expectedDowntimeMinutes,
      independentDowntimeMinutes,
      annualDowntimeMinutes,
      sloBudgetMinutes,
      scenarioMonthImpact,
      remainingBudgetMinutes,
      budgetBurnPct,
      recoveryDurationMinutes,
      rtoMet,
      rpoMet,
      structureSurvives,
      status,
      consequences,
    };
  }, [challengeId, inputs]);

  const invalidFields = (Object.keys(inputs) as Array<keyof ReliabilityInputs>).filter(
    (key) => {
      const value = inputs[key];
      return !Number.isFinite(value) || value < LIMITS[key].min || value > LIMITS[key].max;
    },
  );

  const selectedChallenge =
    CHALLENGES.find((challenge) => challenge.id === challengeId) ?? CHALLENGES[0];
  const statusLabel =
    result.status === 'healthy'
      ? 'Objectives fit'
      : result.status === 'risk'
        ? 'Reserve is thin'
        : 'Objective breached';
  const statusStyle =
    result.status === 'healthy'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
      : result.status === 'risk'
        ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
        : 'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100';
  const metricTone =
    result.status === 'healthy' ? 'teal' : result.status === 'risk' ? 'amber' : 'rose';

  return (
    <div
      data-content-block="tools/reliability-calculator"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-300">
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
              Reliability workbench
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              Design the journey, then break its assumptions
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Combine series dependencies, parallel replicas, failure domains, repair behavior,
              recovery objectives, and an SLO without pretending every failure is independent.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`min-w-0 flex-1 rounded-md border px-3 py-2 lg:flex-none ${statusStyle}`}>
              <p className="text-[11px] font-black uppercase">Scenario status</p>
              <p className="mt-0.5 text-sm font-black" aria-live="polite">
                {statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputs(DEFAULT_INPUTS);
                setChallengeId('baseline');
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-neutral-700 text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              aria-label="Reset reliability assumptions"
              title="Reset reliability assumptions"
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
              Challenge the plan
            </p>
            <h3 className="mt-1 text-base font-black text-neutral-950 dark:text-white">
              Failure and operating scenarios
            </h3>
          </div>
          <p className="max-w-xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Scenarios change the evaluated month, not the assumptions you entered.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CHALLENGES.map((challenge) => {
            const Icon = challenge.icon;
            const selected = challenge.id === challengeId;
            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallengeId(challenge.id)}
                className={`min-h-[104px] rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  selected
                    ? 'border-teal-800 bg-teal-800 text-white shadow-sm dark:border-teal-300 dark:bg-teal-300 dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-teal-700 dark:hover:bg-teal-950/50'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{challenge.label}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-black uppercase ${selected ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {challenge.badge}
                  </span>
                </span>
                <span className={`mt-2 block text-xs leading-5 ${selected ? 'text-teal-50 dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {challenge.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {invalidFields.length > 0 ? (
        <div
          role="alert"
          className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100 sm:px-6 lg:px-8"
        >
          <strong>Some inputs are outside the supported range.</strong> Results use the nearest
          valid boundary until those fields are corrected.
        </div>
      ) : null}

      <div className="grid min-w-0 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:border-b-0 xl:border-r">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
            <SectionHeading
              icon={<Network className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 1"
              title="Dependency topology and redundancy"
              detail="Change the serial path, success rule, placement, and shared-failure assumption."
            />
            <div className="mt-5 space-y-5">
              <RangeControl
                label="Critical stages in series"
                value={result.model.serialStages}
                onChange={(value) => updateInput('serialStages', value)}
                min={1}
                max={5}
                suffix=" stages"
                hint="Every stage must succeed for the user journey to complete."
              />
              <OptionGroup
                label="Replicas per stage"
                value={result.model.replicasPerStage}
                values={[1, 2, 3, 4, 5]}
                onChange={(value) => updateInput('replicasPerStage', value)}
                format={(value) => `${value}`}
              />
              <OptionGroup
                label="Required healthy replicas"
                value={result.model.requiredReplicas}
                values={Array.from(
                  { length: result.model.replicasPerStage },
                  (_, index) => index + 1,
                )}
                onChange={(value) => updateInput('requiredReplicas', value)}
                format={(value) => `${value}`}
              />
              <OptionGroup
                label="Independent failure domains"
                value={result.model.failureDomains}
                values={Array.from(
                  { length: result.model.replicasPerStage },
                  (_, index) => index + 1,
                )}
                onChange={(value) => updateInput('failureDomains', value)}
                format={(value) => `${value}`}
              />
              <RangeControl
                label="Correlated unavailability"
                value={result.model.commonModePct}
                onChange={(value) => updateInput('commonModePct', value)}
                min={0}
                max={80}
                suffix="%"
                hint="Share of one replica's downtime attributed to a common cause."
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6">
            <SectionHeading
              icon={<TimerReset className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 2"
              title="Failure, repair, and recovery"
              detail="Set measured reliability inputs and explicit service recovery objectives."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                label="Component MTBF"
                value={inputs.mtbfHours}
                onChange={(value) => updateInput('mtbfHours', value)}
                onCommit={() => commitInput('mtbfHours')}
                {...LIMITS.mtbfHours}
                step={10}
                unit="hours"
                hint="Mean time between failures for one replica."
              />
              <NumberField
                label="Repair MTTR"
                value={inputs.repairMttrHours}
                onChange={(value) => updateInput('repairMttrHours', value)}
                onCommit={() => commitInput('repairMttrHours')}
                {...LIMITS.repairMttrHours}
                step={0.1}
                unit="hours"
                hint="Mean time until the failed replica is healthy again."
              />
              <NumberField
                label="Detection time"
                value={inputs.detectionMinutes}
                onChange={(value) => updateInput('detectionMinutes', value)}
                onCommit={() => commitInput('detectionMinutes')}
                {...LIMITS.detectionMinutes}
                unit="minutes"
                hint="Time until automation or an operator identifies the failure."
              />
              <NumberField
                label="Failover time"
                value={inputs.failoverMinutes}
                onChange={(value) => updateInput('failoverMinutes', value)}
                onCommit={() => commitInput('failoverMinutes')}
                {...LIMITS.failoverMinutes}
                unit="minutes"
                hint="Time to route or promote a healthy serving path."
              />
              <NumberField
                label="Restore time"
                value={inputs.restoreMinutes}
                onChange={(value) => updateInput('restoreMinutes', value)}
                onCommit={() => commitInput('restoreMinutes')}
                {...LIMITS.restoreMinutes}
                unit="minutes"
                hint="Time to restore state and validate service correctness."
              />
              <NumberField
                label="Replication lag"
                value={inputs.replicationLagMinutes}
                onChange={(value) => updateInput('replicationLagMinutes', value)}
                onCommit={() => commitInput('replicationLagMinutes')}
                {...LIMITS.replicationLagMinutes}
                unit="minutes"
                hint="Potential committed-data exposure when recovery begins."
              />
              <NumberField
                label="RTO target"
                value={inputs.rtoTargetMinutes}
                onChange={(value) => updateInput('rtoTargetMinutes', value)}
                onCommit={() => commitInput('rtoTargetMinutes')}
                {...LIMITS.rtoTargetMinutes}
                unit="minutes"
                hint="Maximum acceptable service restoration time."
              />
              <NumberField
                label="RPO target"
                value={inputs.rpoTargetMinutes}
                onChange={(value) => updateInput('rpoTargetMinutes', value)}
                onCommit={() => commitInput('rpoTargetMinutes')}
                {...LIMITS.rpoTargetMinutes}
                unit="minutes"
                hint="Maximum acceptable committed-data loss window."
              />
              <OptionGroup
                label="Monthly availability SLO"
                value={result.model.sloPct}
                values={[99.9, 99.95, 99.99]}
                onChange={(value) => updateInput('sloPct', value)}
                format={(value) => `${value}%`}
              />
              <RangeControl
                label="Planned user impact"
                value={result.model.plannedImpactMinutes}
                onChange={(value) => updateInput('plannedImpactMinutes', value)}
                min={0}
                max={60}
                suffix=" min"
                hint="Known user-visible interruption charged to each monthly budget."
              />
            </div>
          </section>
        </aside>

        <div className="min-w-0 bg-neutral-50 dark:bg-neutral-900/40">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-800 dark:text-teal-300">
                  <GitBranch className="h-4 w-4" aria-hidden="true" />
                  Evaluated dependency path
                </div>
                <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  {result.stages} serial stages, {result.model.requiredReplicas} of{' '}
                  {result.model.replicasPerStage} replicas required
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Each stage uses parallel replicas. The complete journey succeeds only when every
                  stage reaches its success rule.
                </p>
              </div>
              <div className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-right dark:border-neutral-700 dark:bg-neutral-950">
                <p className="text-[11px] font-black uppercase text-neutral-500 dark:text-neutral-400">
                  Placement
                </p>
                <p className="mt-0.5 text-sm font-black text-neutral-950 dark:text-white">
                  {result.model.failureDomains} domains · up to {result.replicasPerDomain}{' '}
                  replica{result.replicasPerDomain === 1 ? '' : 's'}/domain
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex min-w-max items-stretch gap-3">
                <div className="flex w-28 shrink-0 flex-col items-center justify-center rounded-md border border-sky-300 bg-sky-50 p-3 text-center dark:border-sky-800 dark:bg-sky-950/60">
                  <Activity className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                  <p className="mt-2 text-xs font-black text-sky-950 dark:text-sky-100">User request</p>
                  <p className="mt-1 text-[11px] text-sky-800 dark:text-sky-300">Journey begins</p>
                </div>
                {Array.from({ length: result.stages }, (_, stageIndex) => (
                  <div key={stageIndex} className="flex items-center gap-3">
                    <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <div className={`w-40 shrink-0 rounded-md border p-3 ${
                      result.structureSurvives
                        ? 'border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/50'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-black uppercase text-neutral-500 dark:text-neutral-400">
                            Critical stage {stageIndex + 1}
                          </p>
                          <p className="mt-1 text-sm font-black text-neutral-950 dark:text-white">
                            {result.model.requiredReplicas}-of-{result.model.replicasPerStage}
                          </p>
                        </div>
                        <Server className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
                      </div>
                      <div className="mt-3 flex gap-1.5" aria-label={`${result.eventAvailableReplicas} healthy replicas and ${result.failedReplicas} unavailable replicas`}>
                        {Array.from({ length: result.model.replicasPerStage }, (_, replicaIndex) => {
                          const unavailable =
                            replicaIndex >= result.model.replicasPerStage - result.failedReplicas;
                          return (
                            <span
                              key={replicaIndex}
                              title={unavailable ? 'Unavailable replica' : 'Available replica'}
                              className={`grid h-7 w-7 place-items-center rounded border text-[10px] font-black ${
                                unavailable
                                  ? 'border-rose-400 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                                  : 'border-teal-400 bg-white text-teal-900 dark:border-teal-700 dark:bg-neutral-950 dark:text-teal-200'
                              }`}
                            >
                              {unavailable ? '×' : replicaIndex + 1}
                            </span>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] leading-4 text-neutral-600 dark:text-neutral-300">
                        {formatAvailability(result.correlatedGroupAvailability)} modeled stage
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className={`flex w-32 shrink-0 flex-col items-center justify-center rounded-md border p-3 text-center ${
                    result.status === 'breach'
                      ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/60'
                      : 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/60'
                  }`}>
                    {result.status === 'breach' ? (
                      <AlertTriangle className="h-5 w-5 text-rose-700 dark:text-rose-300" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    )}
                    <p className="mt-2 text-xs font-black text-neutral-950 dark:text-white">User outcome</p>
                    <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                      {formatAvailability(result.journeyAvailability)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded border border-teal-500 bg-teal-100 dark:bg-teal-950" />
                Available replica
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded border border-rose-500 bg-rose-100 dark:bg-rose-950" />
                Scenario-unavailable replica
              </span>
              <span>Scroll is contained inside the path on narrow screens.</span>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-800 dark:text-teal-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Availability model
            </div>
            <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
              Independent redundancy versus correlated reality
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Parallel replicas improve a stage; serial stages multiply their risk. Correlation
              assigns a share of replica downtime to one shared cause, where adding copies cannot
              help.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="One replica"
                value={formatAvailability(result.componentAvailability)}
                detail={`MTBF ${formatNumber(result.model.mtbfHours)} hr / MTTR ${formatNumber(result.repairMttrHours, 1)} hr`}
              />
              <Metric
                label="Independent parallel stage"
                value={formatAvailability(result.independentGroupAvailability)}
                detail={`Probability at least ${result.model.requiredReplicas} of ${result.effectiveReplicas} are healthy`}
                tone="teal"
              />
              <Metric
                label="Correlation-aware stage"
                value={formatAvailability(result.correlatedGroupAvailability)}
                detail={`${formatNumber(result.commonModePct)}% shared-failure assumption`}
                tone={result.commonModePct > 20 ? 'amber' : 'teal'}
              />
              <Metric
                label="Complete journey"
                value={formatAvailability(result.journeyAvailability)}
                detail={`${result.stages} stage probabilities multiplied in series`}
                tone={metricTone}
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-sm font-black text-neutral-950 dark:text-white">Model equations</p>
                <div className="mt-3 space-y-2 font-mono text-xs leading-5 text-neutral-700 dark:text-neutral-300">
                  <p>A(replica) = MTBF / (MTBF + MTTR)</p>
                  <p>A(parallel) = P(at least k of n replicas healthy)</p>
                  <p>U(stage) ≈ c × U(replica) + (1 − c) × U(parallel)</p>
                  <p>A(journey) = A(stage) ^ serial stages</p>
                </div>
              </div>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
                <div className="flex items-center gap-2 text-sm font-black text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Assumption boundary
                </div>
                <p className="mt-2 text-xs leading-5 text-amber-900 dark:text-amber-200">
                  The correlation blend is a planning approximation, not a substitute for failure
                  telemetry, load tests, or a dependency-specific Markov model. Rounded outputs
                  communicate model scale rather than contractual precision.
                </p>
              </div>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-800 dark:text-teal-300">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Objectives and budgets
            </div>
            <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
              Turn availability into time the team can operate
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={`${result.model.sloPct}% monthly SLO`}
                value={formatMinutes(result.sloBudgetMinutes)}
                detail="Total monthly error budget"
              />
              <Metric
                label="Scenario month impact"
                value={formatMinutes(result.scenarioMonthImpact)}
                detail={`${formatNumber(result.budgetBurnPct)}% of the error budget`}
                tone={metricTone}
              />
              <Metric
                label="Annual model downtime"
                value={formatMinutes(result.annualDowntimeMinutes)}
                detail="Steady-state estimate plus planned impact"
              />
              <Metric
                label="Budget remaining"
                value={
                  result.remainingBudgetMinutes >= 0
                    ? formatMinutes(result.remainingBudgetMinutes)
                    : `${formatMinutes(Math.abs(result.remainingBudgetMinutes))} over`
                }
                detail={result.remainingBudgetMinutes >= 0 ? 'Reserve after this scenario' : 'SLO is not supportable'}
                tone={result.remainingBudgetMinutes >= 0 ? 'teal' : 'rose'}
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <ProgressLane
                  label="Error-budget consumption"
                  used={result.scenarioMonthImpact}
                  available={result.sloBudgetMinutes}
                  detail={`Includes ${formatMinutes(result.plannedImpactMinutes)} planned impact and ${formatMinutes(result.scenarioEventMinutes)} from the selected challenge.`}
                />
                <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <ProgressLane
                    label="RTO: restore service"
                    used={result.recoveryDurationMinutes}
                    available={result.model.rtoTargetMinutes}
                    detail={`${formatMinutes(result.detectionMinutes)} detect + ${formatMinutes(result.failoverMinutes)} fail over + ${formatMinutes(result.restoreMinutes)} restore`}
                  />
                </div>
                <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                  <ProgressLane
                    label="RPO: committed-data exposure"
                    used={result.observedRpoMinutes}
                    available={result.model.rpoTargetMinutes}
                    detail="Modeled from replication lag under the selected scenario."
                  />
                </div>
              </div>

              <div className={`rounded-md border p-5 ${statusStyle}`} role="status">
                <div className="flex items-start gap-3">
                  {result.status === 'breach' ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-xs font-black uppercase">{selectedChallenge.label}</p>
                    <h3 className="mt-1 text-lg font-black">{result.scenarioHeadline}</h3>
                    <p className="mt-2 text-sm leading-6 opacity-90">{result.scenarioDetail}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-current/30 bg-white/50 p-3 dark:bg-neutral-950/30">
                    <p className="text-[10px] font-black uppercase opacity-70">RTO</p>
                    <p className="mt-1 text-sm font-black">{result.rtoMet ? 'Met' : 'Missed'}</p>
                  </div>
                  <div className="rounded-md border border-current/30 bg-white/50 p-3 dark:bg-neutral-950/30">
                    <p className="text-[10px] font-black uppercase opacity-70">RPO</p>
                    <p className="mt-1 text-sm font-black">{result.rpoMet ? 'Met' : 'Missed'}</p>
                  </div>
                  <div className="rounded-md border border-current/30 bg-white/50 p-3 dark:bg-neutral-950/30">
                    <p className="text-[10px] font-black uppercase opacity-70">Quorum</p>
                    <p className="mt-1 text-sm font-black">
                      {result.structureSurvives ? 'Survives' : 'Lost'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-teal-800 dark:text-teal-300">
              <Layers3 className="h-4 w-4" aria-hidden="true" />
              Architecture consequences
            </div>
            <h3 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
              What the current assumptions require
            </h3>
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {result.consequences.map((consequence, index) => (
                <li
                  key={consequence}
                  className="flex min-w-0 gap-3 rounded-md border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-neutral-900 text-xs font-black text-white dark:bg-neutral-100 dark:text-neutral-950">
                    {index + 1}
                  </span>
                  <span>{consequence}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-3 rounded-md border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
              <GaugeIcon />
              <p className="leading-6">
                <strong>Planning rule:</strong> derive MTBF, MTTR, correlation, and recovery times
                from production evidence. Confirm the model with fault injection and restore tests
                before using it for an SLO commitment.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function GaugeIcon() {
  return <Activity className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />;
}
