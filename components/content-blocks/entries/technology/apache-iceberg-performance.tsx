'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileSearch,
  Files,
  Layers3,
  ListTree,
  LoaderCircle,
  Search,
  TableProperties,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PartitionSpec = {
  id: number;
  label: string;
  fields: string[];
  detail: string;
};

type Snapshot = {
  id: string;
  label: string;
  committedAt: string;
  operation: string;
  defaultSpecId: number;
  manifestIds: string[];
  detail: string;
};

type Manifest = {
  id: string;
  label: string;
  specId: number;
  addedSnapshotId: string;
  partitionSummary: string;
  fileIds: string[];
};

type DataFile = {
  id: string;
  label: string;
  partition: string;
  rows: number;
};

type QueryPlan = {
  selectedManifestIds: string[];
  selectedFileIds: string[];
  reasoning: string[];
};

type Query = {
  id: string;
  label: string;
  predicate: string;
  detail: string;
  plans: Record<string, QueryPlan>;
};

type SnapshotScanModel = {
  title: string;
  description: string;
  defaultSnapshotId: string;
  defaultQueryId: string;
  partitionSpecs: PartitionSpec[];
  snapshots: Snapshot[];
  manifests: Manifest[];
  files: DataFile[];
  queries: Query[];
};

const BLOCK_ID = 'technology/apache-iceberg-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/apache-iceberg/data/snapshot-scan-model.json';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isQueryPlan(value: unknown): value is QueryPlan {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryPlan>;
  return (
    isStringArray(candidate.selectedManifestIds)
    && isStringArray(candidate.selectedFileIds)
    && isStringArray(candidate.reasoning)
  );
}

function isSnapshotScanModel(value: unknown): value is SnapshotScanModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SnapshotScanModel>;
  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultSnapshotId !== 'string'
    || typeof candidate.defaultQueryId !== 'string'
    || !Array.isArray(candidate.partitionSpecs)
    || !Array.isArray(candidate.snapshots)
    || !Array.isArray(candidate.manifests)
    || !Array.isArray(candidate.files)
    || !Array.isArray(candidate.queries)
  ) {
    return false;
  }

  const specsValid = candidate.partitionSpecs.every((spec) => (
    Number.isInteger(spec.id)
    && typeof spec.label === 'string'
    && isStringArray(spec.fields)
    && typeof spec.detail === 'string'
  ));
  const snapshotsValid = candidate.snapshots.every((snapshot) => (
    typeof snapshot.id === 'string'
    && typeof snapshot.label === 'string'
    && typeof snapshot.committedAt === 'string'
    && typeof snapshot.operation === 'string'
    && Number.isInteger(snapshot.defaultSpecId)
    && isStringArray(snapshot.manifestIds)
    && typeof snapshot.detail === 'string'
  ));
  const manifestsValid = candidate.manifests.every((manifest) => (
    typeof manifest.id === 'string'
    && typeof manifest.label === 'string'
    && Number.isInteger(manifest.specId)
    && typeof manifest.addedSnapshotId === 'string'
    && typeof manifest.partitionSummary === 'string'
    && isStringArray(manifest.fileIds)
  ));
  const filesValid = candidate.files.every((file) => (
    typeof file.id === 'string'
    && typeof file.label === 'string'
    && typeof file.partition === 'string'
    && Number.isInteger(file.rows)
    && file.rows >= 0
  ));
  const snapshotIds = new Set(candidate.snapshots.map((snapshot) => snapshot.id));
  const queriesValid = candidate.queries.every((query) => (
    typeof query.id === 'string'
    && typeof query.label === 'string'
    && typeof query.predicate === 'string'
    && typeof query.detail === 'string'
    && query.plans
    && typeof query.plans === 'object'
    && [...snapshotIds].every((snapshotId) => isQueryPlan(query.plans[snapshotId]))
  ));

  return (
    specsValid
    && snapshotsValid
    && manifestsValid
    && filesValid
    && queriesValid
    && snapshotIds.has(candidate.defaultSnapshotId)
    && candidate.queries.some((query) => query.id === candidate.defaultQueryId)
  );
}

export default function ApacheIcebergPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SnapshotScanModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isSnapshotScanModel(payload)) {
          throw new Error('The snapshot scan model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the snapshot scan model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Snapshot planning lab"
            title="Trace one read through Iceberg metadata"
            description="Loading snapshots, manifests, partition specs, and query plans."
            icon={Layers3}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <SnapshotScanWorkbench model={model} />
      )}
    </div>
  );
}

function SnapshotScanWorkbench({ model }: { model: SnapshotScanModel }) {
  const defaultSnapshot =
    model.snapshots.find((snapshot) => snapshot.id === model.defaultSnapshotId)
    ?? model.snapshots[0];
  const defaultQuery =
    model.queries.find((query) => query.id === model.defaultQueryId)
    ?? model.queries[0];
  const [snapshotId, setSnapshotId] = useState(defaultSnapshot.id);
  const [queryId, setQueryId] = useState(defaultQuery.id);

  const snapshot =
    model.snapshots.find((candidate) => candidate.id === snapshotId) ?? defaultSnapshot;
  const query = model.queries.find((candidate) => candidate.id === queryId) ?? defaultQuery;
  const plan = query.plans[snapshot.id];
  const selectedManifestIds = useMemo(
    () => new Set(plan.selectedManifestIds),
    [plan.selectedManifestIds],
  );
  const selectedFileIds = useMemo(
    () => new Set(plan.selectedFileIds),
    [plan.selectedFileIds],
  );
  const manifestsById = useMemo(
    () => new Map(model.manifests.map((manifest) => [manifest.id, manifest])),
    [model.manifests],
  );
  const filesById = useMemo(
    () => new Map(model.files.map((file) => [file.id, file])),
    [model.files],
  );
  const specsById = useMemo(
    () => new Map(model.partitionSpecs.map((spec) => [spec.id, spec])),
    [model.partitionSpecs],
  );
  const snapshotManifests = snapshot.manifestIds
    .map((id) => manifestsById.get(id))
    .filter((manifest): manifest is Manifest => Boolean(manifest));
  const snapshotFileIds = snapshotManifests.flatMap((manifest) => manifest.fileIds);
  const candidateRows = plan.selectedFileIds.reduce(
    (total, fileId) => total + (filesById.get(fileId)?.rows ?? 0),
    0,
  );
  const defaultSpec = specsById.get(snapshot.defaultSpecId);

  function reset() {
    setSnapshotId(defaultSnapshot.id);
    setQueryId(defaultQuery.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Snapshot planning lab"
        title={model.title}
        description={model.description}
        icon={Layers3}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Committed snapshot
              </legend>
              <div className="mt-3 space-y-2">
                {model.snapshots.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === snapshot.id}
                    label={candidate.label}
                    detail={`${candidate.committedAt}. ${candidate.detail}`}
                    icon={Camera}
                    accent="blue"
                    onClick={() => setSnapshotId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Source-column predicate
              </legend>
              <div className="mt-3 space-y-2">
                {model.queries.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === query.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Search}
                    accent="violet"
                    onClick={() => setQueryId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Predicate
              </p>
              <code className="mt-2 block break-words text-xs leading-5 text-neutral-800 dark:text-neutral-200">
                {query.predicate}
              </code>
            </div>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Snapshot manifests"
              value={snapshotManifests.length.toString()}
              detail={`All metadata visible in ${snapshot.label}`}
              icon={ListTree}
              tone="blue"
            />
            <LabMetric
              label="Manifests kept"
              value={`${plan.selectedManifestIds.length} / ${snapshotManifests.length}`}
              detail="After manifest-list pruning"
              icon={FileSearch}
              tone={plan.selectedManifestIds.length > 0 ? 'violet' : 'neutral'}
            />
            <LabMetric
              label="Files kept"
              value={`${plan.selectedFileIds.length} / ${snapshotFileIds.length}`}
              detail="After partition-only file pruning"
              icon={Files}
              tone={plan.selectedFileIds.length > 0 ? 'emerald' : 'neutral'}
            />
            <LabMetric
              label="Candidate rows"
              value={candidateRows.toLocaleString()}
              detail="Exact fixture rows before row filtering"
              icon={TableProperties}
              tone="amber"
            />
          </div>

          <MetadataChain
            snapshot={snapshot}
            defaultSpec={defaultSpec}
            selectedManifestCount={plan.selectedManifestIds.length}
            selectedFileCount={plan.selectedFileIds.length}
          />

          <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Manifest list inspection
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  Old and new partition specs coexist in one snapshot
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Default for new writes: {defaultSpec?.label ?? `Spec ${snapshot.defaultSpecId}`}
              </p>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {snapshotManifests.map((manifest) => (
                <ManifestCard
                  key={manifest.id}
                  manifest={manifest}
                  spec={specsById.get(manifest.specId)}
                  filesById={filesById}
                  selected={selectedManifestIds.has(manifest.id)}
                  selectedFileIds={selectedFileIds}
                />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
            <div className="flex items-center gap-2">
              <FileSearch aria-hidden="true" className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold uppercase">Why this plan is correct</p>
            </div>
            <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 marker:text-blue-600 dark:marker:text-blue-300">
              {plan.reasoning.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function MetadataChain({
  snapshot,
  defaultSpec,
  selectedManifestCount,
  selectedFileCount,
}: {
  snapshot: Snapshot;
  defaultSpec?: PartitionSpec;
  selectedManifestCount: number;
  selectedFileCount: number;
}) {
  const stages: Array<{
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
  }> = [
    {
      label: 'Table metadata',
      value: snapshot.label,
      detail: `Current write spec: ${defaultSpec?.label ?? snapshot.defaultSpecId}`,
      icon: TableProperties,
    },
    {
      label: 'Pinned snapshot',
      value: snapshot.operation,
      detail: snapshot.committedAt,
      icon: Camera,
    },
    {
      label: 'Manifest list',
      value: `${selectedManifestCount} kept`,
      detail: 'Partition summaries prune manifests',
      icon: ListTree,
    },
    {
      label: 'Data files',
      value: `${selectedFileCount} kept`,
      detail: 'Partition tuples prune files',
      icon: Files,
    },
  ];

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Metadata path
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="contents">
              <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {stage.label}
                </div>
                <p className="mt-2 truncate text-sm font-semibold capitalize text-neutral-950 dark:text-white">
                  {stage.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  {stage.detail}
                </p>
              </div>
              {index < stages.length - 1 ? (
                <>
                  <ArrowDown
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-neutral-400 md:hidden"
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden h-4 w-4 self-center text-neutral-400 md:block"
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManifestCard({
  manifest,
  spec,
  filesById,
  selected,
  selectedFileIds,
}: {
  manifest: Manifest;
  spec?: PartitionSpec;
  filesById: Map<string, DataFile>;
  selected: boolean;
  selectedFileIds: Set<string>;
}) {
  return (
    <article
      className={`min-w-0 rounded-md border p-4 ${
        selected
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-neutral-200 bg-neutral-50 opacity-75 dark:border-neutral-800 dark:bg-neutral-900/50'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {selected ? (
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
              />
            ) : (
              <XCircle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400"
              />
            )}
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              {manifest.label}
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            {manifest.partitionSummary}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            selected
              ? 'border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
          }`}
        >
          {selected ? 'Manifest kept' : 'Manifest pruned'}
        </span>
      </div>

      <div className="mt-3 rounded-md border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-neutral-950/70">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {spec?.label ?? `Spec ${manifest.specId}`}
        </p>
        <p className="mt-1 break-words font-mono text-xs text-neutral-600 dark:text-neutral-400">
          {spec?.fields.join(' + ') ?? 'Unknown partition spec'}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {manifest.fileIds.map((fileId) => {
          const file = filesById.get(fileId);
          if (!file) return null;
          const fileSelected = selected && selectedFileIds.has(file.id);
          return (
            <div
              key={file.id}
              className={`min-w-0 rounded-md border p-3 ${
                fileSelected
                  ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50'
                  : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {fileSelected ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                )}
                <p className="min-w-0 truncate font-mono text-xs font-semibold">
                  {file.label}
                </p>
              </div>
              <p className="mt-1 break-words text-xs opacity-80">{file.partition}</p>
              <p className="mt-1 text-xs tabular-nums opacity-80">
                {file.rows.toLocaleString()} fixture rows
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLabBody>
      <div className="flex min-h-40 items-center justify-center">
        {error ? (
          <div className="max-w-md text-center">
            <XCircle
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
            />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              The scan model could not be loaded.
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white dark:text-neutral-950"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="text-center">
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto h-7 w-7 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-400"
            />
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              Loading exact fixture data...
            </p>
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
