'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  Filter,
  Gauge,
  HardDrive,
  ListFilter,
  Search,
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

type Workload = {
  id: string;
  label: string;
  detail: string;
  vectorsMillions: number;
  dimensions: number;
  topK: number;
  recallFloor: number;
  p95BudgetMs: number;
};

type IndexPlan = {
  id: string;
  label: string;
  detail: string;
  kind: 'exact' | 'graph' | 'compressed';
  recallLow: number;
  recallHigh: number;
  baseLatencyMs: number;
  latencyPerMillionMs: number;
  effortLatencyMs: number;
  bytesPerDimension: number;
  bytesPerVector: number;
};

type FilterPlan = {
  id: string;
  label: string;
  detail: string;
  recallMultiplier: number;
  baseFilterLatencyMs: number;
  candidateMultiplier: number;
};

type SearchQualityData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    indexId: string;
    filterPlanId: string;
    searchEffort: number;
    eligiblePercent: number;
  };
  effort: { min: number; max: number; step: number };
  workloads: Workload[];
  indexes: IndexPlan[];
  filterPlans: FilterPlan[];
};

const BLOCK_ID = 'genai/vector-database-implementation-search-quality-lab';

function isSearchQualityData(value: unknown): value is SearchQualityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SearchQualityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.effort
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.indexes)
      && candidate.indexes.length > 0
      && Array.isArray(candidate.filterPlans)
      && candidate.filterPlans.length > 0,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function VectorDatabaseImplementationSearchQualityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SearchQualityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No search-quality model was supplied.');
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
        if (!isSearchQualityData(payload)) throw new Error('Search-quality data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load search data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <SearchQualityWorkbench data={data} />;
}

function SearchQualityWorkbench({ data }: { data: SearchQualityData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [indexId, setIndexId] = useState(data.defaults.indexId);
  const [filterPlanId, setFilterPlanId] = useState(data.defaults.filterPlanId);
  const [searchEffort, setSearchEffort] = useState(data.defaults.searchEffort);
  const [eligiblePercent, setEligiblePercent] = useState(data.defaults.eligiblePercent);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const index = data.indexes.find((item) => item.id === indexId) ?? data.indexes[0];
  const filterPlan = data.filterPlans.find((item) => item.id === filterPlanId) ?? data.filterPlans[0];

  const result = useMemo(() => {
    const effortRatio = (searchEffort - data.effort.min) / (data.effort.max - data.effort.min);
    const eligibleRatio = eligiblePercent / 100;
    const prefiltered = filterPlan.id === 'prefilter';
    const searchedMillions = workload.vectorsMillions * (prefiltered ? eligibleRatio : 1);
    const curve = index.kind === 'exact' ? 1 : 1 - Math.exp(-3.1 * Math.max(0, effortRatio));
    const indexRecall = index.recallLow + (index.recallHigh - index.recallLow) * curve;

    const rawCandidates = index.kind === 'exact'
      ? Math.round(searchedMillions * 1_000_000)
      : Math.max(workload.topK, Math.round(searchEffort * Math.sqrt(workload.vectorsMillions) * 2.5));
    const returnedCandidates = index.kind === 'exact'
      ? workload.topK
      : Math.max(workload.topK, workload.topK * filterPlan.candidateMultiplier);
    const eligibleCandidates = prefiltered
      ? returnedCandidates
      : Math.floor(returnedCandidates * eligibleRatio);
    const fillRatio = Math.min(1, eligibleCandidates / workload.topK);
    const filterRecall = prefiltered ? filterPlan.recallMultiplier : 0.45 + 0.55 * fillRatio;
    const recall = Math.min(1, indexRecall * filterRecall);
    const resultCount = Math.min(workload.topK, eligibleCandidates);

    const p95LatencyMs = index.baseLatencyMs
      + index.latencyPerMillionMs * searchedMillions
      + index.effortLatencyMs * effortRatio
      + filterPlan.baseFilterLatencyMs
      + (prefiltered && eligiblePercent < 5 ? 4 : 0);
    const bytes = workload.vectorsMillions
      * 1_000_000
      * (workload.dimensions * index.bytesPerDimension + index.bytesPerVector);
    const memoryGiB = bytes / 1024 / 1024 / 1024;

    const recallPass = recall >= workload.recallFloor;
    const latencyPass = p95LatencyMs <= workload.p95BudgetMs;
    const countPass = resultCount >= workload.topK;
    const safe = recallPass && latencyPass && countPass;

    let verdict = 'Ready for a measured canary';
    let detail = 'The planning model clears recall, result-count, and p95 latency gates. Validate it on exact labeled queries before release.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!countPass) {
      verdict = 'Post-filtering starves the result set';
      detail = `Only ${resultCount} of ${workload.topK} requested results survive the filter. Move authorization into the indexed search path or adapt candidate depth.`;
      tone = 'rose';
    } else if (!recallPass && !latencyPass) {
      verdict = 'This operating point misses both gates';
      detail = 'More search work would improve recall but further consume latency. Change the index, representation, or service budget.';
      tone = 'rose';
    } else if (!recallPass) {
      verdict = 'Retrieval quality is below the release floor';
      detail = 'Increase measured search effort or choose a less compressed index, then rerun exact ground-truth evaluation.';
      tone = 'amber';
    } else if (!latencyPass) {
      verdict = 'Search quality passes, but tail latency does not';
      detail = 'Reduce search work, narrow the authorized corpus, or move to an index plan that clears the same recall at lower cost.';
      tone = 'amber';
    }

    return {
      countPass,
      detail,
      eligibleCandidates,
      latencyPass,
      memoryGiB,
      p95LatencyMs,
      rawCandidates,
      recall,
      recallPass,
      resultCount,
      safe,
      searchedMillions,
      tone,
      verdict,
    };
  }, [data.effort, eligiblePercent, filterPlan, index, searchEffort, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setIndexId(data.defaults.indexId);
    setFilterPlanId(data.defaults.filterPlanId);
    setSearchEffort(data.defaults.searchEffort);
    setEligiblePercent(data.defaults.eligiblePercent);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Recall and latency workbench"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Retrieval workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'legal' ? ShieldCheck : item.id === 'catalog' ? Boxes : Database}
                      accent={item.id === 'legal' ? 'rose' : item.id === 'catalog' ? 'amber' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Index plan
                </legend>
                <div className="mt-3 space-y-2">
                  {data.indexes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === index.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.kind === 'exact' ? Database : item.kind === 'graph' ? Search : HardDrive}
                      accent={item.kind === 'exact' ? 'blue' : item.kind === 'graph' ? 'cyan' : 'violet'}
                      onClick={() => setIndexId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Filter placement
                </legend>
                <div className="mt-3 space-y-2">
                  {data.filterPlans.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === filterPlan.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'prefilter' ? ShieldCheck : ListFilter}
                      accent={item.id === 'prefilter' ? 'emerald' : 'amber'}
                      onClick={() => setFilterPlanId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Query-time search effort"
                value={searchEffort}
                output={`${searchEffort} candidates`}
                min={data.effort.min}
                max={data.effort.max}
                step={data.effort.step}
                accent="cyan"
                lowLabel="Fast"
                highLabel="Thorough"
                onChange={setSearchEffort}
              />

              <LabRange
                label="Corpus allowed by filters"
                value={eligiblePercent}
                output={`${eligiblePercent}%`}
                min={1}
                max={100}
                step={1}
                accent="emerald"
                lowLabel="Selective"
                highLabel="Entire corpus"
                onChange={setEligiblePercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled recall@k"
                value={`${(result.recall * 100).toFixed(1)}%`}
                detail={`${(workload.recallFloor * 100).toFixed(0)}% release floor`}
                icon={Gauge}
                tone={result.recallPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled p95"
                value={`${result.p95LatencyMs.toFixed(1)} ms`}
                detail={`${workload.p95BudgetMs} ms workload budget`}
                icon={Search}
                tone={result.latencyPass ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Returned"
                value={`${result.resultCount} / ${workload.topK}`}
                detail={`${result.eligibleCandidates} eligible candidates`}
                icon={Filter}
                tone={result.countPass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Index memory"
                value={`${result.memoryGiB.toFixed(1)} GiB`}
                detail={`${workload.vectorsMillions}M x ${workload.dimensions}D vectors`}
                icon={HardDrive}
                tone={index.kind === 'compressed' ? 'violet' : 'neutral'}
              />
            </div>

            <section aria-label="Search execution trace" className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Execution trace</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Where candidates disappear</h4>
                </div>
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  {filterPlan.id === 'prefilter' ? 'Authorization first' : 'Authorization last'}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <TraceStep
                  label="Eligible search space"
                  value={`${result.searchedMillions.toFixed(2)}M`}
                  detail={filterPlan.id === 'prefilter' ? 'Filtered before ANN traversal' : 'Global corpus traversed'}
                  icon={Database}
                />
                <TraceConnector />
                <TraceStep
                  label="Distance work"
                  value={formatNumber(result.rawCandidates)}
                  detail={index.kind === 'exact' ? 'Vectors scored' : 'Modeled nodes or codes examined'}
                  icon={Search}
                />
                <TraceConnector />
                <TraceStep
                  label="Authorized candidates"
                  value={formatNumber(result.eligibleCandidates)}
                  detail={`${eligiblePercent}% of the global corpus is eligible`}
                  icon={ShieldCheck}
                  warning={!result.countPass}
                />
                <TraceConnector />
                <TraceStep
                  label="Evidence returned"
                  value={`${result.resultCount} items`}
                  detail={`Requested top-${workload.topK}`}
                  icon={CheckCircle2}
                  warning={!result.countPass}
                />
              </div>
            </section>

            <div className={`rounded-md border p-5 ${verdictStyle[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.safe ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release decision</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const verdictStyle = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
};

function TraceStep({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  warning?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border bg-white p-3 dark:bg-neutral-950 ${warning ? 'border-rose-300 dark:border-rose-900' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <Icon aria-hidden="true" className={`h-4 w-4 ${warning ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function TraceConnector() {
  return (
    <div className="flex h-5 items-center justify-center text-neutral-400 md:h-auto" aria-hidden="true">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading the search-quality model...</p>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <p className="font-semibold">Search-quality model unavailable</p>
      <p className="mt-1 text-sm opacity-80">{detail}</p>
    </div>
  );
}
