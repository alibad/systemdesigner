'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  GitCompareArrows,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type WorkerId = 'A' | 'B' | 'owner';
type StrategyId = 'none' | 'mutex' | 'atomic-cas' | 'single-owner';

type TimelineStep = {
  tick: number;
  worker: WorkerId;
  operation: string;
  detail: string;
  counter: number;
};

type Schedule = {
  id: string;
  label: string;
  detail: string;
  firstWorker: 'A' | 'B';
  steps: TimelineStep[];
};

type Strategy = {
  id: StrategyId;
  label: string;
  detail: string;
  guarantee: string;
};

type InterleavingData = {
  title: string;
  description: string;
  initialValue: number;
  expectedFinalValue: number;
  defaultScheduleId: string;
  defaultStrategyId: StrategyId;
  schedules: Schedule[];
  strategies: Strategy[];
};

type Outcome = {
  finalValue: number;
  retries: number;
  waits: number;
  lostUpdates: number;
  steps: TimelineStep[];
  verdict: string;
  explanation: string;
};

const BLOCK_ID = 'technology/concurrency-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/concurrency/data/interleaving-synchronization-model.json';
const strategyIds: StrategyId[] = ['none', 'mutex', 'atomic-cas', 'single-owner'];

const strategyIcons: Record<StrategyId, LucideIcon> = {
  none: TriangleAlert,
  mutex: LockKeyhole,
  'atomic-cas': RefreshCw,
  'single-owner': UsersRound,
};

function isTimelineStep(value: unknown): value is TimelineStep {
  if (!value || typeof value !== 'object') return false;
  const step = value as Partial<TimelineStep>;
  return (
    typeof step.tick === 'number'
    && (step.worker === 'A' || step.worker === 'B' || step.worker === 'owner')
    && typeof step.operation === 'string'
    && typeof step.detail === 'string'
    && typeof step.counter === 'number'
  );
}

function isInterleavingData(value: unknown): value is InterleavingData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<InterleavingData>;
  if (
    typeof data.title !== 'string'
    || typeof data.description !== 'string'
    || typeof data.initialValue !== 'number'
    || typeof data.expectedFinalValue !== 'number'
    || typeof data.defaultScheduleId !== 'string'
    || !strategyIds.includes(data.defaultStrategyId as StrategyId)
    || !Array.isArray(data.schedules)
    || data.schedules.length < 3
    || !Array.isArray(data.strategies)
    || data.strategies.length !== strategyIds.length
  ) {
    return false;
  }

  const scheduleIds = new Set<string>();
  const schedulesValid = data.schedules.every((schedule) => {
    if (
      !schedule
      || typeof schedule.id !== 'string'
      || typeof schedule.label !== 'string'
      || typeof schedule.detail !== 'string'
      || (schedule.firstWorker !== 'A' && schedule.firstWorker !== 'B')
      || !Array.isArray(schedule.steps)
      || schedule.steps.length < 6
      || !schedule.steps.every(isTimelineStep)
    ) {
      return false;
    }
    scheduleIds.add(schedule.id);
    return true;
  });

  const seenStrategies = new Set<StrategyId>();
  const strategiesValid = data.strategies.every((strategy) => {
    if (
      !strategy
      || !strategyIds.includes(strategy.id)
      || typeof strategy.label !== 'string'
      || typeof strategy.detail !== 'string'
      || typeof strategy.guarantee !== 'string'
    ) {
      return false;
    }
    seenStrategies.add(strategy.id);
    return true;
  });

  return (
    schedulesValid
    && strategiesValid
    && scheduleIds.size === data.schedules.length
    && scheduleIds.has(data.defaultScheduleId)
    && seenStrategies.size === strategyIds.length
  );
}

export default function ConcurrencyInterleavingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<InterleavingData | null>(null);
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
        if (!isInterleavingData(payload)) {
          throw new Error('The interleaving model is incomplete.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load the interleaving model.',
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

  return <InterleavingWorkbench data={data} />;
}

function InterleavingWorkbench({ data }: { data: InterleavingData }) {
  const [scheduleId, setScheduleId] = useState(data.defaultScheduleId);
  const [strategyId, setStrategyId] = useState<StrategyId>(
    data.defaultStrategyId,
  );

  const schedule =
    data.schedules.find((candidate) => candidate.id === scheduleId)
    ?? data.schedules[0];
  const strategy =
    data.strategies.find((candidate) => candidate.id === strategyId)
    ?? data.strategies[0];
  const outcome = useMemo(
    () => calculateOutcome(data, schedule, strategy.id),
    [data, schedule, strategy.id],
  );
  const safe = outcome.finalValue === data.expectedFinalValue;

  function reset() {
    setScheduleId(data.defaultScheduleId);
    setStrategyId(data.defaultStrategyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Interleaving and synchronization lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Attempted schedule
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.schedules.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === schedule.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={GitCompareArrows}
                      accent="blue"
                      onClick={() => setScheduleId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Synchronization choice
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((candidate) => {
                    const Icon = strategyIcons[candidate.id];
                    return (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === strategy.id}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Icon}
                        accent="violet"
                        onClick={() => setStrategyId(candidate.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6">
            <div
              aria-live="polite"
              className={`rounded-md border p-5 ${
                safe
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {safe ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Exact outcome
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{outcome.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {outcome.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Final counter"
                value={String(outcome.finalValue)}
                detail={`Expected ${data.expectedFinalValue}`}
                icon={safe ? ShieldCheck : TriangleAlert}
                tone={safe ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Lost updates"
                value={String(outcome.lostUpdates)}
                detail="Expected minus observed"
                icon={CircleAlert}
                tone={outcome.lostUpdates === 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Retry events"
                value={String(outcome.retries)}
                detail="Failed compare-and-swap attempts"
                icon={RefreshCw}
                tone={outcome.retries > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Wait events"
                value={String(outcome.waits)}
                detail="Blocked lock acquisitions"
                icon={LockKeyhole}
                tone={outcome.waits > 0 ? 'violet' : 'neutral'}
              />
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Operation timeline
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Every read, write, wait, and retry is explicit
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Initial counter: {data.initialValue}
                </p>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-2">
                {outcome.steps.map((step) => (
                  <TimelineCard key={`${step.tick}-${step.worker}-${step.operation}`} step={step} />
                ))}
              </ol>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Guarantee
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {strategy.guarantee}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function calculateOutcome(
  data: InterleavingData,
  schedule: Schedule,
  strategyId: StrategyId,
): Outcome {
  const first = schedule.firstWorker;
  const second: 'A' | 'B' = first === 'A' ? 'B' : 'A';
  const attemptedOverlap = schedule.steps[1]?.operation === 'read';

  if (strategyId === 'none') {
    const finalValue =
      schedule.steps[schedule.steps.length - 1]?.counter ?? data.initialValue;
    const lostUpdates = Math.max(0, data.expectedFinalValue - finalValue);
    return {
      finalValue,
      retries: 0,
      waits: 0,
      lostUpdates,
      steps: schedule.steps,
      verdict:
        lostUpdates > 0
          ? `Final value ${finalValue}: one increment was lost`
          : `Final value ${finalValue}: this schedule happened to be correct`,
      explanation:
        lostUpdates > 0
          ? 'Both workers calculated from the same stale read. The later write overwrote an equal value instead of adding another increment.'
          : 'Worker A completed its write before worker B read. The result is correct for this schedule, but there is still no synchronization contract.',
    };
  }

  if (strategyId === 'mutex') {
    const waits = attemptedOverlap ? 1 : 0;
    return {
      finalValue: data.expectedFinalValue,
      retries: 0,
      waits,
      lostUpdates: 0,
      verdict: `Final value ${data.expectedFinalValue}: the critical section is serialized`,
      explanation:
        waits > 0
          ? `${second} attempts to enter while ${first} owns the mutex, waits once, then reads the committed value.`
          : 'The workers already arrive serially, and the mutex makes that ordering an enforced guarantee.',
      steps: [
        step(1, first, 'lock', `${first} acquires the mutex`, 0),
        step(2, first, 'read', `${first} reads counter = 0`, 0),
        step(3, first, 'write', `${first} writes 0 + 1 = 1`, 1),
        step(4, first, 'unlock', `${first} releases the mutex`, 1),
        step(5, second, 'lock', `${second} acquires the mutex`, 1),
        step(6, second, 'read', `${second} reads counter = 1`, 1),
        step(7, second, 'write', `${second} writes 1 + 1 = 2`, 2),
        step(8, second, 'unlock', `${second} releases the mutex`, 2),
      ],
    };
  }

  if (strategyId === 'atomic-cas') {
    if (!attemptedOverlap) {
      return {
        finalValue: data.expectedFinalValue,
        retries: 0,
        waits: 0,
        lostUpdates: 0,
        verdict: `Final value ${data.expectedFinalValue}: both atomic updates commit`,
        explanation:
          'Each worker reads the value left by the previous successful compare-and-swap, so neither needs to retry.',
        steps: [
          step(1, first, 'load', `${first} atomically loads 0`, 0),
          step(2, first, 'CAS success', `${first} changes 0 → 1`, 1),
          step(3, second, 'load', `${second} atomically loads 1`, 1),
          step(4, second, 'CAS success', `${second} changes 1 → 2`, 2),
        ],
      };
    }

    return {
      finalValue: data.expectedFinalValue,
      retries: 1,
      waits: 0,
      lostUpdates: 0,
      verdict: `Final value ${data.expectedFinalValue}: one stale compare-and-swap retries`,
      explanation: `${first} commits first. ${second}'s expected value is stale, so the atomic operation fails instead of overwriting and retries from the new value.`,
      steps: [
        step(1, first, 'load', `${first} atomically loads 0`, 0),
        step(2, second, 'load', `${second} atomically loads 0`, 0),
        step(3, first, 'CAS success', `${first} changes 0 → 1`, 1),
        step(4, second, 'CAS failed', `${second} expected 0 but found 1`, 1),
        step(5, second, 'reload', `${second} atomically loads 1`, 1),
        step(6, second, 'CAS success', `${second} changes 1 → 2`, 2),
      ],
    };
  }

  return {
    finalValue: data.expectedFinalValue,
    retries: 0,
    waits: 0,
    lostUpdates: 0,
    verdict: `Final value ${data.expectedFinalValue}: one owner applies both commands`,
    explanation:
      'Workers do not mutate the counter. They enqueue increment commands, and the single owner applies them in queue order.',
    steps: [
      step(1, first, 'enqueue', `${first} sends increment(+1); queue depth = 1`, 0),
      step(2, second, 'enqueue', `${second} sends increment(+1); queue depth = 2`, 0),
      step(3, 'owner', 'dequeue', `Owner takes ${first}'s command; queue depth = 1`, 0),
      step(4, 'owner', 'apply', 'Owner writes 0 + 1 = 1', 1),
      step(5, 'owner', 'dequeue', `Owner takes ${second}'s command; queue depth = 0`, 1),
      step(6, 'owner', 'apply', 'Owner writes 1 + 1 = 2', 2),
    ],
  };
}

function step(
  tick: number,
  worker: WorkerId,
  operation: string,
  detail: string,
  counter: number,
): TimelineStep {
  return { tick, worker, operation, detail, counter };
}

function TimelineCard({ step: timelineStep }: { step: TimelineStep }) {
  const workerStyle =
    timelineStep.worker === 'A'
      ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50'
      : timelineStep.worker === 'B'
        ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50'
        : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50';

  return (
    <li className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
          {timelineStep.tick}
        </span>
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${workerStyle}`}>
          {timelineStep.worker === 'owner' ? 'Owner' : `Worker ${timelineStep.worker}`}
        </span>
        <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-neutral-400" />
        <span className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
          {timelineStep.operation}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        {timelineStep.detail}
      </p>
      <p className="mt-2 text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
        Shared counter after step: {timelineStep.counter}
      </p>
    </li>
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
          eyebrow="Interleaving and synchronization lab"
          title="Interleave two increments without losing one"
          description="Loading the deterministic timeline model."
          icon={GitCompareArrows}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-44 items-center justify-center">
            {error ? (
              <div className="max-w-lg text-center">
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  The timeline model could not be loaded.
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 min-h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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
                Loading exact schedules
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
