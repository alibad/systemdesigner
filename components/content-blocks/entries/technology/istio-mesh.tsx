'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  MousePointerClick,
  Repeat2,
  Route,
  ServerCrash,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/istio-mesh';
const DEFAULT_DATA_FILE = '/api/content/technology/istio/data/retry-budget-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type Operation = {
  id: string;
  label: string;
  detail: string;
  retryEligible: boolean;
};

type Failure = {
  id: string;
  label: string;
  detail: string;
  matchedByPolicy: boolean;
};

type RetryBudgetModel = {
  title: string;
  description: string;
  defaults: {
    incomingRps: number;
    retryAttempts: number;
    routeTimeoutMs: number;
    perTryTimeoutMs: number;
    operationId: string;
    failureId: string;
  };
  bounds: {
    incomingRps: Bound;
    retryAttempts: Bound;
    routeTimeoutMs: Bound;
    perTryTimeoutMs: Bound;
  };
  operations: Operation[];
  failures: Failure[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return (
    isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.max >= candidate.min
    && candidate.step > 0
  );
}

function isRetryBudgetModel(value: unknown): value is RetryBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetryBudgetModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.operationId
      && candidate.defaults.failureId
      && isFiniteNumber(candidate.defaults.incomingRps)
      && isFiniteNumber(candidate.defaults.retryAttempts)
      && isFiniteNumber(candidate.defaults.routeTimeoutMs)
      && isFiniteNumber(candidate.defaults.perTryTimeoutMs)
      && isBound(candidate.bounds?.incomingRps)
      && isBound(candidate.bounds?.retryAttempts)
      && isBound(candidate.bounds?.routeTimeoutMs)
      && isBound(candidate.bounds?.perTryTimeoutMs)
      && Array.isArray(candidate.operations)
      && candidate.operations.length >= 2
      && candidate.operations.every((operation) => (
        typeof operation.id === 'string'
        && typeof operation.label === 'string'
        && typeof operation.detail === 'string'
        && typeof operation.retryEligible === 'boolean'
      ))
      && Array.isArray(candidate.failures)
      && candidate.failures.length >= 2
      && candidate.failures.every((failure) => (
        typeof failure.id === 'string'
        && typeof failure.label === 'string'
        && typeof failure.detail === 'string'
        && typeof failure.matchedByPolicy === 'boolean'
      )),
  );
}

export default function IstioRetryBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RetryBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRetryBudgetModel(payload)) {
          throw new Error('The retry budget model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the retry lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {model ? (
        <RetryBudgetLab model={model} />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Retry pressure lab"
            title="Load the route budget"
            description="The lesson-owned timeout, retry, operation, and failure model is loading."
            icon={Repeat2}
            accent="amber"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      )}
    </div>
  );
}

function RetryBudgetLab({ model }: { model: RetryBudgetModel }) {
  const [incomingRps, setIncomingRps] = useState<number>(model.defaults.incomingRps);
  const [retryAttempts, setRetryAttempts] = useState<number>(
    model.defaults.retryAttempts,
  );
  const [routeTimeoutMs, setRouteTimeoutMs] = useState<number>(
    model.defaults.routeTimeoutMs,
  );
  const [perTryTimeoutMs, setPerTryTimeoutMs] = useState<number>(
    model.defaults.perTryTimeoutMs,
  );
  const [operationId, setOperationId] = useState(model.defaults.operationId);
  const [failureId, setFailureId] = useState(model.defaults.failureId);

  const operation = model.operations.find((item) => item.id === operationId)
    ?? model.operations[0];
  const failure = model.failures.find((item) => item.id === failureId)
    ?? model.failures[0];

  const result = useMemo(() => {
    const retryPolicyApplies = operation.retryEligible && failure.matchedByPolicy;
    const eligibleRetries = retryPolicyApplies ? retryAttempts : 0;
    const configuredAttempts = 1 + eligibleRetries;
    const completeWindows = Math.max(1, Math.floor(routeTimeoutMs / perTryTimeoutMs));
    const attemptWindows = Math.min(configuredAttempts, completeWindows);
    const maxAttemptRps = incomingRps * attemptWindows;
    const nominalTimeUsedMs = Math.min(
      routeTimeoutMs,
      attemptWindows * perTryTimeoutMs,
    );
    const remainingBudgetMs = Math.max(0, routeTimeoutMs - nominalTimeUsedMs);
    const timeoutClipsAttempt = perTryTimeoutMs > routeTimeoutMs;
    const timeoutClipsRetries = configuredAttempts > attemptWindows;

    return {
      attemptWindows,
      configuredAttempts,
      eligibleRetries,
      maxAttemptRps,
      nominalTimeUsedMs,
      remainingBudgetMs,
      retryPolicyApplies,
      timeoutClipsAttempt,
      timeoutClipsRetries,
    };
  }, [
    failure.matchedByPolicy,
    incomingRps,
    operation.retryEligible,
    perTryTimeoutMs,
    retryAttempts,
    routeTimeoutMs,
  ]);

  function reset() {
    setIncomingRps(model.defaults.incomingRps);
    setRetryAttempts(model.defaults.retryAttempts);
    setRouteTimeoutMs(model.defaults.routeTimeoutMs);
    setPerTryTimeoutMs(model.defaults.perTryTimeoutMs);
    setOperationId(model.defaults.operationId);
    setFailureId(model.defaults.failureId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Retry pressure lab"
        title={model.title}
        description={model.description}
        icon={Repeat2}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Request semantics
              </legend>
              <div className="mt-3 grid gap-2">
                {model.operations.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === operation.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.retryEligible ? CheckCircle2 : TriangleAlert}
                    accent={item.retryEligible ? 'emerald' : 'rose'}
                    onClick={() => setOperationId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Observed failure
              </legend>
              <div className="mt-3 grid gap-2">
                {model.failures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === failure.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.matchedByPolicy ? ServerCrash : CircleAlert}
                    accent={item.matchedByPolicy ? 'amber' : 'blue'}
                    onClick={() => setFailureId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Incoming request rate"
              value={incomingRps}
              output={`${incomingRps.toLocaleString()} req/s`}
              {...model.bounds.incomingRps}
              accent="blue"
              lowLabel="quiet service"
              highLabel="busy service"
              onChange={setIncomingRps}
            />
            <LabRange
              label="Configured retries"
              value={retryAttempts}
              output={`${retryAttempts}`}
              {...model.bounds.retryAttempts}
              accent="amber"
              lowLabel="none"
              highLabel="more attempts"
              onChange={setRetryAttempts}
            />
            <LabRange
              label="Route timeout"
              value={routeTimeoutMs}
              output={`${routeTimeoutMs}ms`}
              {...model.bounds.routeTimeoutMs}
              accent="violet"
              lowLabel="tight deadline"
              highLabel="long deadline"
              onChange={setRouteTimeoutMs}
            />
            <LabRange
              label="Per-try timeout"
              value={perTryTimeoutMs}
              output={`${perTryTimeoutMs}ms`}
              {...model.bounds.perTryTimeoutMs}
              accent="cyan"
              lowLabel="short window"
              highLabel="long window"
              onChange={setPerTryTimeoutMs}
            />
          </div>
        )}
      >
        <RetryResult
          failure={failure}
          incomingRps={incomingRps}
          operation={operation}
          perTryTimeoutMs={perTryTimeoutMs}
          result={result}
          retryAttempts={retryAttempts}
          routeTimeoutMs={routeTimeoutMs}
        />
      </LearningLabBody>
    </LearningLab>
  );
}

function RetryResult({
  failure,
  incomingRps,
  operation,
  perTryTimeoutMs,
  result,
  retryAttempts,
  routeTimeoutMs,
}: {
  failure: Failure;
  incomingRps: number;
  operation: Operation;
  perTryTimeoutMs: number;
  result: {
    attemptWindows: number;
    configuredAttempts: number;
    eligibleRetries: number;
    maxAttemptRps: number;
    nominalTimeUsedMs: number;
    remainingBudgetMs: number;
    retryPolicyApplies: boolean;
    timeoutClipsAttempt: boolean;
    timeoutClipsRetries: boolean;
  };
  retryAttempts: number;
  routeTimeoutMs: number;
}) {
  const outcome = retryOutcomeCopy({
    failure,
    operation,
    result,
    retryAttempts,
  });
  const OutcomeIcon = outcome.icon;

  return (
    <div className="min-w-0 space-y-6" aria-live="polite">
      <section className={`rounded-md border p-5 ${outcome.tone}`}>
        <div className="flex items-start gap-3">
          <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase opacity-70">Policy outcome</p>
            <h4 className="mt-1 text-xl font-semibold">{outcome.title}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <LabMetric
          label="Attempt windows"
          value={`${result.attemptWindows}`}
          detail={`${result.configuredAttempts} configured within ${routeTimeoutMs}ms`}
          icon={Repeat2}
          tone={result.attemptWindows > 2 ? 'amber' : 'blue'}
        />
        <LabMetric
          label="Max attempt pressure"
          value={`${result.maxAttemptRps.toLocaleString()}/s`}
          detail={`${result.attemptWindows}x incoming request rate`}
          icon={Gauge}
          tone={result.attemptWindows > 2 ? 'rose' : 'amber'}
        />
        <LabMetric
          label="Nominal windows"
          value={`${result.nominalTimeUsedMs}ms`}
          detail={`${perTryTimeoutMs}ms per complete window`}
          icon={Clock3}
          tone="violet"
        />
        <LabMetric
          label="Unallocated time"
          value={`${result.remainingBudgetMs}ms`}
          detail="before backoff and proxy overhead"
          icon={TimerReset}
          tone={result.remainingBudgetMs === 0 ? 'rose' : 'emerald'}
        />
      </div>

      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Upper-bound request path
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {incomingRps.toLocaleString()} incoming requests each second
          </p>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.4fr)_auto_minmax(0,0.8fr)] sm:items-center">
          <PathNode
            eyebrow="Caller"
            title="Incoming traffic"
            detail={`${incomingRps.toLocaleString()} req/s`}
            icon={MousePointerClick}
            tone="blue"
          />
          <ArrowRight
            aria-hidden="true"
            className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0"
          />
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/35">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <Route aria-hidden="true" className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Envoy route budget</p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[500px]:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: result.attemptWindows }, (_, index) => (
                <div
                  key={index}
                  className="rounded border border-amber-300 bg-white px-3 py-2 text-center text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-neutral-950 dark:text-amber-100"
                >
                  Attempt {index + 1}
                  <span className="mt-0.5 block font-normal opacity-70">
                    up to {Math.min(perTryTimeoutMs, routeTimeoutMs)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ArrowRight
            aria-hidden="true"
            className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0"
          />
          <PathNode
            eyebrow="Dependency"
            title="Maximum pressure"
            detail={`${result.maxAttemptRps.toLocaleString()} attempts/s`}
            icon={ServerCrash}
            tone={result.attemptWindows > 2 ? 'rose' : 'emerald'}
          />
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
        <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
          Read the bound correctly
        </h4>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 marker:text-amber-500 dark:text-neutral-300">
          <li>
            The route permits {result.eligibleRetries} eligible{' '}
            {result.eligibleRetries === 1 ? 'retry' : 'retries'} for this operation and
            failure.
          </li>
          <li>
            {result.timeoutClipsAttempt
              ? 'The outer route timeout expires before one full per-try window, so the first attempt is clipped.'
              : result.timeoutClipsRetries
                ? 'The outer route timeout cannot contain every configured attempt window.'
                : 'Every configured attempt window fits before the outer route timeout.'}
          </li>
          <li>
            Backoff, queueing, network work, and processing consume part of the displayed
            unallocated time, so this is not a latency promise.
          </li>
        </ul>
      </section>
    </div>
  );
}

function retryOutcomeCopy({
  failure,
  operation,
  result,
  retryAttempts,
}: {
  failure: Failure;
  operation: Operation;
  result: {
    attemptWindows: number;
    retryPolicyApplies: boolean;
    timeoutClipsAttempt: boolean;
    timeoutClipsRetries: boolean;
  };
  retryAttempts: number;
}) {
  if (!operation.retryEligible && retryAttempts > 0) {
    return {
      title: 'Keep the mesh from repeating this operation',
      detail: `${operation.label} is modeled as non-idempotent. The safe route excludes retries even though ${retryAttempts} are configured for eligible reads.`,
      icon: TriangleAlert,
      tone: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    };
  }

  if (!failure.matchedByPolicy && retryAttempts > 0) {
    return {
      title: 'Return the application rejection',
      detail: `${failure.label} is outside the selected retryOn conditions. Repeating it would add load without changing the request.`,
      icon: CircleAlert,
      tone: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    };
  }

  if (result.timeoutClipsAttempt || result.timeoutClipsRetries) {
    return {
      title: 'The outer deadline clips the retry plan',
      detail: `Only ${result.attemptWindows} complete attempt window${result.attemptWindows === 1 ? '' : 's'} fit. Leave space for backoff and processing instead of treating every configured retry as guaranteed.`,
      icon: Clock3,
      tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    };
  }

  if (result.retryPolicyApplies && result.attemptWindows > 1) {
    return {
      title: 'Retries are eligible and amplify dependency pressure',
      detail: `The selected transient failure can be retried for this operation. Capacity and overload protection must tolerate the ${result.attemptWindows}x attempt bound.`,
      icon: Repeat2,
      tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    };
  }

  return {
    title: 'One upstream attempt is permitted',
    detail: 'No eligible retry is active for this combination, so incoming request rate and maximum upstream attempt rate remain equal.',
    icon: CheckCircle2,
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  };
}

function PathNode({
  detail,
  eyebrow,
  icon: Icon,
  title,
  tone,
}: {
  detail: string;
  eyebrow: string;
  icon: typeof Route;
  title: string;
  tone: 'blue' | 'emerald' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 md:p-6">
      <div className={`rounded-md border p-5 ${error
        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
        : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}
      >
        <div className="flex items-start gap-3">
          {error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Gauge
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 animate-pulse motion-reduce:animate-none"
            />
          )}
          <div>
            <p className="font-semibold">
              {error ? 'Retry model unavailable' : 'Loading retry model'}
            </p>
            <p className="mt-1 text-sm leading-6 opacity-80">
              {error ?? 'Preparing the route inputs and explicit arithmetic.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Repeat2 aria-hidden="true" className="h-4 w-4" />
                Retry loading
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
