'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  Database,
  Gauge,
  KeyRound,
  LoaderCircle,
  Network,
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

const BLOCK_ID = 'technology/replication-sharding-key-distribution-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/replication-sharding/data/key-distribution-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type DistributionMode = 'append-range' | 'single-owner' | 'bucketed-owner';

type ShardKeyStrategy = {
  id: string;
  label: string;
  detail: string;
  distributionMode: DistributionMode;
  bucketCount: number;
  rangeLocality: string;
  rebalanceNote: string;
};

type KeyDistributionModel = {
  kind: 'replication-sharding-key-distribution';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  shardCapacityWritesPerSecond: number;
  defaults: {
    strategyId: string;
    shardCount: number;
    writesPerSecond: number;
    hottestKeyPercent: number;
  };
  bounds: {
    shardCount: Bound;
    writesPerSecond: Bound;
    hottestKeyPercent: Bound;
  };
  strategies: ShardKeyStrategy[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isDistributionMode(value: unknown): value is DistributionMode {
  return value === 'append-range'
    || value === 'single-owner'
    || value === 'bucketed-owner';
}

function isStrategy(value: unknown): value is ShardKeyStrategy {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isDistributionMode(value.distributionMode)
    && isFiniteNumber(value.bucketCount)
    && value.bucketCount >= 1
    && typeof value.rangeLocality === 'string'
    && typeof value.rebalanceNote === 'string';
}

function isKeyDistributionModel(value: unknown): value is KeyDistributionModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.bounds)) {
    return false;
  }
  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'replication-sharding-key-distribution'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isFiniteNumber(value.shardCapacityWritesPerSecond)
    && value.shardCapacityWritesPerSecond > 0
    && typeof defaults.strategyId === 'string'
    && isFiniteNumber(defaults.shardCount)
    && isFiniteNumber(defaults.writesPerSecond)
    && isFiniteNumber(defaults.hottestKeyPercent)
    && isBound(bounds.shardCount)
    && isBound(bounds.writesPerSecond)
    && isBound(bounds.hottestKeyPercent)
    && Array.isArray(value.strategies)
    && value.strategies.length === 3
    && value.strategies.every(isStrategy)
    && value.strategies.some(
      (strategy) => strategy.id === defaults.strategyId,
    )
    && typeof value.notice === 'string';
}

function distributeTraffic(
  strategy: ShardKeyStrategy,
  shardCount: number,
  hottestKeyPercent: number,
) {
  const hotShare = hottestKeyPercent / 100;

  if (strategy.distributionMode === 'append-range') {
    const activeRangeShare = Math.min(0.94, 0.55 + hotShare * 0.55);
    const backgroundShare = (1 - activeRangeShare) / (shardCount - 1);
    return Array.from(
      { length: shardCount },
      (_, index) => index === shardCount - 1 ? activeRangeShare : backgroundShare,
    );
  }

  if (strategy.distributionMode === 'single-owner') {
    const hottestShare = Math.max(hotShare, 1 / shardCount);
    const backgroundShare = (1 - hottestShare) / (shardCount - 1);
    return Array.from(
      { length: shardCount },
      (_, index) => index === 0 ? hottestShare : backgroundShare,
    );
  }

  const bucketCount = Math.min(strategy.bucketCount, shardCount);
  const baseShare = (1 - hotShare) / shardCount;
  return Array.from(
    { length: shardCount },
    (_, index) => baseShare + (index < bucketCount ? hotShare / bucketCount : 0),
  );
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export default function ReplicationShardingKeyDistributionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<KeyDistributionModel | null>(null);
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
        if (!isKeyDistributionModel(payload)) {
          throw new Error('The shard-key distribution model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the shard-key distribution model.',
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

  return <KeyDistributionWorkbench model={model} />;
}

function KeyDistributionWorkbench({ model }: { model: KeyDistributionModel }) {
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [shardCount, setShardCount] = useState(model.defaults.shardCount);
  const [writesPerSecond, setWritesPerSecond] = useState(
    model.defaults.writesPerSecond,
  );
  const [hottestKeyPercent, setHottestKeyPercent] = useState(
    model.defaults.hottestKeyPercent,
  );

  const strategy =
    model.strategies.find((item) => item.id === strategyId) ?? model.strategies[0];

  const result = useMemo(() => {
    const shares = distributeTraffic(strategy, shardCount, hottestKeyPercent);
    const writesByShard = shares.map((share) => share * writesPerSecond);
    const hottestWrites = Math.max(...writesByShard);
    const hottestIndex = writesByShard.indexOf(hottestWrites);
    const utilization = hottestWrites / model.shardCapacityWritesPerSecond;
    const queryFanout = strategy.distributionMode === 'bucketed-owner'
      ? Math.min(strategy.bucketCount, shardCount)
      : 1;

    return {
      hottestIndex,
      hottestWrites,
      queryFanout,
      utilization,
      writesByShard,
    };
  }, [
    hottestKeyPercent,
    model.shardCapacityWritesPerSecond,
    shardCount,
    strategy,
    writesPerSecond,
  ]);

  function reset() {
    setStrategyId(model.defaults.strategyId);
    setShardCount(model.defaults.shardCount);
    setWritesPerSecond(model.defaults.writesPerSecond);
    setHottestKeyPercent(model.defaults.hottestKeyPercent);
  }

  const state = result.utilization > 1
    ? 'overloaded'
    : result.utilization > 0.75
      ? 'thin'
      : 'healthy';
  const StateIcon = state === 'healthy' ? CheckCircle2 : TriangleAlert;
  const stateTone = state === 'healthy' ? 'emerald' : state === 'thin' ? 'amber' : 'rose';
  const stateTitle = state === 'healthy'
    ? 'The hottest shard keeps operating headroom'
    : state === 'thin'
      ? 'The design fits, but a small skew change removes headroom'
      : 'Adding shards did not remove the hotspot';
  const stateExplanation = state === 'healthy'
    ? `The hottest shard receives about ${numberFormatter.format(result.hottestWrites)} writes/s, below the modeled ${numberFormatter.format(model.shardCapacityWritesPerSecond)} writes/s limit.`
    : state === 'thin'
      ? `The hottest shard is at ${Math.round(result.utilization * 100)}% of its modeled write limit. Rebalance and traffic bursts still need reserved capacity.`
      : `The hottest shard receives ${numberFormatter.format(result.hottestWrites)} writes/s against a modeled ${numberFormatter.format(model.shardCapacityWritesPerSecond)} writes/s limit. The key shape, not average cluster capacity, is the bottleneck.`;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard-key pressure lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the routing key
                </legend>
                <div className="mt-3 space-y-2">
                  {model.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.distributionMode === 'bucketed-owner' ? Boxes : KeyRound}
                      accent={item.distributionMode === 'bucketed-owner' ? 'violet' : 'blue'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Logical shards"
                value={shardCount}
                output={`${shardCount}`}
                min={model.bounds.shardCount.min}
                max={model.bounds.shardCount.max}
                step={model.bounds.shardCount.step}
                accent="cyan"
                lowLabel="Fewer owners"
                highLabel="More owners"
                onChange={setShardCount}
              />

              <LabRange
                label="Total writes per second"
                value={writesPerSecond}
                output={numberFormatter.format(writesPerSecond)}
                min={model.bounds.writesPerSecond.min}
                max={model.bounds.writesPerSecond.max}
                step={model.bounds.writesPerSecond.step}
                accent="blue"
                lowLabel="Steady"
                highLabel="Peak"
                onChange={setWritesPerSecond}
              />

              <LabRange
                label="Writes concentrated by key or time"
                value={hottestKeyPercent}
                output={`${hottestKeyPercent}%`}
                min={model.bounds.hottestKeyPercent.min}
                max={model.bounds.hottestKeyPercent.max}
                step={model.bounds.hottestKeyPercent.step}
                accent="amber"
                lowLabel="Broadly spread"
                highLabel="Dominant key or tail"
                onChange={setHottestKeyPercent}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Hottest shard"
                value={`${numberFormatter.format(result.hottestWrites)} writes/s`}
                detail={`Shard ${result.hottestIndex + 1} of ${shardCount}`}
                icon={Activity}
                tone={stateTone}
              />
              <LabMetric
                label="Peak utilization"
                value={`${Math.round(result.utilization * 100)}%`}
                detail={`${numberFormatter.format(model.shardCapacityWritesPerSecond)} writes/s modeled limit`}
                icon={Gauge}
                tone={stateTone}
              />
              <LabMetric
                label="Point-read fan-out"
                value={`${result.queryFanout} ${result.queryFanout === 1 ? 'shard' : 'shards'}`}
                detail={strategy.rangeLocality}
                icon={Network}
                tone={result.queryFanout === 1 ? 'emerald' : 'violet'}
              />
              <LabMetric
                label="Average load"
                value={`${numberFormatter.format(writesPerSecond / shardCount)} writes/s`}
                detail="Averages can hide the hottest owner"
                icon={Database}
                tone="neutral"
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Write distribution by shard
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Bar height is the share of peak writes. The warning line is each
                    shard&apos;s modeled write limit.
                  </p>
                </div>
                <Boxes
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-neutral-400"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                {result.writesByShard.map((writes, index) => {
                  const pressure = writes / model.shardCapacityWritesPerSecond;
                  const isHot = index === result.hottestIndex;
                  return (
                    <div
                      key={index}
                      className="flex min-h-36 min-w-0 flex-col justify-end rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <span className="mb-2 block truncate text-center text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                        {numberFormatter.format(writes)}
                      </span>
                      <div className="flex h-20 items-end rounded-sm bg-white p-1 dark:bg-neutral-950">
                        <div
                          className={`w-full rounded-sm ${
                            pressure > 1
                              ? 'bg-rose-500'
                              : isHot
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                          }`}
                          style={{ height: `${Math.max(5, Math.min(100, pressure * 100))}%` }}
                          role="img"
                          aria-label={`Shard ${index + 1}: ${numberFormatter.format(writes)} writes per second, ${Math.round(pressure * 100)} percent utilized`}
                        />
                      </div>
                      <span className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
                        Shard {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className={`rounded-md border p-4 ${
                state === 'healthy'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : state === 'thin'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">{stateTitle}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-85">{stateExplanation}</p>
                  <p className="mt-2 text-xs leading-5 opacity-75">
                    Rebalancing consequence: {strategy.rebalanceNote}
                  </p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
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
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard-key pressure lab"
          title="How evenly will the routing key distribute writes?"
          description="Loading key strategies, workload bounds, and shard capacity."
          icon={KeyRound}
          accent="blue"
        />
        <div className="flex min-h-48 items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center">
              <TriangleAlert
                aria-hidden="true"
                className="mx-auto h-6 w-6 text-rose-500"
              />
              <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
              Loading distribution model
            </div>
          )}
        </div>
      </LearningLab>
    </div>
  );
}
