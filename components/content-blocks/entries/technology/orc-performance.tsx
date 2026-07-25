'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Columns3,
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

type Stripe = {
  id: string;
  label: string;
  rowGroups: RowGroup[];
};

type Layout = {
  id: string;
  label: string;
  detail: string;
  stripes: Stripe[];
};

type Query = {
  id: string;
  label: string;
  detail: string;
  selectedColumnIds: string[];
  eventDayRange?: [number, number];
  assumedMatchingRowsPct: number;
};

type IndexMode = {
  id: string;
  label: string;
  detail: string;
  usesRowGroupIndexes: boolean;
};

type ScanPruningModel = {
  modelNote: string;
  dataset: {
    label: string;
    rowsPerRowGroup: number;
    fileTailKiB: number;
    stripeFooterKiB: number;
    totalRowIndexKiBPerRowGroup: number;
    predicateRowIndexKiBPerRowGroup: number;
  };
  defaultLayoutId: string;
  defaultQueryId: string;
  defaultIndexModeId: string;
  columns: Column[];
  queries: Query[];
  indexModes: IndexMode[];
  layouts: Layout[];
};

const BLOCK_ID = 'technology/orc-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/orc/data/scan-pruning-model.json';

function isScanPruningModel(value: unknown): value is ScanPruningModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScanPruningModel>;
  return Boolean(
    candidate.modelNote
      && candidate.dataset
      && typeof candidate.dataset.rowsPerRowGroup === 'number'
      && typeof candidate.dataset.fileTailKiB === 'number'
      && typeof candidate.dataset.stripeFooterKiB === 'number'
      && typeof candidate.dataset.totalRowIndexKiBPerRowGroup === 'number'
      && typeof candidate.dataset.predicateRowIndexKiBPerRowGroup === 'number'
      && candidate.defaultLayoutId
      && candidate.defaultQueryId
      && candidate.defaultIndexModeId
      && Array.isArray(candidate.columns)
      && candidate.columns.length > 0
      && Array.isArray(candidate.queries)
      && candidate.queries.length > 0
      && Array.isArray(candidate.indexModes)
      && candidate.indexModes.length > 0
      && Array.isArray(candidate.layouts)
      && candidate.layouts.length > 0
      && candidate.layouts.every(
        (layout) => Array.isArray(layout.stripes)
          && layout.stripes.length > 0
          && layout.stripes.every(
            (stripe) => Array.isArray(stripe.rowGroups) && stripe.rowGroups.length > 0,
          ),
      ),
  );
}

function overlaps(group: RowGroup, range?: [number, number]) {
  if (!range) return true;
  return group.maxEventDay >= range[0] && group.minEventDay <= range[1];
}

function stripeRange(stripe: Stripe): [number, number] {
  return [
    Math.min(...stripe.rowGroups.map((group) => group.minEventDay)),
    Math.max(...stripe.rowGroups.map((group) => group.maxEventDay)),
  ];
}

function stripeOverlaps(stripe: Stripe, range?: [number, number]) {
  if (!range) return true;
  const [minimum, maximum] = stripeRange(stripe);
  return maximum >= range[0] && minimum <= range[1];
}

function formatMiB(value: number) {
  if (value < 1) return `${Math.round(value * 1024).toLocaleString()} KiB`;
  return `${value.toFixed(value >= 10 ? 1 : 2)} MiB`;
}

export default function OrcScanPruningLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScanPruningModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScanPruningModel(payload)) {
          throw new Error('The ORC scan model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load scan model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Physical read lab"
            title="Plan an ORC scan"
            description="Loading the file-layout assumptions."
            icon={FileSearch}
            accent="cyan"
          />
          <LearningLabBody>
            <div className="flex min-h-44 items-center justify-center">
              {error ? (
                <div className="max-w-md text-center">
                  <CircleAlert
                    aria-hidden="true"
                    className="mx-auto h-6 w-6 text-rose-500"
                  />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <FileSearch aria-hidden="true" className="h-5 w-5 animate-pulse" />
                  Loading scan planner
                </div>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      ) : (
        <ScanWorkbench data={data} />
      )}
    </div>
  );
}

function ScanWorkbench({ data }: { data: ScanPruningModel }) {
  const [layoutId, setLayoutId] = useState(data.defaultLayoutId);
  const [queryId, setQueryId] = useState(data.defaultQueryId);
  const [indexModeId, setIndexModeId] = useState(data.defaultIndexModeId);

  const result = useMemo(() => {
    const layout = data.layouts.find((item) => item.id === layoutId) ?? data.layouts[0];
    const query = data.queries.find((item) => item.id === queryId) ?? data.queries[0];
    const indexMode = data.indexModes.find((item) => item.id === indexModeId)
      ?? data.indexModes[0];
    const selectedColumns = data.columns.filter((column) =>
      query.selectedColumnIds.includes(column.id),
    );
    const allGroups = layout.stripes.flatMap((stripe) => stripe.rowGroups);
    const candidateStripes = layout.stripes.filter((stripe) =>
      stripeOverlaps(stripe, query.eventDayRange),
    );
    const candidateGroups = candidateStripes.flatMap((stripe) =>
      indexMode.usesRowGroupIndexes
        ? stripe.rowGroups.filter((group) => overlaps(group, query.eventDayRange))
        : stripe.rowGroups,
    );
    const selectedDataMiBPerGroup = selectedColumns.reduce(
      (total, column) => total + column.compressedMiBPerRowGroup,
      0,
    );
    const allDataMiBPerGroup = data.columns.reduce(
      (total, column) => total + column.compressedMiBPerRowGroup,
      0,
    );
    const fullMetadataKiB = data.dataset.fileTailKiB
      + layout.stripes.length * data.dataset.stripeFooterKiB
      + (indexMode.usesRowGroupIndexes
        ? allGroups.length * data.dataset.totalRowIndexKiBPerRowGroup
        : 0);
    const metadataReadKiB = data.dataset.fileTailKiB
      + candidateStripes.length * data.dataset.stripeFooterKiB
      + (indexMode.usesRowGroupIndexes
        ? candidateStripes.reduce(
          (total, stripe) => total + stripe.rowGroups.length,
          0,
        ) * data.dataset.predicateRowIndexKiBPerRowGroup
        : 0);
    const fileSizeMiB = allGroups.length * allDataMiBPerGroup + fullMetadataKiB / 1024;
    const dataReadMiB = candidateGroups.length * selectedDataMiBPerGroup;
    const totalReadMiB = dataReadMiB + metadataReadKiB / 1024;
    const candidateRows = candidateGroups.length * data.dataset.rowsPerRowGroup;

    return {
      allGroups,
      candidateGroups,
      candidateRows,
      candidateStripes,
      dataReadMiB,
      fileSizeMiB,
      indexMode,
      layout,
      metadataReadKiB,
      query,
      readPct: Math.round((totalReadMiB / fileSizeMiB) * 100),
      selectedColumns,
      totalReadMiB,
    };
  }, [data, indexModeId, layoutId, queryId]);

  function reset() {
    setLayoutId(data.defaultLayoutId);
    setQueryId(data.defaultQueryId);
    setIndexModeId(data.defaultIndexModeId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Physical read lab"
        title="Trace projection and predicate pruning"
        description="Choose a query, file ordering, and index level. The lab derives candidate stripes and row groups from min/max overlap, then adds only the projected column-stream bytes."
        icon={FileSearch}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Query shape
              </legend>
              <div className="mt-3 grid gap-2">
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
                2. Physical ordering
              </legend>
              <div className="mt-3 grid gap-2">
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

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Index level
              </legend>
              <div className="mt-3 grid gap-2">
                {data.indexModes.map((mode) => (
                  <LabChoice
                    key={mode.id}
                    selected={mode.id === result.indexMode.id}
                    label={mode.label}
                    detail={mode.detail}
                    icon={FileSearch}
                    accent="emerald"
                    onClick={() => setIndexModeId(mode.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Modeled file size"
            value={formatMiB(result.fileSizeMiB)}
            detail="Compressed data plus explicit metadata assumptions"
            icon={Layers3}
            tone="neutral"
          />
          <LabMetric
            label="Modeled bytes read"
            value={formatMiB(result.totalReadMiB)}
            detail={`${result.readPct}% of the modeled file`}
            icon={FileSearch}
            tone="cyan"
          />
          <LabMetric
            label="Candidate stripes"
            value={`${result.candidateStripes.length} / ${result.layout.stripes.length}`}
            detail="Rejected first by stripe statistics"
            icon={Layers3}
            tone={result.candidateStripes.length < result.layout.stripes.length ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Candidate row groups"
            value={`${result.candidateGroups.length} / ${result.allGroups.length}`}
            detail={`${result.candidateRows.toLocaleString()} candidate rows`}
            icon={ScanLine}
            tone={result.candidateGroups.length < result.allGroups.length ? 'violet' : 'amber'}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              Stripe and row-group decisions
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Candidate means possible match. ORC indexes help skip; they do not answer the query.
            </p>
          </div>
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {result.query.eventDayRange
              ? `Filter: day ${result.query.eventDayRange[0]}-${result.query.eventDayRange[1]}`
              : 'No event-day filter'}
          </p>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {result.layout.stripes.map((stripe) => {
            const stripeCandidate = result.candidateStripes.some(
              (candidate) => candidate.id === stripe.id,
            );
            const [minimum, maximum] = stripeRange(stripe);

            return (
              <section
                key={stripe.id}
                className={`min-w-0 rounded-md border p-3 ${
                  stripeCandidate
                    ? 'border-cyan-300 bg-cyan-50/60 dark:border-cyan-900 dark:bg-cyan-950/20'
                    : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {stripe.label}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      day {minimum}-{maximum}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${
                      stripeCandidate
                        ? 'bg-cyan-100 text-cyan-950 dark:bg-cyan-900/50 dark:text-cyan-100'
                        : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {stripeCandidate ? 'Open' : 'Skip stripe'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {stripe.rowGroups.map((group) => {
                    const groupCandidate = result.candidateGroups.some(
                      (candidate) => candidate.id === group.id,
                    );
                    return (
                      <div
                        key={group.id}
                        className={`min-w-0 rounded border p-2 ${
                          groupCandidate
                            ? 'border-violet-300 bg-white text-violet-950 dark:border-violet-800 dark:bg-neutral-950 dark:text-violet-100'
                            : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                        }`}
                      >
                        <p className="truncate text-xs font-semibold">{group.label}</p>
                        <p className="mt-1 text-[11px] tabular-nums opacity-80">
                          {group.minEventDay}-{group.maxEventDay}
                        </p>
                        <p className="mt-2 text-[10px] font-semibold uppercase">
                          {groupCandidate ? 'Read' : 'Skip'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Projected columns
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.selectedColumns.map((column) => (
                <span
                  key={column.id}
                  className="rounded border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                >
                  {column.label}: {column.compressedMiBPerRowGroup} MiB/group
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Read arithmetic
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {result.candidateGroups.length} groups x projected chunks ={' '}
              <strong>{formatMiB(result.dataReadMiB)}</strong> data, plus{' '}
              <strong>{formatMiB(result.metadataReadKiB / 1024)}</strong> modeled metadata.
            </p>
          </div>
        </div>

        <div
          className={`mt-5 flex items-start gap-3 rounded-md border p-4 ${
            result.readPct < 100
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
          }`}
        >
          {result.readPct < 100 ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Columns3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              Workload assumption: {result.query.assumedMatchingRowsPct}% of rows truly match.
            </p>
            <p className="mt-1 text-sm leading-6 opacity-80">
              The model does not convert that selectivity into invented latency. It shows only
              bytes that metadata and projection can prove unnecessary.
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {data.modelNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
