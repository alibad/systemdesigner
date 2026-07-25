'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  Gauge,
  Layers3,
  LoaderCircle,
  Network,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type QueryScope = 'partition' | 'global';

type QueryContract = {
  id: string;
  label: string;
  detail: string;
  scope: QueryScope;
  selector: string;
  resultLimit: number;
  selectivity: number;
};

type IndexContract = {
  id: string;
  label: string;
  detail: string;
  scope: QueryScope;
  supports: string[];
};

type QueryRouteModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    queryId: string;
    indexId: string;
    documents: number;
  };
  shards: number;
  queries: QueryContract[];
  indexes: IndexContract[];
};

const BLOCK_ID = 'technology/couchdb-query-route-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/couchdb/data/query-route-model.json';
const queryScopes: QueryScope[] = ['partition', 'global'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isQuery(value: unknown): value is QueryContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryContract>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && queryScopes.includes(candidate.scope as QueryScope)
    && isNonEmptyString(candidate.selector)
    && isPositiveInteger(candidate.resultLimit)
    && typeof candidate.selectivity === 'number'
    && candidate.selectivity > 0
    && candidate.selectivity <= 1;
}

function isIndex(value: unknown): value is IndexContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IndexContract>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && queryScopes.includes(candidate.scope as QueryScope)
    && Array.isArray(candidate.supports)
    && candidate.supports.every(isNonEmptyString);
}

function isQueryRouteModel(value: unknown): value is QueryRouteModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryRouteModel>;

  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNonEmptyString(candidate.defaults?.queryId)
    || !isNonEmptyString(candidate.defaults.indexId)
    || !isPositiveInteger(candidate.defaults.documents)
    || !isPositiveInteger(candidate.shards)
    || candidate.shards < 2
    || !Array.isArray(candidate.queries)
    || candidate.queries.length < 3
    || !candidate.queries.every(isQuery)
    || !hasUniqueIds(candidate.queries)
    || !Array.isArray(candidate.indexes)
    || candidate.indexes.length < 4
    || !candidate.indexes.every(isIndex)
    || !hasUniqueIds(candidate.indexes)
  ) {
    return false;
  }

  const queryIds = new Set(candidate.queries.map((query) => query.id));
  return candidate.queries.some(
    (query) => query.id === candidate.defaults?.queryId,
  )
    && candidate.indexes.some(
      (index) => index.id === candidate.defaults?.indexId,
    )
    && candidate.indexes.every((index) =>
      index.supports.every((queryId) => queryIds.has(queryId)));
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function CouchDBQueryRouteLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<QueryRouteModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isQueryRouteModel(payload)) {
          throw new Error('The CouchDB query-route contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the CouchDB query-route lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Mango query route lab"
            title="Plan the query before reading the database"
            description="Loading query scopes, indexes, and shard-routing consequences."
            icon={Route}
            accent="emerald"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <QueryRouteWorkbench model={model} />;
}

function QueryRouteWorkbench({ model }: { model: QueryRouteModel }) {
  const [queryId, setQueryId] = useState(model.defaults.queryId);
  const [indexId, setIndexId] = useState(model.defaults.indexId);
  const [documents, setDocuments] = useState(model.defaults.documents);

  const query = findById(model.queries, queryId);
  const index = findById(model.indexes, indexId);
  const result = useMemo(() => {
    const indexSupportsQuery = index.supports.includes(query.id);
    const scopeMatches = index.scope === query.scope;
    const usableIndex = indexSupportsQuery && scopeMatches;
    const shardsContacted = query.scope === 'partition' ? 1 : model.shards;
    const documentsInScope = query.scope === 'partition'
      ? Math.ceil(documents / model.shards)
      : documents;
    const candidateDocuments = usableIndex
      ? Math.max(
        query.resultLimit,
        Math.ceil(documentsInScope * query.selectivity),
      )
      : documentsInScope;
    const inspectedShare = candidateDocuments / documents;

    return {
      candidateDocuments,
      documentsInScope,
      indexSupportsQuery,
      inspectedShare,
      scopeMatches,
      shardsContacted,
      usableIndex,
    };
  }, [documents, index, model.shards, query]);

  function reset() {
    setQueryId(model.defaults.queryId);
    setIndexId(model.defaults.indexId);
    setDocuments(model.defaults.documents);
  }

  const statusCopy = result.usableIndex
    ? query.scope === 'partition'
      ? 'The selector and partitioned index align. CouchDB can route the request to one shard range.'
      : 'The selector and global index align. The query still fans out because the result crosses partitions.'
    : index.id === 'none'
      ? 'No named JSON index is eligible. Mango may inspect the full query scope through _all_docs.'
      : !result.scopeMatches
        ? `The ${index.scope} index cannot serve this ${query.scope} query contract.`
        : 'The index fields do not support this selector. Verify the fallback with _explain.';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Mango query route lab"
          title={model.title}
          description={model.description}
          icon={Route}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Request contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.queries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === query.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.scope === 'partition' ? Layers3 : Network}
                      accent="emerald"
                      onClick={() => setQueryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate index
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.indexes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === index.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'none' ? ShieldAlert : FileSearch}
                      accent="cyan"
                      onClick={() => setIndexId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Database documents"
                value={documents}
                output={documents.toLocaleString()}
                min={100000}
                max={10000000}
                step={100000}
                accent="emerald"
                lowLabel="100K"
                highLabel="10M"
                onChange={setDocuments}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Shard ranges"
                value={`${result.shardsContacted}/${model.shards}`}
                detail={query.scope === 'partition' ? 'Partition-local route' : 'Global fan-out'}
                icon={Network}
                tone={query.scope === 'partition' ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Candidate documents"
                value={formatCount(result.candidateDocuments)}
                detail={`${formatPercent(result.inspectedShare)} of the database in this teaching model`}
                icon={Search}
                tone={result.usableIndex ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Index plan"
                value={result.usableIndex ? 'Eligible' : 'Mismatch'}
                detail={result.usableIndex ? 'Confirm with _explain' : 'Fallback risk'}
                icon={result.usableIndex ? CheckCircle2 : AlertTriangle}
                tone={result.usableIndex ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Query route
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {query.label}
                  </h4>
                  <p className="mt-1 font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    {query.selector}
                  </p>
                </div>
                <span className="w-fit rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {query.scope} scope
                </span>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {Array.from({ length: model.shards }, (_, indexNumber) => {
                  const active = query.scope === 'global' || indexNumber === 0;
                  return (
                    <div
                      key={indexNumber}
                      className={`flex min-h-16 flex-col items-center justify-center rounded-md border px-2 py-3 text-center ${
                        active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                          : 'border-neutral-200 bg-white text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-600'
                      }`}
                    >
                      <Database aria-hidden="true" className="h-4 w-4" />
                      <span className="mt-1 text-xs font-semibold">
                        Shard {indexNumber + 1}
                      </span>
                      <span className="mt-0.5 text-[11px]">
                        {active ? 'contacted' : 'skipped'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.usableIndex
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.usableIndex ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Planner assessment
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {result.usableIndex ? 'Index and query align' : 'Query plan needs work'}
                  </h4>
                  <p className="mt-2 text-sm leading-6">{statusCopy}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-current/20 pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase opacity-70">
                    Selected index
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{index.label}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase opacity-70">
                    Documents in scope
                  </dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">
                    {result.documentsInScope.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase opacity-70">
                    Result limit
                  </dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">
                    {query.resultLimit.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
              <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                This model compares route width and candidate work. It does not
                predict latency. Treat `_explain`, production-shaped load, and
                observed index build pressure as the actual release evidence.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  const percentage = value * 100;
  return `${percentage < 0.1 ? percentage.toFixed(2) : percentage.toFixed(1)}%`;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-48 items-center justify-center p-6">
      {error ? (
        <div className="max-w-lg text-center">
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
          />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The query-route model could not be loaded.
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center text-neutral-600 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm">Loading query routes…</p>
        </div>
      )}
    </div>
  );
}
