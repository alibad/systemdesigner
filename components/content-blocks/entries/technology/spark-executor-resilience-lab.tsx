'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Boxes,
  CheckCircle2,
  Clock3,
  Cpu,
  Gauge,
  HardDrive,
  Layers3,
  LoaderCircle,
  MemoryStick,
  ServerCrash,
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

const BLOCK_ID = 'technology/spark-executor-resilience-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/spark/data/executor-resilience-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type ExecutorShape = {
  id: string;
  label: string;
  detail: string;
  cores: number;
  heapGb: number;
  overheadGb: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  mode: 'none' | 'fixed' | 'fraction';
  value: number;
};

type ExecutorResilienceModel = {
  kind: 'spark-executor-resilience';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  stage: {
    tasks: number;
    taskMemoryNeedGb: number;
    shufflePartitions: number;
    cachedBlocks: number;
  };
  defaults: {
    shapeId: string;
    failureId: string;
    executorCount: number;
    taskDurationSeconds: number;
  };
  bounds: {
    executorCount: Bound;
    taskDurationSeconds: Bound;
  };
  shapes: ExecutorShape[];
  failures: FailureScenario[];
  notice: string;
};

type Health = 'healthy' | 'thin' | 'unsafe';

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

function isShape(value: unknown): value is ExecutorShape {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.cores)
    && value.cores > 0
    && isFiniteNumber(value.heapGb)
    && value.heapGb > 0
    && isFiniteNumber(value.overheadGb)
    && value.overheadGb > 0;
}

function isFailure(value: unknown): value is FailureScenario {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && (
      value.mode === 'none'
      || value.mode === 'fixed'
      || value.mode === 'fraction'
    )
    && isFiniteNumber(value.value)
    && value.value >= 0;
}

function isExecutorResilienceModel(
  value: unknown,
): value is ExecutorResilienceModel {
  if (
    !isRecord(value)
    || !isRecord(value.stage)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
  ) {
    return false;
  }

  const stage = value.stage;
  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'spark-executor-resilience'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(stage.tasks)
    && stage.tasks > 0
    && isFiniteNumber(stage.taskMemoryNeedGb)
    && stage.taskMemoryNeedGb > 0
    && isFiniteNumber(stage.shufflePartitions)
    && stage.shufflePartitions > 0
    && isFiniteNumber(stage.cachedBlocks)
    && stage.cachedBlocks >= 0
    && typeof defaults.shapeId === 'string'
    && typeof defaults.failureId === 'string'
    && isFiniteNumber(defaults.executorCount)
    && isFiniteNumber(defaults.taskDurationSeconds)
    && isBound(bounds.executorCount)
    && isBound(bounds.taskDurationSeconds)
    && Array.isArray(value.shapes)
    && value.shapes.length >= 3
    && value.shapes.every(isShape)
    && value.shapes.some((item) => item.id === defaults.shapeId)
    && Array.isArray(value.failures)
    && value.failures.length >= 3
    && value.failures.every(isFailure)
    && value.failures.some((item) => item.id === defaults.failureId)
    && typeof value.notice === 'string';
}

export default function SparkExecutorResilienceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ExecutorResilienceModel | null>(null);
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
        if (!isExecutorResilienceModel(payload)) {
          throw new Error('The Spark executor model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Spark executor model.',
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

  return <ExecutorResilienceWorkbench model={model} />;
}

function ExecutorResilienceWorkbench({
  model,
}: {
  model: ExecutorResilienceModel;
}) {
  const [shapeId, setShapeId] = useState(model.defaults.shapeId);
  const [failureId, setFailureId] = useState(model.defaults.failureId);
  const [executorCount, setExecutorCount] = useState(
    model.defaults.executorCount,
  );
  const [taskDurationSeconds, setTaskDurationSeconds] = useState(
    model.defaults.taskDurationSeconds,
  );

  const shape =
    model.shapes.find((item) => item.id === shapeId) ?? model.shapes[0];
  const failure =
    model.failures.find((item) => item.id === failureId) ?? model.failures[0];

  const result = useMemo(() => {
    const failedExecutors =
      failure.mode === 'none'
        ? 0
        : failure.mode === 'fixed'
          ? Math.min(executorCount, Math.round(failure.value))
          : Math.max(1, Math.ceil(executorCount * failure.value));
    const survivingExecutors = executorCount - failedExecutors;
    const totalSlots = executorCount * shape.cores;
    const survivingSlots = survivingExecutors * shape.cores;
    const executionHeapGb = shape.heapGb * 0.6;
    const memoryPerTaskGb = executionHeapGb / shape.cores;
    const memoryRatio = memoryPerTaskGb / model.stage.taskMemoryNeedGb;
    const healthyWaves = Math.ceil(model.stage.tasks / totalSlots);
    const baseDurationSeconds = healthyWaves * taskDurationSeconds;
    const lostShare =
      executorCount === 0 ? 0 : failedExecutors / executorCount;
    const invalidatedShufflePartitions = Math.ceil(
      model.stage.shufflePartitions * lostShare,
    );
    const lostCachedBlocks = Math.ceil(model.stage.cachedBlocks * lostShare);
    const interruptedTasks = Math.min(
      model.stage.tasks,
      failedExecutors * shape.cores,
    );
    const recoveryTasks = Math.max(
      interruptedTasks,
      invalidatedShufflePartitions,
    );
    const recoveryWaves =
      recoveryTasks === 0
        ? 0
        : survivingSlots > 0
          ? Math.ceil(recoveryTasks / survivingSlots)
          : Number.POSITIVE_INFINITY;
    const recoverySeconds = Number.isFinite(recoveryWaves)
      ? recoveryWaves * taskDurationSeconds
      : Number.POSITIVE_INFINITY;
    const clusterMemoryGb =
      executorCount * (shape.heapGb + shape.overheadGb);

    let health: Health = 'healthy';
    if (survivingSlots === 0 || memoryRatio < 0.85) {
      health = 'unsafe';
    } else if (memoryRatio < 1 || recoverySeconds > 300) {
      health = 'thin';
    }

    return {
      baseDurationSeconds,
      clusterMemoryGb,
      executionHeapGb,
      failedExecutors,
      health,
      healthyWaves,
      interruptedTasks,
      invalidatedShufflePartitions,
      lostCachedBlocks,
      memoryPerTaskGb,
      memoryRatio,
      recoverySeconds,
      recoveryTasks,
      recoveryWaves,
      survivingExecutors,
      survivingSlots,
      totalSlots,
    };
  }, [
    executorCount,
    failure,
    model.stage,
    shape,
    taskDurationSeconds,
  ]);

  function reset() {
    setShapeId(model.defaults.shapeId);
    setFailureId(model.defaults.failureId);
    setExecutorCount(model.defaults.executorCount);
    setTaskDurationSeconds(model.defaults.taskDurationSeconds);
  }

  const verdict = getVerdict(result, model);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Executor resilience lab"
          title={model.title}
          description={model.description}
          icon={ServerCrash}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose an executor process">
                {model.shapes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === shape.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Cpu}
                    accent={item.id === 'dense' ? 'amber' : 'violet'}
                    onClick={() => setShapeId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Executor processes"
                value={executorCount}
                output={`${executorCount}`}
                min={model.bounds.executorCount.min}
                max={model.bounds.executorCount.max}
                step={model.bounds.executorCount.step}
                accent="blue"
                lowLabel="Less parallel capacity"
                highLabel="More process overhead"
                onChange={setExecutorCount}
              />

              <LabRange
                label="Representative task duration"
                value={taskDurationSeconds}
                output={formatDuration(taskDurationSeconds)}
                min={model.bounds.taskDurationSeconds.min}
                max={model.bounds.taskDurationSeconds.max}
                step={model.bounds.taskDurationSeconds.step}
                accent="cyan"
                lowLabel="Short tasks"
                highLabel="Expensive replay"
                onChange={setTaskDurationSeconds}
              />

              <ChoiceGroup label="2. Inject a failure">
                {model.failures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === failure.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.mode === 'none' ? CheckCircle2 : ServerCrash}
                    accent={item.mode === 'none' ? 'emerald' : 'rose'}
                    onClick={() => setFailureId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <VerdictPanel
              health={result.health}
              title={verdict.title}
              detail={verdict.detail}
            />

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Task slots"
                value={result.totalSlots.toLocaleString()}
                detail={`${result.survivingSlots.toLocaleString()} survive the event`}
                icon={Cpu}
                tone={result.survivingSlots > 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Execution memory/task"
                value={`${result.memoryPerTaskGb.toFixed(1)} GiB`}
                detail={`${model.stage.taskMemoryNeedGb.toFixed(1)} GiB modeled need`}
                icon={MemoryStick}
                tone={
                  result.memoryRatio >= 1
                    ? 'emerald'
                    : result.memoryRatio >= 0.85
                      ? 'amber'
                      : 'rose'
                }
              />
              <LabMetric
                label="Invalidated shuffle"
                value={result.invalidatedShufflePartitions.toLocaleString()}
                detail={`${result.lostCachedBlocks} cached blocks also lost`}
                icon={HardDrive}
                tone={
                  result.invalidatedShufflePartitions === 0 ? 'emerald' : 'amber'
                }
              />
              <LabMetric
                label="Recovery estimate"
                value={
                  Number.isFinite(result.recoverySeconds)
                    ? formatDuration(result.recoverySeconds)
                    : 'Blocked'
                }
                detail={
                  result.recoveryWaves === 0
                    ? 'No failed work to replay'
                    : Number.isFinite(result.recoveryWaves)
                      ? `${result.recoveryWaves} waves on surviving slots`
                      : 'No executor slots survive'
                }
                icon={Clock3}
                tone={
                  result.recoverySeconds === 0
                    ? 'emerald'
                    : result.recoverySeconds <= 300
                      ? 'violet'
                      : 'rose'
                }
              />
            </div>

            <ExecutorMap
              executorCount={executorCount}
              failedExecutors={result.failedExecutors}
              shape={shape}
            />

            <section className="grid gap-3 md:grid-cols-3">
              <StageFact
                icon={Layers3}
                label="Healthy stage"
                value={`${result.healthyWaves} task waves`}
                detail={`${model.stage.tasks} tasks x ${formatDuration(taskDurationSeconds)} = about ${formatDuration(result.baseDurationSeconds)}`}
              />
              <StageFact
                icon={ServerCrash}
                label="Failure scope"
                value={`${result.failedExecutors} of ${executorCount} executors`}
                detail={`${result.interruptedTasks} active slots and ${result.invalidatedShufflePartitions} modeled shuffle partitions affected`}
              />
              <StageFact
                icon={Gauge}
                label="Process footprint"
                value={`${shape.heapGb + shape.overheadGb} GiB each`}
                detail={`${result.clusterMemoryGb.toLocaleString()} GiB cluster allocation before driver and platform overhead`}
              />
            </section>

            <RecoveryTimeline
              recoveryTasks={result.recoveryTasks}
              recoveryWaves={result.recoveryWaves}
              survivingSlots={result.survivingSlots}
            />

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function getVerdict(
  result: {
    failedExecutors: number;
    health: Health;
    memoryPerTaskGb: number;
    recoverySeconds: number;
    survivingSlots: number;
  },
  model: ExecutorResilienceModel,
) {
  if (result.survivingSlots === 0) {
    return {
      title: 'No task slots survive this failure',
      detail:
        'The application cannot recompute lost work until the cluster manager supplies replacement executors.',
    };
  }

  if (result.memoryPerTaskGb < model.stage.taskMemoryNeedGb) {
    return {
      title: 'Concurrent tasks exceed the modeled execution-memory share',
      detail: `${result.memoryPerTaskGb.toFixed(1)} GiB is available per active task against a ${model.stage.taskMemoryNeedGb.toFixed(1)} GiB need. Reduce cores per executor, reduce task state, or accept measured spill with enough disk and time.`,
    };
  }

  if (result.health === 'thin') {
    return {
      title: 'The stage runs, but recovery consumes the time budget',
      detail: `${result.failedExecutors} failed executor${result.failedExecutors === 1 ? '' : 's'} leave enough memory, but replay takes about ${formatDuration(result.recoverySeconds)} before platform replacement time.`,
    };
  }

  if (result.failedExecutors === 0) {
    return {
      title: 'Healthy capacity is only the baseline',
      detail:
        'Inject executor loss before selecting this shape. The useful production envelope is the memory and completion time that remain after the named failure.',
    };
  }

  return {
    title: 'The surviving cluster can replay the lost boundary',
    detail: `Task memory remains above the modeled need and the failed work replays in about ${formatDuration(result.recoverySeconds)}. Add real executor replacement and shuffle-service behavior to the recovery objective.`,
  };
}

function VerdictPanel({
  health,
  title,
  detail,
}: {
  health: Health;
  title: string;
  detail: string;
}) {
  const tone =
    health === 'healthy'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
      : health === 'thin'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
        : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';
  const Icon = health === 'healthy' ? CheckCircle2 : TriangleAlert;

  return (
    <section className={`rounded-md border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">
            Resilience verdict
          </p>
          <h4 className="mt-1 text-lg font-semibold">{title}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </section>
  );
}

function ExecutorMap({
  executorCount,
  failedExecutors,
  shape,
}: {
  executorCount: number;
  failedExecutors: number;
  shape: ExecutorShape;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Process failure map
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
            Each executor shares one process fate
          </h4>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {shape.cores} slots / {shape.heapGb} GiB heap each
        </p>
      </div>

      <div
        className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8"
        aria-label={`${executorCount} executors, ${failedExecutors} failed`}
      >
        {Array.from({ length: executorCount }, (_, index) => {
          const failed = index < failedExecutors;
          return (
            <div
              key={index}
              className={`flex min-h-14 items-center justify-center rounded-md border ${
                failed
                  ? 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              }`}
              title={`Executor ${index + 1}: ${failed ? 'failed' : 'available'}`}
            >
              {failed ? (
                <ServerCrash aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Cpu aria-hidden="true" className="h-5 w-5" />
              )}
              <span className="sr-only">
                Executor {index + 1}: {failed ? 'failed' : 'available'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Available process
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
          Failed process and local state
        </span>
      </div>
    </section>
  );
}

function StageFact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function RecoveryTimeline({
  recoveryTasks,
  recoveryWaves,
  survivingSlots,
}: {
  recoveryTasks: number;
  recoveryWaves: number;
  survivingSlots: number;
}) {
  if (recoveryTasks === 0) {
    return (
      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
          No recovery work is active. Choose a failure to test the envelope.
        </p>
      </section>
    );
  }

  const finiteWaves = Number.isFinite(recoveryWaves)
    ? Math.min(recoveryWaves, 8)
    : 0;

  return (
    <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Replay path
      </p>
      <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
        {recoveryTasks} tasks or shuffle partitions must be rebuilt
      </h4>
      {survivingSlots === 0 ? (
        <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
          Recovery waits for replacement executors because no slots survive.
        </p>
      ) : (
        <>
          <div className="mt-5 flex min-h-14 items-center gap-2 overflow-x-auto pb-1">
            {Array.from({ length: finiteWaves }, (_, index) => (
              <div
                key={index}
                className="flex h-12 min-w-20 items-center justify-center rounded-md border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100"
              >
                Wave {index + 1}
              </div>
            ))}
            {recoveryWaves > finiteWaves ? (
              <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                +{recoveryWaves - finiteWaves} more
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Up to {survivingSlots} recovery tasks can run concurrently before
            foreground work, replacement startup, and data locality are considered.
          </p>
        </>
      )}
    </section>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
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
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Executor resilience lab"
          title="Loading the executor failure model"
          description="The lesson is loading its co-located executor and stage contract."
          icon={ServerCrash}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center">
            {error ? (
              <div className="max-w-lg text-center">
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-rose-500"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:bg-white dark:text-neutral-950"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin motion-reduce:animate-none"
                />
                Loading executor model...
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 'Blocked';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0
    ? `${minutes}m`
    : `${minutes}m ${remainingSeconds}s`;
}
