'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  LoaderCircle,
  PackageOpen,
  RotateCcw,
  ServerCog,
  TrendingDown,
  TrendingUp,
  Workflow,
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
  liveDataGiB: number;
  activeCompactionGiB: number;
  rangeReadPct: number;
  updatePct: number;
  recommendedStrategyId: string;
};
type Strategy = {
  id: string;
  label: string;
  detail: string;
  writeAmplification: number;
  readRuns: number;
  spaceAmplification: number;
  temporaryInputMultiplier: number;
};
type CompactionData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    strategyId: string;
    logicalWriteMBps: number;
    compactionCapacityMBps: number;
    freeDiskPct: number;
  };
  bounds: {
    logicalWriteMBps: Bound;
    compactionCapacityMBps: Bound;
    freeDiskPct: Bound;
  };
  workloads: Workload[];
  strategies: Strategy[];
};

const BLOCK_ID = 'technology/sstable-compaction-envelope-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isCompactionData(value: unknown): value is CompactionData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CompactionData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.strategyId
      && typeof candidate.defaults.logicalWriteMBps === 'number'
      && typeof candidate.defaults.compactionCapacityMBps === 'number'
      && typeof candidate.defaults.freeDiskPct === 'number'
      && isBound(candidate.bounds?.logicalWriteMBps)
      && isBound(candidate.bounds?.compactionCapacityMBps)
      && isBound(candidate.bounds?.freeDiskPct)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.liveDataGiB === 'number'
        && typeof item.activeCompactionGiB === 'number'
        && typeof item.rangeReadPct === 'number'
        && typeof item.updatePct === 'number'
        && typeof item.recommendedStrategyId === 'string'
      ))
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 2
      && candidate.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.writeAmplification === 'number'
        && typeof item.readRuns === 'number'
        && typeof item.spaceAmplification === 'number'
        && typeof item.temporaryInputMultiplier === 'number'
      )),
  );
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  }).format(value);
}

export default function SSTableCompactionEnvelopeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CompactionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No compaction model was supplied.');
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
        if (!isCompactionData(payload)) throw new Error('The compaction model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the compaction lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <CompactionWorkbench data={data} />;
}

function CompactionWorkbench({ data }: { data: CompactionData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [strategyId, setStrategyId] = useState(data.defaults.strategyId);
  const [logicalWriteMBps, setLogicalWriteMBps] = useState(data.defaults.logicalWriteMBps);
  const [compactionCapacityMBps, setCompactionCapacityMBps] = useState(data.defaults.compactionCapacityMBps);
  const [freeDiskPct, setFreeDiskPct] = useState(data.defaults.freeDiskPct);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const result = useMemo(() => {
    const requiredCompactionMBps = logicalWriteMBps * (strategy.writeAmplification - 1);
    const physicalWriteMBps = logicalWriteMBps + requiredCompactionMBps;
    const capacityMarginMBps = compactionCapacityMBps - requiredCompactionMBps;
    const backlogGrowthGiBPerHour = Math.max(0, -capacityMarginMBps) * 3600 / 1024;
    const totalDiskGiB = workload.liveDataGiB / (1 - freeDiskPct / 100);
    const freeDiskGiB = totalDiskGiB - workload.liveDataGiB;
    const temporaryDiskGiB = workload.activeCompactionGiB * strategy.temporaryInputMultiplier;
    const diskMarginGiB = freeDiskGiB - temporaryDiskGiB;
    const storedFootprintGiB = workload.liveDataGiB * strategy.spaceAmplification;
    const strategyFit = workload.recommendedStrategyId === strategy.id;
    const hoursToExhaustion = backlogGrowthGiBPerHour > 0
      ? Math.max(0, diskMarginGiB) / backlogGrowthGiBPerHour
      : Number.POSITIVE_INFINITY;
    const throughputUtilization = Math.min(100, requiredCompactionMBps / compactionCapacityMBps * 100);
    const diskUtilization = Math.min(100, temporaryDiskGiB / Math.max(1, freeDiskGiB) * 100);

    let verdict = 'Compaction has a sustainable operating envelope';
    let detail = strategyFit
      ? 'Background capacity drains rewrite work, temporary outputs fit, and the strategy matches the dominant read-write shape.'
      : `The envelope is sustainable, but ${data.strategies.find((item) => item.id === workload.recommendedStrategyId)?.label ?? 'the recommended strategy'} better matches this workload's dominant pressure.`;
    let tone: 'emerald' | 'amber' | 'rose' = strategyFit ? 'emerald' : 'amber';

    if (diskMarginGiB < 0) {
      verdict = 'Compaction cannot stage its output safely';
      detail = `The active job needs ${formatNumber(temporaryDiskGiB)} GiB, but only ${formatNumber(freeDiskGiB)} GiB is free. Pause growth, add capacity, or compact a smaller unit before disk fills.`;
      tone = 'rose';
    } else if (capacityMarginMBps < 0) {
      verdict = 'Compaction debt grows every hour';
      detail = `Rewrite demand exceeds worker capacity by ${formatNumber(-capacityMarginMBps)} MB/s, adding ${formatNumber(backlogGrowthGiBPerHour)} GiB of debt per hour.`;
      tone = hoursToExhaustion < 4 ? 'rose' : 'amber';
    } else if (capacityMarginMBps < requiredCompactionMBps * 0.15) {
      verdict = 'The system has almost no compaction burst margin';
      detail = 'Normal demand fits, but retries, flush bursts, or a slow device can move the system into backlog. Reserve more worker or I/O headroom.';
      tone = 'amber';
    }

    return {
      backlogGrowthGiBPerHour,
      capacityMarginMBps,
      detail,
      diskMarginGiB,
      diskUtilization,
      freeDiskGiB,
      hoursToExhaustion,
      physicalWriteMBps,
      requiredCompactionMBps,
      storedFootprintGiB,
      strategyFit,
      temporaryDiskGiB,
      throughputUtilization,
      tone,
      verdict,
    } as const;
  }, [compactionCapacityMBps, data.strategies, freeDiskPct, logicalWriteMBps, strategy, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setStrategyId(data.defaults.strategyId);
    setLogicalWriteMBps(data.defaults.logicalWriteMBps);
    setCompactionCapacityMBps(data.defaults.compactionCapacityMBps);
    setFreeDiskPct(data.defaults.freeDiskPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Compaction control room"
          title={data.title}
          description={data.description}
          icon={ServerCog}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.rangeReadPct >= 50 ? BarChart3 : Database}
                      accent={item.rangeReadPct >= 50 ? 'cyan' : item.updatePct >= 40 ? 'violet' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Compaction shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'leveled' ? Layers3 : PackageOpen}
                      accent={item.id === 'leveled' ? 'violet' : 'amber'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Logical write rate"
                  value={logicalWriteMBps}
                  output={`${logicalWriteMBps} MB/s`}
                  {...data.bounds.logicalWriteMBps}
                  lowLabel="Steady ingest"
                  highLabel="Write burst"
                  accent="blue"
                  onChange={setLogicalWriteMBps}
                />
                <LabRange
                  label="Compaction capacity"
                  value={compactionCapacityMBps}
                  output={`${compactionCapacityMBps} MB/s`}
                  {...data.bounds.compactionCapacityMBps}
                  lowLabel="Constrained workers"
                  highLabel="More drain capacity"
                  accent="emerald"
                  onChange={setCompactionCapacityMBps}
                />
                <LabRange
                  label="Free disk"
                  value={freeDiskPct}
                  output={`${freeDiskPct}%`}
                  {...data.bounds.freeDiskPct}
                  lowLabel="Tight headroom"
                  highLabel="Migration room"
                  accent="amber"
                  onChange={setFreeDiskPct}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Physical writes"
                value={`${formatNumber(result.physicalWriteMBps)} MB/s`}
                detail={`${formatNumber(strategy.writeAmplification)}x total write amplification`}
                icon={TrendingUp}
                tone={strategy.writeAmplification > 5 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Capacity margin"
                value={`${result.capacityMarginMBps >= 0 ? '+' : ''}${formatNumber(result.capacityMarginMBps)} MB/s`}
                detail={result.capacityMarginMBps >= 0 ? 'Available rewrite headroom' : 'Sustained compaction deficit'}
                icon={Gauge}
                tone={result.capacityMarginMBps < 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Read runs"
                value={`Up to ${strategy.readRuns}`}
                detail={`${workload.rangeReadPct}% of this workload is range-oriented`}
                icon={Layers3}
                tone={strategy.readRuns > 5 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Stored footprint"
                value={`${formatNumber(result.storedFootprintGiB)} GiB`}
                detail={`${formatNumber(strategy.spaceAmplification, 2)}x modeled space amplification`}
                icon={HardDrive}
                tone={strategy.spaceAmplification > 1.4 ? 'amber' : 'cyan'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Write-to-level flow
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                See where logical bytes become background work
              </h4>

              <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch">
                <FlowStage
                  icon={Database}
                  eyebrow="Foreground"
                  title={`${logicalWriteMBps} MB/s logical`}
                  detail="WAL and MemTable accept the write contract."
                  tone="blue"
                />
                <FlowArrow />
                <FlowStage
                  icon={PackageOpen}
                  eyebrow="Flush"
                  title={`${logicalWriteMBps} MB/s new runs`}
                  detail="Sorted immutable files enter level zero."
                  tone="cyan"
                />
                <FlowArrow />
                <FlowStage
                  icon={Workflow}
                  eyebrow="Rewrite demand"
                  title={`${formatNumber(result.requiredCompactionMBps)} MB/s`}
                  detail={`${compactionCapacityMBps} MB/s of worker capacity available.`}
                  tone={result.capacityMarginMBps < 0 ? 'rose' : 'emerald'}
                />
                <FlowArrow />
                <FlowStage
                  icon={Layers3}
                  eyebrow="Read shape"
                  title={`${strategy.readRuns} candidate runs`}
                  detail={`${strategy.label} layout after compaction catches up.`}
                  tone="violet"
                />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <PressureMeter
                label="Compaction throughput"
                detail={`${formatNumber(result.requiredCompactionMBps)} MB/s demand / ${compactionCapacityMBps} MB/s capacity`}
                percent={result.throughputUtilization}
                healthy={result.capacityMarginMBps >= 0}
              />
              <PressureMeter
                label="Temporary disk workspace"
                detail={`${formatNumber(result.temporaryDiskGiB)} GiB needed / ${formatNumber(result.freeDiskGiB)} GiB free`}
                percent={result.diskUtilization}
                healthy={result.diskMarginGiB >= 0}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{result.verdict}</h4>
                    <span className="rounded-sm border border-current px-2 py-0.5 text-[11px] font-semibold uppercase opacity-70">
                      {result.strategyFit ? 'Workload fit' : 'Trade-off selected'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                  {Number.isFinite(result.hoursToExhaustion) ? (
                    <p className="mt-2 text-xs font-semibold">
                      Modeled free-space runway after staging: {formatNumber(result.hoursToExhaustion, 2)} hours
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowStage({
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
  tone: 'blue' | 'cyan' | 'emerald' | 'rose' | 'violet';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100',
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

function FlowArrow() {
  return (
    <span className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-4 w-4 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-4 w-4 md:block" />
    </span>
  );
}

function PressureMeter({
  label,
  detail,
  percent,
  healthy,
}: {
  label: string;
  detail: string;
  percent: number;
  healthy: boolean;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
        {healthy
          ? <TrendingDown aria-label="Within capacity" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          : <TrendingUp aria-label="Over capacity" className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
      </div>
      <div
        className="mt-4 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={`h-full transition-[width] motion-reduce:transition-none ${healthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
        />
      </div>
      <p className={`mt-2 text-xs font-semibold ${healthy
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-rose-700 dark:text-rose-300'
      }`}>
        {healthy ? 'Within the modeled envelope' : 'Capacity boundary exceeded'}
      </p>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error
          ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          : <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-500 motion-reduce:animate-none" />}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Compaction lab unavailable' : 'Loading compaction model'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error ?? 'Preparing the rewrite-capacity envelope.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
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
