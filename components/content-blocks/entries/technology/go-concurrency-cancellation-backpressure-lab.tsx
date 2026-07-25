'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CircleStop,
  Clock3,
  LoaderCircle,
  PlayCircle,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  UsersRound,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/go-concurrency-cancellation-backpressure-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/go-concurrency/data/cancellation-backpressure-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  arrivalRatePerSecond: number;
  serviceTimeMs: number;
  deadlineMs: number;
  durationSeconds: number;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  propagatesCancellation: boolean;
  cancelAwareSend: boolean;
  coordinatedShutdown: boolean;
};

type LifecycleModel = {
  kind: 'go-concurrency-cancellation-backpressure';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    strategyId: string;
    workerCount: number;
    bufferSize: number;
  };
  bounds: {
    workerCount: Bound;
    bufferSize: Bound;
  };
  incidents: Incident[];
  strategies: Strategy[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  return isRecord(value)
    && isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isIncident(value: unknown): value is Incident {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.arrivalRatePerSecond)
    && value.arrivalRatePerSecond > 0
    && isFiniteNumber(value.serviceTimeMs)
    && value.serviceTimeMs > 0
    && isFiniteNumber(value.deadlineMs)
    && value.deadlineMs > 0
    && isFiniteNumber(value.durationSeconds)
    && value.durationSeconds > 0;
}

function isStrategy(value: unknown): value is Strategy {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.propagatesCancellation === 'boolean'
    && typeof value.cancelAwareSend === 'boolean'
    && typeof value.coordinatedShutdown === 'boolean';
}

function isLifecycleModel(value: unknown): value is LifecycleModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.bounds)) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'go-concurrency-cancellation-backpressure'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof defaults.incidentId === 'string'
    && typeof defaults.strategyId === 'string'
    && isFiniteNumber(defaults.workerCount)
    && isFiniteNumber(defaults.bufferSize)
    && isBound(bounds.workerCount)
    && isBound(bounds.bufferSize)
    && Array.isArray(value.incidents)
    && value.incidents.length === 3
    && value.incidents.every(isIncident)
    && value.incidents.some((incident) => incident.id === defaults.incidentId)
    && Array.isArray(value.strategies)
    && value.strategies.length === 3
    && value.strategies.every(isStrategy)
    && value.strategies.some((strategy) => strategy.id === defaults.strategyId)
    && typeof value.notice === 'string';
}

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export default function GoConcurrencyCancellationBackpressureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<LifecycleModel | null>(null);
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
        if (!isLifecycleModel(payload)) {
          throw new Error('The cancellation and backpressure model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the cancellation and backpressure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <LifecycleWorkbench model={model} />;
}

function LifecycleWorkbench({ model }: { model: LifecycleModel }) {
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [workerCount, setWorkerCount] = useState(model.defaults.workerCount);
  const [bufferSize, setBufferSize] = useState(model.defaults.bufferSize);

  const incident =
    model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];
  const strategy =
    model.strategies.find((item) => item.id === strategyId) ?? model.strategies[0];

  const result = useMemo(() => {
    const totalArrivals =
      incident.arrivalRatePerSecond * incident.durationSeconds;
    const serviceCapacityPerSecond =
      workerCount * 1000 / incident.serviceTimeMs;
    const completedDuringIncident = Math.min(
      totalArrivals,
      serviceCapacityPerSecond * incident.durationSeconds,
    );
    const queueDemand = Math.max(0, totalArrivals - completedDuringIncident);
    const queuedAtPeak = Math.min(bufferSize, Math.ceil(queueDemand));
    const overflow = Math.max(0, Math.ceil(queueDemand - bufferSize));
    const queueWaitMs =
      queuedAtPeak === 0 ? 0 : queuedAtPeak / workerCount * incident.serviceTimeMs;
    const deadlineBreach =
      incident.serviceTimeMs + queueWaitMs > incident.deadlineMs;
    const blockedProducers = strategy.cancelAwareSend ? 0 : overflow;
    const rejectedAtAdmission = strategy.cancelAwareSend ? overflow : 0;
    const continuingAfterCancel = strategy.propagatesCancellation
      ? 0
      : Math.min(
        Math.ceil(totalArrivals),
        workerCount + queuedAtPeak,
      );
    const staleQueuedJobs = strategy.coordinatedShutdown ? 0 : queuedAtPeak;
    const contained = strategy.propagatesCancellation
      && strategy.cancelAwareSend
      && strategy.coordinatedShutdown
      && blockedProducers === 0;

    return {
      blockedProducers,
      completedDuringIncident,
      contained,
      continuingAfterCancel,
      deadlineBreach,
      overflow,
      queueWaitMs,
      queuedAtPeak,
      rejectedAtAdmission,
      serviceCapacityPerSecond,
      staleQueuedJobs,
      totalArrivals,
    };
  }, [bufferSize, incident, strategy, workerCount]);

  const severity = result.contained && !result.deadlineBreach
    ? 'healthy'
    : result.contained
      ? 'degraded'
      : 'unsafe';
  const stateTitle = severity === 'healthy'
    ? 'The workload remains bounded and useful work keeps its owner'
    : severity === 'degraded'
      ? 'The incident breaches the deadline, but cancellation contains the damage'
      : result.blockedProducers > 0
        ? 'Producers can outlive the request while blocked on the queue'
        : 'Work continues after its caller no longer needs the result';
  const stateDetail = severity === 'healthy'
    ? 'Admission, queue sends, workers, and downstream calls all have a finite exit path.'
    : severity === 'degraded'
      ? result.rejectedAtAdmission > 0
        ? `${integerFormatter.format(result.rejectedAtAdmission)} jobs are rejected rather than hidden in an unbounded wait. Return overload explicitly and recover capacity.`
        : 'The selected deadline is shorter than the modeled queue and service path. Active calls receive cancellation instead of continuing as detached work.'
      : `${integerFormatter.format(result.continuingAfterCancel)} jobs can keep running and ${integerFormatter.format(result.blockedProducers)} producers can remain blocked in this deterministic incident.`;

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setStrategyId(model.defaults.strategyId);
    setWorkerCount(model.defaults.workerCount);
    setBufferSize(model.defaults.bufferSize);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Lifecycle and backpressure lab"
          title={model.title}
          description={model.description}
          icon={Workflow}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject an incident
                </legend>
                <div className="mt-3 space-y-2">
                  {model.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'burst' ? PlayCircle : TimerOff}
                      accent={item.id === 'burst' ? 'amber' : 'rose'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the ownership contract
                </legend>
                <div className="mt-3 space-y-2">
                  {model.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'end-to-end' ? ShieldCheck : CircleStop}
                      accent={item.id === 'end-to-end' ? 'emerald' : 'violet'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Workers"
                value={workerCount}
                output={`${workerCount}`}
                min={model.bounds.workerCount.min}
                max={model.bounds.workerCount.max}
                step={model.bounds.workerCount.step}
                accent="cyan"
                lowLabel="Constrained"
                highLabel="More active work"
                onChange={setWorkerCount}
              />

              <LabRange
                label="Queue buffer"
                value={bufferSize}
                output={`${bufferSize} jobs`}
                min={model.bounds.bufferSize.min}
                max={model.bounds.bufferSize.max}
                step={model.bounds.bufferSize.step}
                accent="amber"
                lowLabel="Backpressure now"
                highLabel="Delay backpressure"
                onChange={setBufferSize}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                severity === 'healthy'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : severity === 'degraded'
                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {severity === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Incident outcome
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{stateTitle}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{stateDetail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Service capacity"
                value={`${integerFormatter.format(result.serviceCapacityPerSecond)}/s`}
                detail={`${workerCount} workers at ${incident.serviceTimeMs}ms each`}
                icon={UsersRound}
                tone="blue"
              />
              <LabMetric
                label="Peak queued"
                value={integerFormatter.format(result.queuedAtPeak)}
                detail={`${integerFormatter.format(result.queueWaitMs)}ms modeled queue wait`}
                icon={Clock3}
                tone={result.deadlineBreach ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Blocked producers"
                value={integerFormatter.format(result.blockedProducers)}
                detail="Senders without a cancellation exit"
                icon={Ban}
                tone={result.blockedProducers > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Post-cancel work"
                value={integerFormatter.format(result.continuingAfterCancel)}
                detail={`${integerFormatter.format(result.staleQueuedJobs)} jobs remain queued`}
                icon={TimerOff}
                tone={result.continuingAfterCancel > 0 ? 'rose' : 'emerald'}
              />
            </div>

            <ol className="grid gap-3 md:grid-cols-4">
              <FlowStage
                number="1"
                title="Admission"
                detail={
                  strategy.cancelAwareSend
                    ? `${integerFormatter.format(result.rejectedAtAdmission)} jobs exit through overload or cancellation`
                    : `${integerFormatter.format(result.blockedProducers)} producers can wait without an exit`
                }
                healthy={strategy.cancelAwareSend}
              />
              <FlowStage
                number="2"
                title="Bounded queue"
                detail={`${result.queuedAtPeak}/${bufferSize} slots used at peak`}
                healthy={!result.deadlineBreach && result.staleQueuedJobs === 0}
              />
              <FlowStage
                number="3"
                title="Workers"
                detail={
                  strategy.propagatesCancellation
                    ? 'Stop when the shared context is done'
                    : 'Keep processing detached work'
                }
                healthy={strategy.propagatesCancellation}
              />
              <FlowStage
                number="4"
                title="Dependency"
                detail={
                  strategy.propagatesCancellation
                    ? 'Receives the remaining deadline'
                    : 'Cannot observe caller cancellation'
                }
                healthy={strategy.propagatesCancellation}
              />
            </ol>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <strong className="text-neutral-950 dark:text-white">
                Ownership rule:
              </strong>{' '}
              the goroutine that starts work must be able to explain who cancels it,
              who closes its output, and which bounded resource admits the next unit.
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowStage({
  number,
  title,
  detail,
  healthy,
}: {
  number: string;
  title: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <li
      className={`relative min-w-0 rounded-md border p-4 ${
        healthy
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-current text-xs font-bold">
          <span className={healthy ? 'text-emerald-50 dark:text-emerald-950' : 'text-rose-50 dark:text-rose-950'}>
            {number}
          </span>
        </span>
        {healthy ? (
          <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
        ) : (
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        )}
      </div>
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </li>
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
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      {error ? (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
            Lifecycle lab unavailable
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading the cancellation and backpressure model…
        </div>
      )}
    </div>
  );
}
