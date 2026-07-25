'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Columns3,
  Database,
  FileSearch,
  Layers3,
  ScanLine,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Column = {
  id: string;
  label: string;
  compressedMiBPerRowGroup: number;
};

type RowGroup = {
  id: string;
  label: string;
  minEventDay: number;
  maxEventDay: number;
};

type Layout = {
  id: string;
  label: string;
  detail: string;
  rowGroups: RowGroup[];
};

type Query = {
  id: string;
  label: string;
  detail: string;
  selectedColumnIds: string[];
  eventDayRange?: [number, number];
};

type ScanPlanningModel = {
  dataset: {
    label: string;
    rowsPerRowGroup: number;
  };
  defaultLayoutId: string;
  defaultQueryId: string;
  columns: Column[];
  layouts: Layout[];
  queries: Query[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/parquet/data/scan-planning-model.json';

function isScanPlanningModel(value: unknown): value is ScanPlanningModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScanPlanningModel>;
  return Boolean(
    candidate.dataset
      && typeof candidate.dataset.rowsPerRowGroup === 'number'
      && Array.isArray(candidate.columns)
      && candidate.columns.length > 0
      && Array.isArray(candidate.layouts)
      && candidate.layouts.length > 0
      && candidate.layouts.every((layout) => Array.isArray(layout.rowGroups) && layout.rowGroups.length > 0)
      && Array.isArray(candidate.queries)
      && candidate.queries.length > 0,
  );
}

function formatMiB(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(2)} GiB`;
  return `${value.toLocaleString()} MiB`;
}

function intersects(rowGroup: RowGroup, range?: [number, number]) {
  if (!range) return true;
  return rowGroup.maxEventDay >= range[0] && rowGroup.minEventDay <= range[1];
}

export default function ParquetScanPlanningLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScanPlanningModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [layoutId, setLayoutId] = useState('');
  const [queryId, setQueryId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isScanPlanningModel(payload)) throw new Error('The scan model is incomplete.');
        setData(payload);
        setLayoutId(payload.defaultLayoutId);
        setQueryId(payload.defaultQueryId);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the scan model.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const layout = data.layouts.find((item) => item.id === layoutId) ?? data.layouts[0];
    const query = data.queries.find((item) => item.id === queryId) ?? data.queries[0];
    const selectedColumns = data.columns.filter((column) =>
      query.selectedColumnIds.includes(column.id),
    );
    const readRowGroups = layout.rowGroups.filter((rowGroup) =>
      intersects(rowGroup, query.eventDayRange),
    );
    const selectedMiBPerRowGroup = selectedColumns.reduce(
      (total, column) => total + column.compressedMiBPerRowGroup,
      0,
    );
    const totalMiBPerRowGroup = data.columns.reduce(
      (total, column) => total + column.compressedMiBPerRowGroup,
      0,
    );
    const bytesReadMiB = readRowGroups.length * selectedMiBPerRowGroup;
    const fileSizeMiB = layout.rowGroups.length * totalMiBPerRowGroup;
    const chunksRead = readRowGroups.length * selectedColumns.length;
    const totalChunks = layout.rowGroups.length * data.columns.length;

    return {
      layout,
      query,
      selectedColumns,
      readRowGroups,
      bytesReadMiB,
      fileSizeMiB,
      chunksRead,
      totalChunks,
      rowsExamined: readRowGroups.length * data.dataset.rowsPerRowGroup,
      reductionPct: Math.round((1 - bytesReadMiB / fileSizeMiB) * 100),
    };
  }, [data, layoutId, queryId]);

  if (error) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">The Parquet scan model could not be loaded.</p>
        <p className="mt-2 leading-6 opacity-80">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="min-h-[620px] animate-pulse rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading Parquet scan model"
      />
    );
  }

  const reset = () => {
    setLayoutId(data.defaultLayoutId);
    setQueryId(data.defaultQueryId);
  };
  const skippedCount = result.layout.rowGroups.length - result.readRowGroups.length;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Footer planning lab"
        title="Plan the physical Parquet read"
        description="Choose a query and a row-group layout. The model first applies column projection, then uses event-day min/max statistics to decide which row groups may be skipped."
        icon={FileSearch}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Query shape
              </legend>
              <div className="mt-3 space-y-2">
                {data.queries.map((query) => (
                  <LabChoice
                    key={query.id}
                    selected={query.id === result.query.id}
                    label={query.label}
                    detail={query.detail}
                    icon={ScanLine}
                    accent="cyan"
                    onClick={() => setQueryId(query.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Physical ordering
              </legend>
              <div className="mt-3 space-y-2">
                {data.layouts.map((layout) => (
                  <LabChoice
                    key={layout.id}
                    selected={layout.id === result.layout.id}
                    label={layout.label}
                    detail={layout.detail}
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setLayoutId(layout.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Modeled bytes read"
            value={formatMiB(result.bytesReadMiB)}
            detail={`${result.reductionPct}% below a full-file read`}
            icon={Database}
            tone="cyan"
          />
          <LabMetric
            label="Row groups read"
            value={`${result.readRowGroups.length} / ${result.layout.rowGroups.length}`}
            detail={`${skippedCount} rejected by statistics`}
            icon={Layers3}
            tone={skippedCount > 0 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Column chunks read"
            value={`${result.chunksRead} / ${result.totalChunks}`}
            detail={`${result.selectedColumns.length} projected columns`}
            icon={Columns3}
            tone="violet"
          />
          <LabMetric
            label="Rows in candidate groups"
            value={result.rowsExamined.toLocaleString()}
            detail="Rows may still be filtered after decoding"
            icon={ScanLine}
            tone="neutral"
          />
        </div>

        <div className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Row-group decision</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                A range overlap means the group remains a candidate; it does not prove every row matches.
              </p>
            </div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {result.query.eventDayRange
                ? `Filter: day ${result.query.eventDayRange[0]}-${result.query.eventDayRange[1]}`
                : 'No event-day filter'}
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {result.layout.rowGroups.map((rowGroup) => {
              const read = result.readRowGroups.some((item) => item.id === rowGroup.id);
              return (
                <div
                  key={rowGroup.id}
                  className={`min-w-0 rounded-md border p-3 ${
                    read
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{rowGroup.label}</p>
                    <span className="text-xs font-semibold uppercase">{read ? 'Read' : 'Skip'}</span>
                  </div>
                  <p className="mt-2 text-xs tabular-nums opacity-75">
                    day {rowGroup.minEventDay}-{rowGroup.maxEventDay}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Selected columns</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.selectedColumns.map((column) => (
              <span
                key={column.id}
                className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
              >
                {column.label}
              </span>
            ))}
          </div>
        </div>

        <div className={`mt-5 flex items-start gap-3 rounded-md border p-4 ${
          skippedCount > 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
            : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
        }`}>
          {skippedCount > 0 ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="text-sm leading-6">
            {skippedCount > 0
              ? `The footer lets the reader avoid ${skippedCount} row groups, and projection avoids every unselected column chunk in the remaining groups.`
              : 'Every row group overlaps the predicate range. Projection still helps, but statistics cannot remove any groups from this layout.'}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
