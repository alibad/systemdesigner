'use client';

import {
  Activity,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock,
  Gauge,
  Info,
  RefreshCcw,
  Rocket,
  Server,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ChallengeId =
  | 'baseline'
  | 'launch-spike'
  | 'trend-break'
  | 'flash-crowd'
  | 'regional-failover'
  | 'forecast-error';

type PredictorInputs = {
  currentBaselineRps: number;
  historyWeeks: number;
  weeklyGrowthPct: number;
  observedVolatilityPct: number;
  backtestErrorPct: number;
  horizonDays: number;
  dailySeasonalityPct: number;
  weekendAdjustmentPct: number;
  plannedEventDay: number;
  plannedEventMultiplier: number;
  testedInstanceRps: number;
  provisionedInstances: number;
  reservePct: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Gauge;
};

type ForecastPoint = {
  day: number;
  expected: number;
  lower: number;
  upper: number;
  scenario: number;
};

const DEFAULT_INPUTS: PredictorInputs = {
  currentBaselineRps: 8_000,
  historyWeeks: 8,
  weeklyGrowthPct: 4,
  observedVolatilityPct: 18,
  backtestErrorPct: 14,
  horizonDays: 30,
  dailySeasonalityPct: 35,
  weekendAdjustmentPct: -20,
  plannedEventDay: 12,
  plannedEventMultiplier: 1.7,
  testedInstanceRps: 1_500,
  provisionedInstances: 12,
  reservePct: 25,
};

const LIMITS: Record<keyof PredictorInputs, { min: number; max: number }> = {
  currentBaselineRps: { min: 1, max: 100_000_000 },
  historyWeeks: { min: 2, max: 26 },
  weeklyGrowthPct: { min: -15, max: 30 },
  observedVolatilityPct: { min: 0, max: 100 },
  backtestErrorPct: { min: 0, max: 100 },
  horizonDays: { min: 7, max: 90 },
  dailySeasonalityPct: { min: 0, max: 150 },
  weekendAdjustmentPct: { min: -80, max: 200 },
  plannedEventDay: { min: 1, max: 90 },
  plannedEventMultiplier: { min: 1, max: 10 },
  testedInstanceRps: { min: 1, max: 10_000_000 },
  provisionedInstances: { min: 1, max: 100_000 },
  reservePct: { min: 0, max: 80 },
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Expected range',
    shortLabel: 'Baseline',
    description: 'Demand follows the fitted trend, weekly shape, and planned event assumptions.',
    icon: CheckCircle2,
  },
  {
    id: 'launch-spike',
    label: 'Launch spike',
    shortLabel: '2.2x event',
    description: 'A product launch lifts demand for three days around the planned event.',
    icon: Rocket,
  },
  {
    id: 'trend-break',
    label: 'Trend break',
    shortLabel: 'Growth accelerates',
    description: 'Growth accelerates after day seven, invalidating the fitted historical trend.',
    icon: TrendingUp,
  },
  {
    id: 'flash-crowd',
    label: 'Flash crowd',
    shortLabel: '4x burst',
    description: 'An unplanned one-hour burst arrives before normal provisioning can react.',
    icon: Zap,
  },
  {
    id: 'regional-failover',
    label: 'Regional failover',
    shortLabel: '33% capacity loss',
    description: 'One of three regions fails while the forecast demand continues.',
    icon: Server,
  },
  {
    id: 'forecast-error',
    label: 'Forecast error',
    shortLabel: 'Upper band realized',
    description: 'Actual demand tracks above the expected line by the observed backtest error.',
    icon: AlertTriangle,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

function safeInputs(inputs: PredictorInputs): PredictorInputs {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => {
      const limit = LIMITS[key as keyof PredictorInputs];
      return [key, clamp(Number.isFinite(value) ? value : limit.min, limit.min, limit.max)];
    }),
  ) as unknown as PredictorInputs;
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
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
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
        <span className="mt-1 block text-xs font-semibold text-rose-700 dark:text-rose-300">
          Enter {formatNumber(min, 1)} to {formatNumber(max, 1)}.
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
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="font-mono text-sm font-black text-neutral-950 dark:text-white">
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
        <p className="text-xs font-black uppercase text-blue-700 dark:text-blue-300">{eyebrow}</p>
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
  tone?: 'neutral' | 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    neutral:
      'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100',
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

function ForecastChart({
  history,
  forecast,
  capacityRps,
  expectedPeakDay,
  scenarioPeakDay,
  challengeLabel,
}: {
  history: Array<{ day: number; value: number }>;
  forecast: ForecastPoint[];
  capacityRps: number;
  expectedPeakDay: number;
  scenarioPeakDay: number;
  challengeLabel: string;
}) {
  const width = 900;
  const height = 330;
  const inset = { top: 26, right: 24, bottom: 48, left: 64 };
  const innerWidth = width - inset.left - inset.right;
  const innerHeight = height - inset.top - inset.bottom;
  const firstDay = history[0]?.day ?? -14;
  const lastDay = forecast.at(-1)?.day ?? 30;
  const maximum = Math.max(
    capacityRps,
    ...history.map((point) => point.value),
    ...forecast.map((point) => Math.max(point.upper, point.scenario)),
    1,
  ) * 1.12;
  const x = (day: number) =>
    inset.left + ((day - firstDay) / Math.max(lastDay - firstDay, 1)) * innerWidth;
  const y = (value: number) => inset.top + innerHeight - (value / maximum) * innerHeight;
  const path = (points: Array<{ day: number; value: number }>) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.day)} ${y(point.value)}`)
      .join(' ');
  const historyPath = path(history);
  const expectedPath = path(forecast.map((point) => ({ day: point.day, value: point.expected })));
  const scenarioPath = path(forecast.map((point) => ({ day: point.day, value: point.scenario })));
  const upper = forecast.map((point) => `${x(point.day)},${y(point.upper)}`).join(' ');
  const lower = [...forecast]
    .reverse()
    .map((point) => `${x(point.day)},${y(point.lower)}`)
    .join(' ');
  const expectedPeak = forecast.find((point) => point.day === expectedPeakDay) ?? forecast[0];
  const scenarioPeak = forecast.find((point) => point.day === scenarioPeakDay) ?? forecast[0];

  return (
    <div
      className="overflow-hidden"
      role="img"
      aria-label={`Load forecast for ${lastDay} days. ${challengeLabel}. Expected peak ${formatCompact(
        expectedPeak?.expected ?? 0,
      )} requests per second, scenario peak ${formatCompact(
        scenarioPeak?.scenario ?? 0,
      )}, usable capacity ${formatCompact(capacityRps)}.`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
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
        <line
          x1={x(0)}
          x2={x(0)}
          y1={inset.top}
          y2={height - inset.bottom}
          className="stroke-neutral-400 dark:stroke-neutral-600"
          strokeDasharray="3 5"
        />
        <polygon points={`${upper} ${lower}`} className="fill-blue-100/90 dark:fill-blue-950/80" />
        <path
          d={historyPath}
          fill="none"
          className="stroke-neutral-500 dark:stroke-neutral-400"
          strokeWidth="3"
        />
        <path
          d={expectedPath}
          fill="none"
          className="stroke-blue-600 dark:stroke-blue-400"
          strokeWidth="4"
        />
        <path
          d={scenarioPath}
          fill="none"
          className="stroke-rose-600 dark:stroke-rose-400"
          strokeDasharray="8 6"
          strokeWidth="3"
        />
        <line
          x1={x(0)}
          x2={width - inset.right}
          y1={y(capacityRps)}
          y2={y(capacityRps)}
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeDasharray="12 5"
          strokeWidth="3"
        />
        {expectedPeak ? (
          <circle
            cx={x(expectedPeak.day)}
            cy={y(expectedPeak.expected)}
            r="5"
            className="fill-white stroke-blue-600 dark:fill-neutral-950 dark:stroke-blue-400"
            strokeWidth="3"
          />
        ) : null}
        {scenarioPeak ? (
          <circle
            cx={x(scenarioPeak.day)}
            cy={y(scenarioPeak.scenario)}
            r="6"
            className="fill-white stroke-rose-600 dark:fill-neutral-950 dark:stroke-rose-400"
            strokeWidth="3"
          />
        ) : null}
        <text
          x={inset.left}
          y={height - 15}
          className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
        >
          History
        </text>
        <text
          x={x(0)}
          y={height - 15}
          textAnchor="middle"
          className="fill-neutral-600 text-[11px] font-bold dark:fill-neutral-300"
        >
          Now
        </text>
        <text
          x={width - inset.right}
          y={height - 15}
          textAnchor="end"
          className="fill-neutral-500 text-[11px] dark:fill-neutral-400"
        >
          Day {lastDay}
        </text>
      </svg>
    </div>
  );
}

export default function LoadPredictorTool() {
  const [inputs, setInputs] = useState<PredictorInputs>(DEFAULT_INPUTS);
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');

  const updateInput = <K extends keyof PredictorInputs>(key: K, value: PredictorInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const commitInput = <K extends keyof PredictorInputs>(key: K) => {
    const limit = LIMITS[key];
    setInputs((current) => ({
      ...current,
      [key]: clamp(Number.isFinite(current[key]) ? current[key] : limit.min, limit.min, limit.max),
    }));
  };

  const result = useMemo(() => {
    const model = safeInputs(inputs);
    const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];
    const historyDays = model.historyWeeks * 7;
    const weeklyFactor = 1 + model.weeklyGrowthPct / 100;
    const dailyGrowthFactor = Math.pow(Math.max(weeklyFactor, 0.01), 1 / 7);
    const cycleFactor = (day: number) => {
      const weekday = ((day % 7) + 7) % 7;
      const weekendFactor = weekday === 5 || weekday === 6 ? 1 + model.weekendAdjustmentPct / 100 : 1;
      const weeklyWave =
        1 + (model.dailySeasonalityPct / 100) * 0.45 * Math.sin(((weekday - 1) / 7) * Math.PI * 2);
      return Math.max(0.05, weekendFactor * weeklyWave);
    };
    const deterministicNoise = (day: number) =>
      1 +
      (model.observedVolatilityPct / 100) *
        0.42 *
        (Math.sin(day * 1.73) * 0.65 + Math.cos(day * 0.61) * 0.35);
    const history = Array.from({ length: historyDays + 1 }, (_, index) => {
      const day = index - historyDays;
      const trend = model.currentBaselineRps * Math.pow(dailyGrowthFactor, day);
      return {
        day,
        value: Math.max(1, trend * cycleFactor(day) * deterministicNoise(day)),
      };
    });
    const uncertaintyAt = (day: number) => {
      const horizonDrift = (day / Math.max(model.horizonDays, 1)) * Math.abs(model.weeklyGrowthPct) * 0.45;
      return clamp(
        model.backtestErrorPct + model.observedVolatilityPct * 0.25 + horizonDrift,
        2,
        95,
      );
    };
    const forecast = Array.from({ length: model.horizonDays + 1 }, (_, day): ForecastPoint => {
      const trend = model.currentBaselineRps * Math.pow(dailyGrowthFactor, day);
      const plannedEventDistance = Math.abs(day - Math.min(model.plannedEventDay, model.horizonDays));
      const eventFactor =
        plannedEventDistance === 0
          ? model.plannedEventMultiplier
          : plannedEventDistance === 1
            ? 1 + (model.plannedEventMultiplier - 1) * 0.35
            : 1;
      const expected = Math.max(1, trend * cycleFactor(day) * eventFactor);
      const uncertaintyPct = uncertaintyAt(day);
      let scenarioFactor = 1;

      if (challenge.id === 'launch-spike') {
        scenarioFactor =
          plannedEventDistance === 0 ? 2.2 : plannedEventDistance <= 1 ? 1.65 : 1;
      } else if (challenge.id === 'trend-break') {
        scenarioFactor = day <= 7 ? 1 : Math.pow(1.055, (day - 7) / 7);
      } else if (challenge.id === 'flash-crowd') {
        scenarioFactor = day === Math.max(2, Math.min(5, model.horizonDays)) ? 4 : 1;
      } else if (challenge.id === 'forecast-error') {
        scenarioFactor = 1 + Math.max(model.backtestErrorPct, uncertaintyPct * 0.7) / 100;
      }

      return {
        day,
        expected,
        lower: expected * Math.max(0.05, 1 - uncertaintyPct / 100),
        upper: expected * (1 + uncertaintyPct / 100),
        scenario: expected * scenarioFactor,
      };
    });
    const rawCapacityRps = model.testedInstanceRps * model.provisionedInstances;
    const reserveAdjustedCapacityRps = rawCapacityRps * (1 - model.reservePct / 100);
    const survivingCapacityFactor = challenge.id === 'regional-failover' ? 2 / 3 : 1;
    const capacityRps = reserveAdjustedCapacityRps * survivingCapacityFactor;
    const expectedPeakPoint = forecast.reduce(
      (peak, point) => (point.expected > peak.expected ? point : peak),
      forecast[0],
    );
    const scenarioPeakPoint = forecast.reduce(
      (peak, point) => (point.scenario > peak.scenario ? point : peak),
      forecast[0],
    );
    const expectedPeak = expectedPeakPoint?.expected ?? 0;
    const scenarioPeak = scenarioPeakPoint?.scenario ?? 0;
    const headroomRps = capacityRps - scenarioPeak;
    const headroomPct = scenarioPeak > 0 ? (headroomRps / scenarioPeak) * 100 : 0;
    const saturationPoint = forecast.find((point) => point.scenario > capacityRps);
    const peakShortfallRps = Math.max(0, scenarioPeak - capacityRps);
    const burstMinutes = challenge.id === 'flash-crowd' ? 60 : 15;
    const requestsAtRisk = peakShortfallRps * burstMinutes * 60;
    const targetPerInstanceRps = model.testedInstanceRps * (1 - model.reservePct / 100);
    const requiredInstances = Math.max(1, Math.ceil(scenarioPeak / Math.max(targetPerInstanceRps, 1)));
    const bandAtHorizon = uncertaintyAt(model.horizonDays);
    const confidenceLabel = bandAtHorizon <= 20 ? 'Narrow' : bandAtHorizon <= 40 ? 'Moderate' : 'Wide';

    return {
      model,
      challenge,
      history,
      forecast,
      capacityRps,
      rawCapacityRps,
      expectedPeak,
      expectedPeakDay: expectedPeakPoint?.day ?? 0,
      scenarioPeak,
      scenarioPeakDay: scenarioPeakPoint?.day ?? 0,
      headroomRps,
      headroomPct,
      saturationDay: saturationPoint?.day,
      peakShortfallRps,
      requestsAtRisk,
      burstMinutes,
      requiredInstances,
      bandAtHorizon,
      confidenceLabel,
      healthy: headroomRps >= 0,
    };
  }, [challengeId, inputs]);

  const capacityShare = clamp((result.capacityRps / Math.max(result.scenarioPeak, result.capacityRps, 1)) * 100, 0, 100);
  const demandShare = clamp((result.scenarioPeak / Math.max(result.scenarioPeak, result.capacityRps, 1)) * 100, 0, 100);

  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-200 bg-neutral-950 px-4 py-5 text-white dark:border-neutral-800 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-black uppercase text-blue-300">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Demand forecast workbench
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Predict the load, then challenge the plan</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Fit a transparent trend to recent traffic, shape the next peak, and test whether usable
              capacity survives uncertainty and abrupt demand changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputs(DEFAULT_INPUTS);
              setChallengeId('baseline');
            }}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-bold text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid min-w-0 xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-neutral-50/70 xl:border-b-0 xl:border-r dark:border-neutral-800 dark:bg-neutral-950">
          <section className="border-b border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
            <SectionHeading
              icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
              eyebrow="Loop 1"
              title="Fit the historical signal"
              detail="The baseline, trend, volatility, and backtest error move the centerline and planning band."
            />
            <div className="mt-5 grid grid-cols-2 gap-4">
              <NumberField
                label="Current baseline"
                value={inputs.currentBaselineRps}
                onChange={(value) => updateInput('currentBaselineRps', value)}
                onCommit={() => commitInput('currentBaselineRps')}
                min={LIMITS.currentBaselineRps.min}
                max={LIMITS.currentBaselineRps.max}
                unit="RPS"
              />
              <NumberField
                label="History window"
                value={inputs.historyWeeks}
                onChange={(value) => updateInput('historyWeeks', value)}
                onCommit={() => commitInput('historyWeeks')}
                min={LIMITS.historyWeeks.min}
                max={LIMITS.historyWeeks.max}
                unit="weeks"
              />
            </div>
            <div className="mt-5 space-y-5">
              <RangeControl
                label="Observed weekly trend"
                value={inputs.weeklyGrowthPct}
                onChange={(value) => updateInput('weeklyGrowthPct', value)}
                min={LIMITS.weeklyGrowthPct.min}
                max={LIMITS.weeklyGrowthPct.max}
                suffix="%"
                hint="A fitted teaching trend, not a production statistical estimate."
              />
              <RangeControl
                label="Observed volatility"
                value={inputs.observedVolatilityPct}
                onChange={(value) => updateInput('observedVolatilityPct', value)}
                min={LIMITS.observedVolatilityPct.min}
                max={LIMITS.observedVolatilityPct.max}
                suffix="%"
                hint="Controls visible variation in the historical signal."
              />
              <RangeControl
                label="Backtest error"
                value={inputs.backtestErrorPct}
                onChange={(value) => updateInput('backtestErrorPct', value)}
                min={LIMITS.backtestErrorPct.min}
                max={LIMITS.backtestErrorPct.max}
                suffix="%"
                hint="Use an error measured on held-out history when operating a real forecast."
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
            <SectionHeading
              icon={<CalendarRange className="h-5 w-5" aria-hidden="true" />}
              eyebrow="Loop 2"
              title="Shape seasonality and events"
              detail="Change when and how demand peaks without changing the fitted historical baseline."
            />
            <div className="mt-5 space-y-5">
              <RangeControl
                label="Forecast horizon"
                value={inputs.horizonDays}
                onChange={(value) => {
                  updateInput('horizonDays', value);
                  if (inputs.plannedEventDay > value) {
                    updateInput('plannedEventDay', value);
                  }
                }}
                min={LIMITS.horizonDays.min}
                max={LIMITS.horizonDays.max}
                suffix=" days"
                hint="Longer horizons widen the heuristic planning band."
              />
              <RangeControl
                label="Weekly seasonality"
                value={inputs.dailySeasonalityPct}
                onChange={(value) => updateInput('dailySeasonalityPct', value)}
                min={LIMITS.dailySeasonalityPct.min}
                max={LIMITS.dailySeasonalityPct.max}
                suffix="%"
                hint="Adds a repeating weekday demand wave."
              />
              <RangeControl
                label="Weekend adjustment"
                value={inputs.weekendAdjustmentPct}
                onChange={(value) => updateInput('weekendAdjustmentPct', value)}
                min={LIMITS.weekendAdjustmentPct.min}
                max={LIMITS.weekendAdjustmentPct.max}
                suffix="%"
                hint="Use negative values for business traffic and positive values for consumer peaks."
              />
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Planned event"
                  value={inputs.plannedEventDay}
                  onChange={(value) => updateInput('plannedEventDay', value)}
                  onCommit={() => {
                    setInputs((current) => ({
                      ...current,
                      plannedEventDay: clamp(
                        Number.isFinite(current.plannedEventDay) ? current.plannedEventDay : 1,
                        1,
                        Math.max(1, safeInputs(current).horizonDays),
                      ),
                    }));
                  }}
                  min={1}
                  max={Math.max(1, safeInputs(inputs).horizonDays)}
                  unit="day"
                />
                <NumberField
                  label="Event lift"
                  value={inputs.plannedEventMultiplier}
                  onChange={(value) => updateInput('plannedEventMultiplier', value)}
                  onCommit={() => commitInput('plannedEventMultiplier')}
                  min={LIMITS.plannedEventMultiplier.min}
                  max={LIMITS.plannedEventMultiplier.max}
                  step={0.1}
                  unit="multiplier"
                />
              </div>
            </div>
          </section>

          <section className="p-4 sm:p-5">
            <SectionHeading
              icon={<Server className="h-5 w-5" aria-hidden="true" />}
              eyebrow="Capacity loop"
              title="Set the serving envelope"
              detail="Measured instance throughput, fleet size, and reserve determine the green capacity line."
            />
            <div className="mt-5 grid grid-cols-2 gap-4">
              <NumberField
                label="Tested throughput"
                value={inputs.testedInstanceRps}
                onChange={(value) => updateInput('testedInstanceRps', value)}
                onCommit={() => commitInput('testedInstanceRps')}
                min={LIMITS.testedInstanceRps.min}
                max={LIMITS.testedInstanceRps.max}
                unit="RPS / instance"
              />
              <NumberField
                label="Live instances"
                value={inputs.provisionedInstances}
                onChange={(value) => updateInput('provisionedInstances', value)}
                onCommit={() => commitInput('provisionedInstances')}
                min={LIMITS.provisionedInstances.min}
                max={LIMITS.provisionedInstances.max}
                unit="instances"
              />
            </div>
            <div className="mt-5">
              <RangeControl
                label="Capacity reserve"
                value={inputs.reservePct}
                onChange={(value) => updateInput('reservePct', value)}
                min={LIMITS.reservePct.min}
                max={LIMITS.reservePct.max}
                suffix="%"
                hint="Reserved capacity is excluded from the usable serving line."
              />
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          <section className="border-b border-neutral-200 p-4 sm:p-6 dark:border-neutral-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <SectionHeading
                icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
                eyebrow="Forecast"
                title={`${result.challenge.label}: demand versus usable capacity`}
                detail={result.challenge.description}
              />
              <div
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-md border px-3 py-2 text-sm font-black ${
                  result.healthy
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100'
                    : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-100'
                }`}
              >
                {result.healthy ? (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                )}
                {result.healthy ? 'Capacity holds' : 'Capacity breached'}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric
                label="Expected peak"
                value={`${formatCompact(result.expectedPeak)} RPS`}
                detail={`Day ${result.expectedPeakDay} on the centerline`}
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                tone="blue"
              />
              <Metric
                label="Scenario peak"
                value={`${formatCompact(result.scenarioPeak)} RPS`}
                detail={`Day ${result.scenarioPeakDay} under ${result.challenge.shortLabel.toLowerCase()}`}
                icon={<Zap className="h-4 w-4" aria-hidden="true" />}
                tone={challengeId === 'baseline' ? 'neutral' : 'amber'}
              />
              <Metric
                label="Usable capacity"
                value={`${formatCompact(result.capacityRps)} RPS`}
                detail={`${formatCompact(result.rawCapacityRps)} raw before reserve and failures`}
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                tone={result.healthy ? 'emerald' : 'rose'}
              />
              <Metric
                label="Peak headroom"
                value={`${result.headroomRps >= 0 ? '+' : ''}${formatCompact(result.headroomRps)} RPS`}
                detail={`${formatNumber(result.headroomPct, 0)}% relative to scenario demand`}
                icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                tone={result.healthy ? 'emerald' : 'rose'}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-5 bg-neutral-500" aria-hidden="true" />
                  Observed history
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-5 bg-blue-600 dark:bg-blue-400" aria-hidden="true" />
                  Expected baseline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-5 bg-blue-100 dark:bg-blue-950" aria-hidden="true" />
                  Heuristic uncertainty
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-5 border-t-2 border-dashed border-rose-600 dark:border-rose-400" aria-hidden="true" />
                  Challenge demand
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-5 border-t-2 border-dashed border-emerald-600 dark:border-emerald-400" aria-hidden="true" />
                  Usable capacity
                </span>
              </div>
              <ForecastChart
                history={result.history}
                forecast={result.forecast}
                capacityRps={result.capacityRps}
                expectedPeakDay={result.expectedPeakDay}
                scenarioPeakDay={result.scenarioPeakDay}
                challengeLabel={result.challenge.label}
              />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                This teaching model compounds a transparent trend and weekly shape. The +/-
                {formatNumber(result.bandAtHorizon, 0)}% band combines backtest error, observed
                volatility, and horizon drift. It is a {result.confidenceLabel.toLowerCase()} planning
                band, not a statistical confidence interval or production forecast.
              </p>
            </div>
          </section>

          <section className="border-b border-neutral-200 p-4 sm:p-6 dark:border-neutral-800">
            <SectionHeading
              icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
              eyebrow="Challenge mode"
              title="Break the healthy forecast"
              detail="Each scenario changes demand or surviving capacity. The chart and consequences update together."
            />
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
              {CHALLENGES.map((challenge) => {
                const Icon = challenge.icon;
                const selected = challenge.id === challengeId;
                return (
                  <button
                    key={challenge.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChallengeId(challenge.id)}
                    className={`min-h-20 rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-blue-400 hover:bg-blue-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-blue-600 dark:hover:bg-blue-950/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-black">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {challenge.label}
                    </span>
                    <span className={`mt-1 block text-xs leading-5 ${selected ? 'opacity-80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {challenge.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid min-w-0 gap-0 lg:grid-cols-2">
            <div className="min-w-0 border-b border-neutral-200 p-4 sm:p-6 lg:border-b-0 lg:border-r dark:border-neutral-800">
              <SectionHeading
                icon={<Activity className="h-5 w-5" aria-hidden="true" />}
                eyebrow="Consequence"
                title={result.healthy ? 'Reserve absorbs the scenario' : 'Demand escapes the serving envelope'}
                detail={
                  result.healthy
                    ? 'Capacity remains above the scenario peak, but the remaining reserve still determines response safety.'
                    : 'The model now exposes the request shortfall instead of hiding overload behind a peak estimate.'
                }
              />
              <div className="mt-5">
                <div className="flex items-end justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
                  <span>Scenario demand</span>
                  <span>{formatCompact(result.scenarioPeak)} RPS</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900">
                  <div
                    className={`h-full transition-[width] duration-300 ${result.healthy ? 'bg-blue-600 dark:bg-blue-400' : 'bg-rose-600 dark:bg-rose-400'}`}
                    style={{ width: `${demandShare}%` }}
                  />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
                  <span>Usable capacity</span>
                  <span>{formatCompact(result.capacityRps)} RPS</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900">
                  <div
                    className="h-full bg-emerald-600 transition-[width] duration-300 dark:bg-emerald-400"
                    style={{ width: `${capacityShare}%` }}
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Metric
                  label="Peak shortfall"
                  value={`${formatCompact(result.peakShortfallRps)} RPS`}
                  detail={result.healthy ? 'No modeled miss at peak' : 'Requests above usable capacity'}
                  icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                  tone={result.healthy ? 'neutral' : 'rose'}
                />
                <Metric
                  label="Requests at risk"
                  value={formatCompact(result.requestsAtRisk)}
                  detail={`${result.burstMinutes}-minute peak exposure`}
                  icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                  tone={result.healthy ? 'neutral' : 'rose'}
                />
              </div>
            </div>

            <div className="min-w-0 p-4 sm:p-6">
              <SectionHeading
                icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
                eyebrow="Decision"
                title="Translate the forecast into an operating action"
                detail="The useful output is a trigger and response, not a precise-looking point estimate."
              />
              <dl className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-neutral-600 dark:text-neutral-400">First saturation</dt>
                  <dd className="text-right font-black text-neutral-950 dark:text-white">
                    {result.saturationDay === undefined ? 'Not in horizon' : `Day ${result.saturationDay}`}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-neutral-600 dark:text-neutral-400">Instances required</dt>
                  <dd className="text-right font-black text-neutral-950 dark:text-white">
                    {formatNumber(result.requiredInstances)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-neutral-600 dark:text-neutral-400">Current provision</dt>
                  <dd className="text-right font-black text-neutral-950 dark:text-white">
                    {formatNumber(result.model.provisionedInstances)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-neutral-600 dark:text-neutral-400">Planning band</dt>
                  <dd className="text-right font-black text-neutral-950 dark:text-white">
                    +/-{formatNumber(result.bandAtHorizon, 0)}% ({result.confidenceLabel.toLowerCase()})
                  </dd>
                </div>
              </dl>
              <div
                className={`mt-5 border-l-4 px-4 py-3 text-sm leading-6 ${
                  result.healthy
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100'
                    : 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/60 dark:text-rose-100'
                }`}
              >
                {result.healthy ? (
                  <p>
                    Keep the current fleet, but alert before demand consumes the remaining{' '}
                    {formatCompact(result.headroomRps)} RPS. Refit the trend when measured error leaves
                    the displayed band.
                  </p>
                ) : (
                  <p>
                    Add at least{' '}
                    {formatNumber(Math.max(0, result.requiredInstances - result.model.provisionedInstances))}{' '}
                    instances or reduce peak work before this scenario. Trigger scaling before day{' '}
                    {result.saturationDay ?? result.scenarioPeakDay}, with enough lead time for instances
                    to become healthy.
                  </p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
