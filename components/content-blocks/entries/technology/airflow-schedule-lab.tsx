'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock3,
  History,
  Layers3,
  Play,
  RotateCcw,
} from 'lucide-react';

type RunSource = 'scheduler' | 'backfill';
type ReprocessPolicy = 'missing' | 'failed' | 'all';
type ExistingState = 'success' | 'failed' | 'missing';

type Interval = {
  id: string;
  day: string;
  window: string;
  state: ExistingState;
};

const intervals: Interval[] = [
  { id: 'mon', day: 'Mon', window: '01 Jul', state: 'success' },
  { id: 'tue', day: 'Tue', window: '02 Jul', state: 'missing' },
  { id: 'wed', day: 'Wed', window: '03 Jul', state: 'success' },
  { id: 'thu', day: 'Thu', window: '04 Jul', state: 'failed' },
  { id: 'fri', day: 'Fri', window: '05 Jul', state: 'missing' },
  { id: 'sat', day: 'Sat', window: '06 Jul', state: 'success' },
  { id: 'sun', day: 'Sun', window: '07 Jul', state: 'missing' },
];

const policyOptions: Array<{
  id: ReprocessPolicy;
  label: string;
  description: string;
}> = [
  {
    id: 'missing',
    label: 'Missing only',
    description: 'Create only intervals with no existing run.',
  },
  {
    id: 'failed',
    label: 'Missing + failed',
    description: 'Repair gaps and retry errored intervals.',
  },
  {
    id: 'all',
    label: 'All intervals',
    description: 'Reprocess successes too; sinks must be idempotent.',
  },
];

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
        checked
          ? 'border-sky-500 bg-sky-500'
          : 'border-neutral-300 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-700'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function AirflowIntervalPlanner() {
  const [source, setSource] = useState<RunSource>('scheduler');
  const [catchup, setCatchup] = useState(true);
  const [policy, setPolicy] = useState<ReprocessPolicy>('failed');
  const [maxActiveRuns, setMaxActiveRuns] = useState(2);

  const selectedIds = useMemo(() => {
    if (source === 'scheduler') {
      const missing = intervals.filter((interval) => interval.state === 'missing');
      return new Set((catchup ? missing : missing.slice(-1)).map((interval) => interval.id));
    }

    return new Set(
      intervals
        .filter((interval) => {
          if (policy === 'all') return true;
          if (policy === 'failed') return interval.state !== 'success';
          return interval.state === 'missing';
        })
        .map((interval) => interval.id),
    );
  }, [catchup, policy, source]);

  const selectedCount = selectedIds.size;
  const waves = selectedCount === 0 ? 0 : Math.ceil(selectedCount / maxActiveRuns);
  const taskInstances = selectedCount * 4;
  const reprocessesSuccess = source === 'backfill' && policy === 'all';

  const reset = () => {
    setSource('scheduler');
    setCatchup(true);
    setPolicy('failed');
    setMaxActiveRuns(2);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white sm:px-7 sm:py-6 dark:border-neutral-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Data interval planner
            </div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Decide which DAG runs Airflow should create
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              A daily run represents one daily data interval. Choose automatic catchup or an
              explicit backfill, then inspect the exact intervals and execution pressure.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.35fr)]">
        <div className="space-y-6 border-b border-neutral-200 p-5 sm:p-7 lg:border-b-0 lg:border-r dark:border-neutral-700">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              1. Choose who creates the runs
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1.5 dark:bg-neutral-900">
              <button
                type="button"
                aria-pressed={source === 'scheduler'}
                onClick={() => setSource('scheduler')}
                className={`rounded-md px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  source === 'scheduler'
                    ? 'bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200 dark:bg-sky-950 dark:text-sky-50 dark:ring-sky-700'
                    : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                  Scheduler
                </span>
                <span className="mt-1 block text-xs leading-5 opacity-80">React to elapsed schedules.</span>
              </button>
              <button
                type="button"
                aria-pressed={source === 'backfill'}
                onClick={() => setSource('backfill')}
                className={`rounded-md px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  source === 'backfill'
                    ? 'bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200 dark:bg-violet-950 dark:text-violet-50 dark:ring-violet-700'
                    : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                  Backfill
                </span>
                <span className="mt-1 block text-xs leading-5 opacity-80">Repair a chosen date range.</span>
              </button>
            </div>
          </fieldset>

          {source === 'scheduler' ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sky-950 dark:text-sky-50">Catch up missed intervals</h3>
                  <p className="mt-1 text-sm leading-5 text-sky-900/80 dark:text-sky-100/80">
                    {catchup
                      ? 'Create every missing scheduled run.'
                      : 'Create only the latest missing interval.'}
                  </p>
                </div>
                <Switch checked={catchup} label="Catch up missed intervals" onChange={setCatchup} />
              </div>
            </div>
          ) : (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                2. Choose reprocessing behavior
              </legend>
              <div className="mt-3 space-y-2">
                {policyOptions.map((option) => {
                  const active = policy === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPolicy(option.id)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        active
                          ? 'border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-600 dark:bg-violet-950/70 dark:text-violet-50'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-500'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? 'border-violet-600 bg-violet-600 text-white'
                            : 'border-neutral-300 text-transparent dark:border-neutral-600'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 opacity-75">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="block">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Maximum active runs
              <span className="rounded-md bg-neutral-900 px-2.5 py-1 text-sm text-white dark:bg-neutral-100 dark:text-neutral-950">
                {maxActiveRuns}
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={maxActiveRuns}
              onChange={(event) => setMaxActiveRuns(Number(event.target.value))}
              className="mt-3 w-full accent-sky-600"
            />
            <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>Protect dependencies</span>
              <span>Finish sooner</span>
            </span>
          </label>
        </div>

        <div className="min-w-0 bg-neutral-50 p-5 sm:p-7 dark:bg-neutral-900/60">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Planned run set
              </p>
              <h3 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                {selectedCount} interval{selectedCount === 1 ? '' : 's'} will run
              </h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
              <Play className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              {source === 'scheduler' ? (catchup ? 'Catchup enabled' : 'Latest only') : 'Explicit backfill'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {intervals.map((interval) => {
              const selected = selectedIds.has(interval.id);
              const selectedTone = source === 'backfill' ? 'violet' : 'sky';
              const status = selected
                ? 'Will run'
                : interval.state === 'success'
                  ? 'Keep success'
                  : interval.state === 'failed'
                    ? 'Failed exists'
                    : 'Not selected';

              return (
                <div
                  key={interval.id}
                  className={`relative min-h-28 rounded-lg border p-3 ${
                    selected
                      ? selectedTone === 'violet'
                        ? 'border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-50'
                        : 'border-sky-400 bg-sky-100 text-sky-950 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-50'
                      : interval.state === 'failed'
                        ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{interval.day}</span>
                    {selected ? (
                      <CheckCircle2 className="h-4 w-4" aria-label="Selected to run" />
                    ) : interval.state === 'failed' ? (
                      <AlertTriangle className="h-4 w-4 text-rose-500" aria-label="Existing run failed" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs opacity-70">{interval.window}</p>
                  <p className="mt-5 text-xs font-medium leading-4">{status}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric
              icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
              label="Task instances"
              value={taskInstances.toString()}
              detail="4 tasks per run"
            />
            <Metric
              icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
              label="Execution waves"
              value={waves.toString()}
              detail={`At most ${maxActiveRuns} runs together`}
            />
            <Metric
              icon={<CalendarRange className="h-4 w-4" aria-hidden="true" />}
              label="Data windows"
              value={selectedCount.toString()}
              detail="Each run owns one interval"
            />
          </div>

          <div
            className={`mt-5 flex items-start gap-3 rounded-lg border p-4 ${
              reprocessesSuccess
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
            }`}
          >
            {reprocessesSuccess ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {reprocessesSuccess ? 'This plan reprocesses successful intervals' : 'The run set matches the selected policy'}
              </p>
              <p className="mt-1 text-sm leading-5 opacity-80">
                {reprocessesSuccess
                  ? 'Use interval-scoped, idempotent writes so replaying a success does not duplicate output.'
                  : source === 'scheduler'
                    ? 'Catchup creates missing scheduled runs; it does not automatically replace an existing failed run.'
                    : 'Backfill concurrency is a workload limit, not permission to overload every downstream system.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className="text-sky-600 dark:text-sky-400">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
