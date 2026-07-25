'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Blocks,
  CircleAlert,
  Database,
  Filter,
  Globe2,
  Route,
  ShieldCheck,
  Shuffle,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type LayoutId = 'unpartitioned' | 'partitioned' | 'partitioned-clustered';
type ScenarioId = 'targeted' | 'missing-date' | 'hot-key' | 'region-outage';

type Layout = {
  id: LayoutId;
  label: string;
  detail: string;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  hasDateFilter: boolean;
  hasCustomerFilter: boolean;
};

const layouts: Layout[] = [
  {
    id: 'unpartitioned',
    label: 'One unpartitioned table',
    detail: 'Every query can inspect all 90 TiB of column data.',
  },
  {
    id: 'partitioned',
    label: 'Daily event-date partitions',
    detail: 'A usable date predicate can prune unrelated days.',
  },
  {
    id: 'partitioned-clustered',
    label: 'Daily partitions + customer clustering',
    detail: 'Date pruning narrows partitions; clustered blocks may narrow a customer lookup further.',
  },
];

const scenarios: Scenario[] = [
  {
    id: 'targeted',
    label: 'Seven days, one customer',
    detail: 'The query filters the partition column and a clustered customer key.',
    hasDateFilter: true,
    hasCustomerFilter: true,
  },
  {
    id: 'missing-date',
    label: 'Date predicate omitted',
    detail: 'A dashboard keeps the customer filter but loses partition pruning.',
    hasDateFilter: false,
    hasCustomerFilter: true,
  },
  {
    id: 'hot-key',
    label: 'Hot-key join skew',
    detail: 'The scan is narrow, but duplicate join keys concentrate shuffle work.',
    hasDateFilter: true,
    hasCustomerFilter: true,
  },
  {
    id: 'region-outage',
    label: 'Primary region unavailable',
    detail: 'Storage layout cannot make a single-location deployment region-resilient.',
    hasDateFilter: false,
    hasCustomerFilter: false,
  },
];

const datasetTiB = 90;
const daysRetained = 365;
const daysRequested = 7;
const clusteredBlockFraction = 0.08;

function formatTiB(value: number) {
  if (value === 0) return '0 TiB';
  if (value < 0.1) return `${(value * 1_024).toFixed(0)} GiB`;
  return `${value.toFixed(value < 10 ? 2 : 1)} TiB`;
}

export default function BigQueryPartitionFailureOptimizationLab() {
  const [layoutId, setLayoutId] = useState<LayoutId>('partitioned-clustered');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('targeted');
  const [requireDateFilter, setRequireDateFilter] = useState(true);
  const [secondaryReady, setSecondaryReady] = useState(false);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  const reset = () => {
    setLayoutId('partitioned-clustered');
    setScenarioId('targeted');
    setRequireDateFilter(true);
    setSecondaryReady(false);
  };

  const model = useMemo(() => {
    const partitioned = layoutId !== 'unpartitioned';
    const clustered = layoutId === 'partitioned-clustered';
    const regionFailure = scenarioId === 'region-outage';
    const blocked = partitioned && requireDateFilter && !scenario.hasDateFilter && !regionFailure;

    if (regionFailure) {
      return {
        bytesRead: 0,
        scanRatio: 0,
        partitionPruned: false,
        clusterPruned: false,
        blocked: false,
        state: secondaryReady ? 'Fail over' : 'Unavailable',
        risk: secondaryReady ? 'Recovery procedure' : 'Regional availability',
        verdict: secondaryReady
          ? 'A secondary dataset and compute capacity create a recovery path. Execute the tested failover procedure and verify freshness before serving results.'
          : 'Partitioning and clustering do not protect a single-location architecture from regional unavailability.',
        action: secondaryReady
          ? 'Route jobs to the secondary location, verify the recovery point, and keep writes fenced until ownership is clear.'
          : 'Replicate required data to a geographically separate location, provision usable compute there, and rehearse failover before setting a regional RTO.',
        tone: secondaryReady ? ('amber' as const) : ('rose' as const),
      };
    }

    if (blocked) {
      return {
        bytesRead: 0,
        scanRatio: 0,
        partitionPruned: false,
        clusterPruned: false,
        blocked: true,
        state: 'Rejected',
        risk: 'Missing partition filter',
        verdict: 'The guardrail rejects the query before it performs a broad table scan.',
        action: 'Add a predicate that BigQuery can use to prune the partitioning column, then use a dry run to review estimated bytes before execution.',
        tone: 'amber' as const,
      };
    }

    const partitionFraction = partitioned && scenario.hasDateFilter ? daysRequested / daysRetained : 1;
    const clusterFraction = clustered && scenario.hasCustomerFilter ? clusteredBlockFraction : 1;
    const bytesRead = datasetTiB * partitionFraction * clusterFraction;
    const scanRatio = (bytesRead / datasetTiB) * 100;
    const partitionPruned = partitioned && scenario.hasDateFilter;
    const clusterPruned = clustered && scenario.hasCustomerFilter;

    if (scenarioId === 'hot-key') {
      return {
        bytesRead,
        scanRatio,
        partitionPruned,
        clusterPruned,
        blocked: false,
        state: 'Shuffle pressure',
        risk: 'Skewed join stage',
        verdict: `The layout reduces the input to ${formatTiB(bytesRead)}, but duplicate hot keys can still send a disproportionate share of shuffle work to a small set of workers.`,
        action: 'Inspect stage records, shuffle output, spill, and key frequencies. Aggregate or deduplicate before the join when the business semantics allow it.',
        tone: 'rose' as const,
      };
    }

    if (scenarioId === 'missing-date') {
      return {
        bytesRead,
        scanRatio,
        partitionPruned,
        clusterPruned,
        blocked: false,
        state: 'Broad scan',
        risk: 'Partition pruning lost',
        verdict: `Without a usable date predicate, the query reads across the retention window. Clustering may still reduce blocks for the customer filter, but it does not restore partition pruning.`,
        action: 'Require a partition filter for bounded tables and alert on jobs whose processed bytes regress from their normal range.',
        tone: 'amber' as const,
      };
    }

    if (!partitioned) {
      return {
        bytesRead,
        scanRatio,
        partitionPruned,
        clusterPruned,
        blocked: false,
        state: 'Full scan',
        risk: 'Layout mismatch',
        verdict: 'The SQL asks for seven days and one customer, but the table layout gives the engine no partition or block boundary to skip in this model.',
        action: 'Partition on a stable, commonly filtered date or timestamp, then cluster on selective columns that appear in filters or joins.',
        tone: 'rose' as const,
      };
    }

    return {
      bytesRead,
      scanRatio,
      partitionPruned,
      clusterPruned,
      blocked: false,
      state: clustered ? 'Narrow scan' : 'Date-pruned',
      risk: clustered ? 'Observe block selectivity' : 'Customer filter scans each selected partition',
      verdict: clustered
        ? 'Partition pruning removes unrelated days, and clustering can skip blocks that do not contain the selected customer.'
        : 'Partition pruning removes unrelated days. The customer predicate still evaluates across the selected partitions because no clustered block order helps it.',
      action: 'Use dry-run bytes and repeated production jobs to verify the actual benefit; clustering is adaptive block pruning, not an index lookup guarantee.',
      tone: clustered ? ('emerald' as const) : ('cyan' as const),
    };
  }, [layoutId, requireDateFilter, scenario, scenarioId, secondaryReady]);

  const scanWidth = model.blocked ? 0 : Math.max(model.scanRatio > 0 ? 2 : 0, Math.min(100, model.scanRatio));

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Partitioning, failure, and optimization lab"
        title="Optimize the scan, then inject a failure"
        description="Choose a physical layout and query scenario. Add a partition guardrail or a regional recovery path to see which risks each control can and cannot address."
        icon={Route}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Table layout
              </legend>
              <div className="mt-3 space-y-2">
                {layouts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={layoutId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'unpartitioned' ? Database : item.id === 'partitioned' ? Blocks : Filter}
                    accent="violet"
                    onClick={() => setLayoutId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Query or failure
              </legend>
              <div className="mt-3 space-y-2">
                {scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={scenarioId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'targeted' ? BadgeCheck : item.id === 'missing-date' ? Filter : item.id === 'hot-key' ? Shuffle : Globe2}
                    accent="rose"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Partition-filter policy
              </legend>
              {layoutId === 'unpartitioned' ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
                  A table-level partition-filter requirement is unavailable until the table has a partition column.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <LabChoice
                    selected={!requireDateFilter}
                    label="Allow broad scans"
                    detail="Rely on query authors"
                    accent="amber"
                    onClick={() => setRequireDateFilter(false)}
                  />
                  <LabChoice
                    selected={requireDateFilter}
                    label="Require date filter"
                    detail="Reject missing filters on partitioned tables"
                    icon={ShieldCheck}
                    accent="emerald"
                    onClick={() => setRequireDateFilter(true)}
                  />
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Regional recovery
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <LabChoice
                  selected={!secondaryReady}
                  label="Single location"
                  detail="No independent failover path"
                  accent="rose"
                  onClick={() => setSecondaryReady(false)}
                />
                <LabChoice
                  selected={secondaryReady}
                  label="Secondary ready"
                  detail="Replicated data, slots, and tested routing"
                  icon={Globe2}
                  accent="blue"
                  onClick={() => setSecondaryReady(true)}
                />
              </div>
            </fieldset>
          </div>
        }
      >
        <div data-content-block="technology/bigquery-partition-failure-optimization-lab" className="min-w-0" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Modeled bytes read"
              value={model.blocked ? 'Blocked' : model.state === 'Unavailable' ? 'No route' : formatTiB(model.bytesRead)}
              detail={`From a ${datasetTiB} TiB retained table`}
              icon={Database}
              tone={model.tone}
            />
            <LabMetric
              label="Table scan ratio"
              value={model.blocked || model.state === 'Unavailable' ? '0%' : `${model.scanRatio.toFixed(model.scanRatio < 1 ? 2 : 1)}%`}
              detail={model.partitionPruned ? `${daysRequested} of ${daysRetained} partitions considered` : 'No partition pruning'}
              icon={Filter}
              tone={model.partitionPruned ? 'emerald' : model.tone}
            />
            <LabMetric
              label="Query state"
              value={model.state}
              detail={model.risk}
              icon={model.tone === 'rose' ? CircleAlert : BadgeCheck}
              tone={model.tone}
            />
            <LabMetric
              label="Recovery posture"
              value={secondaryReady ? 'Secondary ready' : 'One location'}
              detail={secondaryReady ? 'Data and compute are available elsewhere' : 'Regional recovery is not configured'}
              icon={Globe2}
              tone={secondaryReady ? 'blue' : 'neutral'}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <span>Fraction of retained table read</span>
              <span className="tabular-nums">{model.blocked ? 'Rejected before scan' : `${model.scanRatio.toFixed(model.scanRatio < 1 ? 2 : 1)}%`}</span>
            </div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950" role="img" aria-label={model.blocked ? 'The query is rejected before scanning data' : `The query reads ${model.scanRatio.toFixed(2)} percent of the retained table`}>
              <div
                className={`h-full rounded-full transition-[width] ${model.tone === 'rose' ? 'bg-rose-500' : model.tone === 'amber' ? 'bg-amber-500' : model.tone === 'cyan' ? 'bg-cyan-500' : 'bg-emerald-500'}`}
                style={{ width: `${scanWidth}%` }}
              />
            </div>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Controls that fired</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                <li>{model.partitionPruned ? 'Partition pruning limited the date range.' : 'Partition pruning did not reduce this query.'}</li>
                <li>{model.clusterPruned ? 'Clustered blocks reduced the modeled customer scan.' : 'No clustered block reduction applied.'}</li>
                <li>{layoutId === 'unpartitioned' ? 'A table-level partition-filter guardrail is unavailable.' : model.blocked ? 'The partition-filter guardrail rejected the query.' : requireDateFilter ? 'The query passed the required partition-filter policy.' : 'The table allows queries without a partition filter.'}</li>
              </ul>
            </section>
            <section className={`rounded-md border p-4 ${model.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : model.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <p className="text-sm font-semibold">{model.verdict}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{model.action}</p>
            </section>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
