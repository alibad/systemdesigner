'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  Filter,
  Gauge,
  Layers3,
  Network,
  ScanLine,
  Search,
  type LucideIcon,
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
  vectors: number;
  dimensions: number;
  topK: number;
  eligiblePercent: number;
  queryRps: number;
};
type IndexOption = {
  id: string;
  label: string;
  detail: string;
  family: string;
  recallMin: number;
  recallMax: number;
  candidateShareMin: number;
  candidateShareMax: number;
  memoryMultiplier: number;
  buildRate: number;
  requiresTraining: boolean;
};
type FilterOption = {
  id: string;
  label: string;
  detail: string;
  candidateMultiplier: number;
  memoryMultiplier: number;
  maintenanceRisk: string;
};
type QueryPlanData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    indexId: string;
    filterId: string;
    searchEffort: number;
  };
  bounds: { searchEffort: Bound };
  workloads: Workload[];
  indexes: IndexOption[];
  filters: FilterOption[];
};

const BLOCK_ID = 'technology/vector-databases-query-plan-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isQueryPlanData(value: unknown): value is QueryPlanData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryPlanData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.indexId
      && candidate.defaults.filterId
      && typeof candidate.defaults.searchEffort === 'number'
      && isBound(candidate.bounds?.searchEffort)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.indexes)
      && candidate.indexes.length > 0
      && Array.isArray(candidate.filters)
      && candidate.filters.length > 0,
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function VectorDatabasesQueryPlanLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QueryPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No query-plan model was supplied.');
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
        if (!isQueryPlanData(payload)) throw new Error('The query-plan model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the query lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <QueryPlanWorkbench data={data} />;
}

function QueryPlanWorkbench({ data }: { data: QueryPlanData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [indexId, setIndexId] = useState(data.defaults.indexId);
  const [filterId, setFilterId] = useState(data.defaults.filterId);
  const [searchEffort, setSearchEffort] = useState(data.defaults.searchEffort);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const index = data.indexes.find((item) => item.id === indexId) ?? data.indexes[0];
  const filter = data.filters.find((item) => item.id === filterId) ?? data.filters[0];

  const result = useMemo(() => {
    const effort = (searchEffort - data.bounds.searchEffort.min)
      / (data.bounds.searchEffort.max - data.bounds.searchEffort.min);
    const eligibleVectors = Math.max(workload.topK, workload.vectors * workload.eligiblePercent / 100);
    const searchPopulation = filter.id === 'postfilter' ? workload.vectors : eligibleVectors;
    const candidateShare = index.candidateShareMin
      + (index.candidateShareMax - index.candidateShareMin) * effort;
    const candidateVisits = index.id === 'flat'
      ? searchPopulation
      : Math.max(workload.topK * 4, searchPopulation * candidateShare * filter.candidateMultiplier);
    const expandedWindow = Math.ceil(workload.topK * (2 + searchEffort / 10));
    const survivingResults = filter.id === 'postfilter'
      ? Math.min(workload.topK, Math.floor(expandedWindow * workload.eligiblePercent / 100))
      : workload.topK;
    const completeness = survivingResults / workload.topK * 100;
    const filterPenalty = filter.id === 'prefilter' && workload.eligiblePercent < 3 && index.id !== 'flat'
      ? (3 - workload.eligiblePercent) * 2.4
      : filter.id === 'partitioned' && index.id !== 'flat'
        ? 1
        : 0;
    const underfillPenalty = (100 - completeness) * 0.22;
    const recall = Math.max(
      0,
      Math.min(
        100,
        index.recallMin + (index.recallMax - index.recallMin) * effort
          - filterPenalty
          - underfillPenalty,
      ),
    );
    const dimensionFactor = workload.dimensions / 384;
    const concurrencyFactor = 1 + Math.min(0.8, workload.queryRps / 800);
    const latencyMs = 1.8
      + candidateVisits / 45000 * dimensionFactor * concurrencyFactor
      + expandedWindow * 0.015;
    const rawBytes = workload.vectors * workload.dimensions * 4;
    const memoryGiB = rawBytes * index.memoryMultiplier * filter.memoryMultiplier / 1024 ** 3;
    const buildMinutes = workload.vectors / index.buildRate / 60;

    let verdict = 'The plan has a balanced operating envelope';
    let detail = 'The modeled result set is complete, recall is strong, and the candidate budget stays bounded. Validate it against exact search on the real corpus.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (survivingResults < workload.topK) {
      verdict = 'Postfiltering underfills the result contract';
      detail = `Only ${survivingResults} of ${workload.topK} requested eligible slots survive the candidate window. Prefilter, partition, or continue scanning under an explicit work limit.`;
      tone = 'rose';
    } else if (recall < 90) {
      verdict = 'The candidate budget sacrifices too much recall';
      detail = 'Raise search effort, choose a less compressed index, or reduce the search population with a filter-aware layout.';
      tone = recall < 80 ? 'rose' : 'amber';
    } else if (index.id === 'flat' && latencyMs > 40) {
      verdict = 'Exact search is becoming the latency bottleneck';
      detail = 'Keep exact search as the evaluation baseline, then test an ANN index against the same filtered ground truth.';
      tone = 'amber';
    } else if (memoryGiB > 80) {
      verdict = 'Resident memory dominates this design';
      detail = 'Evaluate compression, sharding, or a disk-oriented index while preserving an exact quality baseline and rebuild headroom.';
      tone = 'amber';
    } else if (filter.maintenanceRisk === 'High') {
      verdict = 'Query quality improves at an operational cost';
      detail = 'Partition routing protects completeness, but every partition adds placement, skew, rebuild, and monitoring work.';
      tone = 'amber';
    }

    return {
      buildMinutes,
      candidateVisits,
      completeness,
      detail,
      eligibleVectors,
      expandedWindow,
      latencyMs,
      memoryGiB,
      recall,
      searchPopulation,
      survivingResults,
      tone,
      verdict,
    };
  }, [data.bounds.searchEffort, filter, index, searchEffort, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setIndexId(data.defaults.indexId);
    setFilterId(data.defaults.filterId);
    setSearchEffort(data.defaults.searchEffort);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Index and filter workbench"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Workload"
                items={data.workloads}
                selectedId={workload.id}
                icon={Database}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Index family"
                items={data.indexes}
                selectedId={index.id}
                icon={indexIcon(index.id)}
                accent="violet"
                onSelect={setIndexId}
              />
              <ChoiceGroup
                label="3. Filter execution"
                items={data.filters}
                selectedId={filter.id}
                icon={Filter}
                accent="amber"
                onSelect={setFilterId}
              />
              <LabRange
                label="Search effort"
                value={searchEffort}
                output={`${searchEffort}%`}
                {...data.bounds.searchEffort}
                accent="cyan"
                lowLabel="Small candidate budget"
                highLabel="Recall-first"
                onChange={setSearchEffort}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Modeled Recall@k"
                value={`${result.recall.toFixed(1)}%`}
                detail="Against an exact filtered reference"
                icon={Gauge}
                tone={result.recall >= 95 ? 'emerald' : result.recall >= 85 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Eligible slots"
                value={`${result.survivingResults} / ${workload.topK}`}
                detail={`${result.completeness.toFixed(0)}% result completeness`}
                icon={Filter}
                tone={result.survivingResults === workload.topK ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled p95"
                value={`${result.latencyMs.toFixed(1)} ms`}
                detail={`${formatCompact(result.candidateVisits)} distance checks`}
                icon={ScanLine}
                tone={result.latencyMs <= 40 ? 'cyan' : result.latencyMs <= 100 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Resident estimate"
                value={`${result.memoryGiB.toFixed(1)} GiB`}
                detail="Vectors plus modeled index multiplier"
                icon={Archive}
                tone={result.memoryGiB < 32 ? 'blue' : result.memoryGiB < 96 ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`} />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Candidate funnel" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate funnel</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">See where work and eligible results disappear</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {index.family} index / {filter.maintenanceRisk.toLowerCase()} layout risk
                </p>
              </div>
              <div className="mt-5 space-y-4">
                <FunnelRow label="Collection" value={workload.vectors} max={workload.vectors} tone="blue" note={`${workload.dimensions} dimensions`} />
                <FunnelRow label="Eligible records" value={result.eligibleVectors} max={workload.vectors} tone="amber" note={`${workload.eligiblePercent}% filter selectivity`} />
                <FunnelRow label="Distance checks" value={result.candidateVisits} max={Math.max(result.searchPopulation, 1)} tone="violet" note={`${searchEffort}% search effort`} />
                <FunnelRow label="Returned results" value={result.survivingResults} max={workload.topK} tone={result.survivingResults === workload.topK ? 'emerald' : 'rose'} note={`requested top-${workload.topK}`} />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Candidate window" value={formatCount(result.expandedWindow)} detail="Modeled shortlist before postfiltering" />
              <Fact label="Build estimate" value={result.buildMinutes < 1 ? '< 1 min' : `${result.buildMinutes.toFixed(1)} min`} detail="Single-worker planning assumption" />
              <Fact label="Training" value={index.requiresTraining ? 'Required' : 'Not required'} detail="Still validate on representative vectors" />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'amber';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function indexIcon(id: string): LucideIcon {
  if (id === 'hnsw') return Network;
  if (id === 'ivf-flat') return Boxes;
  if (id === 'ivf-pq') return Archive;
  return ScanLine;
}

function FunnelRow({
  label,
  value,
  max,
  tone,
  note,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'blue' | 'amber' | 'violet' | 'emerald' | 'rose';
  note: string;
}) {
  const styles = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
    emerald: 'bg-emerald-500 dark:bg-emerald-400',
    rose: 'bg-rose-500 dark:bg-rose-400',
  };
  const width = Math.max(3, Math.min(100, value / Math.max(max, 1) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">{label}</span>
        <span className="text-right tabular-nums text-neutral-500 dark:text-neutral-400">{formatCompact(value)} / {note}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${styles[tone]}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 min-h-[640px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading vector query plan lab" />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <p className="font-semibold">The vector query lab could not load</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
