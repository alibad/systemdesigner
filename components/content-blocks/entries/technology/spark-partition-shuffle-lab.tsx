'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Gauge,
  Layers3,
  LoaderCircle,
  Network,
  RadioTower,
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

const BLOCK_ID = 'technology/spark-partition-shuffle-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/spark/data/partition-shuffle-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  inputGb: number;
  dimensionGb: number;
  baseShuffleFactor: number;
  naturalHotKeyPercent: number;
  supportsBroadcast: boolean;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  mode: 'shuffle' | 'broadcast';
  shuffleMultiplier: number;
  skewReduction: number;
  supportedScenarioIds: string[];
};

type PartitionShuffleModel = {
  kind: 'spark-partition-shuffle';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  broadcastLimitGb: number;
  targetPartitionMb: {
    min: number;
    max: number;
  };
  defaults: {
    scenarioId: string;
    strategyId: string;
    shufflePartitions: number;
    totalSlots: number;
    hotKeyPercent: number;
  };
  bounds: {
    shufflePartitions: Bound;
    totalSlots: Bound;
    hotKeyPercent: Bound;
  };
  scenarios: Scenario[];
  strategies: Strategy[];
  notice: string;
};

type Verdict = 'healthy' | 'fragmented' | 'pressure' | 'invalid';

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

function isScenario(value: unknown): value is Scenario {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.inputGb)
    && value.inputGb > 0
    && isFiniteNumber(value.dimensionGb)
    && value.dimensionGb >= 0
    && isFiniteNumber(value.baseShuffleFactor)
    && value.baseShuffleFactor >= 0
    && isFiniteNumber(value.naturalHotKeyPercent)
    && value.naturalHotKeyPercent >= 0
    && typeof value.supportsBroadcast === 'boolean';
}

function isStrategy(value: unknown): value is Strategy {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && (value.mode === 'shuffle' || value.mode === 'broadcast')
    && isFiniteNumber(value.shuffleMultiplier)
    && value.shuffleMultiplier >= 0
    && isFiniteNumber(value.skewReduction)
    && value.skewReduction >= 0
    && Array.isArray(value.supportedScenarioIds)
    && value.supportedScenarioIds.every((id) => typeof id === 'string');
}

function isPartitionShuffleModel(
  value: unknown,
): value is PartitionShuffleModel {
  if (
    !isRecord(value)
    || !isRecord(value.targetPartitionMb)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
  ) {
    return false;
  }

  const target = value.targetPartitionMb;
  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'spark-partition-shuffle'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.broadcastLimitGb)
    && value.broadcastLimitGb > 0
    && isFiniteNumber(target.min)
    && isFiniteNumber(target.max)
    && target.min > 0
    && target.min < target.max
    && typeof defaults.scenarioId === 'string'
    && typeof defaults.strategyId === 'string'
    && isFiniteNumber(defaults.shufflePartitions)
    && isFiniteNumber(defaults.totalSlots)
    && isFiniteNumber(defaults.hotKeyPercent)
    && isBound(bounds.shufflePartitions)
    && isBound(bounds.totalSlots)
    && isBound(bounds.hotKeyPercent)
    && Array.isArray(value.scenarios)
    && value.scenarios.length >= 3
    && value.scenarios.every(isScenario)
    && value.scenarios.some((item) => item.id === defaults.scenarioId)
    && Array.isArray(value.strategies)
    && value.strategies.length >= 3
    && value.strategies.every(isStrategy)
    && value.strategies.some((item) => item.id === defaults.strategyId)
    && typeof value.notice === 'string';
}

export default function SparkPartitionShuffleLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PartitionShuffleModel | null>(null);
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
        if (!isPartitionShuffleModel(payload)) {
          throw new Error('The Spark partition model is incomplete.');
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
            : 'Unable to load the Spark partition model.',
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

  return <PartitionShuffleWorkbench model={model} />;
}

function PartitionShuffleWorkbench({
  model,
}: {
  model: PartitionShuffleModel;
}) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [shufflePartitions, setShufflePartitions] = useState(
    model.defaults.shufflePartitions,
  );
  const [totalSlots, setTotalSlots] = useState(model.defaults.totalSlots);
  const [hotKeyPercent, setHotKeyPercent] = useState(
    model.defaults.hotKeyPercent,
  );

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const strategy =
    model.strategies.find((item) => item.id === strategyId) ?? model.strategies[0];

  const result = useMemo(() => {
    const strategySupported = strategy.supportedScenarioIds.includes(scenario.id);
    const broadcastTooLarge =
      strategy.mode === 'broadcast'
      && scenario.dimensionGb > model.broadcastLimitGb;
    const valid = strategySupported && !broadcastTooLarge;
    const executorCount = Math.max(1, Math.ceil(totalSlots / 8));
    const observedHotKeyPercent = Math.max(
      hotKeyPercent,
      scenario.naturalHotKeyPercent,
    );
    const effectiveHotKeyPercent =
      strategy.mode === 'shuffle'
        ? observedHotKeyPercent * strategy.skewReduction
        : 0;
    const dataMovedGb =
      strategy.mode === 'broadcast'
        ? scenario.dimensionGb * executorCount
        : scenario.inputGb
          * scenario.baseShuffleFactor
          * strategy.shuffleMultiplier;
    const taskInputGb =
      strategy.mode === 'broadcast' ? scenario.inputGb : dataMovedGb;
    const averagePartitionMb = (taskInputGb * 1024) / shufflePartitions;
    const regularShare = (100 - effectiveHotKeyPercent) / 100;
    const hotPartitionMb =
      strategy.mode === 'broadcast'
        ? averagePartitionMb
        : dataMovedGb
          * 1024
          * (
            effectiveHotKeyPercent / 100
            + regularShare / shufflePartitions
          );
    const taskWaves = Math.ceil(shufflePartitions / totalSlots);
    const skewRatio = averagePartitionMb > 0
      ? hotPartitionMb / averagePartitionMb
      : 1;

    let verdict: Verdict = 'healthy';
    if (!valid) {
      verdict = 'invalid';
    } else if (
      hotPartitionMb > model.targetPartitionMb.max * 4
      || averagePartitionMb > model.targetPartitionMb.max * 2
    ) {
      verdict = 'pressure';
    } else if (
      averagePartitionMb < model.targetPartitionMb.min
      && taskWaves >= 4
    ) {
      verdict = 'fragmented';
    } else if (
      averagePartitionMb > model.targetPartitionMb.max
      || hotPartitionMb > model.targetPartitionMb.max
    ) {
      verdict = 'pressure';
    }

    return {
      averagePartitionMb,
      broadcastTooLarge,
      dataMovedGb,
      effectiveHotKeyPercent,
      executorCount,
      hotPartitionMb,
      observedHotKeyPercent,
      skewRatio,
      strategySupported,
      taskWaves,
      valid,
      verdict,
    };
  }, [
    hotKeyPercent,
    model.broadcastLimitGb,
    model.targetPartitionMb,
    scenario,
    shufflePartitions,
    strategy,
    totalSlots,
  ]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setStrategyId(model.defaults.strategyId);
    setShufflePartitions(model.defaults.shufflePartitions);
    setTotalSlots(model.defaults.totalSlots);
    setHotKeyPercent(model.defaults.hotKeyPercent);
  }

  const verdictContent = getVerdictContent(
    result,
    scenario,
    strategy,
    model,
  );

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Stage planning lab"
          title={model.title}
          description={model.description}
          icon={ArrowRightLeft}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose a data shape">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.supportsBroadcast ? RadioTower : Activity}
                    accent={item.id === 'skewed-aggregation' ? 'amber' : 'blue'}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose the exchange plan">
                {model.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === strategy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.mode === 'broadcast' ? RadioTower : Network}
                    accent={item.id === 'salted-shuffle' ? 'violet' : 'cyan'}
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Shuffle or task partitions"
                value={shufflePartitions}
                output={shufflePartitions.toLocaleString()}
                min={model.bounds.shufflePartitions.min}
                max={model.bounds.shufflePartitions.max}
                step={model.bounds.shufflePartitions.step}
                accent="violet"
                lowLabel="Larger tasks"
                highLabel="More scheduling units"
                onChange={setShufflePartitions}
              />

              <LabRange
                label="Available task slots"
                value={totalSlots}
                output={totalSlots.toLocaleString()}
                min={model.bounds.totalSlots.min}
                max={model.bounds.totalSlots.max}
                step={model.bounds.totalSlots.step}
                accent="blue"
                lowLabel="Narrow cluster"
                highLabel="Wide cluster"
                onChange={setTotalSlots}
              />

              <LabRange
                label="Largest logical key share"
                value={hotKeyPercent}
                output={`${hotKeyPercent}%`}
                min={model.bounds.hotKeyPercent.min}
                max={model.bounds.hotKeyPercent.max}
                step={model.bounds.hotKeyPercent.step}
                accent="amber"
                lowLabel="Broadly distributed"
                highLabel="Dominant key"
                onChange={setHotKeyPercent}
              />
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <VerdictPanel
              verdict={result.verdict}
              title={verdictContent.title}
              detail={verdictContent.detail}
            />

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Data movement"
                value={formatStorageFromGb(result.dataMovedGb)}
                detail={
                  strategy.mode === 'broadcast'
                    ? `${formatStorageFromGb(scenario.dimensionGb)} x ${result.executorCount} modeled executors`
                    : 'Estimated exchange output'
                }
                icon={Network}
                tone={result.valid ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Average partition"
                value={formatStorageFromMb(result.averagePartitionMb)}
                detail={`${shufflePartitions.toLocaleString()} scheduling units`}
                icon={Boxes}
                tone={
                  result.averagePartitionMb < model.targetPartitionMb.min
                    ? 'amber'
                    : result.averagePartitionMb > model.targetPartitionMb.max
                      ? 'rose'
                      : 'emerald'
                }
              />
              <LabMetric
                label="Hottest partition"
                value={formatStorageFromMb(result.hotPartitionMb)}
                detail={`${result.skewRatio.toFixed(1)}x the average`}
                icon={Activity}
                tone={result.skewRatio > 4 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Task waves"
                value={`${result.taskWaves}`}
                detail={`${totalSlots} slots at peak concurrency`}
                icon={Layers3}
                tone={result.taskWaves > 8 ? 'amber' : 'violet'}
              />
            </div>

            <PartitionPressure
              averageMb={result.averagePartitionMb}
              hotMb={result.hotPartitionMb}
              targetMaxMb={model.targetPartitionMb.max}
              isBroadcast={strategy.mode === 'broadcast'}
            />

            <section className="grid gap-3 md:grid-cols-3">
              <PlanStep
                number="1"
                title="Read and project"
                detail={`${formatStorageFromGb(scenario.inputGb)} logical input`}
                active
              />
              <PlanStep
                number="2"
                title={
                  strategy.mode === 'broadcast'
                    ? 'Broadcast bounded side'
                    : 'Exchange by key'
                }
                detail={
                  result.valid
                    ? `${formatStorageFromGb(result.dataMovedGb)} modeled movement`
                    : 'Plan cannot satisfy this data shape'
                }
                active={result.valid}
              />
              <PlanStep
                number="3"
                title="Run downstream tasks"
                detail={
                  result.valid
                    ? `${shufflePartitions.toLocaleString()} tasks over ${result.taskWaves} waves`
                    : 'Blocked until the strategy changes'
                }
                active={result.valid}
              />
            </section>

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

function getVerdictContent(
  result: {
    averagePartitionMb: number;
    broadcastTooLarge: boolean;
    effectiveHotKeyPercent: number;
    hotPartitionMb: number;
    observedHotKeyPercent: number;
    strategySupported: boolean;
    taskWaves: number;
    verdict: Verdict;
  },
  scenario: Scenario,
  strategy: Strategy,
  model: PartitionShuffleModel,
) {
  if (!result.strategySupported) {
    return {
      title: `${strategy.label} does not implement this operation`,
      detail:
        strategy.mode === 'broadcast'
          ? 'A group-by still needs records with the same key to meet. There is no bounded dimension side to copy to every executor.'
          : 'This plan changes the aggregation key and is not a valid substitute for the selected join contract.',
    };
  }

  if (result.broadcastTooLarge) {
    return {
      title: 'The projected dimension exceeds the broadcast safety limit',
      detail: `${formatStorageFromGb(scenario.dimensionGb)} is above the modeled ${formatStorageFromGb(model.broadcastLimitGb)} limit. Use a shuffle join or reduce and re-measure the dimension before forcing a broadcast.`,
    };
  }

  if (result.verdict === 'pressure') {
    return {
      title: 'The slowest partition controls this stage',
      detail: `The hottest task receives about ${formatStorageFromMb(result.hotPartitionMb)}. ${strategy.id === 'salted-shuffle' ? 'Salting reduces the dominant key, but the remaining bucket is still large.' : 'More cluster slots do not split that task unless the key distribution changes.'}`,
    };
  }

  if (result.verdict === 'fragmented') {
    return {
      title: 'The stage is divided into many small scheduling units',
      detail: `The average task has ${formatStorageFromMb(result.averagePartitionMb)} and the stage needs ${result.taskWaves} waves. Coalescing can reduce scheduling and output-file overhead if it preserves enough parallelism.`,
    };
  }

  return {
    title:
      strategy.mode === 'broadcast'
        ? 'The large side stays partition-local'
        : 'Average and peak partitions fit the modeled envelope',
    detail:
      strategy.mode === 'broadcast'
        ? 'The dimension is inside the reviewed bound, so the join avoids a key-based shuffle of the fact table. Validate executor memory with its actual in-memory size.'
        : `The effective hot-key share is ${result.effectiveHotKeyPercent.toFixed(1)}% from an observed ${result.observedHotKeyPercent}% concentration. Verify the same shape in task-level metrics.`,
  };
}

function VerdictPanel({
  verdict,
  title,
  detail,
}: {
  verdict: Verdict;
  title: string;
  detail: string;
}) {
  const healthy = verdict === 'healthy';
  const tone =
    verdict === 'invalid' || verdict === 'pressure'
      ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
      : verdict === 'fragmented'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
        : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';
  const Icon = healthy ? CheckCircle2 : TriangleAlert;

  return (
    <section className={`rounded-md border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">
            Stage verdict
          </p>
          <h4 className="mt-1 text-lg font-semibold">{title}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </section>
  );
}

function PartitionPressure({
  averageMb,
  hotMb,
  targetMaxMb,
  isBroadcast,
}: {
  averageMb: number;
  hotMb: number;
  targetMaxMb: number;
  isBroadcast: boolean;
}) {
  const maximum = Math.max(hotMb, targetMaxMb);
  const width = (value: number) =>
    `${Math.max(2, Math.min(100, (value / maximum) * 100))}%`;

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Partition pressure
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
            The maximum task, not the average, closes the stage
          </h4>
        </div>
        <Gauge aria-hidden="true" className="h-5 w-5 text-neutral-400" />
      </div>

      <div className="mt-5 space-y-4">
        <PressureBar
          label="Average task"
          value={formatStorageFromMb(averageMb)}
          width={width(averageMb)}
          tone="bg-blue-500 dark:bg-blue-400"
        />
        <PressureBar
          label={isBroadcast ? 'Largest input task' : 'Hot-key reducer'}
          value={formatStorageFromMb(hotMb)}
          width={width(hotMb)}
          tone={
            hotMb > targetMaxMb
              ? 'bg-rose-500 dark:bg-rose-400'
              : 'bg-emerald-500 dark:bg-emerald-400'
          }
        />
        <PressureBar
          label="Modeled target ceiling"
          value={formatStorageFromMb(targetMaxMb)}
          width={width(targetMaxMb)}
          tone="bg-neutral-400 dark:bg-neutral-500"
          dashed
        />
      </div>
    </section>
  );
}

function PressureBar({
  label,
  value,
  width,
  tone,
  dashed = false,
}: {
  label: string;
  value: string;
  width: string;
  tone: string;
  dashed?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">
          {label}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
          {value}
        </span>
      </div>
      <div
        className={`h-3 overflow-hidden rounded-sm ${
          dashed
            ? 'border border-dashed border-neutral-400 bg-transparent dark:border-neutral-600'
            : 'bg-neutral-200 dark:bg-neutral-800'
        }`}
      >
        {!dashed ? (
          <div
            className={`h-full rounded-sm transition-[width] duration-300 motion-reduce:transition-none ${tone}`}
            style={{ width }}
          />
        ) : null}
      </div>
    </div>
  );
}

function PlanStep({
  number,
  title,
  detail,
  active,
}: {
  number: string;
  title: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border p-4 ${
        active
          ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            active
              ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950'
              : 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950'
          }`}
        >
          {number}
        </span>
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
            {title}
          </h5>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {detail}
          </p>
        </div>
      </div>
    </div>
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
          eyebrow="Stage planning lab"
          title="Loading the Spark stage model"
          description="The lesson is loading its co-located partition and shuffle contract."
          icon={ArrowRightLeft}
          accent="amber"
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
                  className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:bg-white dark:text-neutral-950"
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
                Loading stage model...
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatStorageFromGb(value: number) {
  if (value >= 100) return `${Math.round(value).toLocaleString()} GiB`;
  if (value >= 10) return `${value.toFixed(1)} GiB`;
  return `${value.toFixed(2)} GiB`;
}

function formatStorageFromMb(value: number) {
  if (value >= 1024) return formatStorageFromGb(value / 1024);
  if (value >= 100) return `${Math.round(value).toLocaleString()} MiB`;
  return `${value.toFixed(1)} MiB`;
}
