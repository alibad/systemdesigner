'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleX,
  CloudOff,
  FileClock,
  KeyRound,
  LockKeyhole,
  Network,
  Route,
  Server,
  ServerCrash,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  kind: 'healthy' | 'identity' | 'authorization' | 'policy-distribution' | 'destination';
  stageIndex: number | null;
};

type FallbackProfile = {
  id: string;
  label: string;
  detail: string;
  mode: 'closed' | 'bounded-cache' | 'open';
  maxCacheAgeMinutes: number;
};

type RequestPathModel = {
  title: string;
  description: string;
  defaults: {
    failureId: string;
    fallbackId: string;
    cacheAgeMinutes: number;
  };
  stages: Array<{
    id: string;
    label: string;
    detail: string;
  }>;
  failures: FailureScenario[];
  fallbacks: FallbackProfile[];
};

type PathResult = {
  response: string;
  requestOutcome: string;
  securityOutcome: string;
  explanation: string;
  stopIndex: number | null;
  warning: boolean;
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/zero-trust-mesh-architecture/data/request-path-failure-model.json';

function isRequestPathModel(value: unknown): value is RequestPathModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestPathModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.failureId
      && candidate.defaults.fallbackId
      && typeof candidate.defaults.cacheAgeMinutes === 'number'
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 5
      && candidate.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.detail === 'string'
      ))
      && Array.isArray(candidate.failures)
      && candidate.failures.length >= 4
      && candidate.failures.every((failure) => (
        typeof failure.id === 'string'
        && typeof failure.label === 'string'
        && typeof failure.detail === 'string'
        && ['healthy', 'identity', 'authorization', 'policy-distribution', 'destination']
          .includes(failure.kind)
        && (failure.stageIndex === null || typeof failure.stageIndex === 'number')
      ))
      && Array.isArray(candidate.fallbacks)
      && candidate.fallbacks.length === 3
      && candidate.fallbacks.every((fallback) => (
        typeof fallback.id === 'string'
        && typeof fallback.label === 'string'
        && typeof fallback.detail === 'string'
        && ['closed', 'bounded-cache', 'open'].includes(fallback.mode)
        && typeof fallback.maxCacheAgeMinutes === 'number'
      )),
  );
}

function evaluatePath(
  failure: FailureScenario,
  fallback: FallbackProfile,
  cacheAgeMinutes: number,
): PathResult {
  if (failure.kind === 'healthy') {
    return {
      response: '200 success',
      requestOutcome: 'Handler reached',
      securityOutcome: 'Identity and policy verified',
      explanation: 'The credential is valid, the local policy bundle matches, and the destination is healthy.',
      stopIndex: null,
      warning: false,
    };
  }

  if (failure.kind === 'identity') {
    return {
      response: '401 / TLS failure',
      requestOutcome: 'Handshake stopped',
      securityOutcome: 'Unknown identity rejected',
      explanation: 'An expired workload credential cannot establish the authenticated channel. Authorization is never evaluated.',
      stopIndex: failure.stageIndex,
      warning: false,
    };
  }

  if (failure.kind === 'authorization') {
    return {
      response: '403 denied',
      requestOutcome: 'Policy stopped request',
      securityOutcome: 'Default deny preserved',
      explanation: 'The caller is authenticated, but no exact rule permits this method and resource. Encryption does not change that decision.',
      stopIndex: failure.stageIndex,
      warning: false,
    };
  }

  if (failure.kind === 'destination') {
    return {
      response: '503 unavailable',
      requestOutcome: 'Service failed',
      securityOutcome: 'Authorization succeeded',
      explanation: 'The request passed identity and policy gates, then failed at the destination. This is an availability failure, not an authorization denial.',
      stopIndex: failure.stageIndex,
      warning: false,
    };
  }

  if (fallback.mode === 'closed') {
    return {
      response: '503 policy unavailable',
      requestOutcome: 'Policy gate stopped request',
      securityOutcome: 'Failed closed',
      explanation: 'The local policy bundle is unusable and no bounded fallback is permitted, so the proxy rejects the request.',
      stopIndex: failure.stageIndex,
      warning: false,
    };
  }

  if (fallback.mode === 'bounded-cache') {
    const cacheAccepted = cacheAgeMinutes <= fallback.maxCacheAgeMinutes;
    return cacheAccepted
      ? {
          response: '200 from cached policy',
          requestOutcome: 'Handler reached',
          securityOutcome: 'Last-known-good policy',
          explanation: `The ${cacheAgeMinutes}-minute-old signed bundle is inside the ${fallback.maxCacheAgeMinutes}-minute safety window.`,
          stopIndex: null,
          warning: false,
        }
      : {
          response: '503 policy expired',
          requestOutcome: 'Policy gate stopped request',
          securityOutcome: 'Cache limit enforced',
          explanation: `The ${cacheAgeMinutes}-minute-old bundle exceeds the ${fallback.maxCacheAgeMinutes}-minute window, so the proxy rejects the request.`,
          stopIndex: failure.stageIndex,
          warning: false,
        };
  }

  return {
    response: '200 without policy',
    requestOutcome: 'Handler reached',
    securityOutcome: 'Authorization bypassed',
    explanation: 'Fail-open preserves availability by skipping the missing authorization decision. An authenticated but unauthorized caller may now reach the service.',
    stopIndex: null,
    warning: true,
  };
}

export default function ZeroTrustMeshArchitectureRequestPathLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RequestPathModel | null>(null);
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
        if (!isRequestPathModel(payload)) {
          throw new Error('The request-path failure model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the request-path failure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Request-path failure lab"
          title="Load enforcement stages and failure behavior"
          description="The lesson-owned request-path model is loading."
          icon={Route}
          accent="violet"
        />
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      </LearningLab>
    );
  }

  return <RequestPathLab model={model} />;
}

function RequestPathLab({ model }: { model: RequestPathModel }) {
  const [failureId, setFailureId] = useState(model.defaults.failureId);
  const [fallbackId, setFallbackId] = useState(model.defaults.fallbackId);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState(model.defaults.cacheAgeMinutes);

  const failure = model.failures.find((item) => item.id === failureId) ?? model.failures[0];
  const fallback = model.fallbacks.find((item) => item.id === fallbackId) ?? model.fallbacks[0];
  const result = useMemo(
    () => evaluatePath(failure, fallback, cacheAgeMinutes),
    [cacheAgeMinutes, failure, fallback],
  );

  function reset() {
    setFailureId(model.defaults.failureId);
    setFallbackId(model.defaults.fallbackId);
    setCacheAgeMinutes(model.defaults.cacheAgeMinutes);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Request-path failure lab"
        title={model.title}
        description={model.description}
        icon={Route}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a condition
              </legend>
              <div className="mt-3 space-y-2">
                {model.failures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === failure.id}
                    label={item.label}
                    detail={item.detail}
                    icon={failureIcon(item.kind)}
                    accent={item.kind === 'healthy' ? 'emerald' : 'rose'}
                    onClick={() => setFailureId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Policy-unavailable behavior
              </legend>
              <div className="mt-3 space-y-2">
                {model.fallbacks.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === fallback.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.mode === 'closed' ? LockKeyhole : item.mode === 'bounded-cache' ? FileClock : ShieldAlert}
                    accent={item.mode === 'closed' ? 'emerald' : item.mode === 'bounded-cache' ? 'amber' : 'rose'}
                    onClick={() => setFallbackId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            {fallback.mode === 'bounded-cache' ? (
              <LabRange
                label="Signed bundle age"
                value={cacheAgeMinutes}
                output={`${cacheAgeMinutes} min`}
                min={0}
                max={30}
                step={1}
                accent="amber"
                lowLabel="Fresh"
                highLabel="Stale"
                onChange={setCacheAgeMinutes}
              />
            ) : null}
          </div>
        )}
      >
        <div className="min-w-0 space-y-5" aria-live="polite">
          <OutcomeBanner result={result} />

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Client response"
              value={result.response}
              detail="Transport, authorization, and destination failures stay distinguishable."
              icon={Network}
              tone={result.warning ? 'rose' : result.response.startsWith('200') ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Request path"
              value={result.requestOutcome}
              detail={result.stopIndex === null ? 'The request traverses every stage.' : `Execution stops at stage ${result.stopIndex + 1}.`}
              icon={Route}
              tone={result.stopIndex === null ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Security result"
              value={result.securityOutcome}
              detail={result.warning ? 'Availability was chosen over authorization.' : 'The configured boundary remained explicit.'}
              icon={result.warning ? ShieldAlert : ShieldCheck}
              tone={result.warning ? 'rose' : 'violet'}
            />
          </div>

          <RequestPath stages={model.stages} result={result} failure={failure} />

          <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
            <div className="flex items-start gap-3">
              <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Operational boundary</p>
                <p className="mt-2 text-sm leading-6">
                  A mesh can distribute identity material and policy, then enforce both locally.
                  It still needs an explicit rule for expired identity, denied action, stale
                  policy, and unavailable destination. One fallback cannot safely cover all four.
                </p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function OutcomeBanner({ result }: { result: PathResult }) {
  const failed = result.stopIndex !== null;
  const Icon = result.warning ? ShieldAlert : failed ? CircleX : CheckCircle2;
  const styles = result.warning
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : failed
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';

  return (
    <section className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">Observed path outcome</p>
          <h4 className="mt-1 text-xl font-semibold">{result.securityOutcome}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
        </div>
      </div>
    </section>
  );
}

function RequestPath({
  stages,
  result,
  failure,
}: {
  stages: RequestPathModel['stages'];
  result: PathResult;
  failure: FailureScenario;
}) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Request execution trace
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        {stages.map((stage, index) => {
          const blocked = result.stopIndex === index;
          const notReached = result.stopIndex !== null && index > result.stopIndex;
          const bypassed = result.warning && index === 2;
          const styles = blocked
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            : notReached
              ? 'border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500'
              : bypassed
                ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-400 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
                : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';
          const Icon = stageIcon(stage.id);
          return (
            <article key={stage.id} className={`min-w-0 rounded-md border p-4 ${styles}`}>
              <div className="flex items-center justify-between gap-2">
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="text-[11px] font-semibold uppercase opacity-60">
                  {index + 1}
                </span>
              </div>
              <h5 className="mt-3 text-sm font-semibold">{stage.label}</h5>
              <p className="mt-1 text-xs leading-5 opacity-75">
                {blocked
                  ? failure.detail
                  : notReached
                    ? 'Not reached'
                    : bypassed
                      ? 'Policy check skipped'
                      : stage.detail}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function failureIcon(kind: FailureScenario['kind']) {
  if (kind === 'healthy') return CheckCircle2;
  if (kind === 'identity') return KeyRound;
  if (kind === 'authorization') return LockKeyhole;
  if (kind === 'policy-distribution') return CloudOff;
  return ServerCrash;
}

function stageIcon(id: string) {
  if (id === 'caller') return Activity;
  if (id === 'client-proxy') return KeyRound;
  if (id === 'policy-gate') return ShieldCheck;
  if (id === 'server-proxy') return Network;
  return Server;
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        {error ? (
          <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
        ) : (
          <Activity
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none"
          />
        )}
        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
          {error ? 'Request-path data could not be loaded' : 'Loading request-path failures...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
