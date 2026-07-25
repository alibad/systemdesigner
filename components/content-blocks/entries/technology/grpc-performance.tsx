'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Hourglass,
  Network,
  RotateCcw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Operation = {
  id: string;
  label: string;
  detail: string;
  retrySafe: boolean;
};
type DeadlineData = {
  title: string;
  description: string;
  assumption: string;
  defaults: {
    operationId: string;
    deadlineMs: number;
    networkMs: number;
    serviceMs: number;
    maxAttempts: number;
    initialBackoffMs: number;
    transientFailures: number;
  };
  bounds: {
    deadlineMs: Bound;
    networkMs: Bound;
    serviceMs: Bound;
    initialBackoffMs: Bound;
    transientFailures: Bound;
  };
  attemptOptions: number[];
  operations: Operation[];
};

type Attempt = {
  number: number;
  backoffBeforeMs: number;
  durationMs: number;
  startMs: number;
  result: 'OK' | 'UNAVAILABLE' | 'DEADLINE_EXCEEDED';
};

const BLOCK_ID = 'technology/grpc-performance';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bound>;
  return [item.min, item.max, item.step].every(
    (candidate) => typeof candidate === 'number' && Number.isFinite(candidate),
  );
}

function isDeadlineData(value: unknown): value is DeadlineData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DeadlineData>;
  return Boolean(
    item.title
      && item.description
      && item.assumption
      && item.defaults?.operationId
      && typeof item.defaults.deadlineMs === 'number'
      && typeof item.defaults.networkMs === 'number'
      && typeof item.defaults.serviceMs === 'number'
      && typeof item.defaults.maxAttempts === 'number'
      && typeof item.defaults.initialBackoffMs === 'number'
      && typeof item.defaults.transientFailures === 'number'
      && isBound(item.bounds?.deadlineMs)
      && isBound(item.bounds?.networkMs)
      && isBound(item.bounds?.serviceMs)
      && isBound(item.bounds?.initialBackoffMs)
      && isBound(item.bounds?.transientFailures)
      && Array.isArray(item.attemptOptions)
      && item.attemptOptions.length > 0
      && Array.isArray(item.operations)
      && item.operations.length > 0,
  );
}

export default function GrpcPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DeadlineData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No deadline budget model was supplied.');
      return;
    }
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDeadlineData(payload)) throw new Error('The deadline budget model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the deadline lab.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState error detail={error} />;
  if (!data) return <LoadState detail="Reading retry assumptions..." />;
  return <DeadlineLab data={data} />;
}

function DeadlineLab({ data }: { data: DeadlineData }) {
  const [operationId, setOperationId] = useState(data.defaults.operationId);
  const [deadlineMs, setDeadlineMs] = useState<number>(data.defaults.deadlineMs);
  const [networkMs, setNetworkMs] = useState<number>(data.defaults.networkMs);
  const [serviceMs, setServiceMs] = useState<number>(data.defaults.serviceMs);
  const [maxAttempts, setMaxAttempts] = useState<number>(data.defaults.maxAttempts);
  const [initialBackoffMs, setInitialBackoffMs] = useState<number>(data.defaults.initialBackoffMs);
  const [transientFailures, setTransientFailures] = useState<number>(data.defaults.transientFailures);
  const operation = data.operations.find((item) => item.id === operationId) ?? data.operations[0];

  const model = useMemo(() => {
    const perAttemptMs = networkMs + serviceMs;
    const attemptLimit = operation.retrySafe ? maxAttempts : 1;
    const targetAttempts = Math.min(transientFailures + 1, attemptLimit);
    const attempts: Attempt[] = [];
    let elapsedMs = 0;
    let deadlineExpired = false;

    for (let index = 0; index < targetAttempts; index += 1) {
      const backoffBeforeMs = index === 0 ? 0 : initialBackoffMs * (2 ** (index - 1));
      if (elapsedMs + backoffBeforeMs >= deadlineMs) {
        elapsedMs = deadlineMs;
        deadlineExpired = true;
        break;
      }
      elapsedMs += backoffBeforeMs;
      const startMs = elapsedMs;
      const availableMs = deadlineMs - elapsedMs;
      const durationMs = Math.min(perAttemptMs, availableMs);
      elapsedMs += durationMs;
      const completed = durationMs === perAttemptMs;
      const result: Attempt['result'] = !completed
        ? 'DEADLINE_EXCEEDED'
        : index < transientFailures
          ? 'UNAVAILABLE'
          : 'OK';
      attempts.push({ number: index + 1, backoffBeforeMs, durationMs, startMs, result });
      if (!completed) {
        deadlineExpired = true;
        break;
      }
    }

    const success = attempts.some((attempt) => attempt.result === 'OK');
    const unsafeRetryConfigured = !operation.retrySafe && maxAttempts > 1;
    const exhausted = !success && !deadlineExpired && transientFailures >= attemptLimit;
    const remainingMs = Math.max(0, deadlineMs - elapsedMs);
    let title: string;
    let detail: string;

    if (unsafeRetryConfigured) {
      title = success
        ? 'The call fits, but the configured retries are unsafe'
        : 'The effect contract blocks an automatic retry';
      detail = 'An unkeyed mutation can commit before its response is lost. Return the status and reconcile the operation instead of replaying it automatically.';
    } else if (deadlineExpired) {
      title = 'The call exhausts its deadline before completion';
      detail = 'Reduce attempt work, reserve less backoff, lower the attempt count, or choose a realistic larger user budget. Do not reset the deadline downstream.';
    } else if (exhausted) {
      title = 'The retry policy exhausts its bounded attempts';
      detail = 'The client returns UNAVAILABLE with time still remaining. Another layer should not silently start a new independent retry chain.';
    } else {
      title = attempts.length > 1 ? 'The retry succeeds inside the original deadline' : 'The first attempt succeeds inside the deadline';
      detail = `${remainingMs} ms remains for response handling and any downstream work not represented by the measured inputs.`;
    }

    return {
      attempts,
      attemptLimit,
      deadlineExpired,
      detail,
      elapsedMs,
      exhausted,
      perAttemptMs,
      remainingMs,
      success,
      title,
      unsafeRetryConfigured,
    };
  }, [deadlineMs, initialBackoffMs, maxAttempts, networkMs, operation.retrySafe, serviceMs, transientFailures]);

  function reset() {
    setOperationId(data.defaults.operationId);
    setDeadlineMs(data.defaults.deadlineMs);
    setNetworkMs(data.defaults.networkMs);
    setServiceMs(data.defaults.serviceMs);
    setMaxAttempts(data.defaults.maxAttempts);
    setInitialBackoffMs(data.defaults.initialBackoffMs);
    setTransientFailures(data.defaults.transientFailures);
  }

  const healthy = model.success && !model.unsafeRetryConfigured;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Deadline and retry ledger"
          title={data.title}
          description={data.description}
          icon={TimerReset}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Effect contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.operations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === operation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.retrySafe ? ShieldCheck : CircleAlert}
                      accent={item.retrySafe ? 'emerald' : 'rose'}
                      onClick={() => setOperationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange label="Call deadline" value={deadlineMs} output={`${deadlineMs} ms`} {...data.bounds.deadlineMs} lowLabel="Tight user budget" highLabel="Longer job budget" accent="blue" onChange={setDeadlineMs} />
              <LabRange label="Measured network + proxy" value={networkMs} output={`${networkMs} ms`} {...data.bounds.networkMs} lowLabel="Near" highLabel="More path time" accent="cyan" onChange={setNetworkMs} />
              <LabRange label="Measured service work" value={serviceMs} output={`${serviceMs} ms`} {...data.bounds.serviceMs} lowLabel="Short handler" highLabel="Long handler" accent="violet" onChange={setServiceMs} />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Maximum attempts (original included)
                </legend>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {data.attemptOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={maxAttempts === count}
                      onClick={() => setMaxAttempts(count)}
                      className={`h-11 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        maxAttempts === count
                          ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
                          : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </fieldset>

              <LabRange label="Initial retry backoff" value={initialBackoffMs} output={`${initialBackoffMs} ms`} {...data.bounds.initialBackoffMs} lowLabel="Immediate" highLabel="More recovery time" accent="amber" onChange={setInitialBackoffMs} />
              <LabRange label="UNAVAILABLE failures before success" value={transientFailures} output={`${transientFailures}`} {...data.bounds.transientFailures} lowLabel="Healthy" highLabel="Persistent outage" accent="rose" onChange={setTransientFailures} />
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Per-attempt budget" value={`${model.perAttemptMs} ms`} detail={`${networkMs} network + ${serviceMs} service`} icon={Gauge} tone="blue" />
              <LabMetric label="Attempts used" value={`${model.attempts.length}/${model.attemptLimit}`} detail={operation.retrySafe ? 'Bounded by retry policy' : 'Effect contract limits retries'} icon={RotateCcw} tone="amber" />
              <LabMetric label="Elapsed budget" value={`${model.elapsedMs} ms`} detail="attempts plus backoff" icon={Hourglass} tone={model.deadlineExpired ? 'rose' : 'violet'} />
              <LabMetric label="Remaining deadline" value={`${model.remainingMs} ms`} detail="never reset downstream" icon={Clock3} tone={model.remainingMs > 0 ? 'emerald' : 'rose'} />
            </div>

            <section className={`rounded-md border p-5 ${
              healthy
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {healthy ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Call verdict</p>
                  <h4 className="mt-1 text-lg font-semibold">{model.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{model.detail}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Attempt timeline</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">One deadline across every attempt</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Backoff doubles before each later retry</p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800" aria-hidden="true">
                <div className={`h-full transition-[width] ${healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (model.elapsedMs / deadlineMs) * 100)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>0 ms</span><span>{deadlineMs} ms deadline</span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {model.attempts.map((attempt) => (
                  <div key={attempt.number} className={`rounded-md border p-4 ${attemptTone(attempt.result)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-70">Attempt {attempt.number}</p>
                        <p className="mt-1 text-lg font-semibold">{attempt.result}</p>
                      </div>
                      {attempt.result === 'OK' ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />}
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between gap-3"><dt className="opacity-70">Backoff before</dt><dd className="font-semibold tabular-nums">{attempt.backoffBeforeMs} ms</dd></div>
                      <div className="flex justify-between gap-3"><dt className="opacity-70">Attempt starts</dt><dd className="font-semibold tabular-nums">{attempt.startMs} ms</dd></div>
                      <div className="flex justify-between gap-3"><dt className="opacity-70">Budget consumed</dt><dd className="font-semibold tabular-nums">{attempt.durationMs} ms</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
              <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p><span className="font-semibold">Evidence boundary:</span> {data.assumption}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function attemptTone(result: Attempt['result']) {
  if (result === 'OK') return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  if (result === 'UNAVAILABLE') return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  return 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
}

function LoadState({ detail, error = false }: { detail: string; error?: boolean }) {
  return (
    <div className={`not-prose my-7 rounded-lg border p-6 ${error ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50' : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
      <div className="flex items-start gap-3">
        {error ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Network aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
        <div><p className="font-semibold">{error ? 'Deadline model unavailable' : 'Loading deadline lab'}</p><p className="mt-1 text-sm opacity-75">{detail}</p></div>
      </div>
    </div>
  );
}
