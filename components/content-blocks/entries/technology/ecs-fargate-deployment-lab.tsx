'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  HeartPulse,
  LoaderCircle,
  RotateCcw,
  ServerCrash,
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

type FailureStage = {
  id: string;
  label: string;
  detail: string;
  signal: string;
};

type DeploymentModel = {
  title: string;
  description: string;
  defaults: {
    desiredCount: number;
    observedFailures: number;
    failureStageId: string;
    circuitBreakerEnabled: boolean;
    rollbackEnabled: boolean;
  };
  threshold: {
    multiplier: number;
    minimum: number;
    maximum: number;
  };
  failureStages: FailureStage[];
  healthSources: string[];
};

const BLOCK_ID = 'technology/ecs-fargate-deployment-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/ecs-fargate/data/deployment-failure-model.json';

function validModel(value: unknown): value is DeploymentModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeploymentModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.threshold
      && Number.isFinite(candidate.threshold.multiplier)
      && Number.isFinite(candidate.threshold.minimum)
      && Number.isFinite(candidate.threshold.maximum)
      && Array.isArray(candidate.failureStages)
      && candidate.failureStages.length >= 2
      && Array.isArray(candidate.healthSources)
      && candidate.healthSources.length >= 2,
  );
}

export default function ECSFargateDeploymentLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<DeploymentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validModel(payload)) throw new Error('The deployment failure model is incomplete.');
        setModel(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setModel(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the deployment model.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Deployment failure lab"
            title="Trace how ECS decides a rolling deployment has failed"
            description="Loading the circuit-breaker model."
            icon={Activity}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <DeploymentLab model={model} />
      )}
    </div>
  );
}

function DeploymentLab({ model }: { model: DeploymentModel }) {
  const [desiredCount, setDesiredCount] = useState(model.defaults.desiredCount);
  const [observedFailures, setObservedFailures] = useState(model.defaults.observedFailures);
  const [failureStageId, setFailureStageId] = useState(model.defaults.failureStageId);
  const [circuitBreakerEnabled, setCircuitBreakerEnabled] = useState(model.defaults.circuitBreakerEnabled);
  const [rollbackEnabled, setRollbackEnabled] = useState(model.defaults.rollbackEnabled);

  const result = useMemo(() => {
    const failureStage = model.failureStages.find((stage) => stage.id === failureStageId)
      ?? model.failureStages[0];
    const rawThreshold = Math.ceil(desiredCount * model.threshold.multiplier);
    const threshold = Math.min(
      model.threshold.maximum,
      Math.max(model.threshold.minimum, rawThreshold),
    );
    const breakerTripped = circuitBreakerEnabled && observedFailures >= threshold;
    const remaining = Math.max(0, threshold - observedFailures);
    const state = !circuitBreakerEnabled
      ? 'Evaluation continues without circuit-breaker failure detection'
      : breakerTripped && rollbackEnabled
        ? 'Deployment failed; ECS requests rollback to the last completed deployment'
        : breakerTripped
          ? 'Deployment failed; operator recovery is required'
          : observedFailures === 0
            ? 'Deployment is in progress with no modeled failures'
            : `Deployment remains in progress; ${remaining} more modeled failure${remaining === 1 ? '' : 's'} reaches the threshold`;

    return { failureStage, threshold, breakerTripped, remaining, state };
  }, [circuitBreakerEnabled, desiredCount, failureStageId, model, observedFailures, rollbackEnabled]);

  function reset() {
    setDesiredCount(model.defaults.desiredCount);
    setObservedFailures(model.defaults.observedFailures);
    setFailureStageId(model.defaults.failureStageId);
    setCircuitBreakerEnabled(model.defaults.circuitBreakerEnabled);
    setRollbackEnabled(model.defaults.rollbackEnabled);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Deployment failure lab"
        title={model.title}
        description={model.description}
        icon={Activity}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Failure observed
              </legend>
              <div className="mt-3 grid gap-2">
                {model.failureStages.map((stage) => (
                  <LabChoice
                    key={stage.id}
                    selected={stage.id === result.failureStage.id}
                    label={stage.label}
                    detail={stage.detail}
                    icon={stage.id === 'launch' ? ServerCrash : HeartPulse}
                    accent="rose"
                    onClick={() => setFailureStageId(stage.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Service desired count"
              value={desiredCount}
              output={`${desiredCount} tasks`}
              min={1}
              max={400}
              accent="blue"
              lowLabel="Small service"
              highLabel="400 tasks"
              onChange={setDesiredCount}
            />
            <LabRange
              label="Failures counted"
              value={observedFailures}
              output={`${observedFailures}`}
              min={0}
              max={200}
              accent="rose"
              lowLabel="No failures"
              highLabel="200 failures"
              onChange={setObservedFailures}
            />

            <LabChoice
              selected={circuitBreakerEnabled}
              label={circuitBreakerEnabled ? 'Circuit breaker enabled' : 'Circuit breaker disabled'}
              detail="When enabled, ECS can mark a rolling deployment failed after the computed threshold."
              icon={ShieldCheck}
              accent="amber"
              onClick={() => setCircuitBreakerEnabled((value) => !value)}
            />
            <LabChoice
              selected={rollbackEnabled}
              label={rollbackEnabled ? 'Automatic rollback enabled' : 'Automatic rollback disabled'}
              detail="Rollback requires the circuit breaker and a previously completed deployment to return to."
              icon={RotateCcw}
              accent="violet"
              onClick={() => setRollbackEnabled((value) => !value)}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${result.breakerTripped ? dangerClass : circuitBreakerEnabled ? healthyClass : warningClass}`}>
            <div className="flex items-start gap-3">
              {result.breakerTripped ? (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : circuitBreakerEnabled ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Modeled rollout state</p>
                <h4 className="mt-1 text-lg font-semibold">{result.state}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.failureStage.signal}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Failure threshold"
              value={circuitBreakerEnabled ? `${result.threshold}` : 'Not enforced'}
              detail={`ceil(0.5 x ${desiredCount}), clamped from ${model.threshold.minimum} to ${model.threshold.maximum}`}
              icon={ShieldCheck}
              tone={circuitBreakerEnabled ? 'amber' : 'neutral'}
            />
            <LabMetric
              label="Failures counted"
              value={`${observedFailures}`}
              detail={result.failureStage.label}
              icon={ServerCrash}
              tone={result.breakerTripped ? 'rose' : 'blue'}
            />
            <LabMetric
              label="Rollout state"
              value={result.breakerTripped ? 'FAILED' : 'IN_PROGRESS'}
              detail="The lab models circuit-breaker state, not application correctness"
              icon={Activity}
              tone={result.breakerTripped ? 'rose' : 'cyan'}
            />
            <LabMetric
              label="Recovery path"
              value={result.breakerTripped && rollbackEnabled ? 'Rollback' : 'No auto rollback'}
              detail={rollbackEnabled ? 'Requires a last completed deployment' : 'Operator action required after failure'}
              icon={RotateCcw}
              tone={result.breakerTripped && rollbackEnabled ? 'violet' : 'neutral'}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Two-stage failure trace
              </p>
            </header>
            <ol className="grid md:grid-cols-2">
              <TraceStep
                number="1"
                title="Reach RUNNING"
                detail="ECS counts tasks in the deployment that cannot reach RUNNING. One running task advances evaluation to health checks."
                active={result.failureStage.id === 'launch'}
                failed={result.breakerTripped && result.failureStage.id === 'launch'}
              />
              <TraceStep
                number="2"
                title="Pass health checks"
                detail={`ECS evaluates ${model.healthSources.join(', ')} and container health checks for running tasks.`}
                active={result.failureStage.id === 'health'}
                failed={result.breakerTripped && result.failureStage.id === 'health'}
              />
            </ol>
          </section>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Operational interpretation
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-rose-500 dark:text-neutral-300">
              <li>A health-check grace period can stop slow-starting tasks from being replaced before they are ready; it does not make a failing task healthy.</li>
              <li>Alert on the ECS deployment state-change event so a failed or rolled-back release is visible to operators.</li>
              <li>Keep the previous task definition deployable and verify schema, queue, and side-effect compatibility before relying on rollback.</li>
            </ul>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function TraceStep({
  number,
  title,
  detail,
  active,
  failed,
}: {
  number: string;
  title: string;
  detail: string;
  active: boolean;
  failed: boolean;
}) {
  return (
    <li className={`relative min-w-0 p-5 md:first:border-r md:first:border-neutral-200 md:dark:first:border-neutral-800 ${active ? 'bg-rose-50 dark:bg-rose-950/25' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${active ? 'border-rose-400 bg-white text-rose-700 dark:bg-neutral-950 dark:text-rose-300' : 'border-neutral-300 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'}`}>
          {number}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            {active ? failed ? 'Threshold reached here' : 'Failures counted here' : 'Other evaluation stage'}
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
        </div>
      </div>
    </li>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className={`min-h-48 rounded-md border p-5 ${error ? dangerClass : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}>
        <div className="flex items-start gap-3">
          {error ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" />
          )}
          <div>
            <p className="font-semibold">{error ? 'Deployment model unavailable' : 'Loading deployment model'}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{error ?? 'Preparing the circuit-breaker trace.'}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </LearningLabBody>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100';
