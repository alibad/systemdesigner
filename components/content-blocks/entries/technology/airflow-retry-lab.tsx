'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  KeyRound,
  Network,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

type FailureKind = 'transient' | 'credential' | 'partial';

const failures: Array<{
  id: FailureKind;
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Network;
}> = [
  {
    id: 'transient',
    label: 'Temporary outage',
    eyebrow: 'Retryable',
    description: 'The warehouse is unavailable once, then recovers.',
    icon: Network,
  },
  {
    id: 'credential',
    label: 'Invalid credential',
    eyebrow: 'Permanent',
    description: 'Every attempt receives the same authentication failure.',
    icon: KeyRound,
  },
  {
    id: 'partial',
    label: 'Response lost after commit',
    eyebrow: 'Ambiguous',
    description: 'The write succeeds, but the task never receives confirmation.',
    icon: Database,
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
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
        checked
          ? 'border-emerald-500 bg-emerald-500'
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

export default function AirflowRetryLab() {
  const [failure, setFailure] = useState<FailureKind>('partial');
  const [retries, setRetries] = useState(2);
  const [exponentialBackoff, setExponentialBackoff] = useState(true);
  const [idempotentWrite, setIdempotentWrite] = useState(false);

  const result = useMemo(() => {
    const maximumAttempts = retries + 1;

    if (failure === 'credential') {
      const attempts = maximumAttempts;
      const delay = retryDelay(attempts - 1, exponentialBackoff);
      return {
        success: false,
        attempts,
        delay,
        writes: 0,
        title: 'The DAG run fails after exhausting retries',
        explanation:
          'Authentication errors are deterministic. More retries delay the alert and consume worker capacity without changing the outcome.',
        risk: retries > 0 ? 'Retries amplify a permanent failure.' : 'Fail fast and repair the credential.',
      };
    }

    if (failure === 'transient') {
      const success = retries >= 1;
      const attempts = success ? 2 : 1;
      return {
        success,
        attempts,
        delay: success ? retryDelay(1, exponentialBackoff) : 0,
        writes: success ? 1 : 0,
        title: success ? 'The retry recovers the task' : 'The task fails before the dependency recovers',
        explanation: success
          ? 'A bounded retry is useful because the next attempt sees a healthy warehouse.'
          : 'With no retry budget, the transient outage blocks every downstream task in this run.',
        risk: success ? 'Bound the retry window to the pipeline deadline.' : 'No recovery attempt is available.',
      };
    }

    const success = retries >= 1;
    const attempts = success ? 2 : 1;
    const writes = success ? (idempotentWrite ? 1 : 2) : 1;
    return {
      success,
      attempts,
      delay: success ? retryDelay(1, exponentialBackoff) : 0,
      writes,
      title: success
        ? idempotentWrite
          ? 'The retry completes without duplicating output'
          : 'The DAG succeeds, but the sink receives two writes'
        : 'The run fails after an unconfirmed write',
      explanation: success
        ? idempotentWrite
          ? 'The retry uses the same interval-scoped key, so the target recognizes the operation that already committed.'
          : 'Airflow can retry the task, but it cannot infer whether the first external side effect happened.'
        : 'A successful external commit and a failed task state can coexist when the response is lost.',
      risk: idempotentWrite
        ? 'The write contract makes replay safe.'
        : 'A retry policy cannot guarantee exactly-once side effects.',
    };
  }, [exponentialBackoff, failure, idempotentWrite, retries]);

  const selectedFailure = failures.find((item) => item.id === failure) ?? failures[0];
  const unsafeDuplicate = failure === 'partial' && result.writes > 1;
  const outcomeTone = result.success
    ? unsafeDuplicate
      ? 'amber'
      : 'emerald'
    : 'rose';

  const reset = () => {
    setFailure('partial');
    setRetries(2);
    setExponentialBackoff(true);
    setIdempotentWrite(false);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white sm:px-7 sm:py-6 dark:border-neutral-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Failure and retry lab
            </div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Test whether a retry actually makes the workflow safer
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Inject a failure into the load task. Change its retry contract and watch task
              state, recovery delay, and external side effects diverge.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.72fr)]">
        <div className="space-y-6 border-b border-neutral-200 p-5 sm:p-7 xl:border-b-0 xl:border-r dark:border-neutral-700">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              1. Inject a load-task failure
            </legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {failures.map((item) => {
                const active = failure === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFailure(item.id)}
                    className={`min-h-40 rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-50'
                        : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-200 dark:ring-neutral-700">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          Injected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide opacity-65">{item.eyebrow}</p>
                    <h3 className="mt-1 text-sm font-semibold">{item.label}</h3>
                    <p className="mt-2 text-xs leading-5 opacity-75">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Retry budget
                <span className="rounded-md bg-neutral-900 px-2.5 py-1 text-sm text-white dark:bg-neutral-100 dark:text-neutral-950">
                  {retries} {retries === 1 ? 'retry' : 'retries'}
                </span>
              </span>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={retries}
                onChange={(event) => setRetries(Number(event.target.value))}
                className="mt-4 w-full accent-emerald-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Fail immediately</span>
                <span>More attempts</span>
              </span>
            </label>

            <div className="space-y-3">
              <ControlRow
                label="Exponential backoff"
                description="Spread retries instead of hammering the dependency."
              >
                <Switch
                  checked={exponentialBackoff}
                  label="Use exponential backoff"
                  onChange={setExponentialBackoff}
                />
              </ControlRow>
              <ControlRow
                label="Idempotent target write"
                description="Reuse an interval-scoped operation key."
              >
                <Switch
                  checked={idempotentWrite}
                  label="Use an idempotent target write"
                  onChange={setIdempotentWrite}
                />
              </ControlRow>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Attempt trace
                </p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {selectedFailure.label}
                </h3>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {result.attempts} of {retries + 1} possible attempts used
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: result.attempts }, (_, index) => {
                const attempt = index + 1;
                const final = attempt === result.attempts;
                const succeeded = final && result.success;
                const wrote = failure === 'partial' || succeeded;
                return (
                  <div
                    key={attempt}
                    className={`rounded-lg border p-3 ${
                      succeeded
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/45'
                        : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-950 dark:text-white">Attempt {attempt}</span>
                      {succeeded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Succeeded" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-label="Failed" />
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {attemptDescription(failure, attempt, succeeded, idempotentWrite)}
                    </p>
                    <span className="mt-3 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-200 dark:ring-neutral-700">
                      {wrote ? (idempotentWrite && attempt > 1 ? 'Write deduplicated' : 'External write observed') : 'No external write'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <TaskPath success={result.success} />
        </div>

        <aside className="bg-neutral-50 p-5 sm:p-7 dark:bg-neutral-900/60">
          <div
            className={`rounded-lg border p-5 ${
              outcomeTone === 'emerald'
                ? 'border-emerald-400 bg-emerald-950 text-emerald-50'
                : outcomeTone === 'amber'
                  ? 'border-amber-400 bg-amber-950 text-amber-50'
                  : 'border-rose-400 bg-rose-950 text-rose-50'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              {outcomeTone === 'emerald' ? (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              ) : outcomeTone === 'amber' ? (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertOctagon className="h-4 w-4" aria-hidden="true" />
              )}
              Observed outcome
            </div>
            <h3 className="mt-4 text-2xl font-semibold leading-tight">{result.title}</h3>
            <p className="mt-3 text-sm leading-6 opacity-85">{result.explanation}</p>
          </div>

          <div className="mt-5 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white px-4 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-950">
            <ResultRow label="Task attempts" value={result.attempts.toString()} />
            <ResultRow label="Backoff delay" value={`${result.delay} min`} />
            <ResultRow label="External writes" value={result.writes.toString()} />
            <ResultRow label="DAG run" value={result.success ? 'Can complete' : 'Failed'} />
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Design conclusion
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{result.risk}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Retry transient failures, fail fast on deterministic ones, and make externally visible writes replay-safe.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function retryDelay(retriesUsed: number, exponential: boolean) {
  if (retriesUsed <= 0) return 0;
  if (!exponential) return retriesUsed * 5;
  return Array.from({ length: retriesUsed }, (_, index) => 5 * 2 ** index).reduce(
    (total, delay) => total + delay,
    0,
  );
}

function attemptDescription(
  failure: FailureKind,
  attempt: number,
  succeeded: boolean,
  idempotent: boolean,
) {
  if (failure === 'credential') return 'Authentication is rejected again; time cannot repair the secret.';
  if (failure === 'transient') {
    return succeeded ? 'The dependency has recovered and accepts the write.' : 'The dependency is temporarily unavailable.';
  }
  if (attempt === 1) return 'The target commits, but its acknowledgement never reaches the task.';
  return idempotent
    ? 'The target recognizes the operation key and returns the existing result.'
    : 'The task repeats a write whose first commit was hidden from Airflow.';
}

function ControlRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div>
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="font-semibold text-neutral-950 dark:text-white">{value}</span>
    </div>
  );
}

function TaskPath({ success }: { success: boolean }) {
  const tasks = [
    { label: 'Extract', state: 'success' },
    { label: 'Transform', state: 'success' },
    { label: 'Load', state: success ? 'success' : 'failed' },
    { label: 'Publish', state: success ? 'success' : 'blocked' },
  ];

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Task-state path</p>
      <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        {tasks.map((task, index) => (
          <div key={task.label} className="contents">
            <div
              className={`flex min-h-16 flex-1 items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:block ${
                task.state === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-50'
                  : task.state === 'failed'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-50'
                    : 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              <span className="text-sm font-semibold">{task.label}</span>
              <span className="mt-1 block text-xs capitalize opacity-70">{task.state}</span>
            </div>
            {index < tasks.length - 1 ? (
              <ArrowRight className="h-4 w-4 shrink-0 rotate-90 self-center text-neutral-400 sm:rotate-0" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
