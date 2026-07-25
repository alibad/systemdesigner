'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseBackup,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Profile = {
  id: string;
  label: string;
  detail: string;
  checkpointIntervalSeconds: number;
  checkpointDurationSeconds: number;
  failureAtSeconds: number;
};
type SinkMode = {
  id: 'transactional' | 'idempotent' | 'unsafe';
  label: string;
  detail: string;
  consequence: string;
};
type CheckpointModel = {
  title: string;
  description: string;
  bounds: {
    checkpointIntervalSeconds: Bound;
    checkpointDurationSeconds: Bound;
    failureAtSeconds: Bound;
  };
  profiles: Profile[];
  sinkModes: SinkMode[];
};
type Checkpoint = {
  number: number;
  startsAt: number;
  completesAt: number;
  status: 'completed' | 'in-flight' | 'not-started';
};

const BLOCK_ID = 'technology/apache-flink-checkpoint-recovery';
const DEFAULT_DATA_FILE = '/api/content/technology/apache-flink/data/checkpoint-recovery-scenarios.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isCheckpointModel(value: unknown): value is CheckpointModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CheckpointModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.bounds
      && isBound(candidate.bounds.checkpointIntervalSeconds)
      && isBound(candidate.bounds.checkpointDurationSeconds)
      && isBound(candidate.bounds.failureAtSeconds)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && isFiniteNumber(profile.checkpointIntervalSeconds)
        && isFiniteNumber(profile.checkpointDurationSeconds)
        && isFiniteNumber(profile.failureAtSeconds)
      ))
      && Array.isArray(candidate.sinkModes)
      && candidate.sinkModes.length === 3
      && candidate.sinkModes.every((mode) => (
        ['transactional', 'idempotent', 'unsafe'].includes(mode.id)
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
        && typeof mode.consequence === 'string'
      )),
  );
}

function buildCheckpointTrace(
  interval: number,
  duration: number,
  failureAt: number,
): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];

  for (let startsAt = interval, number = 1; startsAt <= failureAt + interval; startsAt += interval, number += 1) {
    const completesAt = startsAt + duration;
    checkpoints.push({
      number,
      startsAt,
      completesAt,
      status: startsAt > failureAt
        ? 'not-started'
        : completesAt <= failureAt
          ? 'completed'
          : 'in-flight',
    });
  }

  return checkpoints;
}

const checkpointStyles: Record<Checkpoint['status'], string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  'in-flight': 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  'not-started': 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400',
};

export default function ApacheFlinkCheckpointRecovery({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CheckpointModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [sinkModeId, setSinkModeId] = useState<SinkMode['id']>('transactional');
  const [checkpointIntervalSeconds, setCheckpointIntervalSeconds] = useState(30);
  const [checkpointDurationSeconds, setCheckpointDurationSeconds] = useState(8);
  const [failureAtSeconds, setFailureAtSeconds] = useState(105);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setCheckpointIntervalSeconds(profile.checkpointIntervalSeconds);
    setCheckpointDurationSeconds(profile.checkpointDurationSeconds);
    setFailureAtSeconds(profile.failureAtSeconds);
  }

  function resetModel(model: CheckpointModel) {
    const profile = model.profiles[0];
    setProfileId(profile.id);
    setCheckpointIntervalSeconds(profile.checkpointIntervalSeconds);
    setCheckpointDurationSeconds(profile.checkpointDurationSeconds);
    setFailureAtSeconds(profile.failureAtSeconds);
    setSinkModeId('transactional');
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCheckpointModel(payload)) throw new Error('The checkpoint model is incomplete.');
        setData(payload);
        resetModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the checkpoint model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const trace = useMemo(
    () => buildCheckpointTrace(checkpointIntervalSeconds, checkpointDurationSeconds, failureAtSeconds),
    [checkpointDurationSeconds, checkpointIntervalSeconds, failureAtSeconds],
  );
  const latestCompleted = [...trace].reverse().find((checkpoint) => checkpoint.status === 'completed');
  const inFlight = trace.find((checkpoint) => checkpoint.status === 'in-flight');
  const restorePoint = latestCompleted?.startsAt ?? 0;
  const replaySpan = failureAtSeconds - restorePoint;
  const sinkMode = data?.sinkModes.find((mode) => mode.id === sinkModeId) ?? data?.sinkModes[0];
  const duplicateRisk = sinkModeId === 'unsafe';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Checkpoint recovery lab"
          title={data?.title ?? 'What happens when the job fails?'}
          description={data?.description ?? 'Loading the checkpoint scenarios.'}
          icon={DatabaseBackup}
          accent="violet"
          onReset={data ? () => resetModel(data) : undefined}
        />

        {!data || !sinkMode ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Checkpoint profile
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={profile.id === 'slow-snapshot' ? Clock3 : profile.id === 'failure-during-snapshot' ? TriangleAlert : CheckCircle2}
                        accent={profile.id === 'slow-snapshot' ? 'amber' : profile.id === 'failure-during-snapshot' ? 'rose' : 'emerald'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Checkpoint interval"
                  value={checkpointIntervalSeconds}
                  output={`${checkpointIntervalSeconds}s`}
                  {...data.bounds.checkpointIntervalSeconds}
                  accent="blue"
                  lowLabel="More frequent"
                  highLabel="Less frequent"
                  onChange={(value) => { setProfileId(''); setCheckpointIntervalSeconds(value); }}
                />
                <LabRange
                  label="Snapshot duration"
                  value={checkpointDurationSeconds}
                  output={`${checkpointDurationSeconds}s`}
                  {...data.bounds.checkpointDurationSeconds}
                  accent="amber"
                  lowLabel="Completes sooner"
                  highLabel="Longer in flight"
                  onChange={(value) => { setProfileId(''); setCheckpointDurationSeconds(value); }}
                />
                <LabRange
                  label="Failure time"
                  value={failureAtSeconds}
                  output={`t=${failureAtSeconds}s`}
                  {...data.bounds.failureAtSeconds}
                  accent="rose"
                  lowLabel="Earlier failure"
                  highLabel="Later failure"
                  onChange={(value) => { setProfileId(''); setFailureAtSeconds(value); }}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    External sink behavior
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.sinkModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === sinkModeId}
                        label={mode.label}
                        detail={mode.detail}
                        icon={mode.id === 'transactional' ? ShieldCheck : mode.id === 'idempotent' ? ArchiveRestore : TriangleAlert}
                        accent={mode.id === 'transactional' ? 'emerald' : mode.id === 'idempotent' ? 'blue' : 'rose'}
                        onClick={() => setSinkModeId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Restore point"
                  value={`t=${restorePoint}s`}
                  detail={latestCompleted ? `Checkpoint ${latestCompleted.number} completed before failure` : 'Durable baseline at job start'}
                  icon={DatabaseBackup}
                  tone="emerald"
                />
                <LabMetric
                  label="Replay span"
                  value={`${replaySpan}s`}
                  detail="Input positions after the restore point are processed again"
                  icon={ArchiveRestore}
                  tone="blue"
                />
                <LabMetric
                  label="At failure"
                  value={inFlight ? `CP ${inFlight.number} in flight` : 'Between snapshots'}
                  detail={inFlight ? `Due at t=${inFlight.completesAt}s; incomplete snapshots are not restore points` : 'No snapshot was active at the failure instant'}
                  icon={Clock3}
                  tone={inFlight ? 'amber' : 'neutral'}
                />
                <LabMetric
                  label="External duplicate risk"
                  value={duplicateRisk ? 'Exposed' : 'Controlled'}
                  detail={duplicateRisk ? 'The sink has no replay-safe boundary' : 'The selected sink mode handles repeated processing'}
                  icon={duplicateRisk ? TriangleAlert : ShieldCheck}
                  tone={duplicateRisk ? 'rose' : 'emerald'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Checkpoint timeline</p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                      Only completed snapshots can anchor recovery
                    </h4>
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Baseline checkpoint at t=0</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50">
                    <p className="text-xs font-semibold uppercase opacity-70">Baseline</p>
                    <p className="mt-1 font-semibold">Completed at t=0s</p>
                    <p className="mt-2 text-xs leading-5 opacity-75">The deterministic model starts from one durable source and state position.</p>
                  </div>
                  {trace.slice(0, 8).map((checkpoint) => (
                    <div key={checkpoint.number} className={`rounded-md border p-4 ${checkpointStyles[checkpoint.status]}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase opacity-70">Checkpoint {checkpoint.number}</p>
                        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold uppercase">
                          {checkpoint.status === 'not-started' ? 'After failure' : checkpoint.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold tabular-nums">
                        t={checkpoint.startsAt}s to t={checkpoint.completesAt}s
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`rounded-md border p-5 ${duplicateRisk ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  {duplicateRisk
                    ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">Sink consequence</p>
                    <h4 className="mt-1 text-lg font-semibold">{sinkMode.label}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">{sinkMode.consequence}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
                <p className="font-semibold">What this model does and does not claim</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  The replay span is exact for this simplified timeline: failure time minus the barrier time of the latest completed checkpoint. It is not a wall-clock recovery estimate. Restore throughput, state backend, storage, scheduling, and backlog determine how long recovery actually takes.
                </p>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6" role={error ? 'alert' : 'status'}>
      <div className="max-w-md text-center">
        {error
          ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-violet-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
          {error ? 'Checkpoint model unavailable' : 'Loading checkpoint model'}
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing the recovery timeline.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
