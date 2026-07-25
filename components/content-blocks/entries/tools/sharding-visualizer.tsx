'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Database,
  Gauge,
  HardDrive,
  KeyRound,
  Layers3,
  Network,
  Route,
  Server,
  ShieldCheck,
  Shuffle,
  TimerReset,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StrategyId = 'hash' | 'range' | 'directory';
type KeyShape = 'uniform' | 'tenant-skew' | 'sequential';
type ReadRoute = 'primary' | 'nearest-replica';
type RebalanceMode = 'cautious' | 'balanced' | 'fast';
type ScenarioId =
  | 'baseline'
  | 'hot-key'
  | 'skew'
  | 'shard-loss'
  | 'resharding'
  | 'replica-lag'
  | 'recovery';
type Tone = 'healthy' | 'warning' | 'critical';

type Strategy = {
  id: StrategyId;
  label: string;
  routing: string;
  strength: string;
  risk: string;
  rangeQuery: string;
  expansion: string;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Activity;
};

type ShardResult = {
  id: number;
  keyCount: number;
  dataSharePct: number;
  trafficRps: number;
  utilizationPct: number;
  headroomPct: number;
  status: 'healthy' | 'hot' | 'lost' | 'moving' | 'recovering';
  lagMs: number;
};

type Model = {
  shards: ShardResult[];
  readRps: number;
  writeRps: number;
  availabilityPct: number;
  headroomPct: number;
  busiestShard: number;
  hottestSharePct: number;
  imbalanceRatio: number;
  movementPct: number;
  movementGb: number;
  movementMinutes: number;
  replicaLagMs: number;
  staleReadRisk: boolean;
  readPath: string;
  writePath: string;
  routeLatencyMs: number;
  consequence: string;
  consequenceDetail: string;
  tone: Tone;
  lostShard: number | null;
};

const STRATEGIES: Strategy[] = [
  {
    id: 'hash',
    label: 'Hash',
    routing: 'hash(key) mod shard count',
    strength: 'Spreads high-cardinality keys without a lookup service.',
    risk: 'One hot key still maps to one owner; range reads fan out.',
    rangeQuery: 'Scatter-gather',
    expansion: 'High movement with simple modulo hashing',
  },
  {
    id: 'range',
    label: 'Range',
    routing: 'ordered boundary lookup',
    strength: 'Keeps adjacent keys together for ordered scans.',
    risk: 'Sequential keys concentrate new writes on the tail shard.',
    rangeQuery: 'Targeted',
    expansion: 'Split selected ranges',
  },
  {
    id: 'directory',
    label: 'Directory',
    routing: 'key-to-owner metadata lookup',
    strength: 'Supports explicit tenant placement and targeted moves.',
    risk: 'The directory is a latency and availability dependency.',
    rangeQuery: 'Depends on mapping',
    expansion: 'Move selected buckets or tenants',
  },
];

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: 'Healthy baseline',
    shortLabel: 'Baseline',
    description: 'Balanced keys, normal routing, and all replicas caught up.',
    icon: CheckCircle2,
  },
  {
    id: 'hot-key',
    label: 'Hot key',
    shortLabel: 'Hot key',
    description: 'One key receives most traffic even when bytes look balanced.',
    icon: Zap,
  },
  {
    id: 'skew',
    label: 'Tenant skew',
    shortLabel: 'Skew',
    description: 'One tenant owns a disproportionate share of keys and requests.',
    icon: Gauge,
  },
  {
    id: 'shard-loss',
    label: 'Shard loss',
    shortLabel: 'Shard loss',
    description: 'A primary disappears and the system must fail over or lose a range.',
    icon: AlertTriangle,
  },
  {
    id: 'resharding',
    label: 'Online reshard',
    shortLabel: 'Resharding',
    description: 'Add one owner while production reads and writes continue.',
    icon: Shuffle,
  },
  {
    id: 'replica-lag',
    label: 'Replica lag',
    shortLabel: 'Replica lag',
    description: 'Write pressure outruns replica apply capacity.',
    icon: TimerReset,
  },
  {
    id: 'recovery',
    label: 'Recovery catch-up',
    shortLabel: 'Recovery',
    description: 'A restored shard replays missed writes before it is fully healthy.',
    icon: ShieldCheck,
  },
];

const REBALANCE_MODES: Record<
  RebalanceMode,
  { label: string; detail: string; capacityFactor: number; throughputMb: number }
> = {
  cautious: {
    label: 'Cautious',
    detail: 'Protect foreground traffic; move data slowly.',
    capacityFactor: 0.9,
    throughputMb: 35,
  },
  balanced: {
    label: 'Balanced',
    detail: 'Reserve a moderate migration budget.',
    capacityFactor: 0.78,
    throughputMb: 90,
  },
  fast: {
    label: 'Fast',
    detail: 'Finish sooner at higher latency risk.',
    capacityFactor: 0.62,
    throughputMb: 180,
  },
};

const DEFAULTS = {
  strategy: 'hash' as StrategyId,
  keyShape: 'uniform' as KeyShape,
  shardCount: 4,
  totalKeys: 4_000_000,
  trafficRps: 12_000,
  writePct: 30,
  replicationFactor: 2,
  readRoute: 'nearest-replica' as ReadRoute,
  rebalanceMode: 'balanced' as RebalanceMode,
  scenario: 'baseline' as ScenarioId,
};

const SHARD_CAPACITY_UNITS = 5_200;
const BYTES_PER_KEY = 1_200;

function normalize(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

function weightedDistribution(
  strategy: StrategyId,
  keyShape: KeyShape,
  shardCount: number,
  scenario: ScenarioId,
) {
  const weights = Array.from({ length: shardCount }, () => 1);

  if (keyShape === 'tenant-skew') {
    weights[0] = strategy === 'directory' ? shardCount * 1.9 : shardCount * 3.2;
  }

  if (keyShape === 'sequential' && strategy === 'range') {
    weights[shardCount - 1] = shardCount * 4;
  }

  if (keyShape === 'sequential' && strategy === 'directory') {
    weights[shardCount - 1] = shardCount * 1.6;
  }

  if (scenario === 'skew') {
    weights[0] += shardCount * (strategy === 'directory' ? 2 : 4.5);
  }

  return normalize(weights);
}

function trafficDistribution(
  dataWeights: number[],
  strategy: StrategyId,
  scenario: ScenarioId,
) {
  if (scenario === 'hot-key') {
    const hotIndex = strategy === 'range' ? dataWeights.length - 1 : 0;
    return dataWeights.map((_, index) =>
      index === hotIndex ? 0.62 : 0.38 / (dataWeights.length - 1),
    );
  }

  if (scenario === 'skew') {
    return dataWeights.map((_, index) =>
      index === 0 ? 0.56 : 0.44 / (dataWeights.length - 1),
    );
  }

  return dataWeights;
}

function allocateWhole(total: number, weights: number[]) {
  const values = weights.map((weight) => Math.floor(total * weight));
  const remainder = total - values.reduce((sum, value) => sum + value, 0);
  values[0] += remainder;
  return values;
}

function expansionMovementPct(strategy: StrategyId, shardCount: number) {
  if (strategy === 'hash') {
    return (shardCount / (shardCount + 1)) * 100;
  }

  if (strategy === 'range') {
    return 100 / (shardCount + 1);
  }

  return Math.max(8, 75 / (shardCount + 1));
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 99 ? 2 : 1)}%`;
}

function statusStyles(status: ShardResult['status']) {
  switch (status) {
    case 'lost':
      return {
        card: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35',
        bar: 'bg-rose-500',
        label: 'Unavailable',
        labelClass: 'text-rose-700 dark:text-rose-300',
      };
    case 'hot':
      return {
        card: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35',
        bar: 'bg-amber-500',
        label: 'Hot',
        labelClass: 'text-amber-800 dark:text-amber-200',
      };
    case 'moving':
      return {
        card: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/35',
        bar: 'bg-violet-500',
        label: 'Moving keys',
        labelClass: 'text-violet-700 dark:text-violet-300',
      };
    case 'recovering':
      return {
        card: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/35',
        bar: 'bg-blue-500',
        label: 'Catching up',
        labelClass: 'text-blue-700 dark:text-blue-300',
      };
    default:
      return {
        card: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
        bar: 'bg-emerald-500',
        label: 'Healthy',
        labelClass: 'text-emerald-700 dark:text-emerald-300',
      };
  }
}

function consequenceFor(
  scenario: ScenarioId,
  replicationFactor: number,
  readRoute: ReadRoute,
  availabilityPct: number,
  headroomPct: number,
  replicaLagMs: number,
): Pick<Model, 'consequence' | 'consequenceDetail' | 'tone'> {
  const overloaded = headroomPct < 0;

  if (scenario === 'hot-key') {
    return {
      consequence: overloaded ? 'One owner throttles healthy-looking traffic' : 'The hot key consumes the safety margin',
      consequenceDetail:
        'Adding shards does not split a single key. Salt the key, cache it, or isolate that workload.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (scenario === 'skew') {
    return {
      consequence: overloaded ? 'Large-tenant requests queue behind one owner' : 'Capacity is stranded on quieter shards',
      consequenceDetail:
        'Measure traffic per key, not only bytes per shard, before choosing a split or tenant isolation policy.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (scenario === 'shard-loss') {
    if (replicationFactor === 1) {
      return {
        consequence: `${formatPercent(100 - availabilityPct)} of requests lose their owner`,
        consequenceDetail:
          'No replica can be promoted. Reads and writes for that key range fail until the primary returns.',
        tone: 'critical',
      };
    }

    return {
      consequence: 'Replica promotion preserves the key range',
      consequenceDetail:
        'Availability survives, but reduced headroom and failover lag increase tail latency until a replacement replica is built.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (scenario === 'resharding') {
    return {
      consequence: overloaded ? 'Migration competes with foreground traffic' : 'Online movement stays inside the capacity budget',
      consequenceDetail:
        'Dual-read or forwarding rules must remain until every moved key has a single authoritative owner.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (scenario === 'replica-lag') {
    if (readRoute === 'nearest-replica') {
      return {
        consequence: `Nearest reads can trail writes by about ${replicaLagMs.toLocaleString()} ms`,
        consequenceDetail:
          'Users can briefly miss their own update. Route read-after-write traffic to the primary or attach a session watermark.',
        tone: 'critical',
      };
    }

    return {
      consequence: 'Primary reads stay current while replicas fall behind',
      consequenceDetail:
        'Consistency is preserved for users, but read traffic consumes primary headroom and weakens failover readiness.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (scenario === 'recovery') {
    return {
      consequence: overloaded ? 'Catch-up work extends the recovery window' : 'Service is available while redundancy rebuilds',
      consequenceDetail:
        'Keep the restored replica out of nearest-read rotation until replay lag reaches the promotion threshold.',
      tone: overloaded ? 'critical' : 'warning',
    };
  }

  if (overloaded) {
    return {
      consequence: 'The busiest shard exceeds tested capacity',
      consequenceDetail:
        'Average capacity is misleading: requests queue where the hottest key range is owned.',
      tone: 'critical',
    };
  }

  return {
    consequence: 'Every owner retains operating headroom',
    consequenceDetail:
      'The baseline is healthy, but test a hot key and shard loss before treating the design as production-ready.',
    tone: 'healthy',
  };
}

export default function ShardingVisualizer() {
  const [strategy, setStrategy] = useState<StrategyId>(DEFAULTS.strategy);
  const [keyShape, setKeyShape] = useState<KeyShape>(DEFAULTS.keyShape);
  const [shardCount, setShardCount] = useState(DEFAULTS.shardCount);
  const [totalKeys, setTotalKeys] = useState(DEFAULTS.totalKeys);
  const [trafficRps, setTrafficRps] = useState(DEFAULTS.trafficRps);
  const [writePct, setWritePct] = useState(DEFAULTS.writePct);
  const [replicationFactor, setReplicationFactor] = useState(
    DEFAULTS.replicationFactor,
  );
  const [readRoute, setReadRoute] = useState<ReadRoute>(DEFAULTS.readRoute);
  const [rebalanceMode, setRebalanceMode] = useState<RebalanceMode>(
    DEFAULTS.rebalanceMode,
  );
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULTS.scenario);

  const model = useMemo<Model>(() => {
    const dataWeights = weightedDistribution(
      strategy,
      keyShape,
      shardCount,
      scenario,
    );
    const trafficWeights = trafficDistribution(dataWeights, strategy, scenario);
    const keyCounts = allocateWhole(totalKeys, dataWeights);
    const readRps = trafficRps * (1 - writePct / 100);
    const writeRps = trafficRps - readRps;
    const readFanout = readRoute === 'nearest-replica' ? replicationFactor : 1;
    const lostIndex =
      scenario === 'shard-loss' || scenario === 'recovery'
        ? Math.min(1, shardCount - 1)
        : -1;
    const movementPct =
      scenario === 'resharding'
        ? expansionMovementPct(strategy, shardCount)
        : scenario === 'recovery'
          ? dataWeights[lostIndex] * 100
          : 0;
    const movementGb = (totalKeys * BYTES_PER_KEY * (movementPct / 100)) / 1e9;
    const rebalance = REBALANCE_MODES[rebalanceMode];
    const movementMinutes =
      movementGb > 0
        ? (movementGb * 1_000) / rebalance.throughputMb / 60
        : 0;
    const routeLatencyMs = strategy === 'directory' ? 1.8 : strategy === 'range' ? 0.6 : 0.3;

    let replicaLagMs =
      replicationFactor === 1
        ? 0
        : Math.round(12 + (writeRps / shardCount / 700) * 45 * (replicationFactor - 1));

    if (scenario === 'replica-lag') {
      replicaLagMs += Math.round(780 + writeRps / shardCount / 2);
    } else if (scenario === 'recovery') {
      replicaLagMs += Math.round(360 + writeRps / shardCount / 4);
    } else if (scenario === 'shard-loss' && replicationFactor > 1) {
      replicaLagMs += 140;
    }

    const shards = trafficWeights.map((trafficWeight, index): ShardResult => {
      const shardTrafficRps = trafficRps * trafficWeight;
      const shardReadRps = readRps * trafficWeight;
      const shardWriteRps = writeRps * trafficWeight;
      const loadUnits = shardWriteRps * 1.7 + shardReadRps / readFanout;
      const isLost = index === lostIndex && scenario === 'shard-loss';
      const isRecovering = index === lostIndex && scenario === 'recovery';
      let capacityFactor = 1;

      if (isLost) {
        capacityFactor = replicationFactor === 1 ? 0 : 0.72;
      } else if (scenario === 'resharding') {
        capacityFactor = rebalance.capacityFactor;
      } else if (isRecovering) {
        capacityFactor = 0.74;
      }

      const capacity = SHARD_CAPACITY_UNITS * capacityFactor;
      const utilizationPct =
        capacity === 0 ? 100 : (loadUnits / capacity) * 100;
      let status: ShardResult['status'] = 'healthy';

      if (isLost && replicationFactor === 1) {
        status = 'lost';
      } else if (isRecovering) {
        status = 'recovering';
      } else if (scenario === 'resharding' && index < 2) {
        status = 'moving';
      } else if (utilizationPct >= 85) {
        status = 'hot';
      }

      return {
        id: index + 1,
        keyCount: keyCounts[index],
        dataSharePct: dataWeights[index] * 100,
        trafficRps: shardTrafficRps,
        utilizationPct,
        headroomPct: 100 - utilizationPct,
        status,
        lagMs: isRecovering ? replicaLagMs : Math.round(replicaLagMs * (0.8 + index * 0.05)),
      };
    });

    const servedRps = shards.reduce((sum, shard) => {
      if (shard.status === 'lost') {
        return sum;
      }
      return sum + shard.trafficRps * Math.min(1, 100 / Math.max(100, shard.utilizationPct));
    }, 0);
    const availabilityPct = (servedRps / trafficRps) * 100;
    const headroomPct = Math.min(...shards.map((shard) => shard.headroomPct));
    const busiestShard = shards.reduce((busiest, shard) =>
      shard.utilizationPct > busiest.utilizationPct ? shard : busiest,
    ).id;
    const shares = shards.map((shard) => shard.trafficRps);
    const imbalanceRatio = Math.max(...shares) / Math.max(1, Math.min(...shares));
    const result = consequenceFor(
      scenario,
      replicationFactor,
      readRoute,
      availabilityPct,
      headroomPct,
      replicaLagMs,
    );

    return {
      shards,
      readRps,
      writeRps,
      availabilityPct,
      headroomPct,
      busiestShard,
      hottestSharePct: Math.max(...trafficWeights) * 100,
      imbalanceRatio,
      movementPct,
      movementGb,
      movementMinutes,
      replicaLagMs,
      staleReadRisk:
        readRoute === 'nearest-replica' && replicaLagMs >= 250,
      readPath:
        readRoute === 'primary'
          ? 'Client → router → owner primary'
          : `Client → router → nearest replica (RF ${replicationFactor})`,
      writePath:
        replicationFactor === 1
          ? 'Client → router → owner primary'
          : `Client → router → owner primary → ${replicationFactor - 1} replica${replicationFactor > 2 ? 's' : ''}`,
      routeLatencyMs,
      ...result,
      lostShard: lostIndex >= 0 ? lostIndex + 1 : null,
    };
  }, [
    keyShape,
    readRoute,
    rebalanceMode,
    replicationFactor,
    scenario,
    shardCount,
    strategy,
    totalKeys,
    trafficRps,
    writePct,
  ]);

  const currentStrategy = STRATEGIES.find((item) => item.id === strategy)!;
  const currentScenario = SCENARIOS.find((item) => item.id === scenario)!;
  const consequenceStyles: Record<Tone, string> = {
    healthy:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
    warning:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    critical:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
  };

  const reset = () => {
    setStrategy(DEFAULTS.strategy);
    setKeyShape(DEFAULTS.keyShape);
    setShardCount(DEFAULTS.shardCount);
    setTotalKeys(DEFAULTS.totalKeys);
    setTrafficRps(DEFAULTS.trafficRps);
    setWritePct(DEFAULTS.writePct);
    setReplicationFactor(DEFAULTS.replicationFactor);
    setReadRoute(DEFAULTS.readRoute);
    setRebalanceMode(DEFAULTS.rebalanceMode);
    setScenario(DEFAULTS.scenario);
  };

  return (
    <div data-content-block="tools/sharding-visualizer" className="not-prose min-w-0">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Sharding operations lab"
          title="Place keys, route traffic, then break a shard"
          description="A good shard plan balances ownership and request pressure while keeping failures and online movement inside a measured capacity budget."
          icon={Network}
          accent="cyan"
          onReset={reset}
        />

        <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-5 md:px-6 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Challenge the design
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                {currentScenario.description}
              </p>
            </div>
            <currentScenario.icon
              aria-hidden="true"
              className="h-6 w-6 shrink-0 text-cyan-700 dark:text-cyan-300"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {SCENARIOS.map((item) => {
              const Icon = item.icon;
              const selected = item.id === scenario;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScenario(item.id)}
                  className={`min-h-20 rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    selected
                      ? 'border-cyan-600 bg-cyan-100 text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-300 dark:bg-cyan-950 dark:text-white dark:ring-cyan-300'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <span className="mt-2 block text-xs font-semibold leading-4">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <LearningLabBody
          controls={
            <div className="space-y-8">
              <section aria-labelledby="placement-loop-heading">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-700 text-xs font-bold text-white dark:bg-cyan-300 dark:text-neutral-950">
                    1
                  </span>
                  <div>
                    <h4
                      id="placement-loop-heading"
                      className="text-sm font-semibold text-neutral-950 dark:text-white"
                    >
                      Place keys
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Change ownership and observe skew.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {STRATEGIES.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={strategy === item.id}
                      label={item.label}
                      detail={item.routing}
                      icon={item.id === 'hash' ? KeyRound : item.id === 'range' ? Route : Database}
                      accent="cyan"
                      onClick={() => setStrategy(item.id)}
                    />
                  ))}
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Key distribution
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        ['uniform', 'Uniform'],
                        ['tenant-skew', 'Tenant skew'],
                        ['sequential', 'Sequential'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={keyShape === id}
                        onClick={() => setKeyShape(id)}
                        className={`min-h-11 rounded-md border px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          keyShape === id
                            ? 'border-cyan-600 bg-cyan-100 text-cyan-950 dark:border-cyan-300 dark:bg-cyan-950 dark:text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5 space-y-5">
                  <LabRange
                    label="Shard count"
                    value={shardCount}
                    output={`${shardCount} owners`}
                    min={3}
                    max={8}
                    lowLabel="3"
                    highLabel="8"
                    accent="cyan"
                    onChange={setShardCount}
                  />
                  <LabRange
                    label="Stored keys"
                    value={totalKeys}
                    output={formatCompact(totalKeys)}
                    min={500_000}
                    max={10_000_000}
                    step={500_000}
                    lowLabel="500K"
                    highLabel="10M"
                    accent="cyan"
                    onChange={setTotalKeys}
                  />
                </div>
              </section>

              <section
                aria-labelledby="resilience-loop-heading"
                className="border-t border-neutral-200 pt-7 dark:border-neutral-800"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white dark:bg-violet-300 dark:text-neutral-950">
                    2
                  </span>
                  <div>
                    <h4
                      id="resilience-loop-heading"
                      className="text-sm font-semibold text-neutral-950 dark:text-white"
                    >
                      Route and recover
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Change pressure, redundancy, and movement.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <LabRange
                    label="Traffic"
                    value={trafficRps}
                    output={`${formatCompact(trafficRps)} req/s`}
                    min={3_000}
                    max={40_000}
                    step={1_000}
                    lowLabel="3K"
                    highLabel="40K req/s"
                    accent="violet"
                    onChange={setTrafficRps}
                  />
                  <LabRange
                    label="Write share"
                    value={writePct}
                    output={`${writePct}% writes`}
                    min={10}
                    max={80}
                    step={5}
                    lowLabel="Read-heavy"
                    highLabel="Write-heavy"
                    accent="violet"
                    onChange={setWritePct}
                  />
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Replication factor
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((factor) => (
                      <button
                        key={factor}
                        type="button"
                        aria-pressed={replicationFactor === factor}
                        onClick={() => setReplicationFactor(factor)}
                        className={`h-10 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          replicationFactor === factor
                            ? 'border-violet-600 bg-violet-100 text-violet-950 dark:border-violet-300 dark:bg-violet-950 dark:text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        RF {factor}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-5">
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Read path
                  </legend>
                  <div className="mt-2 space-y-2">
                    <LabChoice
                      selected={readRoute === 'primary'}
                      label="Owner primary"
                      detail="Current reads; less primary headroom."
                      icon={Server}
                      accent="violet"
                      onClick={() => setReadRoute('primary')}
                    />
                    <LabChoice
                      selected={readRoute === 'nearest-replica'}
                      label="Nearest replica"
                      detail="More read capacity; bounded-staleness risk."
                      icon={Layers3}
                      accent="violet"
                      onClick={() => setReadRoute('nearest-replica')}
                    />
                  </div>
                </fieldset>

                <fieldset className="mt-5">
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Rebalance budget
                  </legend>
                  <div className="mt-2 space-y-2">
                    {(Object.keys(REBALANCE_MODES) as RebalanceMode[]).map(
                      (mode) => (
                        <LabChoice
                          key={mode}
                          selected={rebalanceMode === mode}
                          label={REBALANCE_MODES[mode].label}
                          detail={REBALANCE_MODES[mode].detail}
                          icon={Shuffle}
                          accent="violet"
                          onClick={() => setRebalanceMode(mode)}
                        />
                      ),
                    )}
                  </div>
                </fieldset>
              </section>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Availability"
                value={formatPercent(model.availabilityPct)}
                detail="Modeled request success"
                icon={ShieldCheck}
                tone={model.availabilityPct >= 99.9 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Busiest headroom"
                value={`${model.headroomPct.toFixed(0)}%`}
                detail={`Shard ${model.busiestShard} sets the limit`}
                icon={Gauge}
                tone={model.headroomPct >= 20 ? 'emerald' : model.headroomPct >= 0 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Movement cost"
                value={
                  model.movementPct > 0
                    ? `${model.movementPct.toFixed(0)}%`
                    : `${expansionMovementPct(strategy, shardCount).toFixed(0)}% next`
                }
                detail={
                  model.movementPct > 0
                    ? `${model.movementGb.toFixed(2)} GB in about ${Math.max(1, model.movementMinutes).toFixed(0)} min`
                    : currentStrategy.expansion
                }
                icon={Shuffle}
                tone={model.movementPct > 45 ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Replica lag"
                value={
                  replicationFactor === 1
                    ? 'No replicas'
                    : `${model.replicaLagMs.toLocaleString()} ms`
                }
                detail={
                  model.staleReadRisk
                    ? 'Read-after-write risk'
                    : 'Inside the modeled threshold'
                }
                icon={TimerReset}
                tone={
                  replicationFactor === 1
                    ? 'neutral'
                    : model.replicaLagMs >= 250
                      ? 'amber'
                      : 'blue'
                }
              />
            </div>

            <section aria-labelledby="topology-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
                    Live topology
                  </p>
                  <h4
                    id="topology-heading"
                    className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                  >
                    Keys and requests converge on an owner
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Hottest shard receives {model.hottestSharePct.toFixed(0)}% of traffic
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="grid min-w-0 gap-4 md:grid-cols-[140px_28px_150px_28px_minmax(0,1fr)] md:items-center">
                  <div className="rounded-md border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
                    <Activity
                      aria-hidden="true"
                      className="h-5 w-5 text-blue-700 dark:text-blue-300"
                    />
                    <p className="mt-2 text-sm font-semibold text-blue-950 dark:text-blue-50">
                      Workload
                    </p>
                    <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                      {formatCompact(model.readRps)} reads/s
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      {formatCompact(model.writeRps)} writes/s
                    </p>
                  </div>

                  <div className="flex items-center justify-center text-neutral-400">
                    <ArrowRight aria-hidden="true" className="hidden h-5 w-5 md:block" />
                    <ArrowDown aria-hidden="true" className="h-5 w-5 md:hidden" />
                  </div>

                  <div className="rounded-md border border-cyan-300 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-950/40">
                    <Route
                      aria-hidden="true"
                      className="h-5 w-5 text-cyan-700 dark:text-cyan-300"
                    />
                    <p className="mt-2 text-sm font-semibold text-cyan-950 dark:text-cyan-50">
                      Router
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-800 dark:text-cyan-200">
                      {currentStrategy.routing}
                    </p>
                    <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-200">
                      +{model.routeLatencyMs.toFixed(1)} ms
                    </p>
                  </div>

                  <div className="flex items-center justify-center text-neutral-400">
                    <ArrowRight aria-hidden="true" className="hidden h-5 w-5 md:block" />
                    <ArrowDown aria-hidden="true" className="h-5 w-5 md:hidden" />
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {model.shards.map((shard) => {
                      const styles = statusStyles(shard.status);
                      return (
                        <article
                          key={shard.id}
                          className={`min-w-0 rounded-md border p-3 ${styles.card}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <HardDrive
                                  aria-hidden="true"
                                  className="h-4 w-4 shrink-0"
                                />
                                <h5 className="truncate text-sm font-semibold">
                                  Shard {shard.id}
                                </h5>
                              </div>
                              <p className="mt-1 text-xs opacity-75">
                                {formatCompact(shard.keyCount)} keys ·{' '}
                                {formatCompact(shard.trafficRps)} req/s
                              </p>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold uppercase ${styles.labelClass}`}
                            >
                              {styles.label}
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="opacity-70">Load</span>
                              <span className="font-semibold tabular-nums">
                                {shard.utilizationPct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${styles.bar}`}
                                style={{
                                  width: `${Math.min(100, shard.utilizationPct)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs opacity-75">
                            <span>{shard.dataSharePct.toFixed(0)}% of keys</span>
                            <span>RF {replicationFactor}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="paths-heading"
              className="grid gap-3 md:grid-cols-2"
            >
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/35">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                  <Route aria-hidden="true" className="h-4 w-4" />
                  Read path
                </div>
                <h4
                  id="paths-heading"
                  className="mt-2 text-sm font-semibold text-blue-950 dark:text-blue-50"
                >
                  {readRoute === 'primary' ? 'Current by default' : 'Faster, possibly stale'}
                </h4>
                <p className="mt-2 text-xs leading-5 text-blue-900 dark:text-blue-100">
                  {model.readPath}
                </p>
              </div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/35">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                  <Layers3 aria-hidden="true" className="h-4 w-4" />
                  Write path
                </div>
                <h4 className="mt-2 text-sm font-semibold text-violet-950 dark:text-violet-50">
                  One owner coordinates the write
                </h4>
                <p className="mt-2 text-xs leading-5 text-violet-900 dark:text-violet-100">
                  {model.writePath}
                </p>
              </div>
            </section>

            <section
              aria-live="polite"
              className={`rounded-lg border p-5 ${consequenceStyles[model.tone]}`}
            >
              <div className="flex items-start gap-3">
                {model.tone === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">
                    User-visible consequence
                  </p>
                  <h4 className="mt-1 text-base font-semibold">{model.consequence}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {model.consequenceDetail}
                  </p>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="strategy-heading"
              className="border-t border-neutral-200 pt-6 dark:border-neutral-800"
            >
              <div className="flex items-center gap-2">
                <Database
                  aria-hidden="true"
                  className="h-5 w-5 text-neutral-500 dark:text-neutral-400"
                />
                <h4
                  id="strategy-heading"
                  className="text-base font-semibold text-neutral-950 dark:text-white"
                >
                  No placement strategy wins every workload
                </h4>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {STRATEGIES.map((item) => {
                  const selected = strategy === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStrategy(item.id)}
                      className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        selected
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-300 dark:bg-cyan-950/60 dark:text-white dark:ring-cyan-300'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-[10px] font-bold uppercase opacity-60">
                          {item.rangeQuery}
                        </span>
                      </span>
                      <span className="mt-3 block text-xs leading-5 opacity-80">
                        {item.strength}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-rose-700 dark:text-rose-300">
                        {item.risk}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Traffic imbalance: {model.imbalanceRatio.toFixed(1)}×</span>
                <span>
                  Key total: {model.shards.reduce((sum, shard) => sum + shard.keyCount, 0).toLocaleString()}
                </span>
                <span>
                  {model.lostShard ? `Affected owner: shard ${model.lostShard}` : 'All owners reachable'}
                </span>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
