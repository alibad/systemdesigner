'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Columns3,
  Database,
  Files,
  FolderTree,
  Gauge,
  LoaderCircle,
  ScanSearch,
  TableProperties,
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
type Layout = {
  id: string;
  label: string;
  detail: string;
  format: 'orc' | 'text';
  partitionHours: number;
  filesPerPartition: number;
  columnPruning: boolean;
};
type ScanPlanningData = {
  title: string;
  description: string;
  defaults: {
    layoutId: string;
    queryWindowHours: number;
    projectedColumns: number;
  };
  assumptions: {
    totalDays: number;
    gibPerHour: number;
    totalColumns: number;
    broadQueryPartitionWarning: number;
    inputFileWarning: number;
  };
  bounds: {
    queryWindowHours: Bound;
    projectedColumns: Bound;
  };
  layouts: Layout[];
};

const BLOCK_ID = 'technology/hive-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/hive/data/scan-planning-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(isFiniteNumber);
}

function isScanPlanningData(value: unknown): value is ScanPlanningData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScanPlanningData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.layoutId
      && isFiniteNumber(candidate.defaults.queryWindowHours)
      && isFiniteNumber(candidate.defaults.projectedColumns)
      && candidate.assumptions
      && isFiniteNumber(candidate.assumptions.totalDays)
      && isFiniteNumber(candidate.assumptions.gibPerHour)
      && isFiniteNumber(candidate.assumptions.totalColumns)
      && isFiniteNumber(candidate.assumptions.broadQueryPartitionWarning)
      && isFiniteNumber(candidate.assumptions.inputFileWarning)
      && isBound(candidate.bounds?.queryWindowHours)
      && isBound(candidate.bounds?.projectedColumns)
      && Array.isArray(candidate.layouts)
      && candidate.layouts.length >= 3
      && candidate.layouts.every((layout) => (
        typeof layout.id === 'string'
        && typeof layout.label === 'string'
        && typeof layout.detail === 'string'
        && (layout.format === 'orc' || layout.format === 'text')
        && isFiniteNumber(layout.partitionHours)
        && isFiniteNumber(layout.filesPerPartition)
        && typeof layout.columnPruning === 'boolean'
      )),
  );
}

function formatGiB(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} TiB`;
  return `${value.toFixed(value < 10 ? 1 : 0)} GiB`;
}

export default function HivePerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScanPlanningData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScanPlanningData(payload)) throw new Error('The scan-planning model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the scan model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <ScanPlanningWorkbench data={data} />;
}

function ScanPlanningWorkbench({ data }: { data: ScanPlanningData }) {
  const [layoutId, setLayoutId] = useState(data.defaults.layoutId);
  const [queryWindowHours, setQueryWindowHours] = useState(data.defaults.queryWindowHours);
  const [projectedColumns, setProjectedColumns] = useState(data.defaults.projectedColumns);
  const layout = data.layouts.find((item) => item.id === layoutId) ?? data.layouts[0];

  const model = useMemo(() => {
    const totalHours = data.assumptions.totalDays * 24;
    const fullTableGiB = totalHours * data.assumptions.gibPerHour;
    const tablePartitions = Math.max(1, Math.ceil(totalHours / layout.partitionHours));
    const partitionsOpened = Math.max(1, Math.ceil(queryWindowHours / layout.partitionHours));
    const partitionEligibleGiB = Math.min(
      fullTableGiB,
      partitionsOpened * layout.partitionHours * data.assumptions.gibPerHour,
    );
    const projectedShare = projectedColumns / data.assumptions.totalColumns;
    const eligibleInputGiB = layout.columnPruning
      ? partitionEligibleGiB * projectedShare
      : partitionEligibleGiB;
    const filesOpened = Math.min(
      tablePartitions * layout.filesPerPartition,
      partitionsOpened * layout.filesPerPartition,
    );
    const tableSharePct = eligibleInputGiB / fullTableGiB * 100;
    const broadPartitionFanout = partitionsOpened >= data.assumptions.broadQueryPartitionWarning;
    const highFileFanout = filesOpened >= data.assumptions.inputFileWarning;

    let verdict = 'The layout narrows the query before execution';
    let detail = 'The date predicate removes directories and ORC removes unselected columns from this teaching model.';
    let tone: 'emerald' | 'amber' | 'rose' | 'blue' = 'emerald';

    if (tablePartitions === 1 && !layout.columnPruning) {
      verdict = 'The filter cannot avoid the table-wide input path';
      detail = 'A WHERE clause still filters rows, but this unpartitioned text layout offers neither directory pruning nor column pruning.';
      tone = 'rose';
    } else if (tablePartitions === 1) {
      verdict = 'Column pruning helps, but the table directory is still broad';
      detail = 'ORC can avoid unselected columns, while the date predicate still has no partition boundary to remove files.';
      tone = 'amber';
    } else if (broadPartitionFanout || highFileFanout) {
      verdict = 'Fine-grained layout creates planning and file fan-out';
      detail = 'The scan is selective by bytes, but a broad time window opens many partitions or input files. Measure planning time and file count before adding finer partitions.';
      tone = 'amber';
    } else if (layout.partitionHours === 24 && queryWindowHours < 24) {
      verdict = 'Daily pruning is useful but cannot isolate a partial day';
      detail = 'One whole daily directory remains eligible. Hourly partitions would narrow this query further, at the cost of a larger catalog.';
      tone = 'blue';
    }

    return {
      detail,
      eligibleInputGiB,
      filesOpened,
      fullTableGiB,
      partitionEligibleGiB,
      partitionsOpened,
      projectedShare,
      tablePartitions,
      tableSharePct,
      tone,
      verdict,
    } as const;
  }, [data, layout, projectedColumns, queryWindowHours]);

  function reset() {
    setLayoutId(data.defaults.layoutId);
    setQueryWindowHours(data.defaults.queryWindowHours);
    setProjectedColumns(data.defaults.projectedColumns);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Scan-planning lab"
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
                  1. Physical table layout
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.layouts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === layout.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.format === 'orc' ? TableProperties : Files}
                      accent={item.format === 'orc' ? 'cyan' : 'amber'}
                      onClick={() => setLayoutId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Time range in WHERE"
                  value={queryWindowHours}
                  output={queryWindowHours < 24 ? `${queryWindowHours}h` : `${Math.round(queryWindowHours / 24)}d`}
                  {...data.bounds.queryWindowHours}
                  lowLabel="Narrow incident"
                  highLabel="Monthly report"
                  accent="blue"
                  onChange={setQueryWindowHours}
                />
                <LabRange
                  label="Columns in SELECT"
                  value={projectedColumns}
                  output={`${projectedColumns}/${data.assumptions.totalColumns}`}
                  {...data.bounds.projectedColumns}
                  lowLabel="Focused projection"
                  highLabel="SELECT *"
                  accent="violet"
                  onChange={setProjectedColumns}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Eligible input"
                value={formatGiB(model.eligibleInputGiB)}
                detail={`${Math.max(0.01, model.tableSharePct).toFixed(model.tableSharePct < 1 ? 2 : 1)}% of the modeled table`}
                icon={Gauge}
                tone={model.tone}
              />
              <LabMetric
                label="Partitions opened"
                value={model.partitionsOpened.toLocaleString()}
                detail={`${model.tablePartitions.toLocaleString()} partitions in the table`}
                icon={FolderTree}
                tone={model.partitionsOpened >= data.assumptions.broadQueryPartitionWarning ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Input files"
                value={model.filesOpened.toLocaleString()}
                detail="Modeled files below selected directories"
                icon={Files}
                tone={model.filesOpened >= data.assumptions.inputFileWarning ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="Projected columns"
                value={`${Math.round(model.projectedShare * 100)}%`}
                detail={layout.columnPruning ? 'Applied to ORC input bytes in this model' : 'Text input still reads full rows'}
                icon={Columns3}
                tone={layout.columnPruning ? 'emerald' : 'amber'}
              />
            </div>

            <section className={`rounded-md border p-5 ${verdictStyles[model.tone]}`}>
              <div className="flex items-start gap-3">
                {model.tone === 'rose' || model.tone === 'amber'
                  ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">Planner verdict</p>
                  <h4 className="mt-1 text-lg font-semibold">{model.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{model.detail}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Input narrowing</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    A filter only saves work when the physical layout can use it
                  </h4>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Arithmetic model, not a runtime forecast
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <ScanBar
                  label="Whole table"
                  value={model.fullTableGiB}
                  total={model.fullTableGiB}
                  valueLabel={formatGiB(model.fullTableGiB)}
                  className="bg-neutral-500"
                />
                <ScanBar
                  label="After partition pruning"
                  value={model.partitionEligibleGiB}
                  total={model.fullTableGiB}
                  valueLabel={formatGiB(model.partitionEligibleGiB)}
                  className="bg-blue-500"
                />
                <ScanBar
                  label="After column projection"
                  value={model.eligibleInputGiB}
                  total={model.fullTableGiB}
                  valueLabel={formatGiB(model.eligibleInputGiB)}
                  className="bg-cyan-500"
                />
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-3">
              <DecisionStage
                number="1"
                icon={CalendarRange}
                title="Directory pruning"
                detail={model.tablePartitions === 1
                  ? 'No partition key exists, so the date predicate cannot remove directories.'
                  : `${model.partitionsOpened} matching partition${model.partitionsOpened === 1 ? '' : 's'} remain.`}
              />
              <DecisionStage
                number="2"
                icon={Columns3}
                title="Column pruning"
                detail={layout.columnPruning
                  ? `ORC keeps ${projectedColumns} selected column streams eligible in this model.`
                  : 'Text rows are read as records before projection removes columns.'}
              />
              <DecisionStage
                number="3"
                icon={Database}
                title="Row-group skipping"
                detail="ORC statistics may skip row groups when predicates and data ordering make that possible; this model does not assume a hit rate."
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const verdictStyles = {
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
} as const;

function ScanBar({
  label,
  value,
  total,
  valueLabel,
  className,
}: {
  label: string;
  value: number;
  total: number;
  valueLabel: string;
  className: string;
}) {
  const width = value <= 0 ? 0 : Math.max(1.5, Math.min(100, value / total * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">{valueLabel}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function DecisionStage({
  number,
  icon: Icon,
  title,
  detail,
}: {
  number: string;
  icon: typeof CalendarRange;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">{number}</span>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <h5 className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</h5>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-950 p-6 text-neutral-200 dark:border-neutral-800">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-amber-300" />
          <p className="mt-3 text-sm">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-700 px-3 py-2 text-sm font-semibold hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading the scan-planning model...
        </div>
      )}
    </div>
  );
}
