'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Database,
  Gauge,
  LoaderCircle,
  Network,
  Server,
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

type Bound = { min: number; max: number; step: number };
type Profile = {
  id: string;
  label: string;
  detail: string;
  nodeCount: number;
  memoryGiBPerNode: number;
  workingSetMillions: number;
  averageValueKiB: number;
  requestRate: number;
  targetHitRatePct: number;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    keyAndItemMetadataBytes: number;
    allocationEfficiencyPct: number;
    targetOpsPerNode: number;
    backendMissBudgetRps: number;
  };
  bounds: {
    nodeCount: Bound;
    memoryGiBPerNode: Bound;
    workingSetMillions: Bound;
    averageValueKiB: Bound;
    requestRate: Bound;
    targetHitRatePct: Bound;
  };
  profiles: Profile[];
};

const BLOCK_ID = 'technology/memcached-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/memcached/data/capacity-envelope.json';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const assumptions = candidate.assumptions;
  const bounds = candidate.bounds;
  return Boolean(
    candidate.title
      && candidate.description
      && assumptions
      && typeof assumptions.keyAndItemMetadataBytes === 'number'
      && typeof assumptions.allocationEfficiencyPct === 'number'
      && typeof assumptions.targetOpsPerNode === 'number'
      && typeof assumptions.backendMissBudgetRps === 'number'
      && bounds
      && isBound(bounds.nodeCount)
      && isBound(bounds.memoryGiBPerNode)
      && isBound(bounds.workingSetMillions)
      && isBound(bounds.averageValueKiB)
      && isBound(bounds.requestRate)
      && isBound(bounds.targetHitRatePct)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2,
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function gib(value: number) {
  if (value < 1) return `${Math.round(value * 1024)} MiB`;
  return `${value.toFixed(value < 10 ? 1 : 0)} GiB`;
}

export default function MemcachedPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [nodeCount, setNodeCount] = useState(4);
  const [memoryGiBPerNode, setMemoryGiBPerNode] = useState(16);
  const [workingSetMillions, setWorkingSetMillions] = useState(4);
  const [averageValueKiB, setAverageValueKiB] = useState(6);
  const [requestRate, setRequestRate] = useState(90000);
  const [targetHitRatePct, setTargetHitRatePct] = useState(92);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setNodeCount(profile.nodeCount);
    setMemoryGiBPerNode(profile.memoryGiBPerNode);
    setWorkingSetMillions(profile.workingSetMillions);
    setAverageValueKiB(profile.averageValueKiB);
    setRequestRate(profile.requestRate);
    setTargetHitRatePct(profile.targetHitRatePct);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('The cache capacity model is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load cache capacity data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const itemBytes = averageValueKiB * 1024 + data.assumptions.keyAndItemMetadataBytes;
    const workingSetBytes = workingSetMillions * 1_000_000 * itemBytes;
    const rawMemoryBytes = nodeCount * memoryGiBPerNode * 1024 ** 3;
    const usableMemoryBytes = rawMemoryBytes * (data.assumptions.allocationEfficiencyPct / 100);
    const coveragePct = Math.min(100, (usableMemoryBytes / workingSetBytes) * 100);
    const operationsPerNode = requestRate / nodeCount;
    const backendMissRps = requestRate * (1 - targetHitRatePct / 100);
    const cacheReadGiBPerSecond =
      (requestRate * (targetHitRatePct / 100) * averageValueKiB * 1024) / 1024 ** 3;
    const memoryGapBytes = Math.max(0, workingSetBytes - usableMemoryBytes);

    if (operationsPerNode > data.assumptions.targetOpsPerNode) {
      return {
        backendMissRps,
        cacheReadGiBPerSecond,
        coveragePct,
        memoryGapBytes,
        operationsPerNode,
        rawMemoryBytes,
        usableMemoryBytes,
        workingSetBytes,
        status: 'Per-node traffic exceeds the planning target',
        tone: 'rose' as const,
        verdict: `Each node receives about ${compact(operationsPerNode)} operations per second, above the model's ${compact(data.assumptions.targetOpsPerNode)} planning target. Benchmark the exact client, network, value sizes, and command mix before relying on this pool.`,
      };
    }

    if (backendMissRps > data.assumptions.backendMissBudgetRps) {
      return {
        backendMissRps,
        cacheReadGiBPerSecond,
        coveragePct,
        memoryGapBytes,
        operationsPerNode,
        rawMemoryBytes,
        usableMemoryBytes,
        workingSetBytes,
        status: 'The miss path exceeds its budget',
        tone: 'amber' as const,
        verdict: `A ${targetHitRatePct}% hit rate still sends ${compact(backendMissRps)} requests per second to the source, above the modeled ${compact(data.assumptions.backendMissBudgetRps)} budget. Improve reuse, lower request cost, or add source headroom.`,
      };
    }

    if (coveragePct < targetHitRatePct) {
      return {
        backendMissRps,
        cacheReadGiBPerSecond,
        coveragePct,
        memoryGapBytes,
        operationsPerNode,
        rawMemoryBytes,
        usableMemoryBytes,
        workingSetBytes,
        status: 'The target depends on workload locality',
        tone: 'amber' as const,
        verdict: `Usable memory covers ${Math.round(coveragePct)}% of modeled objects, below the ${targetHitRatePct}% target hit rate. A skewed workload may still reach the target, but only a key-popularity trace can prove it.`,
      };
    }

    return {
      backendMissRps,
      cacheReadGiBPerSecond,
      coveragePct,
      memoryGapBytes,
      operationsPerNode,
      rawMemoryBytes,
      usableMemoryBytes,
      workingSetBytes,
      status: 'The modeled envelope has headroom',
      tone: 'emerald' as const,
      verdict: `The pool can hold the modeled working set after allocation overhead, while the target hit rate leaves ${compact(backendMissRps)} source requests per second. Validate slab-class pressure, key skew, and node loss under load.`,
    };
  }, [
    averageValueKiB,
    data,
    memoryGiBPerNode,
    nodeCount,
    requestRate,
    targetHitRatePct,
    workingSetMillions,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and miss-load lab"
          title={data?.title ?? 'Can the cache hold the useful working set?'}
          description={data?.description ?? 'Loading the cache capacity model.'}
          icon={Gauge}
          accent="cyan"
          onReset={data ? () => applyProfile(data.profiles[0]) : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload shape
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={Boxes}
                        accent={profile.id === 'api-aggregates' ? 'violet' : profile.id === 'small-hot-objects' ? 'amber' : 'cyan'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange label="Cache nodes" value={nodeCount} output={`${nodeCount}`} {...data.bounds.nodeCount} accent="blue" lowLabel="One failure domain" highLabel="Wider pool" onChange={(value) => { setProfileId(''); setNodeCount(value); }} />
                <LabRange label="Memory per node" value={memoryGiBPerNode} output={`${memoryGiBPerNode} GiB`} {...data.bounds.memoryGiBPerNode} accent="cyan" lowLabel="Small resident set" highLabel="More RAM" onChange={(value) => { setProfileId(''); setMemoryGiBPerNode(value); }} />
                <LabRange label="Working-set objects" value={workingSetMillions} output={`${workingSetMillions}M`} {...data.bounds.workingSetMillions} accent="violet" lowLabel="Focused" highLabel="Broad" onChange={(value) => { setProfileId(''); setWorkingSetMillions(value); }} />
                <LabRange label="Average value" value={averageValueKiB} output={`${averageValueKiB} KiB`} {...data.bounds.averageValueKiB} accent="amber" lowLabel="Tiny objects" highLabel="Larger values" onChange={(value) => { setProfileId(''); setAverageValueKiB(value); }} />
                <LabRange label="Request rate" value={requestRate} output={`${compact(requestRate)}/s`} {...data.bounds.requestRate} accent="rose" lowLabel="Steady" highLabel="Peak" onChange={(value) => { setProfileId(''); setRequestRate(value); }} />
                <LabRange label="Target hit rate" value={targetHitRatePct} output={`${targetHitRatePct}%`} {...data.bounds.targetHitRatePct} accent="emerald" lowLabel="More misses" highLabel="Strict target" onChange={(value) => { setProfileId(''); setTargetHitRatePct(value); }} />
              </div>
            )}
          >
            <div className="space-y-6">
              <div className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-75">Planning verdict</p>
                    <h4 className="mt-1 text-xl font-semibold">{result.status}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.verdict}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Usable memory" value={gib(result.usableMemoryBytes / 1024 ** 3)} detail={`${data.assumptions.allocationEfficiencyPct}% of ${gib(result.rawMemoryBytes / 1024 ** 3)} after allocation overhead`} icon={Server} tone="cyan" />
                <LabMetric label="Working set" value={gib(result.workingSetBytes / 1024 ** 3)} detail={`${workingSetMillions}M objects including key and item metadata`} icon={Boxes} tone={result.memoryGapBytes > 0 ? 'amber' : 'violet'} />
                <LabMetric label="Source misses" value={`${compact(result.backendMissRps)}/s`} detail={`${100 - targetHitRatePct}% of requests continue to the source`} icon={Database} tone={result.backendMissRps > data.assumptions.backendMissBudgetRps ? 'rose' : 'emerald'} />
                <LabMetric label="Operations per node" value={`${compact(result.operationsPerNode)}/s`} detail="Even distribution assumption; hot keys can be worse" icon={Activity} tone={result.operationsPerNode > data.assumptions.targetOpsPerNode ? 'rose' : 'blue'} />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Memory coverage</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{Math.round(result.coveragePct)}% of modeled objects</p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Read payload: {result.cacheReadGiBPerSecond.toFixed(2)} GiB/s</p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${Math.round(result.coveragePct)} percent memory coverage`}>
                  <div className="h-full rounded-full bg-cyan-500 transition-[width] motion-reduce:transition-none" style={{ width: `${result.coveragePct}%` }} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <EnvelopeFact label="Allocation model" value={`${data.assumptions.allocationEfficiencyPct}% usable`} detail="Slab fit, keys, item metadata, and allocator behavior consume capacity." />
                  <EnvelopeFact label="Hit-rate proof" value="Traffic trace" detail="Memory coverage is not a prediction of reuse or popularity skew." />
                  <EnvelopeFact label="Failure test" value="Remove one node" detail="Confirm the backend survives remapping and cold refill traffic." />
                </div>
              </section>

              <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <Network aria-hidden="true" className="h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">This is a planning envelope, not a benchmark. Measure value-size percentiles, slab-class evictions, key popularity, serialization cost, connection behavior, and source latency with the real client.</p>
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
    <div className="flex min-h-48 items-center justify-center p-6 text-center">
      {error ? (
        <div>
          <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Capacity model unavailable</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950">Try again</button>
        </div>
      ) : (
        <div>
          <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-600 motion-reduce:animate-none" />
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the cache envelope...</p>
        </div>
      )}
    </div>
  );
}

function EnvelopeFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
