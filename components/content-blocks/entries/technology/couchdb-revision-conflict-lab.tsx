'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitMerge,
  History,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OutcomeStatus = 'safe' | 'lossy' | 'review';

type Branch = {
  revision: string;
  source: string;
  changes: string[];
};

type ConflictOutcome = {
  resolverId: string;
  status: OutcomeStatus;
  preservedChanges: number;
  lostChanges: number;
  canWriteBack: boolean;
  result: string;
  fields: string[];
};

type ConflictScenario = {
  id: string;
  label: string;
  detail: string;
  documentId: string;
  baseRevision: string;
  branches: Branch[];
  outcomes: ConflictOutcome[];
};

type Resolver = {
  id: string;
  label: string;
  detail: string;
};

type ConflictModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    resolverId: string;
    writeBack: boolean;
  };
  scenarios: ConflictScenario[];
  resolvers: Resolver[];
};

const BLOCK_ID = 'technology/couchdb-revision-conflict-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/couchdb/data/revision-conflict-model.json';
const outcomeStatuses: OutcomeStatus[] = ['safe', 'lossy', 'review'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isBranch(value: unknown): value is Branch {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Branch>;
  return isNonEmptyString(candidate.revision)
    && isNonEmptyString(candidate.source)
    && Array.isArray(candidate.changes)
    && candidate.changes.length > 0
    && candidate.changes.every(isNonEmptyString);
}

function isOutcome(value: unknown): value is ConflictOutcome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConflictOutcome>;
  return isNonEmptyString(candidate.resolverId)
    && outcomeStatuses.includes(candidate.status as OutcomeStatus)
    && isNonNegativeInteger(candidate.preservedChanges)
    && isNonNegativeInteger(candidate.lostChanges)
    && typeof candidate.canWriteBack === 'boolean'
    && isNonEmptyString(candidate.result)
    && Array.isArray(candidate.fields)
    && candidate.fields.length > 0
    && candidate.fields.every(isNonEmptyString);
}

function isScenario(value: unknown): value is ConflictScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConflictScenario>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isNonEmptyString(candidate.documentId)
    && isNonEmptyString(candidate.baseRevision)
    && Array.isArray(candidate.branches)
    && candidate.branches.length >= 2
    && candidate.branches.every(isBranch)
    && Array.isArray(candidate.outcomes)
    && candidate.outcomes.length > 0
    && candidate.outcomes.every(isOutcome);
}

function isResolver(value: unknown): value is Resolver {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Resolver>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail);
}

function isConflictModel(value: unknown): value is ConflictModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConflictModel>;

  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNonEmptyString(candidate.defaults?.scenarioId)
    || !isNonEmptyString(candidate.defaults.resolverId)
    || typeof candidate.defaults.writeBack !== 'boolean'
    || !Array.isArray(candidate.scenarios)
    || candidate.scenarios.length < 3
    || !candidate.scenarios.every(isScenario)
    || !hasUniqueIds(candidate.scenarios)
    || !Array.isArray(candidate.resolvers)
    || candidate.resolvers.length < 3
    || !candidate.resolvers.every(isResolver)
    || !hasUniqueIds(candidate.resolvers)
  ) {
    return false;
  }

  const resolverIds = new Set(candidate.resolvers.map((resolver) => resolver.id));
  return candidate.scenarios.some(
    (scenario) => scenario.id === candidate.defaults?.scenarioId,
  )
    && candidate.resolvers.some(
      (resolver) => resolver.id === candidate.defaults?.resolverId,
    )
    && candidate.scenarios.every(
      (scenario) =>
        scenario.outcomes.length === resolverIds.size
        && scenario.outcomes.every((outcome) =>
          resolverIds.has(outcome.resolverId)),
    );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function CouchDBRevisionConflictLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ConflictModel | null>(null);
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
        if (!isConflictModel(payload)) {
          throw new Error('The CouchDB conflict contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the CouchDB conflict lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Revision conflict lab"
            title="Inspect both leaves before choosing a winner"
            description="Loading revision histories and domain resolution rules."
            icon={GitMerge}
            accent="violet"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <ConflictWorkbench model={model} />;
}

function ConflictWorkbench({ model }: { model: ConflictModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [resolverId, setResolverId] = useState(model.defaults.resolverId);
  const [writeBack, setWriteBack] = useState(model.defaults.writeBack);

  const scenario = findById(model.scenarios, scenarioId);
  const resolver = findById(model.resolvers, resolverId);
  const outcome = scenario.outcomes.find(
    (candidate) => candidate.resolverId === resolver.id,
  ) ?? scenario.outcomes[0];
  const converged = writeBack && outcome.canWriteBack;
  const remainingLeaves = converged ? 1 : scenario.branches.length;
  const tone = outcome.status === 'safe'
    ? 'emerald'
    : outcome.status === 'lossy'
      ? 'rose'
      : 'amber';
  const statusLabel = outcome.status === 'safe'
    ? 'Meaning preserved'
    : outcome.status === 'lossy'
      ? 'Valid change lost'
      : 'Review required';
  const StatusIcon = outcome.status === 'safe'
    ? CheckCircle2
    : outcome.status === 'lossy'
      ? ShieldAlert
      : AlertTriangle;

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setResolverId(model.defaults.resolverId);
    setWriteBack(model.defaults.writeBack);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Revision conflict lab"
          title={model.title}
          description={model.description}
          icon={GitMerge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Concurrent edit
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={GitBranch}
                      accent="violet"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Resolution rule
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.resolvers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === resolver.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'winner-only' ? History : GitMerge}
                      accent="cyan"
                      onClick={() => setResolverId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                <input
                  type="checkbox"
                  checked={writeBack}
                  onChange={(event) => setWriteBack(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Write a resolved descendant
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Commit one merged revision and delete the losing leaves when
                    the rule can decide safely.
                  </span>
                </span>
              </label>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Open leaves"
                value={String(remainingLeaves)}
                detail={converged ? 'One resolved descendant' : 'Conflict remains visible'}
                icon={GitBranch}
                tone={converged ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Preserved changes"
                value={`${outcome.preservedChanges}/${outcome.preservedChanges + outcome.lostChanges}`}
                detail="Valid concurrent edits retained"
                icon={CheckCircle2}
                tone={tone}
              />
              <LabMetric
                label="Resolution"
                value={statusLabel}
                detail={converged ? 'Safe to close the branch set' : 'Do not declare convergence'}
                icon={StatusIcon}
                tone={tone}
              />
            </div>

            <section aria-label="Revision tree" className="min-w-0">
              <div className="mx-auto max-w-sm rounded-md border border-neutral-300 bg-neutral-50 p-4 text-center dark:border-neutral-700 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Common ancestor
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                  {scenario.baseRevision}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {scenario.documentId}
                </p>
              </div>

              <div aria-hidden="true" className="mx-auto h-6 w-px bg-neutral-300 dark:bg-neutral-700" />
              <div className="grid gap-3 sm:grid-cols-2">
                {scenario.branches.map((branch) => (
                  <article
                    key={branch.revision}
                    className="min-w-0 rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase opacity-70">
                          {branch.source}
                        </p>
                        <p className="mt-1 break-all font-mono text-sm font-semibold">
                          {branch.revision}
                        </p>
                      </div>
                      <GitBranch aria-hidden="true" className="h-5 w-5 shrink-0" />
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm leading-6">
                      {branch.changes.map((change) => (
                        <li key={change} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                outcome.status === 'safe'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : outcome.status === 'lossy'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Observed outcome
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{statusLabel}</h4>
                  <p className="mt-2 text-sm leading-6">{outcome.result}</p>
                </div>
              </div>

              <div className="mt-4 border-t border-current/20 pt-4">
                <p className="text-xs font-semibold uppercase opacity-70">
                  Resulting fields
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {outcome.fields.map((field) => (
                    <li
                      key={field}
                      className="min-w-0 rounded border border-current/20 bg-white/60 px-3 py-2 text-sm dark:bg-black/15"
                    >
                      {field}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-4 border-t border-current/20 pt-4 text-sm font-semibold">
                {converged
                  ? 'The resolver can write one descendant and remove losing leaves.'
                  : writeBack
                    ? 'This rule cannot safely write a final descendant; keep the conflict open.'
                    : 'Without write-back, both branches remain for the next reader.'}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
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
    <div className="flex min-h-48 items-center justify-center p-6">
      {error ? (
        <div className="max-w-lg text-center">
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
          />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The conflict model could not be loaded.
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center text-neutral-600 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm">Loading revision histories…</p>
        </div>
      )}
    </div>
  );
}
