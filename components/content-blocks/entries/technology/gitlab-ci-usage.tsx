'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  GitBranch,
  Hourglass,
  Network,
  ServerCog,
  TimerReset,
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

type ScheduleMode = 'stages' | 'needs';
type Job = {
  id: string;
  label: string;
  stage: string;
  durationMinutes: number;
  needs: string[];
  detail: string;
};
type Profile = {
  id: string;
  label: string;
  detail: string;
  stages: string[];
  jobs: Job[];
};
type ScheduleModel = {
  title: string;
  description: string;
  defaults: { profileId: string; mode: ScheduleMode; runnerSlots: number };
  runnerBounds: { min: number; max: number; step: number };
  profiles: Profile[];
};
type ScheduledJob = Job & { start: number; end: number; queueDelay: number };

const BLOCK_ID = 'technology/gitlab-ci-usage';
const DEFAULT_DATA_FILE =
  '/api/content/technology/gitlab-ci/data/pipeline-scheduling-model.json';

function isScheduleModel(value: unknown): value is ScheduleModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ScheduleModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaults?.profileId
      && (model.defaults.mode === 'stages' || model.defaults.mode === 'needs')
      && typeof model.defaults.runnerSlots === 'number'
      && typeof model.runnerBounds?.min === 'number'
      && typeof model.runnerBounds.max === 'number'
      && typeof model.runnerBounds.step === 'number'
      && Array.isArray(model.profiles)
      && model.profiles.length >= 2
      && model.profiles.every((profile) => (
        typeof profile.id === 'string'
        && Array.isArray(profile.stages)
        && Array.isArray(profile.jobs)
        && profile.jobs.length >= 3
        && profile.jobs.every((job) => (
          typeof job.id === 'string'
          && typeof job.label === 'string'
          && typeof job.stage === 'string'
          && typeof job.durationMinutes === 'number'
          && job.durationMinutes > 0
          && Array.isArray(job.needs)
        ))
      )),
  );
}

function schedule(profile: Profile, mode: ScheduleMode, runnerSlots: number) {
  const pending = new Map(profile.jobs.map((job) => [job.id, job]));
  const completed = new Map<string, number>();
  const running: ScheduledJob[] = [];
  const scheduled: ScheduledJob[] = [];
  let time = 0;
  let guard = 0;

  const predecessors = (job: Job) => mode === 'needs'
    ? job.needs
    : profile.jobs
      .filter((candidate) => profile.stages.indexOf(candidate.stage) < profile.stages.indexOf(job.stage))
      .map((candidate) => candidate.id);

  while ((pending.size > 0 || running.length > 0) && guard < 500) {
    guard += 1;
    const ready = [...pending.values()].filter((job) =>
      predecessors(job).every((dependency) => completed.has(dependency)),
    );

    while (running.length < runnerSlots && ready.length > 0) {
      const job = ready.shift();
      if (!job || !pending.has(job.id)) continue;
      const dependencyReadyAt = Math.max(
        0,
        ...predecessors(job).map((dependency) => completed.get(dependency) ?? 0),
      );
      const item = {
        ...job,
        start: time,
        end: time + job.durationMinutes,
        queueDelay: Math.max(0, time - dependencyReadyAt),
      };
      pending.delete(job.id);
      running.push(item);
      scheduled.push(item);
    }

    if (running.length === 0) break;
    time = Math.min(...running.map((job) => job.end));
    running
      .filter((job) => job.end === time)
      .forEach((job) => completed.set(job.id, job.end));
    for (let index = running.length - 1; index >= 0; index -= 1) {
      if (running[index].end === time) running.splice(index, 1);
    }
  }

  const duration = Math.max(0, ...scheduled.map((job) => job.end));
  const workMinutes = profile.jobs.reduce((total, job) => total + job.durationMinutes, 0);
  const firstStage = profile.stages[0];
  const feedbackJobs = scheduled.filter((job) => job.stage !== firstStage);
  return {
    jobs: scheduled,
    duration,
    workMinutes,
    utilization: duration > 0 ? (workMinutes / (duration * runnerSlots)) * 100 : 0,
    firstFeedback: feedbackJobs.length > 0 ? Math.min(...feedbackJobs.map((job) => job.end)) : duration,
    queueMinutes: scheduled.reduce((total, job) => total + job.queueDelay, 0),
    valid: scheduled.length === profile.jobs.length,
  };
}

export default function GitlabCiUsage({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [model, setModel] = useState<ScheduleModel | null>(null);
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
        if (!isScheduleModel(payload)) throw new Error('The scheduling model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load scheduling data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Pipeline scheduling lab"
            title="Resolve the dependency graph"
            description="Loading fixed jobs, durations, stages, and needs edges."
            icon={GitBranch}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : <ScheduleLab model={model} />}
    </div>
  );
}

function ScheduleLab({ model }: { model: ScheduleModel }) {
  const [profileId, setProfileId] = useState(model.defaults.profileId);
  const [mode, setMode] = useState<ScheduleMode>(model.defaults.mode);
  const [runnerSlots, setRunnerSlots] = useState<number>(model.defaults.runnerSlots);
  const profile = model.profiles.find((item) => item.id === profileId) ?? model.profiles[0];

  const result = useMemo(
    () => schedule(profile, mode, runnerSlots),
    [mode, profile, runnerSlots],
  );
  const comparison = useMemo(
    () => schedule(profile, mode === 'stages' ? 'needs' : 'stages', runnerSlots),
    [mode, profile, runnerSlots],
  );
  const recovered = mode === 'needs'
    ? Math.max(0, comparison.duration - result.duration)
    : Math.max(0, result.duration - comparison.duration);

  function reset() {
    setProfileId(model.defaults.profileId);
    setMode(model.defaults.mode);
    setRunnerSlots(model.defaults.runnerSlots);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Pipeline scheduling lab"
        title={model.title}
        description={model.description}
        icon={GitBranch}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody controls={(
        <div className="space-y-7">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Workload graph
            </legend>
            <div className="mt-3 space-y-2">
              {model.profiles.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === profile.id}
                  label={item.label}
                  detail={item.detail}
                  icon={Network}
                  accent="blue"
                  onClick={() => setProfileId(item.id)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              2. Ordering model
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <LabChoice selected={mode === 'stages'} label="Stage barriers" detail="Every later stage waits for all jobs in earlier stages." icon={Hourglass} accent="amber" onClick={() => setMode('stages')} />
              <LabChoice selected={mode === 'needs'} label="Needs graph" detail="Each job waits only for the dependencies it names." icon={GitBranch} accent="violet" onClick={() => setMode('needs')} />
            </div>
          </fieldset>
          <LabRange
            label="Concurrent runner slots"
            value={runnerSlots}
            output={`${runnerSlots}`}
            min={model.runnerBounds.min}
            max={model.runnerBounds.max}
            step={model.runnerBounds.step}
            lowLabel="queue pressure"
            highLabel="more capacity"
            accent="cyan"
            onChange={setRunnerSlots}
          />
        </div>
      )}>
        <div className="space-y-5" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Pipeline duration" value={`${result.duration} min`} detail="End time of the final modeled job." icon={Clock3} tone="blue" />
            <LabMetric label="First feedback" value={`${result.firstFeedback} min`} detail="First non-initial-stage job to finish." icon={Activity} tone="cyan" />
            <LabMetric label="Runner utilization" value={`${Math.round(result.utilization)}%`} detail={`${result.workMinutes} job-minutes across ${runnerSlots} slots.`} icon={ServerCog} tone="violet" />
            <LabMetric label="Ready-job queueing" value={`${result.queueMinutes} min`} detail="Summed wait after modeled dependencies completed." icon={TimerReset} tone={result.queueMinutes > 0 ? 'amber' : 'emerald'} />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Modeled schedule</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {mode === 'needs'
                    ? `Explicit dependencies recover ${recovered} minute${recovered === 1 ? '' : 's'} versus stage barriers at the same capacity.`
                    : `${recovered} minute${recovered === 1 ? '' : 's'} are available by replacing broad barriers with the modeled needs graph.`}
                </p>
              </div>
              <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                {mode === 'needs' ? 'Dependency DAG' : 'Stage ordered'}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto pb-2">
              <div className="min-w-[640px] space-y-2">
                {result.jobs.map((job) => (
                  <div key={job.id} className="grid grid-cols-[132px_minmax(0,1fr)_72px] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-neutral-900 dark:text-white">{job.label}</p>
                      <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{job.stage}</p>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="absolute inset-y-1 rounded bg-blue-500 px-2 text-[11px] font-semibold leading-6 text-white shadow-sm dark:bg-blue-400 dark:text-blue-950"
                        style={{
                          left: `${(job.start / Math.max(result.duration, 1)) * 100}%`,
                          width: `${Math.max((job.durationMinutes / Math.max(result.duration, 1)) * 100, 5)}%`,
                        }}
                        title={`${job.label}: minute ${job.start} to ${job.end}`}
                      >
                        {job.durationMinutes}m
                      </div>
                    </div>
                    <p className="text-right text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{job.start}-{job.end}m</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">The schedule preserves every declared dependency.</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  Durations are deterministic inputs, not GitLab guarantees. Measure runner startup, cache and artifact transfer, retries, and queue time in the real fleet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Scheduling model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">Loading scheduling model...</div>
      )}
    </div>
  );
}
