'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  Database,
  FileLock2,
  Gauge,
  HardDrive,
  Laptop,
  Layers3,
  LoaderCircle,
  Network,
  RefreshCw,
  Server,
  ShieldAlert,
  TriangleAlert,
  Users,
  Workflow,
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

const BLOCK_ID = 'technology/duckdb-workload-fit-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/duckdb/data/workload-fit-model.json';

type Choice = {
  id: string;
  label: string;
  detail: string;
  risk: number;
  guidance: string;
};

type Ownership = Choice & {
  hardBlocker: boolean;
};

type WorkloadFitModel = {
  kind: 'duckdb-workload-fit';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    ownershipId: string;
    mutationId: string;
    storageId: string;
  };
  workloads: Choice[];
  ownerships: Ownership[];
  mutations: Choice[];
  storagePaths: Choice[];
  notice: string;
};

type Verdict = 'strong' | 'conditional' | 'redirect';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRisk(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 5;
}

function isChoice(value: unknown): value is Choice {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isRisk(value.risk)
    && isNonEmptyString(value.guidance);
}

function isOwnership(value: unknown): value is Ownership {
  return isChoice(value)
    && typeof (value as unknown as Record<string, unknown>).hardBlocker === 'boolean';
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isWorkloadFitModel(value: unknown): value is WorkloadFitModel {
  if (!isRecord(value)
    || value.kind !== 'duckdb-workload-fit'
    || value.blockId !== BLOCK_ID
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.description)
    || !isRecord(value.defaults)
    || !Array.isArray(value.workloads)
    || value.workloads.length < 3
    || !value.workloads.every(isChoice)
    || !hasUniqueIds(value.workloads)
    || !Array.isArray(value.ownerships)
    || value.ownerships.length < 3
    || !value.ownerships.every(isOwnership)
    || !hasUniqueIds(value.ownerships)
    || !Array.isArray(value.mutations)
    || value.mutations.length < 3
    || !value.mutations.every(isChoice)
    || !hasUniqueIds(value.mutations)
    || !Array.isArray(value.storagePaths)
    || value.storagePaths.length < 3
    || !value.storagePaths.every(isChoice)
    || !hasUniqueIds(value.storagePaths)
    || !isNonEmptyString(value.notice)
  ) {
    return false;
  }

  const defaults = value.defaults;
  return isNonEmptyString(defaults.workloadId)
    && isNonEmptyString(defaults.ownershipId)
    && isNonEmptyString(defaults.mutationId)
    && isNonEmptyString(defaults.storageId)
    && value.workloads.some((item) => item.id === defaults.workloadId)
    && value.ownerships.some((item) => item.id === defaults.ownershipId)
    && value.mutations.some((item) => item.id === defaults.mutationId)
    && value.storagePaths.some((item) => item.id === defaults.storageId);
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function DuckDBWorkloadFitLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<WorkloadFitModel | null>(null);
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
        if (!isWorkloadFitModel(payload)) {
          throw new Error('The DuckDB workload-fit model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the DuckDB workload-fit lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Workload-fit lab"
            title="Choose the owning process before the database file"
            description="Loading workload, ownership, mutation, and storage boundaries."
            icon={Workflow}
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

  return <WorkloadFitWorkbench model={model} />;
}

function WorkloadFitWorkbench({ model }: { model: WorkloadFitModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [ownershipId, setOwnershipId] = useState(model.defaults.ownershipId);
  const [mutationId, setMutationId] = useState(model.defaults.mutationId);
  const [storageId, setStorageId] = useState(model.defaults.storageId);

  const workload = findById(model.workloads, workloadId);
  const ownership = findById(model.ownerships, ownershipId);
  const mutation = findById(model.mutations, mutationId);
  const storage = findById(model.storagePaths, storageId);

  const result = useMemo(() => {
    const risk = workload.risk + ownership.risk + mutation.risk + storage.risk;
    const hardRedirect = ownership.hardBlocker
      || workload.id === 'transactional-api'
      || mutation.id === 'row-churn'
      || storage.id === 'network-database-file';

    let verdict: Verdict = 'strong';
    let title = 'DuckDB cleanly owns this analytical boundary';
    let summary =
      'One controlled process can execute the work, contain resources, and publish a versioned result.';
    let pattern = 'Embed DuckDB in the job and keep the data path explicit.';

    if (hardRedirect || risk >= 8) {
      verdict = 'redirect';
      title = 'Move the authoritative write boundary elsewhere';
      summary =
        'This design asks a native embedded database file to coordinate independent writers, row-level churn, or shared network ownership.';
      pattern =
        'Use an OLTP server or supported catalog architecture for shared state, then feed snapshots or columnar files to DuckDB for analytics.';
    } else if (risk >= 3) {
      verdict = 'conditional';
      title = 'DuckDB can fit behind an owned service boundary';
      summary =
        'The analytical engine remains useful, but queues, connection reuse, refresh, and publication need an explicit owner.';
      pattern =
        'Let one service embed DuckDB, cap concurrent work, and separate long analytical jobs from latency-critical requests.';
    }

    const guidance = [workload, ownership, mutation, storage]
      .sort((left, right) => right.risk - left.risk)
      .map((item) => item.guidance);

    return {
      guidance,
      pattern,
      risk,
      summary,
      title,
      verdict,
    };
  }, [mutation, ownership, storage, workload]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setOwnershipId(model.defaults.ownershipId);
    setMutationId(model.defaults.mutationId);
    setStorageId(model.defaults.storageId);
  }

  const statusClass = result.verdict === 'strong'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.verdict === 'redirect'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  const StatusIcon = result.verdict === 'strong'
    ? CheckCircle2
    : result.verdict === 'redirect'
      ? XCircle
      : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Workload-fit lab"
          title={model.title}
          description={model.description}
          icon={Workflow}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose the workload">
                {model.workloads.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workload.id}
                    label={item.label}
                    detail={item.detail}
                    icon={workloadIcon(item.id)}
                    accent={item.risk >= 4 ? 'rose' : 'blue'}
                    onClick={() => setWorkloadId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose the connection owner">
                {model.ownerships.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === ownership.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ownershipIcon(item.id)}
                    accent={item.hardBlocker ? 'rose' : 'violet'}
                    onClick={() => setOwnershipId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Choose the mutation pattern">
                {model.mutations.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === mutation.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'row-churn' ? RefreshCw : Layers3}
                    accent={item.risk >= 4 ? 'rose' : 'cyan'}
                    onClick={() => setMutationId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="4. Choose the storage path">
                {model.storagePaths.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === storage.id}
                    label={item.label}
                    detail={item.detail}
                    icon={storageIcon(item.id)}
                    accent={item.risk >= 4 ? 'rose' : 'emerald'}
                    onClick={() => setStorageId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section className={`rounded-md border p-5 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Boundary verdict
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.summary}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Fit pressure"
                value={`${result.risk} / 18`}
                detail="Relative design pressure"
                icon={Gauge}
                tone={result.verdict === 'strong'
                  ? 'emerald'
                  : result.verdict === 'redirect'
                    ? 'rose'
                    : 'amber'}
              />
              <LabMetric
                label="Writer owners"
                value={ownership.id === 'independent-writers' ? 'Many' : 'One'}
                detail={ownership.label}
                icon={Users}
                tone={ownership.hardBlocker ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Mutation shape"
                value={mutation.id === 'row-churn' ? 'Row churn' : 'Batch'}
                detail={mutation.label}
                icon={Layers3}
                tone={mutation.risk >= 4 ? 'rose' : 'cyan'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Network aria-hidden="true" className="h-4 w-4" />
                Recommended ownership path
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <BoundaryStage
                  icon={workloadIcon(workload.id)}
                  label="Demand"
                  value={workload.label}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 text-neutral-400 md:rotate-0"
                />
                <BoundaryStage
                  icon={result.verdict === 'redirect' ? Server : Database}
                  label="Authority"
                  value={result.verdict === 'redirect'
                    ? 'Transactional server or catalog'
                    : ownership.label}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 text-neutral-400 md:rotate-0"
                />
                <BoundaryStage
                  icon={HardDrive}
                  label="Analytical output"
                  value={result.verdict === 'redirect'
                    ? 'Snapshot to DuckDB'
                    : storage.label}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {result.pattern}
              </p>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                Review the consequences
              </div>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {result.guidance.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function BoundaryStage({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <Icon
        aria-hidden="true"
        className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
      />
      <p className="mt-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
    </div>
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
    <div className="flex min-h-52 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert
            aria-hidden="true"
            className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400"
          />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The workload-fit model could not be loaded
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center">
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400"
          />
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            Loading the workload-fit model…
          </p>
        </div>
      )}
    </div>
  );
}

function workloadIcon(id: string): LucideIcon {
  if (id === 'local-exploration') return Laptop;
  if (id === 'scheduled-analytics') return Workflow;
  if (id === 'interactive-dashboard') return Gauge;
  return Server;
}

function ownershipIcon(id: string): LucideIcon {
  if (id === 'single-job') return FileLock2;
  if (id === 'owned-service') return Server;
  if (id === 'read-only-processes') return BookOpen;
  return Users;
}

function storageIcon(id: string): LucideIcon {
  if (id === 'local-ssd') return HardDrive;
  if (id === 'remote-parquet') return Cloud;
  return Network;
}
