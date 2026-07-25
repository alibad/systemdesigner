'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Repeat2,
  Server,
  ServerCrash,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type NumericBound = {
  min: number;
  max: number;
  default: number;
};

type QuorumMode = {
  id: string;
  label: string;
  detail: string;
  usesFallbacks: boolean;
  primaryReadMinimum: number;
  primaryWriteMinimum: number;
};

type ReplicaIncident = {
  id: string;
  label: string;
  detail: string;
  failedPrimaries: number;
  availableFallbacks: number;
  recoveryNote: string;
};

type QuorumModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  bounds: {
    n: NumericBound;
    r: NumericBound;
    w: NumericBound;
  };
  defaults: {
    modeId: string;
    incidentId: string;
  };
  modes: QuorumMode[];
  incidents: ReplicaIncident[];
};

const BLOCK_ID = 'technology/riak-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/riak/data/quorum-envelope.json';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNumericBound(value: unknown): value is NumericBound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NumericBound>;
  return isInteger(candidate.min)
    && isInteger(candidate.max)
    && isInteger(candidate.default)
    && candidate.min > 0
    && candidate.min <= candidate.default
    && candidate.default <= candidate.max;
}

function isQuorumMode(value: unknown): value is QuorumMode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuorumMode>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && typeof candidate.usesFallbacks === 'boolean'
    && isInteger(candidate.primaryReadMinimum)
    && candidate.primaryReadMinimum >= 0
    && isInteger(candidate.primaryWriteMinimum)
    && candidate.primaryWriteMinimum >= 0;
}

function isReplicaIncident(value: unknown): value is ReplicaIncident {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplicaIncident>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isInteger(candidate.failedPrimaries)
    && candidate.failedPrimaries >= 0
    && isInteger(candidate.availableFallbacks)
    && candidate.availableFallbacks >= 0
    && isNonEmptyString(candidate.recoveryNote);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isQuorumModel(value: unknown): value is QuorumModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuorumModel>;
  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNumericBound(candidate.bounds?.n)
    || !isNumericBound(candidate.bounds.r)
    || !isNumericBound(candidate.bounds.w)
    || candidate.bounds.r.max > candidate.bounds.n.max
    || candidate.bounds.w.max > candidate.bounds.n.max
    || candidate.bounds.r.default > candidate.bounds.n.default
    || candidate.bounds.w.default > candidate.bounds.n.default
    || !isNonEmptyString(candidate.defaults?.modeId)
    || !isNonEmptyString(candidate.defaults.incidentId)
    || !Array.isArray(candidate.modes)
    || candidate.modes.length < 2
    || !candidate.modes.every(isQuorumMode)
    || !hasUniqueIds(candidate.modes)
    || !candidate.modes.some((mode) => mode.id === candidate.defaults?.modeId)
    || !Array.isArray(candidate.incidents)
    || candidate.incidents.length < 3
    || !candidate.incidents.every(isReplicaIncident)
    || !hasUniqueIds(candidate.incidents)
    || !candidate.incidents.some(
      (incident) => incident.id === candidate.defaults?.incidentId,
    )
  ) {
    return false;
  }

  return candidate.modes.every(
    (mode) =>
      mode.primaryReadMinimum <= candidate.bounds!.n.max
      && mode.primaryWriteMinimum <= candidate.bounds!.n.max,
  );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function RiakQuorumWorkbench({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<QuorumModel | null>(null);
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
        if (!isQuorumModel(payload)) {
          throw new Error('The Riak quorum contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Riak quorum workbench.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Quorum and fallback workbench"
            title="Choose which acknowledgements count"
            description="Loading replica thresholds, fallback behavior, and recovery consequences."
            icon={GitBranch}
            accent="cyan"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <QuorumWorkbench model={model} />;
}

function QuorumWorkbench({ model }: { model: QuorumModel }) {
  const [nValue, setNValue] = useState(model.bounds.n.default);
  const [rValue, setRValue] = useState(model.bounds.r.default);
  const [wValue, setWValue] = useState(model.bounds.w.default);
  const [modeId, setModeId] = useState(model.defaults.modeId);
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);

  const mode = findById(model.modes, modeId);
  const incident = findById(model.incidents, incidentId);

  const result = useMemo(() => {
    const failedPrimaries = Math.min(nValue, incident.failedPrimaries);
    const livePrimaries = nValue - failedPrimaries;
    const fallbackPlacements = mode.usesFallbacks
      ? Math.min(failedPrimaries, incident.availableFallbacks)
      : 0;
    const reachableReplicas = livePrimaries + fallbackPlacements;
    const readPrimaryMinimum = Math.min(
      rValue,
      mode.primaryReadMinimum,
    );
    const writePrimaryMinimum = Math.min(
      wValue,
      mode.primaryWriteMinimum,
    );
    const readSucceeds =
      reachableReplicas >= rValue
      && livePrimaries >= readPrimaryMinimum;
    const writeSucceeds =
      reachableReplicas >= wValue
      && livePrimaries >= writePrimaryMinimum;
    const overlap = rValue + wValue > nValue;

    return {
      failedPrimaries,
      fallbackPlacements,
      livePrimaries,
      overlap,
      readPrimaryMinimum,
      readSucceeds,
      reachableReplicas,
      writePrimaryMinimum,
      writeSucceeds,
    };
  }, [incident, mode, nValue, rValue, wValue]);

  function changeN(nextN: number) {
    setNValue(nextN);
    setRValue((current) => Math.min(current, nextN));
    setWValue((current) => Math.min(current, nextN));
  }

  function reset() {
    setNValue(model.bounds.n.default);
    setRValue(model.bounds.r.default);
    setWValue(model.bounds.w.default);
    setModeId(model.defaults.modeId);
    setIncidentId(model.defaults.incidentId);
  }

  const operationsSucceed = result.readSucceeds && result.writeSucceeds;
  const outcomeClass = !operationsSucceed
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : result.fallbackPlacements > 0
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  const OutcomeIcon = !operationsSucceed
    ? XCircle
    : result.fallbackPlacements > 0
      ? Repeat2
      : CheckCircle2;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Quorum and fallback workbench"
          title={model.title}
          description={model.description}
          icon={GitBranch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <div className="space-y-6">
                <LabRange
                  label="Replication factor N"
                  value={nValue}
                  output={`${nValue} replicas`}
                  min={model.bounds.n.min}
                  max={model.bounds.n.max}
                  accent="blue"
                  lowLabel="Fewer copies"
                  highLabel="More copy work"
                  onChange={changeN}
                />
                <LabRange
                  label="Read threshold R"
                  value={rValue}
                  output={`${rValue} response${rValue === 1 ? '' : 's'}`}
                  min={model.bounds.r.min}
                  max={nValue}
                  accent="cyan"
                  lowLabel="More available"
                  highLabel="More evidence"
                  onChange={setRValue}
                />
                <LabRange
                  label="Write threshold W"
                  value={wValue}
                  output={`${wValue} ack${wValue === 1 ? '' : 's'}`}
                  min={model.bounds.w.min}
                  max={nValue}
                  accent="violet"
                  lowLabel="Return sooner"
                  highLabel="Wait for more"
                  onChange={setWValue}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Replica condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.failedPrimaries === 0 ? Server : ServerCrash}
                      accent={item.failedPrimaries === 0 ? 'emerald' : 'amber'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Fallback policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.modes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.usesFallbacks ? Repeat2 : ShieldCheck}
                      accent={item.usesFallbacks ? 'cyan' : 'violet'}
                      onClick={() => setModeId(item.id)}
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
                label="Read result"
                value={result.readSucceeds ? 'Available' : 'Unavailable'}
                detail={`${result.reachableReplicas} reachable; R needs ${rValue}`}
                icon={Eye}
                tone={result.readSucceeds ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Write result"
                value={result.writeSucceeds ? 'Acknowledged' : 'No quorum'}
                detail={`${result.reachableReplicas} reachable; W needs ${wValue}`}
                icon={Database}
                tone={result.writeSucceeds ? 'violet' : 'rose'}
              />
              <LabMetric
                label="R + W"
                value={`${rValue + wValue} ${result.overlap ? '>' : '<='} ${nValue}`}
                detail={result.overlap ? 'Quorum sets must overlap' : 'No overlap guarantee'}
                icon={GitBranch}
                tone={result.overlap ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Fallback copies"
                value={`${result.fallbackPlacements}`}
                detail={
                  result.fallbackPlacements > 0
                    ? 'Temporary placements create handoff work'
                    : 'No temporary placement in this request'
                }
                icon={Repeat2}
                tone={result.fallbackPlacements > 0 ? 'amber' : 'neutral'}
              />
            </div>

            <ReplicaPath
              nValue={nValue}
              livePrimaries={result.livePrimaries}
              fallbackPlacements={result.fallbackPlacements}
              availableFallbacks={incident.availableFallbacks}
            />

            <section className={`rounded-md border p-5 ${outcomeClass}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Client-visible consequence
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {!result.writeSucceeds
                      ? 'The client cannot treat the write as committed'
                      : !result.readSucceeds
                        ? 'Writes can pass, but this read contract cannot'
                        : result.fallbackPlacements > 0
                          ? 'Traffic stays available by borrowing fallback vnodes'
                          : 'The primary preference list satisfies both operations'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {!operationsSucceed
                      ? 'A timeout or quorum error is still ambiguous: some reachable replicas may have accepted the request. Retries need an idempotency rule, and operators must inspect replica recovery rather than assuming no write occurred.'
                      : result.fallbackPlacements > 0
                        ? `${incident.recoveryNote} The successful response does not erase that convergence debt.`
                        : 'No fallback vnode is needed for the selected incident. Riak can answer from the primary preference list without creating hinted-handoff debt.'}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <ModelFact
                label="What overlap proves"
                icon={ShieldCheck}
                value={
                  result.overlap
                    ? 'For completed operations against the same N replica set, every W acknowledgement set and R response set share at least one position.'
                    : 'A successful read can be satisfied entirely by replicas outside the acknowledgement set of a successful write.'
                }
              />
              <ModelFact
                label="What overlap does not prove"
                icon={AlertTriangle}
                value={
                  mode.usesFallbacks
                    ? 'Sloppy quorums may involve fallback positions, and concurrent writes can still create siblings. R + W > N is not a blanket linearizability guarantee.'
                    : 'Concurrent writes, client causal context, and application conflict resolution still determine which version a reader observes.'
                }
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ReplicaPath({
  nValue,
  livePrimaries,
  fallbackPlacements,
  availableFallbacks,
}: {
  nValue: number;
  livePrimaries: number;
  fallbackPlacements: number;
  availableFallbacks: number;
}) {
  return (
    <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Coordinator preference walk
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
            Primary positions first, then eligible fallbacks
          </h4>
        </div>
        <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          N = {nValue}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: nValue }, (_, index) => {
          const live = index < livePrimaries;
          return (
            <div
              key={`primary-${index}`}
              className={`min-h-24 rounded-md border p-3 ${
                live
                  ? 'border-blue-200 bg-white text-blue-950 dark:border-blue-900 dark:bg-neutral-950 dark:text-blue-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {live ? (
                  <Server aria-hidden="true" className="h-4 w-4 shrink-0" />
                ) : (
                  <ServerCrash aria-hidden="true" className="h-4 w-4 shrink-0" />
                )}
                <span className="text-xs font-semibold">Primary {index + 1}</span>
              </div>
              <p className="mt-3 text-xs leading-5 opacity-75">
                {live ? 'Can answer this request.' : 'Unavailable to the coordinator.'}
              </p>
            </div>
          );
        })}
      </div>

      {availableFallbacks > 0 ? (
        <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Fallback capacity
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: availableFallbacks }, (_, index) => {
              const used = index < fallbackPlacements;
              return (
                <div
                  key={`fallback-${index}`}
                  className={`min-h-16 rounded-md border p-3 text-xs ${
                    used
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                      : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Repeat2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    Fallback {index + 1}
                  </div>
                  <p className="mt-1 leading-5">
                    {used ? 'Stores a temporary hinted copy.' : 'Reachable but not selected.'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ModelFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <section className="min-w-0 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <h4 className="text-sm font-semibold">{label}</h4>
      </div>
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
              <p className="font-semibold">Quorum model unavailable</p>
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
          Loading quorum consequences
        </div>
      )}
    </LearningLabBody>
  );
}
