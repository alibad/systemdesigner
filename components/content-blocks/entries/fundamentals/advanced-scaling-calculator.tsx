'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  Hash,
  KeyRound,
  Network,
  RefreshCw,
  Route,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };

type PlacementStrategy = {
  id: string;
  label: string;
  detail: string;
  queryFanout: number;
  localityPercent: number;
  baseShares: number[];
  consequence: string;
};

type PlacementModel = {
  shardCount: number;
  shardCapacityQps: number;
  defaults: {
    strategyId: string;
    peakQps: number;
    largestTenantShare: number;
  };
  bounds: {
    peakQps: Bound;
    largestTenantShare: Bound;
  };
  strategies: PlacementStrategy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/advanced-scaling/data/shard-placement-model.json';

function formatQps(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1000)}k/s`;
}

function distributeRemainder(dominantShare: number, shardCount: number, dominantIndex: number) {
  const remainderShare = (100 - dominantShare) / shardCount;
  return Array.from({ length: shardCount }, (_, index) =>
    index === dominantIndex ? dominantShare + remainderShare : remainderShare,
  );
}

function strategyIcon(strategyId: string) {
  if (strategyId === 'tenant-hash') return UsersRound;
  if (strategyId === 'order-hash') return Hash;
  if (strategyId === 'time-range') return Clock3;
  return Route;
}

export default function AdvancedScalingCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PlacementModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [strategyId, setStrategyId] = useState('');
  const [peakQps, setPeakQps] = useState(0);
  const [largestTenantShare, setLargestTenantShare] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<PlacementModel>;
      })
      .then((model) => {
        if (model.strategies.length < 2 || model.shardCount < 2) {
          throw new Error('The placement model does not contain enough strategies or shards.');
        }
        setData(model);
        setStrategyId(model.defaults.strategyId);
        setPeakQps(model.defaults.peakQps);
        setLargestTenantShare(model.defaults.largestTenantShare);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load placement data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const strategy =
      data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
    let shares = strategy.baseShares;

    if (strategy.id === 'tenant-hash') {
      shares = distributeRemainder(largestTenantShare, data.shardCount, 1);
    } else if (strategy.id === 'directory') {
      const dominantShare = Math.max(largestTenantShare, 27);
      const otherShare = (100 - dominantShare) / (data.shardCount - 1);
      shares = Array.from({ length: data.shardCount }, (_, index) =>
        index === 1 ? dominantShare : otherShare,
      );
    }

    const loads = shares.map((share) => Math.round(peakQps * (share / 100)));
    const hottestQps = Math.max(...loads);
    const hottestIndex = loads.indexOf(hottestQps);
    const hottestShare = shares[hottestIndex];
    const balancedQps = peakQps / data.shardCount;
    const imbalance = hottestQps / balancedQps;
    const overloaded = hottestQps > data.shardCapacityQps;
    const skewed = hottestShare >= 45;
    const scaleMax = Math.max(data.shardCapacityQps * 1.18, hottestQps * 1.08);
    const result = overloaded
      ? `Shard ${hottestIndex + 1} exceeds the ${formatQps(data.shardCapacityQps)} planning limit. ${strategy.consequence}`
      : skewed
        ? `Shard ${hottestIndex + 1} carries ${hottestShare.toFixed(0)}% of demand. ${strategy.consequence}`
        : strategy.consequence;

    return {
      balancedQps,
      hottestIndex,
      hottestQps,
      hottestShare,
      imbalance,
      loads,
      overloaded,
      result,
      scaleMax,
      shares,
      skewed,
      strategy,
    };
  }, [data, largestTenantShare, peakQps, strategyId]);

  function reset() {
    if (!data) return;
    setStrategyId(data.defaults.strategyId);
    setPeakQps(data.defaults.peakQps);
    setLargestTenantShare(data.defaults.largestTenantShare);
  }

  return (
    <div data-content-block="fundamentals/advanced-scaling-calculator">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard placement workbench"
          title="Make distribution and locality compete in public"
          description="Choose a placement rule, then change demand and tenant skew. The same workload can be balanced for writes yet expensive to query, or local to query yet impossible to split."
          icon={KeyRound}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {loadError ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Placement data could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Loading placement model...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Placement rule
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.strategies.map((strategy) => (
                      <LabChoice
                        key={strategy.id}
                        selected={strategy.id === view.strategy.id}
                        label={strategy.label}
                        detail={strategy.detail}
                        icon={strategyIcon(strategy.id)}
                        accent={strategy.id === 'time-range' ? 'amber' : strategy.id === 'order-hash' ? 'violet' : 'cyan'}
                        onClick={() => setStrategyId(strategy.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Peak write demand"
                  value={peakQps}
                  output={formatQps(peakQps)}
                  {...data.bounds.peakQps}
                  accent="blue"
                  lowLabel="40k/s"
                  highLabel="180k/s"
                  onChange={setPeakQps}
                />

                <LabRange
                  label="Largest tenant share"
                  value={largestTenantShare}
                  output={`${largestTenantShare}%`}
                  {...data.bounds.largestTenantShare}
                  accent="amber"
                  lowLabel="similar tenants"
                  highLabel="dominant tenant"
                  onChange={setLargestTenantShare}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Busiest shard"
                  value={formatQps(view.hottestQps)}
                  detail={`Shard ${view.hottestIndex + 1} receives ${view.hottestShare.toFixed(0)}% of writes.`}
                  icon={Gauge}
                  tone={view.overloaded ? 'rose' : view.skewed ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Balanced baseline"
                  value={formatQps(view.balancedQps)}
                  detail="Total demand divided equally across four owners."
                  icon={Network}
                  tone="blue"
                />
                <LabMetric
                  label="Imbalance"
                  value={`${view.imbalance.toFixed(2)}x`}
                  detail="Hottest owner divided by the balanced baseline."
                  icon={TriangleAlert}
                  tone={view.imbalance > 1.75 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Tenant query fanout"
                  value={`${view.strategy.queryFanout} shard${view.strategy.queryFanout === 1 ? '' : 's'}`}
                  detail={`${view.strategy.localityPercent}% of modeled tenant work stays local.`}
                  icon={UsersRound}
                  tone={view.strategy.queryFanout === 1 ? 'emerald' : 'violet'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Per-shard write pressure
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      The vertical marker is the {formatQps(data.shardCapacityQps)} planning limit.
                    </p>
                  </div>
                  <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    Total {formatQps(peakQps)}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {view.loads.map((load, index) => {
                    const loadWidth = Math.max(2, (load / view.scaleMax) * 100);
                    const limitPosition = (data.shardCapacityQps / view.scaleMax) * 100;
                    const overloaded = load > data.shardCapacityQps;
                    return (
                      <div key={`shard-${index + 1}`}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                            Shard {index + 1}
                          </span>
                          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                            {formatQps(load)} · {view.shares[index].toFixed(0)}%
                          </span>
                        </div>
                        <div
                          className="relative h-7 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
                          role="img"
                          aria-label={`Shard ${index + 1}: ${formatQps(load)}, ${view.shares[index].toFixed(0)} percent${overloaded ? ', above limit' : ''}`}
                        >
                          <div
                            className={`h-full rounded-sm transition-[width] duration-200 motion-reduce:transition-none ${
                              overloaded
                                ? 'bg-rose-500 dark:bg-rose-600'
                                : index === view.hottestIndex
                                  ? 'bg-amber-400 dark:bg-amber-500'
                                  : 'bg-cyan-400 dark:bg-cyan-600'
                            }`}
                            style={{ width: `${Math.min(loadWidth, 100)}%` }}
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-y-0 w-0.5 bg-neutral-800 dark:bg-white"
                            style={{ left: `${limitPosition}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className={`mt-5 rounded-md border p-4 ${
                  view.overloaded
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                    : view.skewed
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {view.overloaded || view.skewed ? (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {view.overloaded
                        ? 'The owner is beyond its planning envelope'
                        : view.skewed
                          ? 'Fleet averages hide concentrated pressure'
                          : 'The model fits with a visible trade-off'}
                    </p>
                    <p className="mt-1 text-sm leading-6 opacity-85">{view.result}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
