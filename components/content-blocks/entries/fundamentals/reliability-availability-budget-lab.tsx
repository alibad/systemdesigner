'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock3,
  DollarSign,
  Gauge,
  RotateCcw,
  TimerReset,
} from 'lucide-react';

const TARGETS = [99, 99.9, 99.99, 99.999] as const;
const WINDOWS = [7, 30, 90, 365] as const;
const REVENUE_RATES = [1000, 10000, 100000] as const;

function formatDuration(minutes: number) {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)} hr`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: value >= 100000 ? 'compact' : 'standard',
  }).format(value);
}

function SegmentedControl<T extends number>({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 sm:grid-cols-4 dark:bg-neutral-900">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`min-h-10 rounded-md border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selected
                  ? 'border-blue-500 bg-blue-600 text-white shadow-sm dark:border-blue-400 dark:bg-blue-400 dark:text-blue-950'
                  : 'border-transparent bg-transparent text-neutral-600 hover:border-neutral-300 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white'
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

export default function ReliabilityAvailabilityBudgetLab() {
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(99.9);
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30);
  const [incidents, setIncidents] = useState(2);
  const [recoveryMinutes, setRecoveryMinutes] = useState(20);
  const [revenuePerHour, setRevenuePerHour] = useState<(typeof REVENUE_RATES)[number]>(10000);

  const result = useMemo(() => {
    const windowMinutes = windowDays * 24 * 60;
    const allowedMinutes = windowMinutes * (1 - target / 100);
    const projectedDowntime = incidents * recoveryMinutes;
    const remainingMinutes = allowedMinutes - projectedDowntime;
    const consumedPercent = allowedMinutes === 0 ? 100 : (projectedDowntime / allowedMinutes) * 100;
    const projectedAvailability = ((windowMinutes - Math.min(projectedDowntime, windowMinutes)) / windowMinutes) * 100;
    const revenueExposure = (projectedDowntime / 60) * revenuePerHour;
    return {
      allowedMinutes,
      projectedDowntime,
      remainingMinutes,
      consumedPercent,
      projectedAvailability,
      revenueExposure,
      healthy: remainingMinutes >= 0,
    };
  }, [incidents, recoveryMinutes, revenuePerHour, target, windowDays]);

  const reset = () => {
    setTarget(99.9);
    setWindowDays(30);
    setIncidents(2);
    setRecoveryMinutes(20);
    setRevenuePerHour(10000);
  };

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg shadow-neutral-950/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/30">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Calculator aria-hidden="true" className="h-4 w-4" />
              Availability budget lab
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">Turn a target into an incident budget</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Set the promise, then test whether incident frequency and recovery speed fit inside it.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6 border-b border-neutral-200 p-5 md:p-6 lg:border-b-0 lg:border-r dark:border-neutral-800">
          <SegmentedControl
            label="Availability target"
            value={target}
            options={TARGETS}
            format={(option) => `${option}%`}
            onChange={setTarget}
          />

          <SegmentedControl
            label="Evaluation window"
            value={windowDays}
            options={WINDOWS}
            format={(option) => (option === 365 ? '1 year' : `${option} days`)}
            onChange={setWindowDays}
          />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-white">
                Incidents in window
                <output className="rounded-md bg-white px-2 py-1 font-mono text-blue-700 shadow-sm dark:bg-neutral-800 dark:text-blue-300">
                  {incidents}
                </output>
              </span>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={incidents}
                onChange={(event) => setIncidents(Number(event.target.value))}
                className="mt-4 w-full accent-blue-600"
              />
              <span className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>None</span>
                <span>12 incidents</span>
              </span>
            </label>

            <label className="block rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-white">
                Recovery per incident
                <output className="rounded-md bg-white px-2 py-1 font-mono text-violet-700 shadow-sm dark:bg-neutral-800 dark:text-violet-300">
                  {recoveryMinutes}m
                </output>
              </span>
              <input
                type="range"
                min="1"
                max="180"
                step="1"
                value={recoveryMinutes}
                onChange={(event) => setRecoveryMinutes(Number(event.target.value))}
                className="mt-4 w-full accent-violet-600"
              />
              <span className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>1 minute</span>
                <span>3 hours</span>
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Revenue while unavailable</legend>
            <div className="grid grid-cols-3 gap-2">
              {REVENUE_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={revenuePerHour === rate}
                  onClick={() => setRevenuePerHour(rate)}
                  className={`min-h-11 rounded-md border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    revenuePerHour === rate
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {formatMoney(rate)}/hr
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 bg-neutral-50 p-5 md:p-6 dark:bg-neutral-900/60">
          <div
            className={`rounded-lg border p-5 ${
              result.healthy
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div
                  className={`flex items-center gap-2 text-xs font-bold uppercase ${
                    result.healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {result.healthy ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
                  {result.healthy ? 'Within the target' : 'Budget exhausted'}
                </div>
                <p className="mt-2 text-3xl font-bold text-neutral-950 dark:text-white">
                  {result.projectedAvailability.toFixed(target >= 99.99 ? 4 : 3)}%
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Projected availability for this window</p>
              </div>
              <div className="rounded-md border border-black/10 bg-white/70 px-3 py-2 text-left sm:text-right dark:border-white/10 dark:bg-black/20">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Budget remaining</p>
                <p className={`mt-1 font-mono text-lg font-bold ${result.healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {result.healthy ? formatDuration(result.remainingMinutes) : `-${formatDuration(Math.abs(result.remainingMinutes))}`}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-4 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                <span>Error budget consumed</span>
                <span>{Math.round(result.consumedPercent)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
                <div
                  className={`h-full rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                    result.healthy ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(result.consumedPercent, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>0 minutes used</span>
                <span>{formatDuration(result.allowedMinutes)} allowed</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Allowed downtime', value: formatDuration(result.allowedMinutes), icon: Gauge, tone: 'text-blue-700 dark:text-blue-300' },
              { label: 'Projected downtime', value: formatDuration(result.projectedDowntime), icon: TimerReset, tone: 'text-violet-700 dark:text-violet-300' },
              { label: 'Revenue exposure', value: formatMoney(result.revenueExposure), icon: DollarSign, tone: 'text-amber-700 dark:text-amber-300' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <metric.icon aria-hidden="true" className={`h-5 w-5 ${metric.tone}`} />
                <p className="mt-3 break-words text-lg font-bold text-neutral-950 dark:text-white">{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" />
            <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              <strong className="text-neutral-950 dark:text-white">The operational lever:</strong>{' '}
              {incidents === 0
                ? 'No incident time is projected, so the full budget remains available.'
                : result.healthy
                  ? `At ${incidents} incident${incidents === 1 ? '' : 's'}, recovery must stay below ${formatDuration(result.allowedMinutes / incidents)} per incident to hold this target.`
                  : `At ${incidents} incident${incidents === 1 ? '' : 's'}, recovery must fall below ${formatDuration(result.allowedMinutes / incidents)} per incident, or incident frequency must decrease.`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
