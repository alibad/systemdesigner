'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  LoaderCircle,
  MemoryStick,
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
type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  primaryCount: number;
  memoryGiBPerPrimary: number;
  workingSetMillions: number;
  averageValueKiB: number;
  requestRate: number;
  measuredHitRatePct: number;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    averageKeyBytes: number;
    objectOverheadBytes: number;
    maxmemorySharePct: number;
    backendMissBudgetRps: number;
    warningHeadroomPct: number;
  };
  bounds: {
    primaryCount: Bound;
    memoryGiBPerPrimary: Bound;
    workingSetMillions: Bound;
    averageValueKiB: Bound;
    requestRate: Bound;
    measuredHitRatePct: Bound;
  };
  profiles: WorkloadProfile[];
};

const BLOCK_ID = 'technology/redis-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/redis/data/cache-capacity-envelope.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isProfile(value: unknown): value is WorkloadProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isFiniteNumber(candidate.primaryCount)
      && isFiniteNumber(candidate.memoryGiBPerPrimary)
      && isFiniteNumber(candidate.workingSetMillions)
      && isFiniteNumber(candidate.averageValueKiB)
      && isFiniteNumber(candidate.requestRate)
      && isFiniteNumber(candidate.measuredHitRatePct),
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
      && isFiniteNumber(assumptions.averageKeyBytes)
      && isFiniteNumber(assumptions.objectOverheadBytes)
      && isFiniteNumber(assumptions.maxmemorySharePct)
      && isFiniteNumber(assumptions.backendMissBudgetRps)
      && isFiniteNumber(assumptions.warningHeadroomPct)
      && bounds
      && isBound(bounds.primaryCount)
      && isBound(bounds.memoryGiBPerPrimary)
      && isBound(bounds.workingSetMillions)
      && isBound(bounds.averageValueKiB)
      && isBound(bounds.requestRate)
      && isBound(bounds.measuredHitRatePct)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2
      && candidate.profiles.every(isProfile),
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

export default function RedisPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [primaryCount, setPrimaryCount] = useState(3);
  const [memoryGiBPerPrimary, setMemoryGiBPerPrimary] = useState(16);
  const [workingSetMillions, setWorkingSetMillions] = useState(4);
  const [averageValueKiB, setAverageValueKiB] = useState(3);
  const [requestRate, setRequestRate] = useState(80000);
  const [measuredHitRatePct, setMeasuredHitRatePct] = useState(94);

  function applyProfile(profile: WorkloadProfile) {
    setProfileId(profile.id);
    setPrimaryCount(profile.primaryCount);
    setMemoryGiBPerPrimary(profile.memoryGiBPerPrimary);
    setWorkingSetMillions(profile.workingSetMillions);
    setAverageValueKiB(profile.averageValueKiB);
    setRequestRate(profile.requestRate);
    setMeasuredHitRatePct(profile.measuredHitRatePct);
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
        if (!isCapacityData(payload)) throw new Error('The Redis capacity model is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load Redis capacity data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;

    const itemBytes = averageValueKiB * 1024
      + data.assumptions.averageKeyBytes
      + data.assumptions.objectOverheadBytes;
    const workingSetBytes = workingSetMillions * 1_000_000 * itemBytes;
    const physicalPrimaryBytes = primaryCount * memoryGiBPerPrimary * 1024 ** 3;
    const configuredMaxmemoryBytes = physicalPrimaryBytes
      * (data.assumptions.maxmemorySharePct / 100);
    const coveragePct = Math.min(100, (configuredMaxmemoryBytes / workingSetBytes) * 100);
    const memoryGapBytes = Math.max(0, workingSetBytes - configuredMaxmemoryBytes);
    const headroomPct = Math.max(
      0,
      ((configuredMaxmemoryBytes - workingSetBytes) / configuredMaxmemoryBytes) * 100,
    );
    const backendMissRps = requestRate * (1 - measuredHitRatePct / 100);
    const coldSourceRps = requestRate;
    const physicalRamWithReplicaBytes = physicalPrimaryBytes * 2;

    if (memoryGapBytes > 0) {
      return {
        backendMissRps,
        coldSourceRps,
        configuredMaxmemoryBytes,
        coveragePct,
        headroomPct,
        memoryGapBytes,
        physicalPrimaryBytes,
        physicalRamWithReplicaBytes,
        workingSetBytes,
        status: 'The working set exceeds maxmemory',
        tone: 'rose' as const,
        verdict: `The modeled keys need ${gib(workingSetBytes / 1024 ** 3)}, but the primaries expose ${gib(configuredMaxmemoryBytes / 1024 ** 3)} through maxmemory. Redis must evict eligible keys or reject memory-growing writes, depending on policy.`,
      };
    }

    if (backendMissRps > data.assumptions.backendMissBudgetRps) {
      return {
        backendMissRps,
        coldSourceRps,
        configuredMaxmemoryBytes,
        coveragePct,
        headroomPct,
        memoryGapBytes,
        physicalPrimaryBytes,
        physicalRamWithReplicaBytes,
        workingSetBytes,
        status: 'The steady miss path exceeds its budget',
        tone: 'rose' as const,
        verdict: `A ${measuredHitRatePct}% hit rate still sends ${compact(backendMissRps)} requests per second to the source, above the modeled ${compact(data.assumptions.backendMissBudgetRps)} request budget. Fix reuse or source capacity before treating the cache as protection.`,
      };
    }

    if (headroomPct < data.assumptions.warningHeadroomPct) {
      return {
        backendMissRps,
        coldSourceRps,
        configuredMaxmemoryBytes,
        coveragePct,
        headroomPct,
        memoryGapBytes,
        physicalPrimaryBytes,
        physicalRamWithReplicaBytes,
        workingSetBytes,
        status: 'The model fits with little memory headroom',
        tone: 'amber' as const,
        verdict: `Only ${Math.round(headroomPct)}% of the configured dataset budget remains. Size percentiles, temporary command results, fragmentation, replication buffers, and AOF buffers can turn a narrow average-case fit into eviction pressure.`,
      };
    }

    return {
      backendMissRps,
      coldSourceRps,
      configuredMaxmemoryBytes,
      coveragePct,
      headroomPct,
      memoryGapBytes,
      physicalPrimaryBytes,
      physicalRamWithReplicaBytes,
      workingSetBytes,
      status: 'The modeled memory and miss budgets have headroom',
      tone: 'emerald' as const,
      verdict: `The working set fits below maxmemory with ${Math.round(headroomPct)}% planning headroom, and steady misses remain inside the source budget. A cold cache still sends up to ${compact(coldSourceRps)} requests per second toward the source, so warm-up needs separate admission control.`,
    };
  }, [
    averageValueKiB,
    data,
    measuredHitRatePct,
    memoryGiBPerPrimary,
    primaryCount,
    requestRate,
    workingSetMillions,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Memory and miss-load lab"
          title={data?.title ?? 'Can Redis hold the useful hot set?'}
          description={data?.description ?? 'Loading the Redis capacity model.'}
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
                        accent={profile.id === 'permission-snapshots' ? 'violet' : profile.id === 'rendered-responses' ? 'amber' : 'cyan'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange label="Primary shards" value={primaryCount} output={`${primaryCount}`} {...data.bounds.primaryCount} accent="blue" lowLabel="One dataset owner" highLabel="More shards" onChange={(value) => { setProfileId(''); setPrimaryCount(value); }} />
                <LabRange label="RAM per primary" value={memoryGiBPerPrimary} output={`${memoryGiBPerPrimary} GiB`} {...data.bounds.memoryGiBPerPrimary} accent="cyan" lowLabel="Smaller node" highLabel="Larger node" onChange={(value) => { setProfileId(''); setMemoryGiBPerPrimary(value); }} />
                <LabRange label="Working-set keys" value={workingSetMillions} output={`${workingSetMillions}M`} {...data.bounds.workingSetMillions} accent="violet" lowLabel="Focused" highLabel="Broad" onChange={(value) => { setProfileId(''); setWorkingSetMillions(value); }} />
                <LabRange label="Average value" value={averageValueKiB} output={`${averageValueKiB} KiB`} {...data.bounds.averageValueKiB} accent="amber" lowLabel="Compact" highLabel="Large" onChange={(value) => { setProfileId(''); setAverageValueKiB(value); }} />
                <LabRange label="Read rate" value={requestRate} output={`${compact(requestRate)}/s`} {...data.bounds.requestRate} accent="rose" lowLabel="Steady" highLabel="Peak" onChange={(value) => { setProfileId(''); setRequestRate(value); }} />
                <LabRange label="Measured hit rate" value={measuredHitRatePct} output={`${measuredHitRatePct}%`} {...data.bounds.measuredHitRatePct} accent="emerald" lowLabel="More misses" highLabel="High reuse" onChange={(value) => { setProfileId(''); setMeasuredHitRatePct(value); }} />
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
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
                <LabMetric label="Configured maxmemory" value={gib(result.configuredMaxmemoryBytes / 1024 ** 3)} detail={`${data.assumptions.maxmemorySharePct}% of primary RAM; leave room for process and non-eviction buffers`} icon={MemoryStick} tone="cyan" />
                <LabMetric label="Modeled working set" value={gib(result.workingSetBytes / 1024 ** 3)} detail={`${workingSetMillions}M keys including modeled key and object overhead`} icon={Boxes} tone={result.memoryGapBytes > 0 ? 'rose' : 'violet'} />
                <LabMetric label="Steady source misses" value={`${compact(result.backendMissRps)}/s`} detail={`${100 - measuredHitRatePct}% of reads continue to the authoritative source`} icon={Database} tone={result.backendMissRps > data.assumptions.backendMissBudgetRps ? 'rose' : 'emerald'} />
                <LabMetric label="RAM with one replica" value={gib(result.physicalRamWithReplicaBytes / 1024 ** 3)} detail="Primaries plus one same-size replica; replicas add safety, not unique capacity" icon={Server} tone="blue" />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Dataset envelope</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                      {Math.round(result.coveragePct)}% coverage, {Math.round(result.headroomPct)}% headroom
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Cold source demand: {compact(result.coldSourceRps)}/s
                  </p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${Math.round(result.coveragePct)} percent memory coverage`}>
                  <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${result.memoryGapBytes > 0 ? 'bg-rose-500' : result.headroomPct < data.assumptions.warningHeadroomPct ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${result.coveragePct}%` }} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <EnvelopeFact label="Per-item model" value={`${data.assumptions.averageKeyBytes + data.assumptions.objectOverheadBytes} B + value`} detail="Measure MEMORY USAGE percentiles; encodings and allocator behavior vary." />
                  <EnvelopeFact label="Eviction boundary" value="maxmemory" detail="Policy chooses eviction or write rejection after the dataset crosses the limit." />
                  <EnvelopeFact label="Buffer reserve" value={`${100 - data.assumptions.maxmemorySharePct}% of RAM`} detail="Replication and AOF buffers can consume memory outside the eviction comparison." />
                </div>
              </section>

              <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <HardDrive aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  This is a planning envelope, not a benchmark. Validate serialized size percentiles, key popularity, command mix, fragmentation, fork behavior, buffer growth, and one-node recovery on the target hardware.
                </p>
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
          <button type="button" onClick={onRetry} className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950">
            Try again
          </button>
        </div>
      ) : (
        <div>
          <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-600 motion-reduce:animate-none" />
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the Redis envelope...</p>
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
