'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  Hash,
  Layers3,
  LoaderCircle,
  Server,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/cockroachdb-range-distribution-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/cockroachdb/data/range-distribution-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type DistributionMode = 'append-tail' | 'randomized' | 'hash-sharded';

type KeyStrategy = {
  id: string;
  label: string;
  detail: string;
  distributionMode: DistributionMode;
  bucketCount: number;
  orderedScanFanout: number;
  tradeoff: string;
};

type RangeDistributionModel = {
  kind: 'cockroachdb-range-distribution';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  rangeCapacityWritesPerSecond: number;
  nodeCapacityWritesPerSecond: number;
  defaults: {
    strategyId: string;
    rangeCount: number;
    nodeCount: number;
    writesPerSecond: number;
  };
  bounds: {
    rangeCount: Bound;
    nodeCount: Bound;
    writesPerSecond: Bound;
  };
  strategies: KeyStrategy[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
  return value === 'append-tail'
    || value === 'randomized'
    || value === 'hash-sharded';
}

function isKeyStrategy(value: unknown): value is KeyStrategy {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isDistributionMode(value.distributionMode)
    && isFiniteNumber(value.bucketCount)
    && value.bucketCount >= 0
    && isFiniteNumber(value.orderedScanFanout)
    && value.orderedScanFanout >= 0
    && isNonEmptyString(value.tradeoff);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isRangeDistributionModel(
  value: unknown,
): value is RangeDistributionModel {
  if (
    !isRecord(value)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'cockroachdb-range-distribution'
    && value.blockId === BLOCK_ID
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.description)
    && isFiniteNumber(value.rangeCapacityWritesPerSecond)
    && value.rangeCapacityWritesPerSecond > 0
    && isFiniteNumber(value.nodeCapacityWritesPerSecond)
    && value.nodeCapacityWritesPerSecond > 0
    && isNonEmptyString(defaults.strategyId)
    && isFiniteNumber(defaults.rangeCount)
    && isFiniteNumber(defaults.nodeCount)
    && isFiniteNumber(defaults.writesPerSecond)
    && isBound(bounds.rangeCount)
    && isBound(bounds.nodeCount)
    && isBound(bounds.writesPerSecond)
    && Array.isArray(value.strategies)
    && value.strategies.length === 3
    && value.strategies.every(isKeyStrategy)
    && hasUniqueIds(value.strategies)
    && value.strategies.some(
      (strategy) => strategy.id === defaults.strategyId,
    )
    && isNonEmptyString(value.notice);
}

function buildRangeLoads(
  strategy: KeyStrategy,
  rangeCount: number,
  writesPerSecond: number,
): number[] {
  if (strategy.distributionMode === 'append-tail') {
    return Array.from(
      { length: rangeCount },
      (_, index) => (index === rangeCount - 1 ? writesPerSecond : 0),
    );
  }

  const activeRangeCount = strategy.distributionMode === 'hash-sharded'
    ? Math.min(rangeCount, strategy.bucketCount)
    : rangeCount;
  const activeIndexes = new Set(
    Array.from(
      { length: activeRangeCount },
      (_, index) => Math.min(
        rangeCount - 1,
        Math.floor((index * rangeCount) / activeRangeCount),
      ),
    ),
  );
  const weights = Array.from({ length: rangeCount }, (_, index) => {
    if (!activeIndexes.has(index)) return 0;
    return 1 + ((((index * 7) % 5) - 2) * 0.05);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) =>
    totalWeight === 0 ? 0 : (writesPerSecond * weight) / totalWeight);
}

export default function CockroachDBRangeDistributionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RangeDistributionModel | null>(null);
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
        if (!isRangeDistributionModel(payload)) {
          throw new Error('The range-distribution model is incomplete.');
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
            : 'Unable to load the range-distribution model.',
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

  return <RangeDistributionWorkbench model={model} />;
}

function RangeDistributionWorkbench({
  model,
}: {
  model: RangeDistributionModel;
}) {
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [rangeCount, setRangeCount] = useState(model.defaults.rangeCount);
  const [nodeCount, setNodeCount] = useState(model.defaults.nodeCount);
  const [writesPerSecond, setWritesPerSecond] = useState(
    model.defaults.writesPerSecond,
  );

  const strategy =
    model.strategies.find((item) => item.id === strategyId)
    ?? model.strategies[0];

  const result = useMemo(() => {
    const rangeLoads = buildRangeLoads(strategy, rangeCount, writesPerSecond);
    const hottestRange = Math.max(...rangeLoads);
    const activeRanges = rangeLoads.filter((load) => load > 0).length;
    const averageNodeLoad = writesPerSecond / nodeCount;
    const rangePressure =
      hottestRange / model.rangeCapacityWritesPerSecond;
    const nodePressure =
      averageNodeLoad / model.nodeCapacityWritesPerSecond;
    const pressure = Math.max(rangePressure, nodePressure);
    const healthy = pressure <= 1;
    const headroomPercent = Math.round((1 - pressure) * 100);
    const bottleneck = rangePressure >= nodePressure
      ? 'hottest range'
      : 'average node';

    return {
      activeRanges,
      averageNodeLoad,
      bottleneck,
      headroomPercent,
      healthy,
      hottestRange,
      rangeLoads,
      rangePressure,
    };
  }, [
    model.nodeCapacityWritesPerSecond,
    model.rangeCapacityWritesPerSecond,
    nodeCount,
    rangeCount,
    strategy,
    writesPerSecond,
  ]);

  function reset() {
    setStrategyId(model.defaults.strategyId);
    setRangeCount(model.defaults.rangeCount);
    setNodeCount(model.defaults.nodeCount);
    setWritesPerSecond(model.defaults.writesPerSecond);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Range pressure lab"
          title={model.title}
          description={model.description}
          icon={BarChart3}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Primary key shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.distributionMode === 'hash-sharded'
                        ? Hash
                        : Database}
                      accent="blue"
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Ranges"
                  value={rangeCount}
                  output={`${rangeCount}`}
                  min={model.bounds.rangeCount.min}
                  max={model.bounds.rangeCount.max}
                  step={model.bounds.rangeCount.step}
                  lowLabel="Few ownership slices"
                  highLabel="More ownership slices"
                  accent="blue"
                  onChange={setRangeCount}
                />
                <LabRange
                  label="Nodes"
                  value={nodeCount}
                  output={`${nodeCount}`}
                  min={model.bounds.nodeCount.min}
                  max={model.bounds.nodeCount.max}
                  step={model.bounds.nodeCount.step}
                  lowLabel="Small cluster"
                  highLabel="More hosts"
                  accent="violet"
                  onChange={setNodeCount}
                />
                <LabRange
                  label="Peak writes"
                  value={writesPerSecond}
                  output={`${writesPerSecond.toLocaleString()}/s`}
                  min={model.bounds.writesPerSecond.min}
                  max={model.bounds.writesPerSecond.max}
                  step={model.bounds.writesPerSecond.step}
                  lowLabel="Steady"
                  highLabel="Pressure"
                  accent="amber"
                  onChange={setWritesPerSecond}
                />
              </div>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Hottest range"
                value={`${Math.round(result.hottestRange).toLocaleString()}/s`}
                detail={`${Math.round(result.rangePressure * 100)}% of the illustrative range budget`}
                icon={Gauge}
                tone={result.rangePressure > 1 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Average node"
                value={`${Math.round(result.averageNodeLoad).toLocaleString()}/s`}
                detail={`${nodeCount} nodes share the cluster average`}
                icon={Server}
                tone="violet"
              />
              <LabMetric
                label="Active write ranges"
                value={`${result.activeRanges} of ${rangeCount}`}
                detail="Ranges receiving part of this modeled peak"
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Ordered scan"
                value={strategy.orderedScanFanout === 0
                  ? 'Needs an index'
                  : `${strategy.orderedScanFanout} range${strategy.orderedScanFanout === 1 ? '' : 's'}`}
                detail="Maximum modeled branches for logical key order"
                icon={Activity}
                tone="amber"
              />
            </div>

            <RangePressureMap
              loads={result.rangeLoads}
              capacity={model.rangeCapacityWritesPerSecond}
            />

            <div
              role="status"
              className={`rounded-md border p-4 ${
                result.healthy
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.healthy ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                ) : (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold">
                    {result.healthy
                      ? `${result.headroomPercent}% modeled headroom remains`
                      : `${Math.abs(result.headroomPercent)}% over the ${result.bottleneck} budget`}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {strategy.tradeoff}
                  </p>
                </div>
              </div>
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

function RangePressureMap({
  loads,
  capacity,
}: {
  loads: number[];
  capacity: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            Write pressure by key range
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Each column is one contiguous ownership range.
          </p>
        </div>
        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          Red crosses {capacity.toLocaleString()}/s
        </span>
      </div>

      <div
        className="mt-5 grid h-40 items-end gap-1 border-b border-neutral-300 dark:border-neutral-700"
        style={{
          gridTemplateColumns: `repeat(${loads.length}, minmax(0, 1fr))`,
        }}
        aria-label="Modeled writes per second for each range"
      >
        {loads.map((load, index) => {
          const pressure = load / capacity;
          const height = load === 0
            ? 4
            : Math.min(100, Math.max(12, pressure * 82));
          const overloaded = pressure > 1;

          return (
            <div
              key={`${index}-${loads.length}`}
              className={`min-w-0 rounded-t-sm transition-[height] motion-reduce:transition-none ${
                overloaded
                  ? 'bg-rose-500 dark:bg-rose-400'
                  : load > 0
                    ? 'bg-blue-500 dark:bg-blue-400'
                    : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
              style={{ height: `${height}%` }}
              title={`Range ${index + 1}: ${Math.round(load).toLocaleString()} writes/s`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>Low keys</span>
        <span>High keys</span>
      </div>
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
          eyebrow="Range pressure lab"
          title="Map the active write frontier"
          description="Loading key strategies, range limits, and workload controls."
          icon={BarChart3}
          accent="blue"
        />
        <LearningLabBody>
          <div
            role={error ? 'alert' : 'status'}
            className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-900/60"
          >
            {error ? (
              <div>
                <AlertTriangle
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-500"
                />
                <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
                  The range model could not be loaded
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                <LoaderCircle
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 animate-spin text-blue-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  Loading the range model...
                </p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
