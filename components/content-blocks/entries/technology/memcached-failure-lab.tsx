'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  KeyRound,
  LoaderCircle,
  Network,
  RefreshCw,
  Route,
  ServerCrash,
  ShieldCheck,
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

type Bound = { min: number; max: number; step: number };
type Option = { id: string; label: string; detail: string };
type ScenarioKind = 'node-loss' | 'hot-expiry' | 'late-fill';
type Scenario = {
  id: string;
  label: string;
  detail: string;
  kind: ScenarioKind;
  concurrentRequests: number;
  backendLatencyMs: number;
};
type FailureData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    nodeCount: number;
    routing: string;
    refillProtection: string;
    writeGuard: string;
  };
  bounds: { nodeCount: Bound };
  routingOptions: Option[];
  refillOptions: Option[];
  writeGuardOptions: Option[];
  scenarios: Scenario[];
};
type TraceStep = {
  label: string;
  detail: string;
  state: string;
  tone: 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
};

const BLOCK_ID = 'technology/memcached-failure-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/memcached/data/failure-scenarios.json';

function isOption(value: unknown): value is Option {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Option>;
  return Boolean(candidate.id && candidate.label && candidate.detail);
}

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Scenario>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && ['node-loss', 'hot-expiry', 'late-fill'].includes(candidate.kind ?? '')
      && typeof candidate.concurrentRequests === 'number'
      && typeof candidate.backendLatencyMs === 'number',
  );
}

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureData>;
  const defaults = candidate.defaults;
  const bound = candidate.bounds?.nodeCount;
  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.scenarioId
      && defaults.routing
      && defaults.refillProtection
      && defaults.writeGuard
      && typeof defaults.nodeCount === 'number'
      && bound
      && [bound.min, bound.max, bound.step].every((item) => typeof item === 'number')
      && Array.isArray(candidate.routingOptions)
      && candidate.routingOptions.every(isOption)
      && Array.isArray(candidate.refillOptions)
      && candidate.refillOptions.every(isOption)
      && Array.isArray(candidate.writeGuardOptions)
      && candidate.writeGuardOptions.every(isOption)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isScenario),
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function MemcachedFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FailureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureData(payload)) throw new Error('The failure model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load failure scenarios.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div data-content-block={BLOCK_ID} className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-300"><ServerCrash aria-hidden="true" className="h-4 w-4" />Failure and coherence lab</p>
          <h3 className="mt-2 text-xl font-semibold md:text-2xl">Inject a cache failure</h3>
        </header>
        <div className="flex min-h-48 items-center justify-center p-6 text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Failure model unavailable</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950">Try again</button>
            </div>
          ) : (
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-violet-600 motion-reduce:animate-none" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading failure scenarios...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <FailureWorkbench data={data} />;
}

function FailureWorkbench({ data }: { data: FailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [nodeCount, setNodeCount] = useState(data.defaults.nodeCount);
  const [routing, setRouting] = useState(data.defaults.routing);
  const [refillProtection, setRefillProtection] = useState(data.defaults.refillProtection);
  const [writeGuard, setWriteGuard] = useState(data.defaults.writeGuard);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const protectedRefill = refillProtection !== 'none';
    const guardedWrite = writeGuard !== 'none';
    let affectedPct = 100;
    let backendFetches = scenario.concurrentRequests;
    let staleResult = false;
    let tone: 'rose' | 'amber' | 'emerald' = 'rose';
    let headline = 'The failure escapes the cache boundary';
    let explanation = '';
    let primaryRisk = 'source overload';
    let trace: TraceStep[] = [];

    if (scenario.kind === 'node-loss') {
      affectedPct = routing === 'consistent' ? 100 / nodeCount : 100 - 100 / nodeCount;
      backendFetches = Math.max(1, Math.round(scenario.concurrentRequests * affectedPct / 100));
      tone = routing === 'consistent' ? 'amber' : 'rose';
      headline = routing === 'consistent' ? 'Only the failed node\'s key range moves' : 'Most keys move at once';
      explanation = routing === 'consistent'
        ? `About ${Math.round(affectedPct)}% of keys remap in this simplified ring model. Their next reads miss and refill from the source.`
        : `Changing the modulo from ${nodeCount} to ${nodeCount - 1} remaps roughly ${Math.round(affectedPct)}% of keys, producing a broad cold-cache wave.`;
      primaryRisk = 'remap miss wave';
      trace = [
        { label: 'Client route', state: `${nodeCount} nodes`, detail: 'The client hashes each key to one independent server.', tone: 'blue' },
        { label: 'Node disappears', state: 'Pool changes', detail: `${Math.round(affectedPct)}% of keys get a different destination in the model.`, tone: 'rose' },
        { label: 'Source refill', state: `${compact(backendFetches)} reads`, detail: protectedRefill ? 'Per-key refill ownership prevents duplicate work for the same missing key.' : 'Concurrent requests for the same remapped key can duplicate source work.', tone: routing === 'consistent' ? 'amber' : 'rose' },
      ];
    }

    if (scenario.kind === 'hot-expiry') {
      affectedPct = 100;
      backendFetches = protectedRefill ? 1 : scenario.concurrentRequests;
      tone = protectedRefill ? 'emerald' : 'rose';
      headline = protectedRefill ? 'One request owns the refill' : 'Every caller stampedes the source';
      explanation = protectedRefill
        ? `${scenario.concurrentRequests} callers observe the expiry, but the selected contract allows one source fetch while peers wait or use a fallback.`
        : `${scenario.concurrentRequests} callers miss together and each starts the same ${scenario.backendLatencyMs} ms source operation.`;
      primaryRisk = protectedRefill ? 'bounded wait' : 'cache stampede';
      trace = [
        { label: 'Hot key', state: 'TTL expires', detail: `${scenario.concurrentRequests} requests arrive around the same expiration boundary.`, tone: 'amber' },
        { label: 'Refill election', state: protectedRefill ? 'One owner' : 'No owner', detail: protectedRefill ? 'Single-flight or the meta lease chooses the recache caller.' : 'Every miss is allowed to fetch.', tone: protectedRefill ? 'emerald' : 'rose' },
        { label: 'Database', state: `${compact(backendFetches)} fetch${backendFetches === 1 ? '' : 'es'}`, detail: 'TTL jitter spreads expirations across keys; refill ownership contains concurrency within one key.', tone: protectedRefill ? 'emerald' : 'rose' },
      ];
    }

    if (scenario.kind === 'late-fill') {
      affectedPct = 100;
      backendFetches = 2;
      staleResult = !guardedWrite;
      tone = guardedWrite ? 'emerald' : 'rose';
      headline = guardedWrite ? 'The older refill cannot replace the newer value' : 'The oldest value wins by finishing last';
      explanation = guardedWrite
        ? writeGuard === 'cas'
          ? 'The stale refill presents an obsolete CAS token, so the cache rejects its write.'
          : 'The newer source version uses a different immutable key, so the older fill cannot overwrite it.'
        : 'Both callers use blind set. The request that read version 7 finishes after version 8 and leaves stale data in the cache.';
      primaryRisk = staleResult ? 'stale overwrite' : 'guarded conflict';
      trace = [
        { label: 'Refill A', state: 'Reads v7', detail: `The slower source request takes ${scenario.backendLatencyMs} ms.`, tone: 'amber' },
        { label: 'Refill B', state: 'Writes v8', detail: 'A newer source version reaches the cache first.', tone: 'blue' },
        { label: 'Refill A completes', state: guardedWrite ? 'Rejected or isolated' : 'Overwrites with v7', detail: guardedWrite ? 'The write contract keeps v8 visible.' : 'Blind set has no evidence that v7 is obsolete.', tone: guardedWrite ? 'emerald' : 'rose' },
      ];
    }

    return { affectedPct, backendFetches, explanation, headline, primaryRisk, staleResult, tone, trace };
  }, [nodeCount, refillProtection, routing, scenario, writeGuard]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setNodeCount(data.defaults.nodeCount);
    setRouting(data.defaults.routing);
    setRefillProtection(data.defaults.refillProtection);
    setWriteGuard(data.defaults.writeGuard);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Failure and coherence lab" title={data.title} description={data.description} icon={ServerCrash} accent="violet" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a failure</legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={item.kind === 'node-loss' ? ServerCrash : item.kind === 'hot-expiry' ? TimerReset : RefreshCw} accent={item.kind === 'node-loss' ? 'rose' : item.kind === 'hot-expiry' ? 'amber' : 'violet'} onClick={() => setScenarioId(item.id)} />
                  ))}
                </div>
              </fieldset>

              <LabRange label="Pool nodes" value={nodeCount} output={`${nodeCount}`} {...data.bounds.nodeCount} accent="blue" lowLabel="Large failure share" highLabel="Smaller range per node" onChange={setNodeCount} />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Route keys</legend>
                <div className="mt-3 grid gap-2">
                  {data.routingOptions.map((item) => <LabChoice key={item.id} selected={routing === item.id} label={item.label} detail={item.detail} icon={item.id === 'consistent' ? Route : GitBranch} accent="blue" onClick={() => setRouting(item.id)} />)}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Coordinate refill</legend>
                <div className="mt-3 grid gap-2">
                  {data.refillOptions.map((item) => <LabChoice key={item.id} selected={refillProtection === item.id} label={item.label} detail={item.detail} icon={item.id === 'none' ? RefreshCw : ShieldCheck} accent={item.id === 'none' ? 'rose' : 'emerald'} onClick={() => setRefillProtection(item.id)} />)}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Guard cache writes</legend>
                <div className="mt-3 grid gap-2">
                  {data.writeGuardOptions.map((item) => <LabChoice key={item.id} selected={writeGuard === item.id} label={item.label} detail={item.detail} icon={item.id === 'versioned-key' ? KeyRound : item.id === 'cas' ? CheckCircle2 : CircleAlert} accent={item.id === 'none' ? 'rose' : 'violet'} onClick={() => setWriteGuard(item.id)} />)}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.headline}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Requests in event" value={compact(scenario.concurrentRequests)} detail={`${scenario.backendLatencyMs} ms modeled source latency`} icon={Network} tone="blue" />
              <LabMetric label="Keys or callers affected" value={`${Math.round(result.affectedPct)}%`} detail={scenario.kind === 'node-loss' ? 'Approximate key remap share' : 'The selected key is on the failure path'} icon={Route} tone={result.tone} />
              <LabMetric label="Source fetches" value={compact(result.backendFetches)} detail="Work reaching the durable source in this event" icon={Database} tone={result.backendFetches > 50 ? 'rose' : result.backendFetches > 1 ? 'amber' : 'emerald'} />
              <LabMetric label="Primary risk" value={result.primaryRisk} detail={result.staleResult ? 'Users can observe an older source version' : 'Outcome follows the selected application contract'} icon={result.staleResult ? CircleAlert : ShieldCheck} tone={result.tone} />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request trace</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {result.trace.map((step, index) => <TraceCard key={step.label} index={index + 1} {...step} />)}
              </div>
            </section>

            <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck aria-hidden="true" className="h-4 w-4" />The application owns coherence</p>
              <p className="mt-2 text-sm leading-6 opacity-80">Memcached stores opaque values and serves commands quickly. Routing, source fallback, refill ownership, invalidation, and acceptable staleness remain application-level contracts.</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const traceTones: Record<TraceStep['tone'], string> = {
  blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
  amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
  rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
  emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
  violet: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30',
};

function TraceCard({ index, label, detail, state, tone }: TraceStep & { index: number }) {
  return (
    <article className={`relative min-w-0 rounded-md border p-4 ${traceTones[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{index}</span>
        <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</p>
      </div>
      <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{state}</p>
      <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </article>
  );
}
