'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  Database,
  Gauge,
  GitBranch,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Network,
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

type Bound = {
  min: number;
  max: number;
  step: number;
};

type StrategyId = 'regular' | 'skewed' | 'replicated';

type Strategy = {
  id: StrategyId;
  label: string;
  detail: string;
  resultRule: string;
};

type ShuffleSkewData = {
  title: string;
  description: string;
  modelNote: string;
  dataset: {
    largeInputGiB: number;
    mapTasks: number;
  };
  defaults: {
    strategyId: StrategyId;
    reducers: number;
    hotKeyPct: number;
    smallSideMiB: number;
    taskMemoryMiB: number;
  };
  bounds: {
    reducers: Bound;
    hotKeyPct: Bound;
    smallSideMiB: Bound;
    taskMemoryMiB: Bound;
  };
  thresholds: {
    imbalanceWarning: number;
    imbalanceSevere: number;
    replicatedMaxMiB: number;
    memorySafetyFraction: number;
    skewTargetMultiple: number;
    skewSamplingOverheadPct: number;
  };
  strategies: Strategy[];
};

const BLOCK_ID = 'technology/pig-shuffle-skew-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/pig/data/shuffle-skew-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return Boolean(
    isFiniteNumber(candidate.min)
      && isFiniteNumber(candidate.max)
      && isFiniteNumber(candidate.step)
      && candidate.min < candidate.max
      && candidate.step > 0,
  );
}

function isShuffleSkewData(value: unknown): value is ShuffleSkewData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ShuffleSkewData>;
  const defaults = candidate.defaults;
  const thresholds = candidate.thresholds;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && candidate.dataset
      && isFiniteNumber(candidate.dataset.largeInputGiB)
      && candidate.dataset.largeInputGiB > 0
      && isFiniteNumber(candidate.dataset.mapTasks)
      && defaults
      && ['regular', 'skewed', 'replicated'].includes(defaults.strategyId)
      && isFiniteNumber(defaults.reducers)
      && isFiniteNumber(defaults.hotKeyPct)
      && isFiniteNumber(defaults.smallSideMiB)
      && isFiniteNumber(defaults.taskMemoryMiB)
      && isBound(candidate.bounds?.reducers)
      && isBound(candidate.bounds?.hotKeyPct)
      && isBound(candidate.bounds?.smallSideMiB)
      && isBound(candidate.bounds?.taskMemoryMiB)
      && thresholds
      && isFiniteNumber(thresholds.imbalanceWarning)
      && isFiniteNumber(thresholds.imbalanceSevere)
      && isFiniteNumber(thresholds.replicatedMaxMiB)
      && isFiniteNumber(thresholds.memorySafetyFraction)
      && isFiniteNumber(thresholds.skewTargetMultiple)
      && isFiniteNumber(thresholds.skewSamplingOverheadPct)
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length === 3
      && candidate.strategies.every((strategy) => (
        ['regular', 'skewed', 'replicated'].includes(strategy.id)
        && typeof strategy.label === 'string'
        && typeof strategy.detail === 'string'
        && typeof strategy.resultRule === 'string'
      )),
  );
}

function formatGiB(value: number) {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} TiB`;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} GiB`;
}

export default function PigShuffleSkewLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ShuffleSkewData | null>(null);
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
        if (!isShuffleSkewData(payload)) {
          throw new Error('The Pig shuffle/skew model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the shuffle/skew model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadingState
          error={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : (
        <ShuffleSkewWorkbench data={data} />
      )}
    </div>
  );
}

function ShuffleSkewWorkbench({ data }: { data: ShuffleSkewData }) {
  const [strategyId, setStrategyId] = useState<StrategyId>(data.defaults.strategyId);
  const [reducers, setReducers] = useState(data.defaults.reducers);
  const [hotKeyPct, setHotKeyPct] = useState(data.defaults.hotKeyPct);
  const [smallSideMiB, setSmallSideMiB] = useState(data.defaults.smallSideMiB);
  const [taskMemoryMiB, setTaskMemoryMiB] = useState(data.defaults.taskMemoryMiB);

  const strategy = (
    data.strategies.find((candidate) => candidate.id === strategyId)
    ?? data.strategies[0]
  );

  const model = useMemo(() => {
    const smallSideGiB = smallSideMiB / 1024;
    const regularShuffleGiB = data.dataset.largeInputGiB + smallSideGiB;
    const meanReducerGiB = regularShuffleGiB / reducers;
    const hotGiB = regularShuffleGiB * hotKeyPct / 100;
    const coldGiB = regularShuffleGiB - hotGiB;
    const coldPerReducerGiB = coldGiB / reducers;
    const replicatedMemoryLimitMiB = Math.min(
      data.thresholds.replicatedMaxMiB,
      taskMemoryMiB * data.thresholds.memorySafetyFraction,
    );
    const replicatedFits = smallSideMiB <= replicatedMemoryLimitMiB;

    let loads: number[] = [];
    let shuffleGiB = regularShuffleGiB;
    let hotPartitions = 1;

    if (strategy.id === 'regular') {
      loads = Array.from({ length: reducers }, () => coldPerReducerGiB);
      const hotReducer = Math.floor(reducers * 0.42);
      loads[hotReducer] += hotGiB;
    } else if (strategy.id === 'skewed') {
      const targetGiB = meanReducerGiB * data.thresholds.skewTargetMultiple;
      hotPartitions = Math.min(
        reducers,
        Math.max(2, Math.ceil(hotGiB / targetGiB)),
      );
      loads = Array.from({ length: reducers }, (_, index) => (
        coldPerReducerGiB + (index < hotPartitions ? hotGiB / hotPartitions : 0)
      ));
      shuffleGiB *= 1 + data.thresholds.skewSamplingOverheadPct / 100;
    }

    const busiestReducerGiB = loads.length > 0 ? Math.max(...loads) : 0;
    const imbalance = loads.length > 0 ? busiestReducerGiB / meanReducerGiB : 0;
    const topLoads = loads
      .map((loadGiB, index) => ({ id: index + 1, loadGiB }))
      .sort((left, right) => right.loadGiB - left.loadGiB)
      .slice(0, Math.min(8, loads.length));

    let verdict = 'The hash join has an acceptable modeled tail';
    let detail = 'No single reducer is far above the mean in this bounded distribution.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (strategy.id === 'replicated') {
      verdict = replicatedFits
        ? 'The small side fits the replicated-join contract'
        : 'The small side exceeds the safe replication envelope';
      detail = replicatedFits
        ? 'The large relation can stay map-side for this join, while the small relation is localized to tasks.'
        : `The modeled limit is ${Math.round(replicatedMemoryLimitMiB)} MiB after applying both the configured cap and task-memory headroom.`;
      tone = replicatedFits ? 'emerald' : 'rose';
    } else if (imbalance >= data.thresholds.imbalanceSevere) {
      verdict = 'One reducer determines the completion time';
      detail = 'Adding reducers lowers the mean, but the equal hot key still has one owner in a regular hash partition.';
      tone = 'rose';
    } else if (imbalance >= data.thresholds.imbalanceWarning) {
      verdict = strategy.id === 'skewed'
        ? 'Skew handling reduces, but does not erase, the hot-key tail'
        : 'Reducer load is materially imbalanced';
      detail = strategy.id === 'skewed'
        ? `The teaching model spreads the hot key across ${hotPartitions} specialized partitions and adds sampling overhead.`
        : 'Measure key frequencies and compare regular, skewed, or correctness-preserving salting strategies.';
      tone = 'amber';
    } else if (strategy.id === 'skewed') {
      verdict = 'The specialized plan contains the modeled hot key';
      detail = `The hot key is spread across ${hotPartitions} specialized partitions, with explicit sampling overhead.`;
    }

    return {
      busiestReducerGiB,
      detail,
      hotGiB,
      hotPartitions,
      imbalance,
      meanReducerGiB,
      regularShuffleGiB,
      replicatedFits,
      replicatedMemoryLimitMiB,
      shuffleGiB: strategy.id === 'replicated' ? 0 : shuffleGiB,
      smallSideGiB,
      tone,
      topLoads,
      verdict,
    };
  }, [
    data,
    hotKeyPct,
    reducers,
    smallSideMiB,
    strategy.id,
    taskMemoryMiB,
  ]);

  function reset() {
    setStrategyId(data.defaults.strategyId);
    setReducers(data.defaults.reducers);
    setHotKeyPct(data.defaults.hotKeyPct);
    setSmallSideMiB(data.defaults.smallSideMiB);
    setTaskMemoryMiB(data.defaults.taskMemoryMiB);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Partition and skew lab"
        title={data.title}
        description={data.description}
        icon={GitBranch}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Join strategy
              </legend>
              <div className="mt-3 grid gap-2">
                {data.strategies.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === strategy.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={candidate.id === 'replicated' ? Database : Network}
                    accent={candidate.id === 'regular'
                      ? 'blue'
                      : candidate.id === 'skewed'
                        ? 'amber'
                        : 'emerald'}
                    onClick={() => setStrategyId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Reducers (regular/skewed)"
                value={reducers}
                output={`${reducers}`}
                {...data.bounds.reducers}
                lowLabel="Larger partitions"
                highLabel="More task/file overhead"
                accent="blue"
                onChange={setReducers}
              />
              <LabRange
                label="Largest key share"
                value={hotKeyPct}
                output={`${hotKeyPct}%`}
                {...data.bounds.hotKeyPct}
                lowLabel="Evener keys"
                highLabel="Hot key"
                accent="rose"
                onChange={setHotKeyPct}
              />
              <LabRange
                label="Small-side serialized size"
                value={smallSideMiB}
                output={`${smallSideMiB} MiB`}
                {...data.bounds.smallSideMiB}
                lowLabel="Compact lookup"
                highLabel="Replication risk"
                accent="violet"
                onChange={setSmallSideMiB}
              />
              <LabRange
                label="Task memory"
                value={taskMemoryMiB}
                output={`${taskMemoryMiB} MiB`}
                {...data.bounds.taskMemoryMiB}
                lowLabel="Tight heap"
                highLabel="More headroom"
                accent="emerald"
                onChange={setTaskMemoryMiB}
              />
            </div>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className={`rounded-md border p-5 ${verdictClasses[model.tone]}`}>
            <div className="flex items-start gap-3">
              {model.tone === 'emerald' ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Join consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">{model.verdict}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{model.detail}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Large relation"
              value={formatGiB(data.dataset.largeInputGiB)}
              detail={`${data.dataset.mapTasks} modeled map tasks`}
              icon={HardDrive}
              tone="blue"
            />
            <LabMetric
              label="Reduce-side shuffle"
              value={formatGiB(model.shuffleGiB)}
              detail={strategy.id === 'replicated'
                ? 'Small side still must be distributed'
                : strategy.id === 'skewed'
                  ? `includes ${data.thresholds.skewSamplingOverheadPct}% teaching overhead`
                  : 'both join inputs'}
              icon={Network}
              tone={model.shuffleGiB > 400 ? 'amber' : 'cyan'}
            />
            <LabMetric
              label="Busiest reducer"
              value={strategy.id === 'replicated'
                ? 'Not used'
                : formatGiB(model.busiestReducerGiB)}
              detail={strategy.id === 'replicated'
                ? 'Map-side join path'
                : `${model.imbalance.toFixed(1)}x the mean`}
              icon={Gauge}
              tone={model.imbalance >= data.thresholds.imbalanceSevere ? 'rose' : 'violet'}
            />
            <LabMetric
              label="Replicated memory"
              value={`${Math.round(model.replicatedMemoryLimitMiB)} MiB`}
              detail={`${smallSideMiB} MiB selected small side`}
              icon={MemoryStick}
              tone={model.replicatedFits ? 'emerald' : 'rose'}
            />
          </div>

          {strategy.id === 'replicated' ? (
            <ReplicatedMemoryView
              selectedMiB={smallSideMiB}
              safeMiB={model.replicatedMemoryLimitMiB}
              taskMemoryMiB={taskMemoryMiB}
            />
          ) : (
            <ReducerLoadView
              loads={model.topLoads}
              meanGiB={model.meanReducerGiB}
              busiestGiB={model.busiestReducerGiB}
              reducerCount={reducers}
              hotKeyPct={hotKeyPct}
              hotPartitions={model.hotPartitions}
              skewed={strategy.id === 'skewed'}
            />
          )}

          <div className="border-l-4 border-neutral-400 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-100">
            <p className="text-sm font-semibold">{strategy.resultRule}</p>
            <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
              {data.modelNote}
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ReducerLoadView({
  loads,
  meanGiB,
  busiestGiB,
  reducerCount,
  hotKeyPct,
  hotPartitions,
  skewed,
}: {
  loads: Array<{ id: number; loadGiB: number }>;
  meanGiB: number;
  busiestGiB: number;
  reducerCount: number;
  hotKeyPct: number;
  hotPartitions: number;
  skewed: boolean;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Busiest reducer partitions
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            Top {loads.length} of {reducerCount}; mean is {formatGiB(meanGiB)}
          </p>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {skewed
            ? `${hotKeyPct}% key spread across ${hotPartitions} specialized partitions`
            : `${hotKeyPct}% key remains on one partition`}
        </p>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {loads.map((load) => (
          <li
            key={load.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 bg-white px-3 py-2 dark:bg-neutral-950"
          >
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              R{load.id}
            </span>
            <span className="h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
              <span
                className={`block h-full transition-[width] duration-200 motion-reduce:transition-none ${
                  load.loadGiB > meanGiB * 2 ? 'bg-rose-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.max(4, load.loadGiB / busiestGiB * 100)}%` }}
              />
            </span>
            <span className="text-right text-xs font-semibold tabular-nums text-neutral-950 dark:text-white">
              {formatGiB(load.loadGiB)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReplicatedMemoryView({
  selectedMiB,
  safeMiB,
  taskMemoryMiB,
}: {
  selectedMiB: number;
  safeMiB: number;
  taskMemoryMiB: number;
}) {
  const usedPct = Math.min(100, selectedMiB / taskMemoryMiB * 100);
  const safePct = Math.min(100, safeMiB / taskMemoryMiB * 100);
  const fits = selectedMiB <= safeMiB;

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Per-task memory contract
      </p>
      <div className="mt-4 h-6 overflow-hidden rounded-sm border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div
          className={`h-full transition-[width] duration-200 motion-reduce:transition-none ${
            fits ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-500 sm:flex-row sm:justify-between dark:text-neutral-400">
        <span>{selectedMiB} MiB selected ({usedPct.toFixed(0)}% of task memory)</span>
        <span className="text-right">
          Safe teaching envelope: {Math.round(safeMiB)} MiB ({safePct.toFixed(0)}%)
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        A replicated join removes reducer ownership from this join, not memory ownership.
        The localized relation shares the task process with Pig operators, buffers, UDFs,
        and runtime overhead.
      </p>
    </section>
  );
}

function LoadingState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Partition and skew lab"
        title="Diagnose a hot-key join"
        description="Loading partition, memory, and join-strategy data."
        icon={GitBranch}
        accent="amber"
      />
      <LearningLabBody>
        <div
          role={error ? 'alert' : 'status'}
          className="flex min-h-40 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <div>
            {error ? (
              <CircleAlert
                aria-hidden="true"
                className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400"
              />
            ) : (
              <LoaderCircle
                aria-hidden="true"
                className="mx-auto h-6 w-6 animate-spin text-amber-600 motion-reduce:animate-none dark:text-amber-400"
              />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading reducer and memory scenarios...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

const verdictClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
};
