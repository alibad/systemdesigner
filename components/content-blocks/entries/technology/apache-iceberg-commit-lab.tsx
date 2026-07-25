'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Combine,
  FilePlus2,
  Files,
  GitCommitHorizontal,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type BaseSnapshot = {
  id: string;
  files: string[];
  detail: string;
};

type CommitOperation = {
  id: string;
  label: string;
  kind: 'append' | 'rewrite';
  description: string;
  requiredFiles: string[];
  removesFiles: string[];
  producedFiles: string[];
  reusableArtifact: string;
};

type ConflictingCommit = {
  id: string;
  label: string;
  description: string;
  addsFiles: string[];
  removesFiles: string[];
};

type OptimisticCommitModel = {
  title: string;
  description: string;
  defaultOperationId: string;
  defaultConflictId: string;
  baseSnapshot: BaseSnapshot;
  operations: CommitOperation[];
  conflicts: ConflictingCommit[];
};

const BLOCK_ID = 'technology/apache-iceberg-commit-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/apache-iceberg/data/optimistic-commit-model.json';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptimisticCommitModel(value: unknown): value is OptimisticCommitModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OptimisticCommitModel>;
  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultOperationId !== 'string'
    || typeof candidate.defaultConflictId !== 'string'
    || !candidate.baseSnapshot
    || typeof candidate.baseSnapshot.id !== 'string'
    || !isStringArray(candidate.baseSnapshot.files)
    || typeof candidate.baseSnapshot.detail !== 'string'
    || !Array.isArray(candidate.operations)
    || !Array.isArray(candidate.conflicts)
  ) {
    return false;
  }

  const operationsValid = candidate.operations.every((operation) => (
    typeof operation.id === 'string'
    && typeof operation.label === 'string'
    && (operation.kind === 'append' || operation.kind === 'rewrite')
    && typeof operation.description === 'string'
    && isStringArray(operation.requiredFiles)
    && isStringArray(operation.removesFiles)
    && isStringArray(operation.producedFiles)
    && typeof operation.reusableArtifact === 'string'
  ));
  const conflictsValid = candidate.conflicts.every((conflict) => (
    typeof conflict.id === 'string'
    && typeof conflict.label === 'string'
    && typeof conflict.description === 'string'
    && isStringArray(conflict.addsFiles)
    && isStringArray(conflict.removesFiles)
  ));

  return (
    operationsValid
    && conflictsValid
    && candidate.operations.some(
      (operation) => operation.id === candidate.defaultOperationId,
    )
    && candidate.conflicts.some(
      (conflict) => conflict.id === candidate.defaultConflictId,
    )
  );
}

export default function ApacheIcebergCommitLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<OptimisticCommitModel | null>(null);
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
        if (!isOptimisticCommitModel(payload)) {
          throw new Error('The optimistic commit model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the optimistic commit model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Optimistic commit lab"
            title="Resolve an Iceberg metadata race"
            description="Loading operations, conflicts, and file-set invariants."
            icon={GitCommitHorizontal}
            accent="emerald"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <CommitRaceWorkbench model={model} />
      )}
    </div>
  );
}

function CommitRaceWorkbench({ model }: { model: OptimisticCommitModel }) {
  const defaultOperation =
    model.operations.find((operation) => operation.id === model.defaultOperationId)
    ?? model.operations[0];
  const defaultConflict =
    model.conflicts.find((conflict) => conflict.id === model.defaultConflictId)
    ?? model.conflicts[0];
  const [operationId, setOperationId] = useState(defaultOperation.id);
  const [conflictId, setConflictId] = useState(defaultConflict.id);

  const operation =
    model.operations.find((candidate) => candidate.id === operationId) ?? defaultOperation;
  const conflict =
    model.conflicts.find((candidate) => candidate.id === conflictId) ?? defaultConflict;
  const outcome = useMemo(
    () => evaluateRace(model.baseSnapshot, operation, conflict),
    [model.baseSnapshot, operation, conflict],
  );

  function reset() {
    setOperationId(defaultOperation.id);
    setConflictId(defaultConflict.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Optimistic commit lab"
        title={model.title}
        description={model.description}
        icon={GitCommitHorizontal}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Pending writer
              </legend>
              <div className="mt-3 space-y-2">
                {model.operations.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === operation.id}
                    label={candidate.label}
                    detail={candidate.description}
                    icon={candidate.kind === 'append' ? FilePlus2 : Combine}
                    accent={candidate.kind === 'append' ? 'blue' : 'amber'}
                    onClick={() => setOperationId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Commit that wins first
              </legend>
              <div className="mt-3 space-y-2">
                {model.conflicts.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === conflict.id}
                    label={candidate.label}
                    detail={candidate.description}
                    icon={candidate.removesFiles.length > 0 ? Trash2 : FilePlus2}
                    accent={
                      candidate.id === 'overlapping-rewrite'
                        ? 'rose'
                        : candidate.id === 'independent-delete'
                          ? 'violet'
                          : 'emerald'
                    }
                    onClick={() => setConflictId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Pointer result"
              value="Race lost"
              detail="The first compare-and-swap fails"
              icon={RefreshCw}
              tone="amber"
            />
            <LabMetric
              label="Required sources"
              value={operation.requiredFiles.length.toString()}
              detail={operation.kind === 'append' ? 'Append has no rewrite sources' : 'Rewrite validation set'}
              icon={Files}
              tone="blue"
            />
            <LabMetric
              label="Missing sources"
              value={outcome.missingRequiredFiles.length.toString()}
              detail="Checked against refreshed metadata"
              icon={CircleAlert}
              tone={outcome.missingRequiredFiles.length > 0 ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Final decision"
              value={outcome.safeToRetry ? 'Retry commit' : 'Replan'}
              detail={outcome.safeToRetry ? 'Assumptions still hold' : 'Stale rewrite is rejected'}
              icon={outcome.safeToRetry ? ShieldCheck : XCircle}
              tone={outcome.safeToRetry ? 'emerald' : 'rose'}
            />
          </div>

          <CommitTimeline
            baseSnapshot={model.baseSnapshot}
            operation={operation}
            conflict={conflict}
            safeToRetry={outcome.safeToRetry}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <FileSetCard
              eyebrow="Refreshed current snapshot"
              title="What the winning commit published"
              files={outcome.currentFiles}
              addedFiles={new Set(conflict.addsFiles)}
              removedFiles={new Set(conflict.removesFiles)}
              requiredFiles={new Set(operation.requiredFiles)}
            />
            <FileSetCard
              eyebrow={outcome.safeToRetry ? 'Retry result' : 'Rejected pending result'}
              title={outcome.safeToRetry ? 'Files after the safe retry' : 'Current files stay unchanged'}
              files={outcome.finalFiles}
              addedFiles={new Set(outcome.safeToRetry ? operation.producedFiles : [])}
              removedFiles={new Set(outcome.safeToRetry ? operation.removesFiles : [])}
              requiredFiles={new Set()}
            />
          </div>

          <div
            className={`rounded-md border p-5 ${
              outcome.safeToRetry
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {outcome.safeToRetry ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase">
                  {outcome.safeToRetry ? 'Validation passed' : 'Validation failed'}
                </p>
                <h4 className="mt-1 text-lg font-semibold">
                  {outcome.safeToRetry
                    ? 'Reapply the operation to refreshed metadata'
                    : `Replan because ${outcome.missingRequiredFiles.join(', ')} disappeared`}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {outcome.safeToRetry
                    ? operation.reusableArtifact
                    : 'The prepared output is not table state. Do not publish it or restore removed source files; refresh the plan and let conservative orphan cleanup handle unreferenced artifacts later.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ReaderState
              title="Reader already pinned to snapshot 900"
              detail="It keeps the complete base file set while that snapshot remains valid. The failed writer never leaks prepared files into this read."
              files={model.baseSnapshot.files}
            />
            <ReaderState
              title="Reader that refreshes after resolution"
              detail={
                outcome.safeToRetry
                  ? 'It resolves the successful retry and sees the final file set as one committed snapshot.'
                  : 'It resolves the winner only; the rejected pending rewrite never becomes visible.'
              }
              files={outcome.finalFiles}
            />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function evaluateRace(
  baseSnapshot: BaseSnapshot,
  operation: CommitOperation,
  conflict: ConflictingCommit,
) {
  const currentFiles = new Set(baseSnapshot.files);
  conflict.removesFiles.forEach((file) => currentFiles.delete(file));
  conflict.addsFiles.forEach((file) => currentFiles.add(file));

  const missingRequiredFiles = operation.requiredFiles.filter(
    (file) => !currentFiles.has(file),
  );
  const safeToRetry = missingRequiredFiles.length === 0;
  const finalFiles = new Set(currentFiles);

  if (safeToRetry) {
    operation.removesFiles.forEach((file) => finalFiles.delete(file));
    operation.producedFiles.forEach((file) => finalFiles.add(file));
  }

  return {
    safeToRetry,
    missingRequiredFiles,
    currentFiles: [...currentFiles].sort(),
    finalFiles: [...finalFiles].sort(),
  };
}

function CommitTimeline({
  baseSnapshot,
  operation,
  conflict,
  safeToRetry,
}: {
  baseSnapshot: BaseSnapshot;
  operation: CommitOperation;
  conflict: ConflictingCommit;
  safeToRetry: boolean;
}) {
  const stages = [
    {
      label: '1. Plan',
      title: baseSnapshot.id,
      detail: `${operation.label} prepares immutable output from the base snapshot.`,
      tone: 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35',
    },
    {
      label: '2. Conflict wins',
      title: conflict.label,
      detail: 'The catalog pointer now targets newer metadata.',
      tone: 'border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35',
    },
    {
      label: '3. Swap rejected',
      title: 'Expected base is stale',
      detail: 'No prepared file becomes visible from the failed pointer swap.',
      tone: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    },
    {
      label: '4. Validate',
      title: safeToRetry ? 'Rebase and retry' : 'Stop and replan',
      detail: safeToRetry
        ? 'Every required source still exists in refreshed metadata.'
        : 'At least one required source is absent from refreshed metadata.',
      tone: safeToRetry
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
        : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    },
  ];

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Commit trace
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {stages.map((stage, index) => (
          <div key={stage.label} className="contents">
            <div className={`rounded-md border p-3 ${stage.tone}`}>
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                {stage.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                {stage.title}
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
        ))}
      </div>
    </div>
  );
}

function FileSetCard({
  eyebrow,
  title,
  files,
  addedFiles,
  removedFiles,
  requiredFiles,
}: {
  eyebrow: string;
  title: string;
  files: string[];
  addedFiles: Set<string>;
  removedFiles: Set<string>;
  requiredFiles: Set<string>;
}) {
  return (
    <section className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {eyebrow}
      </p>
      <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
        {title}
      </h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {files.map((file) => {
          const added = addedFiles.has(file);
          const required = requiredFiles.has(file);
          return (
            <span
              key={file}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
                added
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : required
                    ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
              }`}
            >
              {added ? (
                <FilePlus2 aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Files aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {file}
            </span>
          );
        })}
      </div>
      {removedFiles.size > 0 ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Removed by this stage
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...removedFiles].map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-mono text-xs text-rose-800 line-through dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                {file}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReaderState({
  title,
  detail,
  files,
}: {
  title: string;
  detail: string;
  files: string[];
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-start gap-3">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300"
        />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            {detail}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-neutral-700 dark:text-neutral-300">
            {files.join(' · ')}
          </p>
        </div>
      </div>
    </section>
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
              The commit model could not be loaded.
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-white dark:text-neutral-950"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="text-center">
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto h-7 w-7 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-400"
            />
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              Loading exact file-set scenarios...
            </p>
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
