'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Binary,
  Blocks,
  CheckCircle2,
  CircleAlert,
  Database,
  Filter,
  Gauge,
  HardDrive,
  KeyRound,
  Layers3,
  LoaderCircle,
  MemoryStick,
  RotateCcw,
  ScanSearch,
  Search,
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
type Workload = {
  id: string;
  label: string;
  detail: string;
  lookupKind: 'point' | 'range';
  presentPct: number;
  overlapPct: number;
  blocksPerCandidate: number;
};
type ReadPathData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    tableCount: number;
    bloomBitsPerKey: number;
    cacheHitPct: number;
  };
  bounds: {
    tableCount: Bound;
    bloomBitsPerKey: Bound;
    cacheHitPct: Bound;
  };
  randomReadLatencyMs: number;
  cachedBlockLatencyMs: number;
  workloads: Workload[];
};

const BLOCK_ID = 'technology/sstable-read-path-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isReadPathData(value: unknown): value is ReadPathData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReadPathData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.tableCount === 'number'
      && typeof candidate.defaults.bloomBitsPerKey === 'number'
      && typeof candidate.defaults.cacheHitPct === 'number'
      && isBound(candidate.bounds?.tableCount)
      && isBound(candidate.bounds?.bloomBitsPerKey)
      && isBound(candidate.bounds?.cacheHitPct)
      && typeof candidate.randomReadLatencyMs === 'number'
      && typeof candidate.cachedBlockLatencyMs === 'number'
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && (item.lookupKind === 'point' || item.lookupKind === 'range')
        && typeof item.presentPct === 'number'
        && typeof item.overlapPct === 'number'
        && typeof item.blocksPerCandidate === 'number'
      )),
  );
}

function formatNumber(value: number, digits = 1) {
  const minimumFractionDigits = value > 0 && value < 1 ? 2 : 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.max(digits, minimumFractionDigits),
    minimumFractionDigits,
  }).format(value);
}

export default function SSTableReadPathLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReadPathData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No read-path model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReadPathData(payload)) throw new Error('The read-path model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the read lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <ReadPathWorkbench data={data} />;
}

function ReadPathWorkbench({ data }: { data: ReadPathData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [tableCount, setTableCount] = useState(data.defaults.tableCount);
  const [bloomBitsPerKey, setBloomBitsPerKey] = useState(data.defaults.bloomBitsPerKey);
  const [cacheHitPct, setCacheHitPct] = useState(data.defaults.cacheHitPct);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const falsePositiveRate = bloomBitsPerKey === 0 ? 1 : 0.6185 ** bloomBitsPerKey;
    const presentProbability = workload.presentPct / 100;
    const candidateRuns = workload.lookupKind === 'range'
      ? Math.max(1, tableCount * workload.overlapPct / 100)
      : presentProbability * (1 + (tableCount - 1) * falsePositiveRate * 0.5)
        + (1 - presentProbability) * tableCount * falsePositiveRate;
    const blocksConsidered = candidateRuns * workload.blocksPerCandidate;
    const cachedBlocks = blocksConsidered * cacheHitPct / 100;
    const diskBlocks = Math.max(0, blocksConsidered - cachedBlocks);
    const randomSeeks = workload.lookupKind === 'range'
      ? Math.min(candidateRuns, diskBlocks)
      : diskBlocks;
    const sequentialBlocks = Math.max(0, diskBlocks - randomSeeks);
    const expectedLatencyMs = randomSeeks * data.randomReadLatencyMs
      + sequentialBlocks * 0.16
      + cachedBlocks * data.cachedBlockLatencyMs;
    const rejectedRuns = workload.lookupKind === 'point'
      ? Math.max(0, tableCount - candidateRuns)
      : 0;
    const bloomMemoryMiBPerMillion = bloomBitsPerKey * 1_000_000 / 8 / 1024 ** 2;
    const hashFunctions = bloomBitsPerKey === 0 ? 0 : Math.max(1, Math.round(bloomBitsPerKey * Math.LN2));

    let verdict = 'The lookup stays inside a bounded read budget';
    let detail = 'Filters remove irrelevant runs and the cache absorbs most candidate blocks before disk.';
    let tone: 'emerald' | 'amber' | 'rose' | 'blue' = 'emerald';

    if (workload.lookupKind === 'range') {
      verdict = 'Range scans depend on overlap, not point-key filters';
      detail = 'Bloom bits do not change this path. Compaction, key-range overlap, block size, and cache behavior are the useful levers.';
      tone = diskBlocks > 8 ? 'amber' : 'blue';
    } else if (bloomBitsPerKey === 0) {
      verdict = 'Every immutable run becomes a candidate';
      detail = 'Without a Bloom filter, a missing point key must inspect the index and candidate block path in every overlapping run.';
      tone = 'rose';
    } else if (diskBlocks > 2) {
      verdict = 'Read amplification reaches disk';
      detail = 'Filters help, but the run count and cache miss rate still create multiple random reads per request. Compact runs or increase useful cache coverage.';
      tone = 'amber';
    }

    return {
      bloomMemoryMiBPerMillion,
      blocksConsidered,
      cachedBlocks,
      candidateRuns,
      detail,
      diskBlocks,
      expectedLatencyMs,
      falsePositiveRate,
      hashFunctions,
      rejectedRuns,
      tone,
      verdict,
    } as const;
  }, [bloomBitsPerKey, cacheHitPct, data, tableCount, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setTableCount(data.defaults.tableCount);
    setBloomBitsPerKey(data.defaults.bloomBitsPerKey);
    setCacheHitPct(data.defaults.cacheHitPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Read-path workbench"
          title={data.title}
          description={data.description}
          icon={ScanSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Lookup shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.lookupKind === 'range' ? Search : KeyRound}
                      accent={item.lookupKind === 'range' ? 'violet' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Immutable runs"
                  value={tableCount}
                  output={`${tableCount} SSTables`}
                  {...data.bounds.tableCount}
                  lowLabel="Compacted"
                  highLabel="Many overlapping runs"
                  accent="violet"
                  onChange={setTableCount}
                />
                <LabRange
                  label="Bloom memory"
                  value={bloomBitsPerKey}
                  output={`${bloomBitsPerKey} bits / key`}
                  {...data.bounds.bloomBitsPerKey}
                  lowLabel="No filter"
                  highLabel="Lower false-positive rate"
                  accent="cyan"
                  onChange={setBloomBitsPerKey}
                />
                <LabRange
                  label="Block-cache hit rate"
                  value={cacheHitPct}
                  output={`${cacheHitPct}%`}
                  {...data.bounds.cacheHitPct}
                  lowLabel="Cold cache"
                  highLabel="Warm cache"
                  accent="emerald"
                  onChange={setCacheHitPct}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Candidate runs"
                value={formatNumber(result.candidateRuns)}
                detail={`Expected work across ${tableCount} immutable runs`}
                icon={Layers3}
                tone={result.candidateRuns > 4 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Disk blocks"
                value={formatNumber(result.diskBlocks)}
                detail={`${formatNumber(result.cachedBlocks)} candidate blocks served from cache`}
                icon={HardDrive}
                tone={result.diskBlocks > 2 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Modeled latency"
                value={`${formatNumber(result.expectedLatencyMs, 2)} ms`}
                detail="Illustrative expected I/O time, not a device benchmark"
                icon={Gauge}
                tone={result.expectedLatencyMs > 8 ? 'rose' : result.expectedLatencyMs > 3 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Filter budget"
                value={`${formatNumber(result.bloomMemoryMiBPerMillion, 2)} MiB`}
                detail={`Per 1M keys; ${result.hashFunctions} hash functions`}
                icon={MemoryStick}
                tone="cyan"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Lookup runway
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    One request, four narrowing decisions
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Expected values per lookup
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch">
                <PathStage
                  icon={Layers3}
                  eyebrow="Run directory"
                  title={`${tableCount} SSTables`}
                  detail="Use key bounds and newest-first order."
                  tone="violet"
                />
                <PathArrow />
                <PathStage
                  icon={Filter}
                  eyebrow="Bloom filters"
                  title={workload.lookupKind === 'range' ? 'Not applicable' : `${formatNumber(result.rejectedRuns)} rejected`}
                  detail={workload.lookupKind === 'range' ? 'A point filter cannot answer interval overlap.' : `${formatNumber(result.falsePositiveRate * 100, 2)}% false-positive rate.`}
                  tone="cyan"
                />
                <PathArrow />
                <PathStage
                  icon={Binary}
                  eyebrow="Sparse indexes"
                  title={`${formatNumber(result.candidateRuns)} searched`}
                  detail="Locate the first candidate block offset."
                  tone="blue"
                />
                <PathArrow />
                <PathStage
                  icon={Blocks}
                  eyebrow="Data blocks"
                  title={`${formatNumber(result.diskBlocks)} to disk`}
                  detail={`${formatNumber(result.blocksConsidered)} total candidate blocks.`}
                  tone="emerald"
                />
              </div>
            </section>

            <section className={`rounded-md border p-4 ${result.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                : result.tone === 'blue'
                  ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <h4 className="font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: typeof Database;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'blue' | 'emerald';
}) {
  const styles = {
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
  } as const;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <span className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-4 w-4 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-4 w-4 md:block" />
    </span>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error
          ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          : <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-500 motion-reduce:animate-none" />}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Read-path lab unavailable' : 'Loading read-path model'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error ?? 'Preparing the immutable-run model.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
