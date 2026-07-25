'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  CopyCheck,
  DatabaseZap,
  Fingerprint,
  ListRestart,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
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

type ScenarioKind = 'upstream-timeout' | 'cache-expiry' | 'forwarded-identity';
type Method = 'GET' | 'POST';

interface FailureScenario {
  id: string;
  label: string;
  detail: string;
  kind: ScenarioKind;
  concurrentRequests: number;
}

interface FailureData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    method: Method;
    retryCount: number;
  };
  scenarios: FailureScenario[];
}

const BLOCK_ID = 'technology/nginx-failure-lab';

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults && Array.isArray(candidate.scenarios) && candidate.scenarios.length);
}

export default function NginxFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No proxy incidents were supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureData(payload)) throw new Error('Proxy incidents are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load proxy incidents.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Failure lab unavailable" detail={error} />;
  if (!data) return <State title="Loading failure lab" detail="Preparing proxy incidents..." />;
  return <FailureLab data={data} />;
}

function FailureLab({ data }: { data: FailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [method, setMethod] = useState<Method>(data.defaults.method);
  const [retryCount, setRetryCount] = useState(data.defaults.retryCount);
  const [idempotencyKey, setIdempotencyKey] = useState(false);
  const [cacheLock, setCacheLock] = useState(true);
  const [serveStale, setServeStale] = useState(true);
  const [trustedProxyBoundary, setTrustedProxyBoundary] = useState(true);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    if (scenario.kind === 'upstream-timeout') {
      const duplicateEffects = method === 'POST' && retryCount > 0 && !idempotencyKey ? retryCount : 0;
      const safe = duplicateEffects === 0;
      return {
        safe,
        title: safe ? 'The retry policy preserves the operation contract' : 'The proxy can repeat a state-changing operation',
        detail: safe
          ? 'Keep retry count and total retry time bounded by the caller deadline, and make the application return the original result for a repeated operation ID.'
          : 'A timeout means the result is unknown, not that the upstream did nothing. Retrying a non-idempotent request can create another business effect.',
        duplicateEffects,
        originRequests: 1 + retryCount,
        servedStale: 0,
        trustedIdentity: true,
      };
    }

    if (scenario.kind === 'cache-expiry') {
      const originRequests = serveStale ? 1 : cacheLock ? 1 : scenario.concurrentRequests;
      const safe = originRequests === 1;
      return {
        safe,
        title: serveStale
          ? 'Stale content keeps callers off the failing refresh path'
          : cacheLock
            ? 'One request refreshes while peers wait or bypass by policy'
            : 'Every concurrent miss reaches the origin together',
        detail: safe
          ? 'Stale serving and cache locking solve different parts of expiry pressure. Define freshness, lock timeout, bypass, and error behavior explicitly.'
          : 'A hot-key expiry becomes an origin stampede. Source capacity, not proxy CPU, now determines availability.',
        duplicateEffects: 0,
        originRequests,
        servedStale: serveStale ? scenario.concurrentRequests - 1 : 0,
        trustedIdentity: true,
      };
    }

    return {
      safe: trustedProxyBoundary,
      title: trustedProxyBoundary ? 'Client identity is derived only from a trusted network hop' : 'An attacker-controlled forwarding header becomes authoritative',
      detail: trustedProxyBoundary
        ? 'Strip untrusted forwarding headers, set canonical values at the trusted edge, and configure real-IP processing only for known proxy ranges.'
        : 'Rate limits, audit records, geolocation, and access policy can all be attached to a forged client address.',
      duplicateEffects: 0,
      originRequests: 1,
      servedStale: 0,
      trustedIdentity: trustedProxyBoundary,
    };
  }, [cacheLock, idempotencyKey, method, retryCount, scenario, serveStale, trustedProxyBoundary]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setMethod(data.defaults.method);
    setRetryCount(data.defaults.retryCount);
    setIdempotencyKey(false);
    setCacheLock(true);
    setServeStale(true);
    setTrustedProxyBoundary(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Proxy failure lab" title={data.title} description={data.description} icon={ShieldAlert} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject an incident</legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={item.kind === 'cache-expiry' ? DatabaseZap : item.kind === 'forwarded-identity' ? Fingerprint : Clock3} accent="rose" onClick={() => setScenarioId(item.id)} />
                  ))}
                </div>
              </fieldset>

              {scenario.kind === 'upstream-timeout' ? (
                <>
                  <fieldset>
                    <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request method</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <LabChoice selected={method === 'GET'} label="GET" detail="Read contract" icon={CheckCircle2} accent="emerald" onClick={() => setMethod('GET')} />
                      <LabChoice selected={method === 'POST'} label="POST" detail="May change state" icon={TriangleAlert} accent="amber" onClick={() => setMethod('POST')} />
                    </div>
                  </fieldset>
                  <LabRange label="Additional upstream tries" value={retryCount} output={`${retryCount}`} min={0} max={3} accent="amber" lowLabel="No retry" highLabel="Three retries" onChange={setRetryCount} />
                  {method === 'POST' ? <LabChoice selected={idempotencyKey} label="Application idempotency key" detail="A repeated operation ID converges on the first durable business outcome." icon={CopyCheck} accent="emerald" onClick={() => setIdempotencyKey((value) => !value)} /> : null}
                </>
              ) : null}

              {scenario.kind === 'cache-expiry' ? (
                <>
                  <LabChoice selected={cacheLock} label="Cache fill lock" detail="Elect one cache-population request instead of sending every miss to the origin." icon={LockKeyhole} accent="blue" onClick={() => setCacheLock((value) => !value)} />
                  <LabChoice selected={serveStale} label="Serve stale while updating or on error" detail="Return an explicitly permitted older response while one refresh runs or the origin is unavailable." icon={DatabaseZap} accent="violet" onClick={() => setServeStale((value) => !value)} />
                </>
              ) : null}

              {scenario.kind === 'forwarded-identity' ? (
                <LabChoice selected={trustedProxyBoundary} label="Trusted forwarding boundary" detail="Discard client-supplied identity headers and accept real-IP metadata only from known proxy ranges." icon={ShieldCheck} accent="emerald" onClick={() => setTrustedProxyBoundary((value) => !value)} />
              ) : null}
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.safe ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.safe ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Origin attempts" value={`${result.originRequests}`} detail="For the selected request wave" icon={ListRestart} tone={result.originRequests <= 1 ? 'emerald' : 'amber'} />
              <LabMetric label="Duplicate effects" value={`${result.duplicateEffects}`} detail="Possible repeated state changes" icon={CopyCheck} tone={result.duplicateEffects === 0 ? 'cyan' : 'rose'} />
              <LabMetric label="Stale responses" value={`${result.servedStale}`} detail="Served under an explicit stale policy" icon={DatabaseZap} tone={result.servedStale ? 'violet' : 'blue'} />
              <LabMetric label="Client identity" value={result.trustedIdentity ? 'Trusted' : 'Spoofable'} detail="Authority of forwarding metadata" icon={Fingerprint} tone={result.trustedIdentity ? 'emerald' : 'rose'} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stage icon={Clock3} title="Bound the attempt" detail="Set connect, send, read, total retry time, and tries from the request deadline and the upstream's real latency envelope." />
              <Stage icon={Ban} title="Protect semantics" detail="Retry only methods and operations that are safe to repeat, or require application-level identity and deduplication." />
              <Stage icon={ShieldCheck} title="Prove the boundary" detail="Test slow responses, partial writes, hot-key expiry, stale policy, header spoofing, and config reload under real traffic." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ icon: Icon, title, detail }: { icon: typeof Clock3; title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function State({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
