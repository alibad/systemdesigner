'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  DatabaseZap,
  Filter,
  Gauge,
  LoaderCircle,
  Rows3,
  ScanSearch,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/clickhouse-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/clickhouse/data/query-pruning-model.json';

type QueryShape = {
  id: string;
  label: string;
  detail: string;
  filter: string;
  usefulRowFraction: number;
};

type OrderKey = {
  id: string;
  label: string;
  detail: string;
  readFractions: Record<string, number>;
};

type QueryPruningModel = {
  kind: 'clickhouse-query-pruning';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  granuleRows: number;
  retentionDays: number;
  rowsPerDay: number;
  defaults: {
    queryId: string;
    orderKeyId: string;
    windowDays: number;
    selectedBytesPerRow: number;
  };
  ranges: {
    windowDays: { min: number; max: number; step: number };
    selectedBytesPerRow: { min: number; max: number; step: number };
  };
  queries: QueryShape[];
  orderKeys: OrderKey[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isQueryPruningModel(value: unknown): value is QueryPruningModel {
  if (
    !isRecord(value)
    || value.kind !== 'clickhouse-query-pruning'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.notice !== 'string'
    || !isFiniteNumber(value.granuleRows)
    || !isFiniteNumber(value.retentionDays)
    || !isFiniteNumber(value.rowsPerDay)
    || !isRecord(value.defaults)
    || !isRecord(value.ranges)
    || !Array.isArray(value.queries)
    || !Array.isArray(value.orderKeys)
  ) {
    return false;
  }

  return value.queries.length >= 2 && value.orderKeys.length >= 2;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
}

export default function ClickHousePerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<QueryPruningModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [queryId, setQueryId] = useState('');
  const [orderKeyId, setOrderKeyId] = useState('');
  const [windowDays, setWindowDays] = useState(1);
  const [selectedBytesPerRow, setSelectedBytesPerRow] = useState(8);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isQueryPruningModel(payload)) {
          throw new Error('The ClickHouse pruning model is incomplete.');
        }
        setModel(payload);
        setQueryId(payload.defaults.queryId);
        setOrderKeyId(payload.defaults.orderKeyId);
        setWindowDays(payload.defaults.windowDays);
        setSelectedBytesPerRow(payload.defaults.selectedBytesPerRow);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load pruning data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const query = model?.queries.find((item) => item.id === queryId) ?? model?.queries[0];
  const orderKey =
    model?.orderKeys.find((item) => item.id === orderKeyId) ?? model?.orderKeys[0];

  const result = useMemo(() => {
    if (!model || !query || !orderKey) return null;
    const windowRows = model.rowsPerDay * windowDays;
    const totalGranules = Math.ceil(windowRows / model.granuleRows);
    const readFraction = Math.min(1, Math.max(0, orderKey.readFractions[query.id] ?? 1));
    const granulesRead = Math.max(1, Math.ceil(totalGranules * readFraction));
    const rowsRead = Math.min(windowRows, granulesRead * model.granuleRows);
    const usefulRows = Math.max(1, Math.round(windowRows * query.usefulRowFraction));
    const bytesRead = rowsRead * selectedBytesPerRow;
    const usefulRatio = Math.min(1, usefulRows / rowsRead);
    const aligned = readFraction <= 0.08;
    const broad = readFraction >= 0.5;
    return {
      aligned,
      broad,
      bytesRead,
      granulesRead,
      readFraction,
      rowsRead,
      totalGranules,
      usefulRatio,
      windowRows,
    };
  }, [model, orderKey, query, selectedBytesPerRow, windowDays]);

  if (!model || !query || !orderKey || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Sparse-index lab"
            title="Match physical order to query shape"
            description="Loading query patterns, order keys, and granule assumptions."
            icon={ScanSearch}
            accent="cyan"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading pruning model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setQueryId(model.defaults.queryId);
    setOrderKeyId(model.defaults.orderKeyId);
    setWindowDays(model.defaults.windowDays);
    setSelectedBytesPerRow(model.defaults.selectedBytesPerRow);
  };
  const OutcomeIcon = result.aligned ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Sparse-index lab"
          title={model.title}
          description={model.description}
          icon={ScanSearch}
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
                <div className="mt-3 space-y-2">
                  {model.queries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === query.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Filter}
                      accent="blue"
                      onClick={() => setQueryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Physical ORDER BY
                </legend>
                <div className="mt-3 space-y-2">
                  {model.orderKeys.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === orderKey.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Rows3}
                      accent="violet"
                      onClick={() => setOrderKeyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Bound the scan
                </p>
                <p className="mt-1 font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  WHERE {query.filter}
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <LabRange
                  label="Time window"
                  value={windowDays}
                  output={`${windowDays} day${windowDays === 1 ? '' : 's'}`}
                  {...model.ranges.windowDays}
                  lowLabel="Incident slice"
                  highLabel="Monthly sweep"
                  accent="cyan"
                  onChange={setWindowDays}
                />
                <LabRange
                  label="Selected column bytes"
                  value={selectedBytesPerRow}
                  output={`${selectedBytesPerRow} B/row`}
                  {...model.ranges.selectedBytesPerRow}
                  lowLabel="Narrow projection"
                  highLabel="Wide projection"
                  accent="violet"
                  onChange={setSelectedBytesPerRow}
                />
              </div>
            </section>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Granules read"
                value={result.granulesRead.toLocaleString()}
                detail={`of ${result.totalGranules.toLocaleString()} in window`}
                icon={Blocks}
                tone={result.aligned ? 'emerald' : result.broad ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Rows read"
                value={result.rowsRead.toLocaleString()}
                detail={`${(result.readFraction * 100).toFixed(1)}% of window rows`}
                icon={Rows3}
                tone={result.aligned ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Modeled bytes"
                value={formatBytes(result.bytesRead)}
                detail="Uncompressed selected-column bytes"
                icon={DatabaseZap}
                tone={result.broad ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Useful density"
                value={`${(result.usefulRatio * 100).toFixed(2)}%`}
                detail="Useful rows divided by rows read"
                icon={Gauge}
                tone={result.usefulRatio >= 0.25 ? 'emerald' : 'violet'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Primary-index pruning
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    Colored granules remain candidates after the modeled sparse-index lookup.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {(result.readFraction * 100).toFixed(1)}% read
                </span>
              </div>
              <div className="mt-4 grid grid-cols-12 gap-1.5" aria-hidden="true">
                {Array.from({ length: 24 }, (_, index) => {
                  const readTiles = Math.max(1, Math.ceil(result.readFraction * 24));
                  return (
                    <span
                      key={index}
                      className={`h-8 rounded-sm border ${
                        index < readTiles
                          ? result.aligned
                            ? 'border-emerald-400 bg-emerald-300 dark:border-emerald-600 dark:bg-emerald-800'
                            : 'border-amber-400 bg-amber-300 dark:border-amber-600 dark:bg-amber-800'
                          : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950'
                      }`}
                    />
                  );
                })}
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.aligned
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.aligned
                      ? 'The order key leads with the query boundary'
                      : 'The query cannot use the selected leading key efficiently'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-85">
                    {result.aligned
                      ? 'Validate this shape with EXPLAIN indexes = 1 and system.query_log, then test compression, concurrency, and insert cost.'
                      : 'A projection, a different table, or a revised order key may serve this access path. Do not add a skip index before measuring correlation and cost.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
