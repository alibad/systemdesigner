'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleEllipsis,
  GitMerge,
  History,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Repeat2,
  Scale,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ObjectField = {
  name: string;
  value: string;
  source: string;
};

type SiblingVersion = {
  id: string;
  label: string;
  context: string;
  fields: ObjectField[];
};

type Resolver = {
  id: string;
  label: string;
  detail: string;
};

type ResolutionStatus = 'safe' | 'lossy' | 'review';

type ResolutionOutcome = {
  resolverId: string;
  status: ResolutionStatus;
  canCommit: boolean;
  resultFields: ObjectField[];
  preservedChanges: number;
  lostChanges: number;
  explanation: string;
};

type ConflictCase = {
  id: string;
  label: string;
  detail: string;
  location: string;
  causalRelation: string;
  siblings: SiblingVersion[];
  outcomes: ResolutionOutcome[];
};

type CompletionMode = {
  id: string;
  label: string;
  detail: string;
  writesResolvedDescendant: boolean;
  convergenceLabel: string;
  explanation: string;
};

type ConvergenceModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    caseId: string;
    resolverId: string;
    completionId: string;
  };
  cases: ConflictCase[];
  resolvers: Resolver[];
  completionModes: CompletionMode[];
};

const BLOCK_ID = 'technology/riak-convergence-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/riak/data/conflict-convergence-model.json';
const resolutionStatuses: ResolutionStatus[] = ['safe', 'lossy', 'review'];

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

function isObjectField(value: unknown): value is ObjectField {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ObjectField>;
  return isNonEmptyString(candidate.name)
    && isNonEmptyString(candidate.value)
    && isNonEmptyString(candidate.source);
}

function isSiblingVersion(value: unknown): value is SiblingVersion {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SiblingVersion>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.context)
    && Array.isArray(candidate.fields)
    && candidate.fields.length > 0
    && candidate.fields.every(isObjectField);
}

function isResolver(value: unknown): value is Resolver {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Resolver>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail);
}

function isResolutionOutcome(value: unknown): value is ResolutionOutcome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResolutionOutcome>;
  return isNonEmptyString(candidate.resolverId)
    && resolutionStatuses.includes(candidate.status as ResolutionStatus)
    && typeof candidate.canCommit === 'boolean'
    && Array.isArray(candidate.resultFields)
    && candidate.resultFields.length > 0
    && candidate.resultFields.every(isObjectField)
    && isNonNegativeInteger(candidate.preservedChanges)
    && isNonNegativeInteger(candidate.lostChanges)
    && isNonEmptyString(candidate.explanation);
}

function isConflictCase(value: unknown): value is ConflictCase {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConflictCase>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isNonEmptyString(candidate.location)
    && isNonEmptyString(candidate.causalRelation)
    && Array.isArray(candidate.siblings)
    && candidate.siblings.length > 0
    && candidate.siblings.every(isSiblingVersion)
    && hasUniqueIds(candidate.siblings)
    && Array.isArray(candidate.outcomes)
    && candidate.outcomes.length > 0
    && candidate.outcomes.every(isResolutionOutcome);
}

function isCompletionMode(value: unknown): value is CompletionMode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CompletionMode>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && typeof candidate.writesResolvedDescendant === 'boolean'
    && isNonEmptyString(candidate.convergenceLabel)
    && isNonEmptyString(candidate.explanation);
}

function isConvergenceModel(value: unknown): value is ConvergenceModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConvergenceModel>;
  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNonEmptyString(candidate.defaults?.caseId)
    || !isNonEmptyString(candidate.defaults.resolverId)
    || !isNonEmptyString(candidate.defaults.completionId)
    || !Array.isArray(candidate.resolvers)
    || candidate.resolvers.length < 3
    || !candidate.resolvers.every(isResolver)
    || !hasUniqueIds(candidate.resolvers)
    || !candidate.resolvers.some(
      (resolver) => resolver.id === candidate.defaults?.resolverId,
    )
    || !Array.isArray(candidate.completionModes)
    || candidate.completionModes.length < 2
    || !candidate.completionModes.every(isCompletionMode)
    || !hasUniqueIds(candidate.completionModes)
    || !candidate.completionModes.some(
      (mode) => mode.id === candidate.defaults?.completionId,
    )
    || !Array.isArray(candidate.cases)
    || candidate.cases.length < 3
    || !candidate.cases.every(isConflictCase)
    || !hasUniqueIds(candidate.cases)
    || !candidate.cases.some(
      (conflictCase) => conflictCase.id === candidate.defaults?.caseId,
    )
  ) {
    return false;
  }

  const resolverIds = new Set(candidate.resolvers.map((resolver) => resolver.id));
  return candidate.cases.every(
    (conflictCase) =>
      conflictCase.outcomes.length === resolverIds.size
      && hasUniqueIds(
        conflictCase.outcomes.map((outcome) => ({ id: outcome.resolverId })),
      )
      && conflictCase.outcomes.every((outcome) =>
        resolverIds.has(outcome.resolverId)),
  );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function RiakConvergenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ConvergenceModel | null>(null);
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
        if (!isConvergenceModel(payload)) {
          throw new Error('The Riak conflict contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Riak convergence lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Sibling convergence lab"
            title="Resolve meaning before repairing copies"
            description="Loading causal histories, resolution policies, and write-back consequences."
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

  return <ConvergenceWorkbench model={model} />;
}

function ConvergenceWorkbench({ model }: { model: ConvergenceModel }) {
  const [caseId, setCaseId] = useState(model.defaults.caseId);
  const [resolverId, setResolverId] = useState(model.defaults.resolverId);
  const [completionId, setCompletionId] = useState(
    model.defaults.completionId,
  );

  const conflictCase = findById(model.cases, caseId);
  const resolver = findById(model.resolvers, resolverId);
  const completion = findById(model.completionModes, completionId);
  const outcome = conflictCase.outcomes.find(
    (candidate) => candidate.resolverId === resolver.id,
  ) ?? conflictCase.outcomes[0];

  const result = useMemo(() => {
    const writesResolvedDescendant =
      completion.writesResolvedDescendant && outcome.canCommit;
    const remainingSiblings = writesResolvedDescendant
      ? 1
      : conflictCase.siblings.length;
    const complete =
      writesResolvedDescendant
      && outcome.status !== 'lossy';

    return {
      complete,
      remainingSiblings,
      writesResolvedDescendant,
    };
  }, [completion, conflictCase.siblings.length, outcome]);

  function reset() {
    setCaseId(model.defaults.caseId);
    setResolverId(model.defaults.resolverId);
    setCompletionId(model.defaults.completionId);
  }

  const statusClass = result.complete
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : outcome.status === 'lossy'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  const StatusIcon = result.complete
    ? CheckCircle2
    : outcome.status === 'lossy'
      ? XCircle
      : CircleEllipsis;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Sibling convergence lab"
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
                  1. Update history
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === conflictCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.siblings.length > 1 ? History : CheckCircle2}
                      accent={item.siblings.length > 1 ? 'amber' : 'emerald'}
                      onClick={() => setCaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Resolution policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.resolvers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === resolver.id}
                      label={item.label}
                      detail={item.detail}
                      icon={
                        item.id === 'domain-merge'
                          ? GitMerge
                          : item.id === 'timestamp-winner'
                            ? History
                            : Scale
                      }
                      accent={
                        item.id === 'domain-merge'
                          ? 'violet'
                          : item.id === 'timestamp-winner'
                            ? 'rose'
                            : 'blue'
                      }
                      onClick={() => setResolverId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Convergence action
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.completionModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === completion.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.writesResolvedDescendant ? Sparkles : Repeat2}
                      accent={item.writesResolvedDescendant ? 'emerald' : 'cyan'}
                      onClick={() => setCompletionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Causal relation"
                value={conflictCase.causalRelation}
                detail={conflictCase.location}
                icon={History}
                tone={conflictCase.siblings.length > 1 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Read returns"
                value={`${conflictCase.siblings.length} version${conflictCase.siblings.length === 1 ? '' : 's'}`}
                detail="Causal context preserves concurrent branches"
                icon={Layers3}
                tone={conflictCase.siblings.length > 1 ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="After action"
                value={`${result.remainingSiblings} version${result.remainingSiblings === 1 ? '' : 's'}`}
                detail={completion.convergenceLabel}
                icon={Repeat2}
                tone={result.writesResolvedDescendant ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Changes kept"
                value={`${outcome.preservedChanges} kept`}
                detail={`${outcome.lostChanges} lost by this policy`}
                icon={ShieldCheck}
                tone={outcome.lostChanges > 0 ? 'rose' : 'blue'}
              />
            </div>

            <VersionComparison
              siblings={conflictCase.siblings}
              resultFields={outcome.resultFields}
              resolverLabel={resolver.label}
            />

            <section className={`rounded-md border p-5 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Resolution consequence
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {result.complete
                      ? 'The application stores one causal descendant'
                      : outcome.status === 'lossy'
                        ? 'The cluster can converge after discarding a valid change'
                        : !outcome.canCommit
                          ? 'The policy cannot produce a defensible value yet'
                          : 'The reader computed a result but did not complete convergence'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {outcome.explanation} {completion.explanation}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <ModelFact
                label="Repair mechanism"
                value={
                  result.writesResolvedDescendant
                    ? 'The resolved write carries the returned causal context and supersedes the sibling set. Later read repair and AAE can propagate that stored descendant to divergent replicas.'
                    : 'Read repair can copy observed object versions and AAE can find divergent replicas with hash-tree exchanges. Neither mechanism knows the business rule needed to merge siblings.'
                }
              />
              <ModelFact
                label="Operational signal"
                value={
                  result.remainingSiblings > 1
                    ? 'Sibling count remains above one. Track repeated siblings, object size, read latency, and resolver errors before the object grows into a hot operational problem.'
                    : 'The key now has one application-approved descendant. Verify replica convergence separately; one successful response is not evidence that every primary vnode has repaired.'
                }
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function VersionComparison({
  siblings,
  resultFields,
  resolverLabel,
}: {
  siblings: SiblingVersion[];
  resultFields: ObjectField[];
  resolverLabel: string;
}) {
  return (
    <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Object history
        </p>
        <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
          Compare stored siblings with the proposed descendant
        </h4>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {siblings.map((sibling) => (
            <ObjectVersion
              key={sibling.id}
              label={sibling.label}
              context={sibling.context}
              fields={sibling.fields}
              tone="sibling"
            />
          ))}
        </div>

        <div className="flex items-center justify-center">
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-center text-xs font-semibold text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            <GitMerge aria-hidden="true" className="mx-auto h-4 w-4" />
            <span className="mt-1 block">{resolverLabel}</span>
          </div>
        </div>

        <ObjectVersion
          label="Proposed result"
          context="Must be written with the returned causal context"
          fields={resultFields}
          tone="result"
        />
      </div>
    </section>
  );
}

function ObjectVersion({
  label,
  context,
  fields,
  tone,
}: {
  label: string;
  context: string;
  fields: ObjectField[];
  tone: 'sibling' | 'result';
}) {
  return (
    <article
      className={`min-w-0 rounded-md border p-4 ${
        tone === 'result'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
          : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
      }`}
    >
      <h5 className="text-sm font-semibold">{label}</h5>
      <p className="mt-1 break-words text-xs leading-5 opacity-70">{context}</p>
      <dl className="mt-3 divide-y divide-current/10 text-xs">
        {fields.map((field) => (
          <div
            key={`${field.name}-${field.source}`}
            className="grid min-w-0 grid-cols-[minmax(72px,0.7fr)_minmax(0,1.3fr)] gap-3 py-2"
          >
            <dt className="break-words font-semibold">{field.name}</dt>
            <dd className="min-w-0 break-words text-right">
              <span className="block">{field.value}</span>
              <span className="mt-0.5 block opacity-60">{field.source}</span>
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ModelFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <section className="min-w-0 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
      <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
        {label}
      </h4>
      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
        {value}
      </p>
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
      {error ? (
        <div
          className="min-h-40 rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <div>
              <p className="font-semibold">Conflict model unavailable</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading causal histories
        </div>
      )}
    </LearningLabBody>
  );
}
