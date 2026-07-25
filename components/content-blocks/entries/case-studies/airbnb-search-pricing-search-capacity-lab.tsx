'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  MapPin,
  Search,
  Server,
  TriangleAlert,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeData {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface SearchCapacityData {
  title: string;
  description: string;
  peakSearchesPerSecond: RangeData;
  candidatesPerSearch: RangeData;
  availabilitySnapshotTtlSeconds: RangeData;
  rankerWorkers: RangeData;
  candidateScoresPerWorkerSecond: number;
  targetUtilization: number;
  snapshotBaseHitRate: number;
  snapshotHitRateGainPerSecond: number;
  maxSnapshotHitRate: number;
  safeInventoryChecksPerSecond: number;
  responseBudgetMs: number;
  rankingBaseLatencyMs: number;
  candidatesPerRankingMillisecond: number;
}

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeData>;
  return (
    typeof candidate.default === 'number' &&
    typeof candidate.min === 'number' &&
    typeof candidate.max === 'number' &&
    typeof candidate.step === 'number' &&
    candidate.min < candidate.max &&
    candidate.step > 0 &&
    candidate.default >= candidate.min &&
    candidate.default <= candidate.max
  );
}

function isSearchCapacityData(value: unknown): value is SearchCapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SearchCapacityData>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    isRangeData(candidate.peakSearchesPerSecond) &&
    isRangeData(candidate.candidatesPerSearch) &&
    isRangeData(candidate.availabilitySnapshotTtlSeconds) &&
    isRangeData(candidate.rankerWorkers) &&
    typeof candidate.candidateScoresPerWorkerSecond === 'number' &&
    candidate.candidateScoresPerWorkerSecond > 0 &&
    typeof candidate.targetUtilization === 'number' &&
    candidate.targetUtilization > 0 &&
    candidate.targetUtilization < 1 &&
    typeof candidate.snapshotBaseHitRate === 'number' &&
    candidate.snapshotBaseHitRate >= 0 &&
    candidate.snapshotBaseHitRate <= 1 &&
    typeof candidate.snapshotHitRateGainPerSecond === 'number' &&
    candidate.snapshotHitRateGainPerSecond >= 0 &&
    typeof candidate.maxSnapshotHitRate === 'number' &&
    candidate.maxSnapshotHitRate > 0 &&
    candidate.maxSnapshotHitRate <= 1 &&
    typeof candidate.safeInventoryChecksPerSecond === 'number' &&
    candidate.safeInventoryChecksPerSecond > 0 &&
    typeof candidate.responseBudgetMs === 'number' &&
    candidate.responseBudgetMs > 0 &&
    typeof candidate.rankingBaseLatencyMs === 'number' &&
    candidate.rankingBaseLatencyMs > 0 &&
    typeof candidate.candidatesPerRankingMillisecond === 'number' &&
    candidate.candidatesPerRankingMillisecond > 0
  );
}

function formatRate(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function AirbnbSearchPricingSearchCapacityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SearchCapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [peakSearchesPerSecond, setPeakSearchesPerSecond] = useState(0);
  const [candidatesPerSearch, setCandidatesPerSearch] = useState(0);
  const [availabilitySnapshotTtlSeconds, setAvailabilitySnapshotTtlSeconds] = useState(0);
  const [rankerWorkers, setRankerWorkers] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Search capacity request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSearchCapacityData(payload)) {
          throw new Error('Search capacity data is invalid');
        }
        setData(payload);
        setPeakSearchesPerSecond(payload.peakSearchesPerSecond.default);
        setCandidatesPerSearch(payload.candidatesPerSearch.default);
        setAvailabilitySnapshotTtlSeconds(payload.availabilitySnapshotTtlSeconds.default);
        setRankerWorkers(payload.rankerWorkers.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const candidateScoresPerSecond = peakSearchesPerSecond * candidatesPerSearch;
    const rawRankerCapacity = rankerWorkers * data.candidateScoresPerWorkerSecond;
    const plannedRankerCapacity = Math.floor(rawRankerCapacity * data.targetUtilization);
    const rankerPressure =
      plannedRankerCapacity === 0 ? 0 : candidateScoresPerSecond / plannedRankerCapacity;
    const snapshotHitRate = Math.min(
      data.maxSnapshotHitRate,
      data.snapshotBaseHitRate +
        availabilitySnapshotTtlSeconds * data.snapshotHitRateGainPerSecond,
    );
    const inventoryChecksPerSecond = Math.round(
      candidateScoresPerSecond * (1 - snapshotHitRate),
    );
    const inventoryPressure = inventoryChecksPerSecond / data.safeInventoryChecksPerSecond;
    const queueGrowthSearchesPerSecond =
      candidatesPerSearch === 0
        ? 0
        : Math.max(0, candidateScoresPerSecond - plannedRankerCapacity) /
          candidatesPerSearch;

    const queuePenaltyMs =
      rankerPressure <= 0.75
        ? 0
        : rankerPressure <= 1
          ? ((rankerPressure - 0.75) / 0.25) * 70
          : 70 + Math.min(500, (rankerPressure - 1) * 350);
    const inventoryPenaltyMs =
      inventoryPressure <= 1 ? 0 : Math.min(180, (inventoryPressure - 1) * 120);
    const retrievalMs = 18 + (1 - snapshotHitRate) * 70 + inventoryPenaltyMs;
    const rankingMs =
      data.rankingBaseLatencyMs +
      candidatesPerSearch / data.candidatesPerRankingMillisecond +
      queuePenaltyMs;
    const estimatedP95Ms = Math.round(18 + retrievalMs + 22 + rankingMs + 18 + 12);

    const overloaded = rankerPressure > 1 || inventoryPressure > 1;
    const slow = estimatedP95Ms > data.responseBudgetMs;
    const stale = availabilitySnapshotTtlSeconds > 45;

    return {
      candidateScoresPerSecond,
      rawRankerCapacity,
      plannedRankerCapacity,
      rankerPressure,
      snapshotHitRate,
      inventoryChecksPerSecond,
      inventoryPressure,
      queueGrowthSearchesPerSecond,
      estimatedP95Ms,
      overloaded,
      slow,
      stale,
    };
  }, [
    availabilitySnapshotTtlSeconds,
    candidatesPerSearch,
    data,
    peakSearchesPerSecond,
    rankerWorkers,
  ]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        The search capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading search capacity model"
        className="min-h-[720px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const reset = () => {
    setPeakSearchesPerSecond(data.peakSearchesPerSecond.default);
    setCandidatesPerSearch(data.candidatesPerSearch.default);
    setAvailabilitySnapshotTtlSeconds(data.availabilitySnapshotTtlSeconds.default);
    setRankerWorkers(data.rankerWorkers.default);
  };

  const stateTone: 'rose' | 'amber' | 'emerald' = model.overloaded
    ? 'rose'
    : model.slow || model.stale
      ? 'amber'
      : 'emerald';
  const StateIcon = model.overloaded
    ? TriangleAlert
    : model.slow || model.stale
      ? CircleAlert
      : CheckCircle2;
  const verdict = model.overloaded
    ? 'The regional search path is beyond its safe capacity envelope'
    : model.slow
      ? 'The request fits, but the estimated P95 misses the response target'
      : model.stale
        ? 'The fast path is healthy, but availability may remain stale too long'
        : 'The search plan fits the latency, capacity, and freshness targets';
  const consequence = model.overloaded
    ? `Ranking or inventory work is saturated. About ${formatRate(model.queueGrowthSearchesPerSecond)} searches/s can join the queue, so guests see slow results, timeouts, or partial recall.`
    : model.slow
      ? `The estimated P95 is ${model.estimatedP95Ms} ms against a ${data.responseBudgetMs} ms target. Reduce candidate breadth, add ranker capacity, or remove noncritical features from the online path.`
      : model.stale
        ? `A sold night can remain eligible in the projection for up to ${availabilitySnapshotTtlSeconds} seconds. Revalidate inventory before display or booking and tell the guest when a result changed.`
        : `The ranker has reserve, authoritative inventory checks stay below their safe limit, and a sold night ages out of the search projection within ${availabilitySnapshotTtlSeconds} seconds.`;

  return (
    <div data-content-block="case-studies/airbnb-search-pricing-search-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Geographic search capacity lab"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange
                label="Peak searches"
                value={peakSearchesPerSecond}
                output={`${formatRate(peakSearchesPerSecond)}/s`}
                min={data.peakSearchesPerSecond.min}
                max={data.peakSearchesPerSecond.max}
                step={data.peakSearchesPerSecond.step}
                lowLabel="Ordinary peak"
                highLabel="Event surge"
                onChange={setPeakSearchesPerSecond}
              />
              <LabRange
                label="Candidates per search"
                value={candidatesPerSearch}
                output={candidatesPerSearch.toLocaleString()}
                min={data.candidatesPerSearch.min}
                max={data.candidatesPerSearch.max}
                step={data.candidatesPerSearch.step}
                accent="violet"
                lowLabel="Lower recall"
                highLabel="Broader recall"
                onChange={setCandidatesPerSearch}
              />
              <LabRange
                label="Availability snapshot TTL"
                value={availabilitySnapshotTtlSeconds}
                output={`${availabilitySnapshotTtlSeconds}s`}
                min={data.availabilitySnapshotTtlSeconds.min}
                max={data.availabilitySnapshotTtlSeconds.max}
                step={data.availabilitySnapshotTtlSeconds.step}
                accent="amber"
                lowLabel="Fresher, more reads"
                highLabel="Cheaper, staler"
                onChange={setAvailabilitySnapshotTtlSeconds}
              />
              <LabRange
                label="Ranker workers"
                value={rankerWorkers}
                output={rankerWorkers.toLocaleString()}
                min={data.rankerWorkers.min}
                max={data.rankerWorkers.max}
                step={data.rankerWorkers.step}
                accent="blue"
                lowLabel="Small regional pool"
                highLabel="More headroom"
                onChange={setRankerWorkers}
              />
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The availability cache holds a bounded projection for retrieval. The
                booking and price authorities still decide whether a night can be sold
                and what the checkout total is.
              </p>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Candidate scores"
              value={`${formatRate(model.candidateScoresPerSecond)}/s`}
              detail={`${formatRate(peakSearchesPerSecond)} searches x ${candidatesPerSearch.toLocaleString()} candidates`}
              icon={MapPin}
              tone="violet"
            />
            <LabMetric
              label="Ranker capacity"
              value={`${formatRate(model.plannedRankerCapacity)}/s`}
              detail={`${Math.round(data.targetUtilization * 100)}% operating target; ${formatRate(model.rawRankerCapacity)}/s raw`}
              icon={Server}
              tone={model.rankerPressure > 1 ? 'rose' : 'blue'}
            />
            <LabMetric
              label="Inventory fallbacks"
              value={`${formatRate(model.inventoryChecksPerSecond)}/s`}
              detail={`${Math.round(model.snapshotHitRate * 100)}% snapshot hit rate`}
              icon={Database}
              tone={model.inventoryPressure > 1 ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Estimated search P95"
              value={`${model.estimatedP95Ms} ms`}
              detail={`${data.responseBudgetMs} ms regional target`}
              icon={Clock3}
              tone={model.estimatedP95Ms > data.responseBudgetMs ? 'rose' : 'emerald'}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Ranker pressure
                </span>
                <output className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {Math.round(model.rankerPressure * 100)}%
                </output>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    model.rankerPressure > 1
                      ? 'bg-rose-500'
                      : model.rankerPressure > 0.8
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, model.rankerPressure * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Pressure compares scoring demand with the pool's planned capacity, not
                its unsafe raw ceiling.
              </p>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Inventory authority pressure
                </span>
                <output className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {Math.round(model.inventoryPressure * 100)}%
                </output>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    model.inventoryPressure > 1
                      ? 'bg-rose-500'
                      : model.inventoryPressure > 0.8
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, model.inventoryPressure * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                A longer TTL absorbs more reads, but expands the interval in which a
                sold night can survive in retrieval.
              </p>
            </div>
          </div>

          <div
            className={`mt-5 rounded-md border p-4 ${
              stateTone === 'rose'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                : stateTone === 'amber'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <StateIcon
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  stateTone === 'rose'
                    ? 'text-rose-600 dark:text-rose-300'
                    : stateTone === 'amber'
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-emerald-600 dark:text-emerald-300'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {verdict}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {consequence}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-neutral-200 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            {model.overloaded ? (
              <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            ) : (
              <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
            )}
            <p className="leading-6">
              Tune for enough geographic recall to find good homes, enough reserve to
              survive a regional burst, and a freshness window short enough that
              revalidation rarely surprises the guest.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
