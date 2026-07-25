'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  Inbox,
  LoaderCircle,
  PauseCircle,
  ServerCog,
  TriangleAlert,
  Unplug,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PolicyId = 'block' | 'reject' | 'unbounded';

type NumericBound = {
  min: number;
  max: number;
  step: number;
};

type QueuePolicy = {
  id: PolicyId;
  label: string;
  detail: string;
};

type QueueData = {
  title: string;
  description: string;
  simulationSeconds: number;
  defaults: {
    arrivalRate: number;
    workers: number;
    serviceTimeMs: number;
    queueCapacity: number;
    policyId: PolicyId;
  };
  bounds: {
    arrivalRate: NumericBound;
    workers: NumericBound;
    queueCapacity: NumericBound;
  };
  serviceTimesMs: number[];
  policies: QueuePolicy[];
};

type TickResult = {
  second: number;
  newArrivals: number;
  retriedUpstream: number;
  completed: number;
  queueDepth: number;
  blockedUpstream: number;
  rejected: number;
};

type Simulation = {
  ticks: TickResult[];
  serviceCapacity: number;
  offered: number;
  completed: number;
  rejected: number;
  finalQueue: number;
  blockedUpstream: number;
  verdict: string;
  explanation: string;
  tone: 'emerald' | 'amber' | 'rose';
};

const BLOCK_ID = 'technology/concurrency-backpressure-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/concurrency/data/bounded-queue-model.json';
const policyIds: PolicyId[] = ['block', 'reject', 'unbounded'];

const policyIcons: Record<PolicyId, LucideIcon> = {
  block: PauseCircle,
  reject: Ban,
  unbounded: Inbox,
};

function isBound(value: unknown): value is NumericBound {
  if (!value || typeof value !== 'object') return false;
  const bound = value as Partial<NumericBound>;
  return (
    typeof bound.min === 'number'
    && typeof bound.max === 'number'
    && typeof bound.step === 'number'
    && bound.min <= bound.max
    && bound.step > 0
  );
}

function isQueueData(value: unknown): value is QueueData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<QueueData>;
  if (
    typeof data.title !== 'string'
    || typeof data.description !== 'string'
    || typeof data.simulationSeconds !== 'number'
    || data.simulationSeconds < 2
    || !data.defaults
    || !data.bounds
    || !isBound(data.bounds.arrivalRate)
    || !isBound(data.bounds.workers)
    || !isBound(data.bounds.queueCapacity)
    || !Array.isArray(data.serviceTimesMs)
    || data.serviceTimesMs.length < 2
    || !data.serviceTimesMs.every(
      (duration) => typeof duration === 'number' && duration > 0 && 1000 % duration === 0,
    )
    || !Array.isArray(data.policies)
    || data.policies.length !== policyIds.length
  ) {
    return false;
  }

  const defaults = data.defaults;
  const policies = new Set<PolicyId>();
  const policiesValid = data.policies.every((policy) => {
    if (
      !policy
      || !policyIds.includes(policy.id)
      || typeof policy.label !== 'string'
      || typeof policy.detail !== 'string'
    ) {
      return false;
    }
    policies.add(policy.id);
    return true;
  });

  return (
    policiesValid
    && policies.size === policyIds.length
    && typeof defaults.arrivalRate === 'number'
    && typeof defaults.workers === 'number'
    && typeof defaults.serviceTimeMs === 'number'
    && typeof defaults.queueCapacity === 'number'
    && policyIds.includes(defaults.policyId)
    && data.serviceTimesMs.includes(defaults.serviceTimeMs)
  );
}

export default function ConcurrencyBackpressureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<QueueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isQueueData(payload)) {
          throw new Error('The queue and backpressure model is incomplete.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load the queue model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <QueueWorkbench data={data} />;
}

function QueueWorkbench({ data }: { data: QueueData }) {
  const [arrivalRate, setArrivalRate] = useState(data.defaults.arrivalRate);
  const [workers, setWorkers] = useState(data.defaults.workers);
  const [serviceTimeMs, setServiceTimeMs] = useState(data.defaults.serviceTimeMs);
  const [queueCapacity, setQueueCapacity] = useState(data.defaults.queueCapacity);
  const [policyId, setPolicyId] = useState<PolicyId>(data.defaults.policyId);

  const policy =
    data.policies.find((candidate) => candidate.id === policyId)
    ?? data.policies[0];
  const simulation = useMemo(
    () =>
      simulateQueue({
        arrivalRate,
        workers,
        serviceTimeMs,
        queueCapacity,
        policyId: policy.id,
        seconds: data.simulationSeconds,
      }),
    [
      arrivalRate,
      data.simulationSeconds,
      policy.id,
      queueCapacity,
      serviceTimeMs,
      workers,
    ],
  );
  const maxBarValue = Math.max(
    arrivalRate,
    simulation.serviceCapacity,
    queueCapacity,
    ...simulation.ticks.flatMap((tick) => [
      tick.queueDepth,
      tick.blockedUpstream,
      tick.rejected,
    ]),
    1,
  );

  function reset() {
    setArrivalRate(data.defaults.arrivalRate);
    setWorkers(data.defaults.workers);
    setServiceTimeMs(data.defaults.serviceTimeMs);
    setQueueCapacity(data.defaults.queueCapacity);
    setPolicyId(data.defaults.policyId);
  }

  const verdictClass =
    simulation.tone === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
      : simulation.tone === 'amber'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Bounded queue and backpressure lab"
          title={data.title}
          description={data.description}
          icon={ServerCog}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Full-queue policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((candidate) => {
                    const Icon = policyIcons[candidate.id];
                    return (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === policy.id}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Icon}
                        accent={
                          candidate.id === 'block'
                            ? 'amber'
                            : candidate.id === 'reject'
                              ? 'rose'
                              : 'blue'
                        }
                        onClick={() => setPolicyId(candidate.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <LabRange
                label="New arrivals"
                value={arrivalRate}
                output={`${arrivalRate} tasks/s`}
                min={data.bounds.arrivalRate.min}
                max={data.bounds.arrivalRate.max}
                step={data.bounds.arrivalRate.step}
                accent="cyan"
                lowLabel={`${data.bounds.arrivalRate.min}/s`}
                highLabel={`${data.bounds.arrivalRate.max}/s`}
                onChange={setArrivalRate}
              />

              <LabRange
                label="Workers"
                value={workers}
                output={String(workers)}
                min={data.bounds.workers.min}
                max={data.bounds.workers.max}
                step={data.bounds.workers.step}
                accent="violet"
                lowLabel="One worker"
                highLabel={`${data.bounds.workers.max} workers`}
                onChange={setWorkers}
              />

              <label className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Service time per task
                </span>
                <select
                  value={serviceTimeMs}
                  onChange={(event) => setServiceTimeMs(Number(event.target.value))}
                  className="mt-3 min-h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.serviceTimesMs.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} ms ({1000 / duration} tasks/s per worker)
                    </option>
                  ))}
                </select>
              </label>

              {policy.id === 'unbounded' ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Queue capacity
                  </p>
                  <p className="mt-1 text-sm font-semibold">No limit is applied</p>
                  <p className="mt-1 text-xs leading-5 opacity-75">
                    Every unfinished task remains resident in this model.
                  </p>
                </div>
              ) : (
                <LabRange
                  label="Queue capacity"
                  value={queueCapacity}
                  output={`${queueCapacity} tasks`}
                  min={data.bounds.queueCapacity.min}
                  max={data.bounds.queueCapacity.max}
                  step={data.bounds.queueCapacity.step}
                  accent="blue"
                  lowLabel="No waiting slots"
                  highLabel={`${data.bounds.queueCapacity.max} slots`}
                  onChange={setQueueCapacity}
                />
              )}
            </div>
          }
        >
          <div className="space-y-6">
            <div aria-live="polite" className={`rounded-md border p-5 ${verdictClass}`}>
              <div className="flex items-start gap-3">
                {simulation.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : simulation.tone === 'amber' ? (
                  <PauseCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {data.simulationSeconds}-second result
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{simulation.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {simulation.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Service capacity"
                value={`${simulation.serviceCapacity}/s`}
                detail={`${workers} × 1000 / ${serviceTimeMs} ms`}
                icon={Gauge}
                tone={
                  simulation.serviceCapacity >= arrivalRate ? 'emerald' : 'amber'
                }
              />
              <LabMetric
                label="Completed"
                value={`${simulation.completed} / ${simulation.offered}`}
                detail={`New tasks completed in ${data.simulationSeconds} windows`}
                icon={CheckCircle2}
                tone="blue"
              />
              <LabMetric
                label="Final queue"
                value={String(simulation.finalQueue)}
                detail={
                  policy.id === 'unbounded'
                    ? 'No configured capacity'
                    : `${queueCapacity} configured slots`
                }
                icon={Boxes}
                tone={simulation.finalQueue > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label={
                  policy.id === 'reject'
                    ? 'Rejected'
                    : policy.id === 'block'
                      ? 'Upstream waiting'
                      : 'Admission failures'
                }
                value={String(
                  policy.id === 'reject'
                    ? simulation.rejected
                    : policy.id === 'block'
                      ? simulation.blockedUpstream
                      : 0,
                )}
                detail={
                  policy.id === 'reject'
                    ? 'Not admitted'
                    : policy.id === 'block'
                      ? 'Tasks held outside the worker queue'
                      : 'Unbounded policy admits every task'
                }
                icon={
                  policy.id === 'reject'
                    ? Ban
                    : policy.id === 'block'
                      ? Clock3
                      : Inbox
                }
                tone={
                  simulation.rejected > 0 || simulation.blockedUpstream > 0
                    ? 'rose'
                    : 'neutral'
                }
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">
                Arithmetic used for every one-second window
              </p>
              <p className="mt-1">
                <code>
                  available = previous queue + new arrivals
                  {policy.id === 'block' ? ' + previously blocked tasks' : ''}
                </code>
                ; <code>completed = min(available, service capacity)</code>; the
                policy handles the remaining tasks.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Queue pressure by second
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {simulation.ticks.map((tick) => (
                  <QueueTick
                    key={tick.second}
                    tick={tick}
                    maxValue={maxBarValue}
                    policyId={policy.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function simulateQueue({
  arrivalRate,
  workers,
  serviceTimeMs,
  queueCapacity,
  policyId,
  seconds,
}: {
  arrivalRate: number;
  workers: number;
  serviceTimeMs: number;
  queueCapacity: number;
  policyId: PolicyId;
  seconds: number;
}): Simulation {
  const serviceCapacity = workers * (1000 / serviceTimeMs);
  let queueDepth = 0;
  let blockedUpstream = 0;
  let totalCompleted = 0;
  let totalRejected = 0;
  const ticks: TickResult[] = [];

  for (let second = 1; second <= seconds; second += 1) {
    const retriedUpstream = policyId === 'block' ? blockedUpstream : 0;
    const available = queueDepth + arrivalRate + retriedUpstream;
    const completed = Math.min(available, serviceCapacity);
    const remaining = available - completed;
    let rejected = 0;

    if (policyId === 'unbounded') {
      queueDepth = remaining;
      blockedUpstream = 0;
    } else if (policyId === 'reject') {
      queueDepth = Math.min(remaining, queueCapacity);
      rejected = Math.max(0, remaining - queueCapacity);
      blockedUpstream = 0;
    } else {
      queueDepth = Math.min(remaining, queueCapacity);
      blockedUpstream = Math.max(0, remaining - queueCapacity);
    }

    totalCompleted += completed;
    totalRejected += rejected;
    ticks.push({
      second,
      newArrivals: arrivalRate,
      retriedUpstream,
      completed,
      queueDepth,
      blockedUpstream,
      rejected,
    });
  }

  const offered = arrivalRate * seconds;
  if (policyId === 'unbounded' && queueDepth > 0) {
    return {
      ticks,
      serviceCapacity,
      offered,
      completed: totalCompleted,
      rejected: totalRejected,
      finalQueue: queueDepth,
      blockedUpstream,
      tone: 'rose',
      verdict: `The unbounded queue grows to ${queueDepth} tasks`,
      explanation: `${arrivalRate} new tasks/s exceeds ${serviceCapacity} completed tasks/s. The queue hides rejection by retaining the unfinished difference in memory.`,
    };
  }

  if (policyId === 'block' && blockedUpstream > 0) {
    return {
      ticks,
      serviceCapacity,
      offered,
      completed: totalCompleted,
      rejected: totalRejected,
      finalQueue: queueDepth,
      blockedUpstream,
      tone: 'amber',
      verdict: `${blockedUpstream} tasks are waiting upstream`,
      explanation: `The queue stays within ${queueCapacity} slots, but producer wait grows because demand exceeds the worker boundary.`,
    };
  }

  if (policyId === 'reject' && totalRejected > 0) {
    return {
      ticks,
      serviceCapacity,
      offered,
      completed: totalCompleted,
      rejected: totalRejected,
      finalQueue: queueDepth,
      blockedUpstream,
      tone: 'rose',
      verdict: `${totalRejected} tasks are rejected explicitly`,
      explanation: `Memory stays bounded at ${queueCapacity} waiting slots. The caller now needs an explicit error, retry, or fallback contract.`,
    };
  }

  return {
    ticks,
    serviceCapacity,
    offered,
    completed: totalCompleted,
    rejected: totalRejected,
    finalQueue: queueDepth,
    blockedUpstream,
    tone: 'emerald',
    verdict: 'Worker capacity keeps pace with new arrivals',
    explanation: `${serviceCapacity} tasks/s of service is at least the ${arrivalRate} tasks/s arrival rate, so no persistent backlog remains in this exact model.`,
  };
}

function QueueTick({
  tick,
  maxValue,
  policyId,
}: {
  tick: TickResult;
  maxValue: number;
  policyId: PolicyId;
}) {
  const pressure =
    policyId === 'reject'
      ? tick.rejected
      : policyId === 'block'
        ? tick.blockedUpstream
        : 0;
  const pressureLabel =
    policyId === 'reject'
      ? 'Rejected'
      : policyId === 'block'
        ? 'Upstream'
        : 'Admission failures';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
          Second {tick.second}
        </p>
        <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {tick.completed} completed
        </p>
      </div>
      <div className="mt-3 space-y-3">
        <PressureBar
          label="Queue"
          value={tick.queueDepth}
          maxValue={maxValue}
          className="bg-blue-500"
        />
        <PressureBar
          label={pressureLabel}
          value={pressure}
          maxValue={maxValue}
          className={policyId === 'reject' ? 'bg-rose-500' : 'bg-amber-500'}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        New {tick.newArrivals}
        {tick.retriedUpstream > 0 ? ` + retried ${tick.retriedUpstream}` : ''}
        {' → '}completed {tick.completed}, queued {tick.queueDepth}
        {pressure > 0
          ? policyId === 'reject'
            ? `, rejected ${pressure}`
            : `, waiting upstream ${pressure}`
          : ''}
      </p>
    </div>
  );
}

function PressureBar({
  label,
  value,
  maxValue,
  className,
}: {
  label: string;
  value: number;
  maxValue: number;
  className: string;
}) {
  const width = value === 0 ? 0 : Math.max(4, (value / maxValue) * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-neutral-600 dark:text-neutral-300">
          {label}
        </span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
          {value}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${className}`}
          style={{ width: `${Math.min(100, width)}%` }}
        />
      </div>
    </div>
  );
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Bounded queue and backpressure lab"
          title="Keep a worker pool stable under sustained load"
          description="Loading queue limits and exact simulation bounds."
          icon={ServerCog}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-44 items-center justify-center">
            {error ? (
              <div className="max-w-lg text-center">
                <Unplug
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  The queue model could not be loaded.
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 min-h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                <LoaderCircle
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin motion-reduce:animate-none"
                />
                Loading queue model
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
