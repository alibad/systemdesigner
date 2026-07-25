'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Server,
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

type Bound = {
  min: number;
  max: number;
  step: number;
};

type CapacityProfile = {
  id: string;
  label: string;
  detail: string;
  buildsPerHour: number;
  executorMinutesPerBuild: number;
  agentExecutors: number;
  burstMultiplier: number;
};

type CapacityModel = {
  title: string;
  description: string;
  planningTargetPercent: number;
  burstDurationMinutes: number;
  bounds: {
    buildsPerHour: Bound;
    executorMinutesPerBuild: Bound;
    agentExecutors: Bound;
    burstMultiplier: Bound;
  };
  profiles: CapacityProfile[];
};

type PressureState = 'ready' | 'constrained' | 'overloaded';

const BLOCK_ID = 'technology/jenkins-capacity';
const DEFAULT_DATA_FILE = '/api/content/technology/jenkins/data/executor-pressure-model.json';
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min < candidate.max
    && candidate.step > 0;
}

function isCapacityProfile(value: unknown): value is CapacityProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityProfile>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && isFiniteNumber(candidate.buildsPerHour)
    && isFiniteNumber(candidate.executorMinutesPerBuild)
    && isFiniteNumber(candidate.agentExecutors)
    && isFiniteNumber(candidate.burstMultiplier);
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && isFiniteNumber(candidate.planningTargetPercent)
      && candidate.planningTargetPercent > 0
      && candidate.planningTargetPercent < 100
      && isFiniteNumber(candidate.burstDurationMinutes)
      && candidate.burstDurationMinutes > 0
      && candidate.bounds
      && isBound(candidate.bounds.buildsPerHour)
      && isBound(candidate.bounds.executorMinutesPerBuild)
      && isBound(candidate.bounds.agentExecutors)
      && isBound(candidate.bounds.burstMultiplier)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isCapacityProfile),
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function JenkinsCapacity({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [buildsPerHour, setBuildsPerHour] = useState(24);
  const [executorMinutesPerBuild, setExecutorMinutesPerBuild] = useState(12);
  const [agentExecutors, setAgentExecutors] = useState(8);
  const [burstMultiplier, setBurstMultiplier] = useState(2);

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
        if (!isCapacityModel(payload)) {
          throw new Error('The executor-pressure model is incomplete.');
        }

        const profile = payload.profiles[0];
        setData(payload);
        setProfileId(profile.id);
        setBuildsPerHour(profile.buildsPerHour);
        setExecutorMinutesPerBuild(profile.executorMinutesPerBuild);
        setAgentExecutors(profile.agentExecutors);
        setBurstMultiplier(profile.burstMultiplier);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the executor-pressure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    const targetRatio = (data?.planningTargetPercent ?? 70) / 100;
    const capacityExecutorMinutes = agentExecutors * 60;
    const demandExecutorMinutes = buildsPerHour * executorMinutesPerBuild;
    const utilization = demandExecutorMinutes / capacityExecutorMinutes;
    const capacityBuildsPerHour = capacityExecutorMinutes / executorMinutesPerBuild;
    const burstBuildsPerHour = buildsPerHour * burstMultiplier;
    const backlogAfterBurst = Math.max(
      0,
      (burstBuildsPerHour - capacityBuildsPerHour)
        * ((data?.burstDurationMinutes ?? 30) / 60),
    );
    const steadyDrainRate = capacityBuildsPerHour - buildsPerHour;
    const drainMinutes = backlogAfterBurst === 0
      ? 0
      : steadyDrainRate > 0
        ? (backlogAfterBurst / steadyDrainRate) * 60
        : null;
    const executorsAtTarget = Math.ceil(
      demandExecutorMinutes / (60 * targetRatio),
    );

    let state: PressureState = 'ready';
    if (utilization >= 1 || drainMinutes === null) {
      state = 'overloaded';
    } else if (utilization > targetRatio || backlogAfterBurst > 0) {
      state = 'constrained';
    }

    return {
      backlogAfterBurst,
      burstBuildsPerHour,
      capacityBuildsPerHour,
      capacityExecutorMinutes,
      demandExecutorMinutes,
      drainMinutes,
      executorsAtTarget,
      state,
      targetRatio,
      utilization,
    };
  }, [
    agentExecutors,
    buildsPerHour,
    burstMultiplier,
    data,
    executorMinutesPerBuild,
  ]);

  function applyProfile(profile: CapacityProfile) {
    setProfileId(profile.id);
    setBuildsPerHour(profile.buildsPerHour);
    setExecutorMinutesPerBuild(profile.executorMinutesPerBuild);
    setAgentExecutors(profile.agentExecutors);
    setBurstMultiplier(profile.burstMultiplier);
  }

  function reset() {
    if (data) applyProfile(data.profiles[0]);
  }

  if (!data) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Executor pressure lab"
            title="Can the agent pool absorb the work?"
            description="Loading workload profiles and model bounds."
            icon={Gauge}
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

  const stateStyle = result.state === 'ready'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.state === 'constrained'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
  const StateIcon = result.state === 'ready' ? CheckCircle2 : TriangleAlert;
  const stateTitle = result.state === 'ready'
    ? 'The pool absorbs both steady work and the modeled burst'
    : result.state === 'constrained'
      ? 'The steady rate fits, but the pool accumulates burst work'
      : 'The steady workload consumes all available capacity';
  const utilizationWidth = `${Math.min(result.utilization * 100, 100)}%`;
  const targetWidth = `${data.planningTargetPercent}%`;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Executor pressure lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={profile.id === 'release-burst' ? Boxes : Activity}
                      accent={profile.id === 'release-burst' ? 'amber' : 'blue'}
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Build arrivals"
                value={buildsPerHour}
                output={`${buildsPerHour}/h`}
                {...data.bounds.buildsPerHour}
                accent="blue"
                lowLabel="Fewer runs"
                highLabel="More runs"
                onChange={(value) => {
                  setProfileId('');
                  setBuildsPerHour(value);
                }}
              />
              <LabRange
                label="Executor-minutes per build"
                value={executorMinutesPerBuild}
                output={`${executorMinutesPerBuild} min`}
                {...data.bounds.executorMinutesPerBuild}
                accent="violet"
                lowLabel="Short work"
                highLabel="Long work"
                onChange={(value) => {
                  setProfileId('');
                  setExecutorMinutesPerBuild(value);
                }}
              />
              <LabRange
                label="Agent executors"
                value={agentExecutors}
                output={agentExecutors.toString()}
                {...data.bounds.agentExecutors}
                accent="emerald"
                lowLabel="Less concurrency"
                highLabel="More concurrency"
                onChange={(value) => {
                  setProfileId('');
                  setAgentExecutors(value);
                }}
              />
              <LabRange
                label="Arrival burst"
                value={burstMultiplier}
                output={`${numberFormatter.format(burstMultiplier)}x`}
                {...data.bounds.burstMultiplier}
                accent="amber"
                lowLabel="Steady"
                highLabel="Sharp burst"
                onChange={(value) => {
                  setProfileId('');
                  setBurstMultiplier(value);
                }}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Steady demand"
                value={`${numberFormatter.format(result.demandExecutorMinutes)} min/h`}
                detail={`${buildsPerHour}/h x ${executorMinutesPerBuild} executor-min`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Agent capacity"
                value={`${numberFormatter.format(result.capacityExecutorMinutes)} min/h`}
                detail={`${agentExecutors} executors x 60 minutes`}
                icon={Server}
                tone="emerald"
              />
              <LabMetric
                label="Utilization"
                value={percent(result.utilization)}
                detail={`${data.planningTargetPercent}% planning target`}
                icon={Gauge}
                tone={result.utilization <= result.targetRatio ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Burst backlog"
                value={`${Math.ceil(result.backlogAfterBurst)} builds`}
                detail={`After ${data.burstDurationMinutes} minutes at ${numberFormatter.format(result.burstBuildsPerHour)}/h`}
                icon={Clock3}
                tone={result.backlogAfterBurst === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Steady capacity balance
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    The target is a teaching assumption, not a Jenkins product limit.
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {percent(result.utilization)}
                </span>
              </div>
              <div
                className="relative mt-4 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                role="meter"
                aria-label="Steady executor utilization"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(Math.round(result.utilization * 100), 100)}
              >
                <div
                  className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                    result.utilization <= result.targetRatio
                      ? 'bg-cyan-600 dark:bg-cyan-400'
                      : result.utilization < 1
                        ? 'bg-amber-500 dark:bg-amber-300'
                        : 'bg-rose-600 dark:bg-rose-400'
                  }`}
                  style={{ width: utilizationWidth }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                  style={{ left: targetWidth }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>0%</span>
                <span>{data.planningTargetPercent}% target</span>
                <span>100%</span>
              </div>
            </section>

            <div className={`rounded-md border p-5 ${stateStyle}`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="text-base font-semibold">{stateTitle}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.state === 'ready'
                      ? `At these averages, ${agentExecutors} executors leave enough modeled headroom for the selected burst. Validate the estimate with queue time and agent resource telemetry.`
                      : result.state === 'constrained'
                        ? `The burst leaves about ${Math.ceil(result.backlogAfterBurst)} builds waiting. At the steady arrival rate, the pool needs about ${Math.ceil(result.drainMinutes ?? 0)} minutes to drain them.`
                        : `Demand is at least the pool's steady capacity. The backlog cannot drain until build work falls or agent capacity rises.`}
                  </p>
                </div>
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              <ModelFact
                label="Build throughput"
                value={`${numberFormatter.format(result.capacityBuildsPerHour)}/h`}
                detail="Capacity if each build consumes the selected average executor time."
              />
              <ModelFact
                label="Executors at target"
                value={result.executorsAtTarget.toString()}
                detail={`Minimum whole executors for the ${data.planningTargetPercent}% planning target.`}
              />
              <ModelFact
                label="Drain time"
                value={result.drainMinutes === null ? 'No drain' : `${Math.ceil(result.drainMinutes)} min`}
                detail="Time to clear the modeled burst after arrivals return to steady."
              />
            </dl>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ModelFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border-l-2 border-neutral-300 pl-3 dark:border-neutral-700">
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </dd>
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
              <p className="text-sm font-semibold">Executor model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <TimerReset aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-36 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
          />
          Loading executor-pressure model...
        </div>
      )}
    </LearningLabBody>
  );
}
