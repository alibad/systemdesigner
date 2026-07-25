'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2,
  LoaderCircle,
  RefreshCcw,
  Send,
  ShieldAlert,
  TimerOff,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RetryPolicyId = 'honor' | 'fixed' | 'exponential';
type QuotaScenario = {
  id: string;
  label: string;
  detail: string;
  identity: string;
  resource: string;
  limit: number;
  windowSeconds: number;
  retryAfterSeconds: number;
};
type RetryPolicy = {
  id: RetryPolicyId;
  label: string;
  detail: string;
};
type ResponseModel = {
  title: string;
  description: string;
  bounds: { retryAfterSeconds: { min: number; max: number; step: number } };
  scenarios: QuotaScenario[];
  policies: RetryPolicy[];
};
type Attempt = { number: number; atSeconds: number; accepted: boolean };

const BLOCK_ID = 'technology/rate-limiting-http-response';
const DEFAULT_DATA_FILE = '/api/content/technology/rate-limiting/data/http-retry-scenarios.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isResponseModel(value: unknown): value is ResponseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResponseModel>;
  const bound = candidate.bounds?.retryAfterSeconds;
  return Boolean(
    candidate.title
      && candidate.description
      && bound
      && isFiniteNumber(bound.min)
      && isFiniteNumber(bound.max)
      && isFiniteNumber(bound.step)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.identity === 'string'
        && typeof scenario.resource === 'string'
        && isFiniteNumber(scenario.limit)
        && isFiniteNumber(scenario.windowSeconds)
        && isFiniteNumber(scenario.retryAfterSeconds)
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length === 3
      && candidate.policies.every((policy) => (
        ['honor', 'fixed', 'exponential'].includes(policy.id)
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
      )),
  );
}

function buildAttempts(
  policy: RetryPolicyId,
  retryAfterSeconds: number,
  includeRetryAfter: boolean,
): Attempt[] {
  const effectivePolicy = policy === 'honor' && !includeRetryAfter ? 'exponential' : policy;
  const attempts: Attempt[] = [];
  let elapsed = 0;

  for (let index = 0; index < 8; index += 1) {
    const wait = effectivePolicy === 'honor'
      ? retryAfterSeconds
      : effectivePolicy === 'fixed'
        ? 2
        : Math.min(8, 2 ** index);
    elapsed += wait;
    const accepted = elapsed >= retryAfterSeconds;
    attempts.push({ number: index + 1, atSeconds: elapsed, accepted });
    if (accepted) break;
  }

  return attempts;
}

export default function RateLimitingHttpResponse({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ResponseModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState<RetryPolicyId>('honor');
  const [includeRetryAfter, setIncludeRetryAfter] = useState(true);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(6);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isResponseModel(payload)) throw new Error('The retry model is incomplete.');
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setPolicyId('honor');
        setIncludeRetryAfter(true);
        setRetryAfterSeconds(payload.scenarios[0].retryAfterSeconds);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the retry model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];
  const attempts = useMemo(
    () => buildAttempts(policyId, retryAfterSeconds, includeRetryAfter),
    [includeRetryAfter, policyId, retryAfterSeconds],
  );
  const premature = attempts.filter((attempt) => !attempt.accepted).length;
  const success = attempts.find((attempt) => attempt.accepted);

  function chooseScenario(nextScenario: QuotaScenario) {
    setScenarioId(nextScenario.id);
    setRetryAfterSeconds(nextScenario.retryAfterSeconds);
  }

  function reset() {
    if (!data) return;
    chooseScenario(data.scenarios[0]);
    setPolicyId('honor');
    setIncludeRetryAfter(true);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="HTTP recovery lab"
          title={data?.title ?? 'What should happen after a quota rejection?'}
          description={data?.description ?? 'Loading the retry model.'}
          icon={RefreshCcw}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !policy ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Quota scope</legend>
                  <div className="mt-3 grid gap-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'anonymous-search' ? ShieldAlert : item.id === 'tenant-export' ? Send : Code2}
                        accent={item.id === 'anonymous-search' ? 'amber' : item.id === 'tenant-export' ? 'violet' : 'blue'}
                        onClick={() => chooseScenario(item)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Server signal</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LabChoice selected={includeRetryAfter} label="Send Retry-After" detail="Advertise a delay in seconds." icon={AlarmClock} accent="emerald" onClick={() => setIncludeRetryAfter(true)} />
                    <LabChoice selected={!includeRetryAfter} label="Omit it" detail="Client needs a local fallback." icon={TimerOff} accent="amber" onClick={() => setIncludeRetryAfter(false)} />
                  </div>
                </fieldset>

                <LabRange
                  label="Quota ready after"
                  value={retryAfterSeconds}
                  output={`${retryAfterSeconds}s`}
                  {...data.bounds.retryAfterSeconds}
                  accent="violet"
                  lowLabel="Soon"
                  highLabel="Longer wait"
                  onChange={setRetryAfterSeconds}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Client policy</legend>
                  <div className="mt-3 grid gap-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'honor' ? CheckCircle2 : item.id === 'fixed' ? Clock3 : RefreshCcw}
                        accent={item.id === 'honor' ? 'emerald' : item.id === 'fixed' ? 'rose' : 'violet'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-950 text-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                    <span className="text-xs font-semibold uppercase text-violet-300">Server response</span>
                    <span className="rounded bg-rose-950 px-2 py-1 text-xs font-semibold text-rose-200">Quota exhausted</span>
                  </div>
                  <pre className="overflow-x-auto p-4 text-xs leading-6 text-neutral-200"><code>{`HTTP/1.1 429 Too Many Requests\n${includeRetryAfter ? `Retry-After: ${retryAfterSeconds}\n` : ''}Content-Type: application/json\n\n{\n  \"error\": \"rate_limit_exceeded\",\n  \"scope\": \"${scenario.identity}\",\n  \"resource\": \"${scenario.resource}\"\n}`}</code></pre>
                </div>

                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Policy contract</p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{scenario.limit} operations per {scenario.windowSeconds}s</h4>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-neutral-500 dark:text-neutral-400">Identity</dt><dd className="text-right font-medium text-neutral-950 dark:text-white">{scenario.identity}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-neutral-500 dark:text-neutral-400">Resource</dt><dd className="text-right font-medium text-neutral-950 dark:text-white">{scenario.resource}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-neutral-500 dark:text-neutral-400">Recovery point</dt><dd className="font-mono text-neutral-950 dark:text-white">t={retryAfterSeconds}s</dd></div>
                  </dl>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <LabMetric label="Follow-up attempts" value={`${attempts.length}`} detail="Requests sent after the original 429" icon={Send} tone="neutral" />
                <LabMetric label="Premature retries" value={`${premature}`} detail="Attempts before quota is ready" icon={ShieldAlert} tone={premature > 0 ? 'rose' : 'emerald'} />
                <LabMetric label="First success" value={success ? `t=${success.atSeconds}s` : 'Not reached'} detail="Within this bounded trace" icon={CheckCircle2} tone={success ? 'emerald' : 'amber'} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Client attempt timeline</p>
                <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {attempts.map((attempt) => (
                    <div key={attempt.number} className={`relative rounded-md border p-4 ${attempt.accepted ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase opacity-70">Attempt {attempt.number}</span>
                        {attempt.accepted ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
                      </div>
                      <p className="mt-2 text-xl font-semibold tabular-nums">t={attempt.atSeconds}s</p>
                      <p className="mt-1 text-sm">{attempt.accepted ? 'Accepted' : '429 again'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-md border p-5 ${premature === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {premature === 0 ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="font-semibold">{premature === 0 ? 'The client waits through the advertised recovery point' : `${premature} retries add load before recovery`}</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      {policyId === 'honor' && !includeRetryAfter
                        ? 'With no Retry-After value to honor, this lab gives the client a bounded exponential fallback. That fallback is application policy, not a value supplied by HTTP.'
                        : policyId === 'honor'
                          ? 'Retry-After communicates how long the client ought to wait. A delay-seconds value is a non-negative integer measured from receipt of the response.'
                          : 'A retry policy that wakes before the quota can accept work repeats the rejection and increases pressure on the same request path.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6" role={error ? 'alert' : 'status'}>
      <div className="max-w-md text-center">
        {error ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" /> : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-violet-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{error ? 'Retry model unavailable' : 'Loading retry model'}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{error ?? 'Preparing the HTTP response trace.'}</p>
        {error ? <button type="button" onClick={onRetry} className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100">Retry</button> : null}
      </div>
    </div>
  );
}
