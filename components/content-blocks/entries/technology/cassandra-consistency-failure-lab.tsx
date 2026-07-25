'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleX,
  DatabaseZap,
  Eye,
  LoaderCircle,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ConsistencyLevelId = 'ONE' | 'QUORUM' | 'ALL';

type ConsistencyLevel = {
  id: ConsistencyLevelId;
  label: string;
  responses: number;
  detail: string;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  availableReplicas: number;
  consequence: string;
  repairNote: string;
};

type ConsistencyFailureModel = {
  title: string;
  description: string;
  replicationFactor: number;
  defaultWriteLevel: ConsistencyLevelId;
  defaultReadLevel: ConsistencyLevelId;
  defaultScenarioId: string;
  levels: ConsistencyLevel[];
  scenarios: FailureScenario[];
};

const BLOCK_ID = 'technology/cassandra-consistency-failure-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/cassandra/data/consistency-failure-model.json';
const levelIds: ConsistencyLevelId[] = ['ONE', 'QUORUM', 'ALL'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isConsistencyLevel(value: unknown): value is ConsistencyLevel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConsistencyLevel>;
  return levelIds.includes(candidate.id as ConsistencyLevelId)
    && typeof candidate.label === 'string'
    && isFiniteNumber(candidate.responses)
    && typeof candidate.detail === 'string';
}

function isFailureScenario(value: unknown): value is FailureScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureScenario>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && isFiniteNumber(candidate.availableReplicas)
    && typeof candidate.consequence === 'string'
    && typeof candidate.repairNote === 'string';
}

function isConsistencyFailureModel(
  value: unknown,
): value is ConsistencyFailureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConsistencyFailureModel>;
  return typeof candidate.title === 'string'
    && typeof candidate.description === 'string'
    && isFiniteNumber(candidate.replicationFactor)
    && levelIds.includes(candidate.defaultWriteLevel as ConsistencyLevelId)
    && levelIds.includes(candidate.defaultReadLevel as ConsistencyLevelId)
    && typeof candidate.defaultScenarioId === 'string'
    && Array.isArray(candidate.levels)
    && candidate.levels.length === levelIds.length
    && candidate.levels.every(isConsistencyLevel)
    && Array.isArray(candidate.scenarios)
    && candidate.scenarios.length >= 3
    && candidate.scenarios.every(isFailureScenario)
    && candidate.scenarios.some(
      (scenario) => scenario.id === candidate.defaultScenarioId,
    );
}

export default function CassandraConsistencyFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ConsistencyFailureModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [writeLevelId, setWriteLevelId] =
    useState<ConsistencyLevelId>('QUORUM');
  const [readLevelId, setReadLevelId] =
    useState<ConsistencyLevelId>('QUORUM');
  const [scenarioId, setScenarioId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isConsistencyFailureModel(payload)) {
          throw new Error('The consistency-failure model is incomplete.');
        }
        setData(payload);
        setWriteLevelId(payload.defaultWriteLevel);
        setReadLevelId(payload.defaultReadLevel);
        setScenarioId(payload.defaultScenarioId);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the consistency-failure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const writeLevel = data.levels.find(
      (level) => level.id === writeLevelId,
    ) ?? data.levels[0];
    const readLevel = data.levels.find(
      (level) => level.id === readLevelId,
    ) ?? data.levels[0];
    const scenario = data.scenarios.find(
      (candidate) => candidate.id === scenarioId,
    ) ?? data.scenarios[0];
    const writeSucceeds =
      scenario.availableReplicas >= writeLevel.responses;
    const readSucceeds =
      scenario.availableReplicas >= readLevel.responses;
    const overlap = writeLevel.responses + readLevel.responses
      > data.replicationFactor;
    const unavailableReplicas =
      data.replicationFactor - scenario.availableReplicas;

    return {
      overlap,
      readLevel,
      readSucceeds,
      scenario,
      unavailableReplicas,
      writeLevel,
      writeSucceeds,
    };
  }, [data, readLevelId, scenarioId, writeLevelId]);

  if (!data || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Consistency and failure lab"
            title="How many replicas must answer?"
            description="Loading acknowledgement thresholds and replica failures."
            icon={DatabaseZap}
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

  const {
    defaultReadLevel,
    defaultScenarioId,
    defaultWriteLevel,
  } = data;

  function reset() {
    setWriteLevelId(defaultWriteLevel);
    setReadLevelId(defaultReadLevel);
    setScenarioId(defaultScenarioId);
  }

  const allSuccessful = result.writeSucceeds && result.readSucceeds;
  const outcomeTone = !allSuccessful
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : result.overlap
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  const OutcomeIcon = !allSuccessful
    ? TimerOff
    : result.overlap
      ? ShieldCheck
      : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Consistency and failure lab"
          title={data.title}
          description={data.description}
          icon={DatabaseZap}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Replica condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={
                        scenario.availableReplicas === data.replicationFactor
                          ? CheckCircle2
                          : ServerCrash
                      }
                      accent={
                        scenario.availableReplicas === data.replicationFactor
                          ? 'emerald'
                          : scenario.availableReplicas > 1
                            ? 'amber'
                            : 'rose'
                      }
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LevelPicker
                label="Write consistency"
                levels={data.levels}
                selectedId={result.writeLevel.id}
                onChange={setWriteLevelId}
              />
              <LevelPicker
                label="Read consistency"
                levels={data.levels}
                selectedId={result.readLevel.id}
                onChange={setReadLevelId}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Write threshold"
                value={`${result.writeLevel.responses} of ${data.replicationFactor}`}
                detail={`${result.writeLevel.id} acknowledgements required`}
                icon={DatabaseZap}
                tone={result.writeSucceeds ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Read threshold"
                value={`${result.readLevel.responses} of ${data.replicationFactor}`}
                detail={`${result.readLevel.id} responses required`}
                icon={Eye}
                tone={result.readSucceeds ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Available replicas"
                value={`${result.scenario.availableReplicas} of ${data.replicationFactor}`}
                detail={`${result.unavailableReplicas} unavailable in this scenario`}
                icon={ServerCrash}
                tone={result.unavailableReplicas === 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="R + W"
                value={`${result.readLevel.responses + result.writeLevel.responses}`}
                detail={`Must exceed RF ${data.replicationFactor} for overlap`}
                icon={ShieldCheck}
                tone={result.overlap ? 'violet' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Coordinator view of the replica set
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Cassandra sends a normal write to every configured replica. The
                  write consistency level changes how many acknowledgements the
                  coordinator waits for, not how many replicas it targets.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {Array.from(
                  { length: data.replicationFactor },
                  (_, index) => index,
                ).map((index) => {
                  const available =
                    index < result.scenario.availableReplicas;
                  const countsForWrite =
                    available && index < result.writeLevel.responses;
                  const countsForRead =
                    available && index < result.readLevel.responses;
                  return (
                    <div
                      key={index}
                      className={`rounded-md border p-4 ${
                        available
                          ? 'border-neutral-300 bg-neutral-50 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white'
                          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Replica {index + 1}
                        </p>
                        {available ? (
                          <CheckCircle2
                            aria-label="Available"
                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                          />
                        ) : (
                          <CircleX
                            aria-label="Unavailable"
                            className="h-5 w-5 text-rose-600 dark:text-rose-400"
                          />
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                        {countsForWrite ? (
                          <span className="rounded bg-violet-100 px-2 py-1 text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                            Write ack
                          </span>
                        ) : null}
                        {countsForRead ? (
                          <span className="rounded bg-cyan-100 px-2 py-1 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
                            Read response
                          </span>
                        ) : null}
                        {!available ? (
                          <span className="rounded bg-rose-100 px-2 py-1 text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                            Missed mutation
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className={`rounded-md border p-5 ${outcomeTone}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="text-base font-semibold">
                    {!result.writeSucceeds
                      ? 'The client cannot treat the write as acknowledged'
                      : !result.readSucceeds
                        ? 'The selected read cannot gather enough responses'
                        : result.overlap
                          ? 'Successful read and write quorums must overlap'
                          : 'Both operations can succeed without an overlap guarantee'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {!result.writeSucceeds
                      ? `Only ${result.scenario.availableReplicas} replicas can answer, but ${result.writeLevel.id} requires ${result.writeLevel.responses}. A timeout does not prove that no replica applied the mutation, so the caller needs an idempotent retry policy.`
                      : !result.readSucceeds
                        ? `The write can be acknowledged, but ${result.readLevel.id} needs ${result.readLevel.responses} read responses and only ${result.scenario.availableReplicas} replicas are reachable.`
                        : result.overlap
                          ? `R + W = ${result.readLevel.responses + result.writeLevel.responses}, which is greater than RF ${data.replicationFactor}. For this replica set, an acknowledged write and a successful read quorum share at least one replica. This is not a general linearizability claim for concurrent writes.`
                          : `R + W = ${result.readLevel.responses + result.writeLevel.responses}, which does not exceed RF ${data.replicationFactor}. The read may contact a replica that did not acknowledge the latest write.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ModelFact
                label="User-visible consequence"
                value={result.scenario.consequence}
              />
              <ModelFact
                label="Convergence obligation"
                value={result.scenario.repairNote}
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LevelPicker({
  label,
  levels,
  selectedId,
  onChange,
}: {
  label: string;
  levels: ConsistencyLevel[];
  selectedId: ConsistencyLevelId;
  onChange: (id: ConsistencyLevelId) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {levels.map((level) => (
          <button
            key={level.id}
            type="button"
            aria-pressed={level.id === selectedId}
            title={level.detail}
            onClick={() => onChange(level.id)}
            className={`min-h-11 rounded-md border px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:text-sm ${
              level.id === selectedId
                ? 'border-violet-600 bg-violet-50 text-violet-950 ring-1 ring-violet-600 dark:border-violet-400 dark:bg-violet-950/45 dark:text-violet-50 dark:ring-violet-400'
                : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {levels.find((level) => level.id === selectedId)?.detail}
      </p>
    </fieldset>
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
    <div className="min-w-0 border-l-2 border-neutral-300 pl-3 dark:border-neutral-700">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
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
    <LearningLabBody>
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Consistency model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
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
        <div
          className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
          />
          Loading consistency and failure model...
        </div>
      )}
    </LearningLabBody>
  );
}
