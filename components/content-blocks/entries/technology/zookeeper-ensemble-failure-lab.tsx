'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  CloudCog,
  LoaderCircle,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Vote,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Ensemble = {
  id: string;
  label: string;
  voters: number;
  detail: string;
};

type Placement = {
  id: string;
  label: string;
  detail: string;
  domainCount: number;
};

type FailureKind = 'none' | 'single-voter' | 'largest-domain' | 'two-voters';

type Failure = {
  id: string;
  label: string;
  detail: string;
  kind: FailureKind;
};

type EnsembleFailureModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    ensembleId: string;
    placementId: string;
    failureId: string;
  };
  ensembles: Ensemble[];
  placements: Placement[];
  failures: Failure[];
};

const BLOCK_ID = 'technology/zookeeper-ensemble-failure-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/zookeeper/data/ensemble-failure-model.json';
const failureKinds: FailureKind[] = [
  'none',
  'single-voter',
  'largest-domain',
  'two-voters',
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isEnsemble(value: unknown): value is Ensemble {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Ensemble>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && typeof candidate.voters === 'number'
    && Number.isInteger(candidate.voters)
    && candidate.voters >= 3
    && candidate.voters % 2 === 1;
}

function isPlacement(value: unknown): value is Placement {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Placement>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && typeof candidate.domainCount === 'number'
    && Number.isInteger(candidate.domainCount)
    && candidate.domainCount >= 1
    && candidate.domainCount <= 3;
}

function isFailure(value: unknown): value is Failure {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Failure>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && failureKinds.includes(candidate.kind as FailureKind);
}

function isEnsembleFailureModel(value: unknown): value is EnsembleFailureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnsembleFailureModel>;
  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNonEmptyString(candidate.defaults?.ensembleId)
    || !isNonEmptyString(candidate.defaults.placementId)
    || !isNonEmptyString(candidate.defaults.failureId)
    || !Array.isArray(candidate.ensembles)
    || candidate.ensembles.length < 3
    || !candidate.ensembles.every(isEnsemble)
    || !hasUniqueIds(candidate.ensembles)
    || !Array.isArray(candidate.placements)
    || candidate.placements.length < 3
    || !candidate.placements.every(isPlacement)
    || !hasUniqueIds(candidate.placements)
    || !Array.isArray(candidate.failures)
    || candidate.failures.length < 3
    || !candidate.failures.every(isFailure)
    || !hasUniqueIds(candidate.failures)
  ) {
    return false;
  }

  return candidate.ensembles.some(
    (item) => item.id === candidate.defaults?.ensembleId,
  )
    && candidate.placements.some(
      (item) => item.id === candidate.defaults?.placementId,
    )
    && candidate.failures.some(
      (item) => item.id === candidate.defaults?.failureId,
    );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

function distribute(voters: number, domainCount: number): number[] {
  const base = Math.floor(voters / domainCount);
  const remainder = voters % domainCount;
  return Array.from(
    { length: domainCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function failedVoterIndexes(
  distribution: number[],
  failureKind: FailureKind,
): Set<number> {
  if (failureKind === 'none') return new Set();
  if (failureKind === 'single-voter') return new Set([0]);
  if (failureKind === 'largest-domain') {
    return new Set(Array.from({ length: distribution[0] }, (_, index) => index));
  }

  const secondDomainStart = distribution[0] ?? 1;
  return new Set(
    distribution.length > 1
      ? [0, secondDomainStart]
      : [0, 1],
  );
}

export default function ZookeeperEnsembleFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<EnsembleFailureModel | null>(null);
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
        if (!isEnsembleFailureModel(payload)) {
          throw new Error('The ensemble failure contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the ensemble failure lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Quorum and placement lab"
            title="Test the majority before trusting the topology"
            description="Loading ensemble sizes, failure domains, and outage scenarios."
            icon={Vote}
            accent="blue"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <EnsembleWorkbench model={model} />;
}

function EnsembleWorkbench({ model }: { model: EnsembleFailureModel }) {
  const [ensembleId, setEnsembleId] = useState(model.defaults.ensembleId);
  const [placementId, setPlacementId] = useState(model.defaults.placementId);
  const [failureId, setFailureId] = useState(model.defaults.failureId);

  const ensemble = findById(model.ensembles, ensembleId);
  const placement = findById(model.placements, placementId);
  const failure = findById(model.failures, failureId);

  const result = useMemo(() => {
    const quorum = Math.floor(ensemble.voters / 2) + 1;
    const distribution = distribute(ensemble.voters, placement.domainCount);
    const failed = failedVoterIndexes(distribution, failure.kind);
    const survivors = ensemble.voters - failed.size;
    const canWrite = survivors >= quorum;
    const atEdge = canWrite && survivors === quorum;

    return {
      quorum,
      distribution,
      failed,
      survivors,
      canWrite,
      atEdge,
      toleratedFailures: Math.floor((ensemble.voters - 1) / 2),
    };
  }, [ensemble.voters, failure.kind, placement.domainCount]);

  function reset() {
    setEnsembleId(model.defaults.ensembleId);
    setPlacementId(model.defaults.placementId);
    setFailureId(model.defaults.failureId);
  }

  const OutcomeIcon = result.canWrite ? CheckCircle2 : XCircle;
  const outcomeTone = result.canWrite
    ? result.atEdge
      ? 'amber'
      : 'emerald'
    : 'rose';
  const outcomeClass = result.canWrite
    ? result.atEdge
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Quorum and placement lab"
          title={model.title}
          description={model.description}
          icon={Vote}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Voting ensemble"
                items={model.ensembles}
                selectedId={ensemble.id}
                icon={Server}
                accent="blue"
                onSelect={setEnsembleId}
              />
              <ChoiceGroup
                legend="2. Failure-domain placement"
                items={model.placements}
                selectedId={placement.id}
                icon={CloudCog}
                accent="violet"
                onSelect={setPlacementId}
              />
              <ChoiceGroup
                legend="3. Inject a failure"
                items={model.failures}
                selectedId={failure.id}
                icon={TriangleAlert}
                accent="rose"
                onSelect={setFailureId}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Voting members"
              value={`${ensemble.voters}`}
              detail="Observers do not count toward this number."
              icon={Vote}
              tone="blue"
            />
            <LabMetric
              label="Write quorum"
              value={`${result.quorum}`}
              detail={`floor(${ensemble.voters} / 2) + 1`}
              icon={ShieldCheck}
              tone="violet"
            />
            <LabMetric
              label="Surviving voters"
              value={`${result.survivors}`}
              detail={`${result.failed.size} unavailable in this scenario`}
              icon={Network}
              tone={outcomeTone}
            />
            <LabMetric
              label="Failure tolerance"
              value={`${result.toleratedFailures}`}
              detail="Maximum arbitrary voter failures before quorum is lost."
              icon={CircleOff}
              tone="neutral"
            />
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Placement map
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {placement.label}: {result.distribution.join(' + ')} voters
                </h4>
              </div>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                Majority needs {result.quorum} of {ensemble.voters}
              </span>
            </div>

            <div
              className="mt-4 grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(result.distribution.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {result.distribution.map((count, domainIndex) => {
                const startIndex = result.distribution
                  .slice(0, domainIndex)
                  .reduce((sum, value) => sum + value, 0);
                const domainFailed = Array.from(
                  { length: count },
                  (_, offset) => startIndex + offset,
                ).every((index) => result.failed.has(index));

                return (
                  <div
                    key={`${placement.id}-${domainIndex}`}
                    className={`min-w-0 rounded-md border p-4 ${
                      domainFailed
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                        : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        {placement.domainCount === 1 ? 'Shared rack' : `Zone ${domainIndex + 1}`}
                      </span>
                      {domainFailed ? (
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                          Domain lost
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Array.from({ length: count }, (_, offset) => {
                        const voterIndex = startIndex + offset;
                        const isFailed = result.failed.has(voterIndex);
                        return (
                          <span
                            key={voterIndex}
                            title={`Voter ${voterIndex + 1}: ${isFailed ? 'unavailable' : 'available'}`}
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold ${
                              isFailed
                                ? 'border-rose-400 bg-rose-100 text-rose-800 line-through dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                : 'border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-neutral-950 dark:text-emerald-200'
                            }`}
                          >
                            {voterIndex + 1}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-5 ${outcomeClass}`}>
            <div className="flex items-start gap-3">
              <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {result.canWrite
                    ? result.atEdge
                      ? 'Writes continue at the quorum edge'
                      : 'The ensemble retains write quorum'
                    : 'Write quorum is lost'}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {result.canWrite
                    ? `${result.survivors} surviving voters can still produce the ${result.quorum} acknowledgements required for progress. ${
                        result.atEdge
                          ? 'There is no remaining voter-failure headroom; replace or restore a member before planned maintenance.'
                          : 'The ensemble still has voter headroom after this failure.'
                      }`
                    : `Only ${result.survivors} voters remain, below the required majority of ${result.quorum}. Clients cannot commit coordination changes until enough voters return.`}
                </p>
              </div>
            </div>
          </div>

          {placement.domainCount < 3 ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <strong>Placement warning:</strong> {placement.detail} Voter count
                alone does not protect a coordination service from a shared
                failure boundary.
              </p>
            </div>
          ) : null}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends { id: string; label: string; detail: string }>({
  legend,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  legend: string;
  items: T[];
  selectedId: string;
  icon: typeof Server;
  accent: 'blue' | 'violet' | 'rose';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
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
      <div className="max-w-md text-center">
        {error ? (
          <>
            <AlertTriangle
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300"
            />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              Ensemble data could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </>
        ) : (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto h-7 w-7 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-300"
            />
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
              Loading quorum scenarios...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
