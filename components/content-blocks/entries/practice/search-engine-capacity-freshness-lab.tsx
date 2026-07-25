'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  Network,
  Search,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const secondsPerDay = 86_400;
const peakMultiplier = 3;
const indexToTextRatio = 0.3;
const indexCopies = 3;
const documentsPerShardGroup = 250_000_000;
const crawlerCapacityPerSecond = 120_000;
const shardRpcBudgetPerSecond = 6_000_000;

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function storage(bytes: number) {
  if (bytes >= 1_000_000_000_000_000) return `${(bytes / 1_000_000_000_000_000).toFixed(1)} PB`;
  if (bytes >= 1_000_000_000_000) return `${(bytes / 1_000_000_000_000).toFixed(0)} TB`;
  return `${(bytes / 1_000_000_000).toFixed(0)} GB`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function SearchEngineCapacityFreshnessLab() {
  const [corpusBillions, setCorpusBillions] = useState(10);
  const [extractedKilobytes, setExtractedKilobytes] = useState(20);
  const [dailyRevisitPercent, setDailyRevisitPercent] = useState(5);
  const [dailyQueryBillions, setDailyQueryBillions] = useState(4);
  const [resultCacheHitPercent, setResultCacheHitPercent] = useState(25);

  const model = useMemo(() => {
    const documents = corpusBillions * 1_000_000_000;
    const rawTextBytes = documents * extractedKilobytes * 1_000;
    const primaryIndexBytes = rawTextBytes * indexToTextRatio;
    const replicatedIndexBytes = primaryIndexBytes * indexCopies;
    const revisitPagesPerDay = documents * (dailyRevisitPercent / 100);
    const requiredFetchesPerSecond = revisitPagesPerDay / secondsPerDay;
    const crawlHours = revisitPagesPerDay / crawlerCapacityPerSecond / 3_600;
    const backlogPagesPerDay = Math.max(
      0,
      revisitPagesPerDay - crawlerCapacityPerSecond * secondsPerDay,
    );
    const averageQueryQps = (dailyQueryBillions * 1_000_000_000) / secondsPerDay;
    const peakQueryQps = averageQueryQps * peakMultiplier;
    const shardGroups = Math.ceil(documents / documentsPerShardGroup);
    const uncachedQueryQps = peakQueryQps * (1 - resultCacheHitPercent / 100);
    const shardRpcsPerSecond = uncachedQueryQps * shardGroups;
    const crawlUtilization = requiredFetchesPerSecond / crawlerCapacityPerSecond;
    const rpcUtilization = shardRpcsPerSecond / shardRpcBudgetPerSecond;

    return {
      primaryIndexBytes,
      replicatedIndexBytes,
      revisitPagesPerDay,
      requiredFetchesPerSecond,
      crawlHours,
      backlogPagesPerDay,
      peakQueryQps,
      shardGroups,
      shardRpcsPerSecond,
      crawlUtilization,
      rpcUtilization,
      freshnessHealthy: crawlHours <= 24,
      servingHealthy: shardRpcsPerSecond <= shardRpcBudgetPerSecond,
    };
  }, [corpusBillions, dailyQueryBillions, dailyRevisitPercent, extractedKilobytes, resultCacheHitPercent]);

  const reset = () => {
    setCorpusBillions(10);
    setExtractedKilobytes(20);
    setDailyRevisitPercent(5);
    setDailyQueryBillions(4);
    setResultCacheHitPercent(25);
  };

  const healthy = model.freshnessHealthy && model.servingHealthy;
  const recommendation = healthy
    ? 'The modeled envelope fits both tested budgets'
    : !model.freshnessHealthy && !model.servingHealthy
      ? 'Both ingestion and query fan-out need a design change'
      : !model.freshnessHealthy
        ? 'Prioritize recrawls or add measured fetch capacity'
        : 'Reduce query fan-out before adding ranking work';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and freshness lab"
        title="Turn corpus and query assumptions into system pressure"
        description="Change the corpus, revisit policy, demand, and cache hit rate. The model couples storage, crawler work, and document-shard fan-out instead of treating them as unrelated server counts."
        icon={Search}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Canonical corpus"
              value={corpusBillions}
              output={`${corpusBillions}B documents`}
              min={1}
              max={100}
              step={1}
              accent="cyan"
              lowLabel="1 billion"
              highLabel="100 billion"
              onChange={setCorpusBillions}
            />
            <LabRange
              label="Extracted text per document"
              value={extractedKilobytes}
              output={`${extractedKilobytes} KB`}
              min={5}
              max={100}
              step={5}
              accent="violet"
              lowLabel="Compact"
              highLabel="Rich text"
              onChange={setExtractedKilobytes}
            />
            <LabRange
              label="Corpus revisited daily"
              value={dailyRevisitPercent}
              output={`${dailyRevisitPercent}%`}
              min={1}
              max={25}
              step={1}
              accent="emerald"
              lowLabel="Selective"
              highLabel="Aggressive"
              onChange={setDailyRevisitPercent}
            />
            <LabRange
              label="Queries per day"
              value={dailyQueryBillions}
              output={`${dailyQueryBillions.toFixed(1)}B`}
              min={0.5}
              max={12}
              step={0.5}
              accent="blue"
              lowLabel="0.5 billion"
              highLabel="12 billion"
              onChange={setDailyQueryBillions}
            />
            <LabRange
              label="Whole-result cache hit rate"
              value={resultCacheHitPercent}
              output={`${resultCacheHitPercent}%`}
              min={0}
              max={70}
              step={5}
              accent="amber"
              lowLabel="No cache"
              highLabel="Head-heavy"
              onChange={setResultCacheHitPercent}
            />
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Primary index"
            value={storage(model.primaryIndexBytes)}
            detail={`${storage(model.replicatedIndexBytes)} across ${indexCopies} copies`}
            icon={Database}
            tone="violet"
          />
          <LabMetric
            label="Peak query load"
            value={`${compact(model.peakQueryQps)}/s`}
            detail={`${peakMultiplier}x the daily average`}
            icon={Activity}
            tone="blue"
          />
          <LabMetric
            label="Shard RPC fan-out"
            value={`${compact(model.shardRpcsPerSecond)}/s`}
            detail={`${model.shardGroups} document-shard groups after cache`}
            icon={Network}
            tone={model.servingHealthy ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Revisit work"
            value={`${model.crawlHours.toFixed(1)} h`}
            detail={`${compact(model.revisitPagesPerDay)} pages at 120K fetches/s`}
            icon={Clock3}
            tone={model.freshnessHealthy ? 'emerald' : 'amber'}
          />
        </div>

        <div
          className={`mt-5 rounded-md border p-4 ${
            healthy
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {healthy ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">{recommendation}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                The revisit plan needs {compact(model.requiredFetchesPerSecond)} fetches/s. The query path uses {percent(model.rpcUtilization)} of the tested shard-RPC budget after result-cache hits.
              </p>
              {model.backlogPagesPerDay > 0 ? (
                <p className="mt-1 text-sm font-semibold">
                  Unfinished revisit backlog: {compact(model.backlogPagesPerDay)} pages per day.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Gauge aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                Crawler budget
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                {percent(model.crawlUtilization)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded ${model.freshnessHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, model.crawlUtilization * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              Crawl priority is a scheduling decision. Give frequently changing and important URLs more of this finite budget.
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Network aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Shard-RPC budget
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                {percent(model.rpcUtilization)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded ${model.servingHealthy ? 'bg-cyan-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, model.rpcUtilization * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              Result caching helps head queries, but shard pruning and local top-K retrieval protect the long tail.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          Scenario constants are explicit assumptions: a 30% index-to-text ratio, three index copies, 250 million documents per shard group, 120K crawler fetches/s, and a tested 6M shard RPC/s serving budget. Replace them with measurements before procurement.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
