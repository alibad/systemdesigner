'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Box,
  CheckCircle2,
  CircleGauge,
  Clock3,
  DatabaseBackup,
  Gauge,
  GitBranch,
  Inbox,
  Layers3,
  ListRestart,
  Network,
  PackageCheck,
  RadioTower,
  RefreshCcw,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  Shuffle,
  Skull,
  Snail,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type RoutingMode = 'direct' | 'topic' | 'keyed';
type AckMode = 'before-processing' | 'after-processing' | 'durable-handoff';
type ChallengeId =
  | 'healthy'
  | 'consumer-slowdown'
  | 'poison-message'
  | 'broker-loss'
  | 'retry-storm'
  | 'partition-skew'
  | 'recovery';
type Health = 'healthy' | 'warning' | 'critical' | 'recovering';

interface QueueModel {
  producerRate: number;
  partitions: number;
  routing: RoutingMode;
  hotKeyPercent: number;
  replication: number;
  durableWrites: boolean;
  consumers: number;
  processingMs: number;
  prefetch: number;
  retryLimit: number;
  ackMode: AckMode;
  idempotentHandler: boolean;
  orderedRedrive: boolean;
}

interface Challenge {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Activity;
}

interface Simulation {
  inputRate: number;
  retryRate: number;
  attemptedRate: number;
  consumerCapacity: number;
  deliveredRate: number;
  backlog: number;
  queueAgeSeconds: number;
  inFlight: number;
  dlqRate: number;
  duplicateEffects: number;
  lostRate: number;
  hottestPartitionRate: number;
  hottestPartitionCapacity: number;
  activePartitions: number;
  availableReplicas: number;
  health: Health;
  deliveryLabel: string;
  orderingLabel: string;
  durabilityLabel: string;
  primaryConsequence: string;
  secondaryConsequence: string;
  routeNote: string;
  recoverySeconds: number | null;
  bottleneck: string;
}

const DEFAULT_MODEL: QueueModel = {
  producerRate: 720,
  partitions: 12,
  routing: 'keyed',
  hotKeyPercent: 8,
  replication: 3,
  durableWrites: true,
  consumers: 10,
  processingMs: 10,
  prefetch: 40,
  retryLimit: 3,
  ackMode: 'after-processing',
  idempotentHandler: true,
  orderedRedrive: true,
};

const CHALLENGES: Challenge[] = [
  {
    id: 'healthy',
    label: 'Healthy traffic',
    shortLabel: 'Healthy',
    description: 'Balanced keys, available brokers, and consumers keeping pace.',
    icon: CheckCircle2,
  },
  {
    id: 'consumer-slowdown',
    label: 'Consumer slowdown',
    shortLabel: 'Slow consumer',
    description: 'A downstream dependency makes every handler take longer.',
    icon: Snail,
  },
  {
    id: 'poison-message',
    label: 'Poison message',
    shortLabel: 'Poison',
    description: 'A malformed message repeatedly fails until it reaches the DLQ.',
    icon: Skull,
  },
  {
    id: 'broker-loss',
    label: 'Broker loss',
    shortLabel: 'Broker loss',
    description: 'One broker disappears and replicas must elect or recover.',
    icon: ServerCrash,
  },
  {
    id: 'retry-storm',
    label: 'Retry storm',
    shortLabel: 'Retry storm',
    description: 'Transient failures multiply work faster than consumers can drain it.',
    icon: ListRestart,
  },
  {
    id: 'partition-skew',
    label: 'Partition skew',
    shortLabel: 'Skew',
    description: 'One routing key receives most of the traffic and serializes progress.',
    icon: Shuffle,
  },
  {
    id: 'recovery',
    label: 'Recovery drain',
    shortLabel: 'Recovery',
    description: 'The fault is cleared while consumers drain an existing backlog.',
    icon: RefreshCcw,
  },
];

const ROUTING_OPTIONS: Array<{ id: RoutingMode; label: string; detail: string }> = [
  {
    id: 'direct',
    label: 'Direct queue',
    detail: 'All work enters one ordered lane. Simple, but parallelism is bounded.',
  },
  {
    id: 'topic',
    label: 'Topic fan-out',
    detail: 'Bindings copy matching events to independent consumer queues.',
  },
  {
    id: 'keyed',
    label: 'Keyed partitions',
    detail: 'A stable key preserves local order while partitions add parallelism.',
  },
];

const ACK_OPTIONS: Array<{ id: AckMode; label: string; detail: string }> = [
  {
    id: 'before-processing',
    label: 'Ack before work',
    detail: 'Fast release, but a crash after acknowledgment can lose the operation.',
  },
  {
    id: 'after-processing',
    label: 'Ack after work',
    detail: 'A crash can redeliver the message, so handlers must tolerate duplicates.',
  },
  {
    id: 'durable-handoff',
    label: 'Ack after handoff',
    detail: 'A durable local result or outbox closes the gap before acknowledgment.',
  },
];

const HEALTH_STYLES: Record<Health, string> = {
  healthy:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100',
  critical:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-100',
  recovering:
    'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-100',
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatRate(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}/s`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function calculateSimulation(model: QueueModel, challenge: ChallengeId): Simulation {
  const scenario = {
    producerMultiplier: 1,
    processingMultiplier: 1,
    transientFailureRate: 0.012,
    poisonRate: 0.0003,
    brokerCapacityMultiplier: 1,
    forcedHotShare: 0,
    seededBacklog: 0,
  };

  if (challenge === 'consumer-slowdown') {
    scenario.processingMultiplier = 3.4;
    scenario.transientFailureRate = 0.035;
  } else if (challenge === 'poison-message') {
    scenario.poisonRate = 0.075;
    scenario.transientFailureRate = 0.025;
  } else if (challenge === 'broker-loss') {
    scenario.brokerCapacityMultiplier = model.replication > 1 ? 0.7 : 0.25;
    scenario.transientFailureRate = model.replication > 1 ? 0.075 : 0.22;
  } else if (challenge === 'retry-storm') {
    scenario.transientFailureRate = 0.24;
    scenario.processingMultiplier = 1.25;
  } else if (challenge === 'partition-skew') {
    scenario.forcedHotShare = 0.68;
  } else if (challenge === 'recovery') {
    scenario.processingMultiplier = 0.72;
    scenario.transientFailureRate = 0.018;
    scenario.seededBacklog = model.producerRate * 180;
  }

  const inputRate = model.producerRate * scenario.producerMultiplier;
  const activePartitions =
    model.routing === 'direct' ? 1 : Math.max(1, Math.min(model.partitions, model.consumers));
  const prefetchEfficiency = 0.7 + 0.3 * (1 - Math.exp(-model.prefetch / 24));
  const perConsumerCapacity =
    (1000 / Math.max(1, model.processingMs * scenario.processingMultiplier)) * prefetchEfficiency;
  const parallelCapacity = activePartitions * perConsumerCapacity;
  const configuredHotShare =
    model.routing === 'direct'
      ? 1
      : model.routing === 'topic'
        ? 1 / activePartitions
        : Math.max(model.hotKeyPercent / 100, 1 / Math.max(1, model.partitions));
  const hottestShare = Math.max(configuredHotShare, scenario.forcedHotShare);
  const skewBoundCapacity =
    model.routing === 'topic'
      ? parallelCapacity
      : Math.min(parallelCapacity, perConsumerCapacity / Math.max(0.001, hottestShare));
  const consumerCapacity =
    skewBoundCapacity *
    scenario.brokerCapacityMultiplier *
    (challenge === 'recovery' ? 1.08 : 1);

  const retriesEnabled = model.ackMode !== 'before-processing' && model.retryLimit > 0;
  const retryRate = retriesEnabled
    ? inputRate * scenario.transientFailureRate * Math.min(model.retryLimit, 5) * 0.78
    : 0;
  const attemptedRate = inputRate + retryRate;
  const handledRate = Math.min(attemptedRate, consumerCapacity);
  const poisonDlqRate =
    retriesEnabled && model.retryLimit > 0 ? inputRate * scenario.poisonRate : 0;
  const exhaustedTransientRate = retriesEnabled
    ? inputRate *
      scenario.transientFailureRate *
      Math.pow(0.32, Math.min(model.retryLimit, 5) + 1)
    : 0;
  const dlqRate = poisonDlqRate + exhaustedTransientRate;
  const deliveredRate = Math.max(
    0,
    Math.min(inputRate, handledRate - retryRate) - (retriesEnabled ? dlqRate : 0)
  );
  const unhandledPerSecond = Math.max(0, attemptedRate - consumerCapacity);
  const observationSeconds = challenge === 'healthy' ? 120 : 600;
  const drainedDuringRecovery =
    challenge === 'recovery' ? Math.max(0, consumerCapacity - attemptedRate) * observationSeconds : 0;
  const backlog =
    challenge === 'recovery'
      ? Math.max(0, scenario.seededBacklog - drainedDuringRecovery)
      : unhandledPerSecond * observationSeconds;
  const queueAgeSeconds = backlog / Math.max(1, inputRate);
  const inFlight = Math.round(
    Math.min(model.prefetch * model.consumers, handledRate * Math.max(0.01, model.processingMs / 1000))
  );

  const lostRate =
    model.ackMode === 'before-processing'
      ? inputRate * (scenario.transientFailureRate + scenario.poisonRate)
      : !model.durableWrites && challenge === 'broker-loss'
        ? inputRate * 0.16
        : 0;
  const duplicateEffects =
    model.ackMode === 'before-processing'
      ? 0
      : retryRate * (model.idempotentHandler ? 0.01 : model.ackMode === 'durable-handoff' ? 0.05 : 0.32);
  const availableReplicas =
    challenge === 'broker-loss' ? Math.max(0, model.replication - 1) : model.replication;
  const recoverySeconds =
    challenge === 'recovery' && consumerCapacity > attemptedRate
      ? scenario.seededBacklog / (consumerCapacity - attemptedRate)
      : null;

  let health: Health = 'healthy';
  if (challenge === 'recovery') health = backlog > 0 ? 'recovering' : 'healthy';
  else if (
    backlog > inputRate * 120 ||
    lostRate > inputRate * 0.03 ||
    (challenge === 'broker-loss' && availableReplicas < 1)
  )
    health = 'critical';
  else if (
    backlog > 0 ||
    dlqRate > inputRate * 0.01 ||
    duplicateEffects > inputRate * 0.02 ||
    retryRate > inputRate * 0.1
  )
    health = 'warning';

  let deliveryLabel = 'At-least-once transport';
  if (model.ackMode === 'before-processing') {
    deliveryLabel = 'At-most-once behavior';
  } else if (model.idempotentHandler && model.ackMode === 'durable-handoff') {
    deliveryLabel = 'Effectively-once effects';
  } else if (model.idempotentHandler) {
    deliveryLabel = 'At-least-once, deduplicated';
  }

  let orderingLabel = 'No ordering contract';
  if (model.routing === 'direct') {
    orderingLabel =
      model.consumers === 1 && (model.orderedRedrive || model.retryLimit === 0)
        ? 'One global ordered lane'
        : 'Order can change across consumers';
  } else if (model.routing === 'keyed') {
    orderingLabel = model.orderedRedrive
      ? 'Per-key order, including redrive'
      : 'Per-key order can break on retry';
  } else {
    orderingLabel = 'Independent order per subscription';
  }

  let durabilityLabel = 'No durable broker copy';
  if (model.durableWrites && availableReplicas >= 2) {
    durabilityLabel = `${availableReplicas} durable replicas available`;
  } else if (model.durableWrites && availableReplicas === 1) {
    durabilityLabel = 'One durable copy remains';
  }

  let bottleneck = 'Consumer fleet has usable headroom';
  if (hottestPartitionRate(inputRate, hottestShare) > perConsumerCapacity) {
    bottleneck = 'Hottest partition exceeds one consumer lane';
  } else if (attemptedRate > consumerCapacity) {
    bottleneck = 'Aggregate consumer capacity is below attempted work';
  } else if (retryRate > inputRate * 0.1) {
    bottleneck = 'Retries consume a material share of capacity';
  }

  let primaryConsequence = 'Messages reach consumers without sustained queue growth.';
  let secondaryConsequence = 'The oldest message stays near the front of the live workload.';
  let routeNote = 'Producer traffic is routed, durably stored, consumed, and acknowledged.';

  if (challenge === 'consumer-slowdown') {
    primaryConsequence = `Slow handlers add ${formatCount(backlog)} messages to the backlog during the observation window.`;
    secondaryConsequence = `Users wait about ${formatAge(queueAgeSeconds)} before new work reaches a consumer.`;
    routeNote = 'The queue absorbs the slowdown, but it cannot remove the downstream capacity deficit.';
  } else if (challenge === 'poison-message') {
    primaryConsequence =
      dlqRate > 0
        ? `${formatRate(dlqRate)} are isolated in the dead-letter flow after retries.`
        : 'Failed messages have no DLQ path and remain mixed with healthy work.';
    secondaryConsequence =
      retryRate > 0
        ? `${formatRate(retryRate)} of retry traffic competes with first attempts.`
        : `${formatRate(lostRate)} can be acknowledged before successful processing.`;
    routeNote = 'The poison path must be observable and separately redrivable.';
  } else if (challenge === 'broker-loss') {
    primaryConsequence =
      availableReplicas >= 1
        ? `${availableReplicas} replica${availableReplicas === 1 ? '' : 's'} continue serving while capacity falls.`
        : 'No broker copy remains available for this queue.';
    secondaryConsequence =
      lostRate > 0
        ? `${formatRate(lostRate)} are exposed to loss under this durability contract.`
        : 'Replication preserves accepted messages, but backlog and latency still rise.';
    routeNote = 'The broker path is degraded until leadership and replicas recover.';
  } else if (challenge === 'retry-storm') {
    primaryConsequence = `${formatRate(retryRate)} of amplified retry work now shares the consumer fleet.`;
    secondaryConsequence = model.idempotentHandler
      ? `Idempotency holds duplicate side effects near ${formatRate(duplicateEffects)}.`
      : `${formatRate(duplicateEffects)} duplicate business effects can escape.`;
    routeNote = 'Retries loop through the queue; backoff and a bounded attempt budget protect new work.';
  } else if (challenge === 'partition-skew') {
    primaryConsequence = `One partition receives ${formatRate(inputRate * hottestShare)} but one lane serves ${formatRate(perConsumerCapacity)}.`;
    secondaryConsequence = `${formatAge(queueAgeSeconds)} of queue age accumulates even when other partitions are idle.`;
    routeNote = 'The hot key fixes work to one lane, so adding unrelated consumers does not clear it.';
  } else if (challenge === 'recovery') {
    primaryConsequence =
      backlog > 0
        ? `${formatCount(backlog)} messages remain while consumers drain faster than producers enqueue.`
        : 'The seeded backlog is drained and steady-state service has resumed.';
    secondaryConsequence =
      recoverySeconds === null
        ? 'Current capacity cannot drain the backlog.'
        : `Estimated full recovery takes ${formatAge(recoverySeconds)} at this headroom.`;
    routeNote = 'Recovery prioritizes bounded redrive while preserving capacity for new messages.';
  }

  if (challenge === 'healthy' && backlog > 0) {
    primaryConsequence = `The configured lanes add ${formatCount(backlog)} messages to the backlog in two minutes.`;
    secondaryConsequence = `Even without an injected fault, new work waits about ${formatAge(queueAgeSeconds)} for capacity.`;
    routeNote = 'The topology is available, but its configured routing and consumer lanes cannot keep pace.';
  } else if (challenge === 'healthy' && lostRate > 0) {
    primaryConsequence = `${formatRate(lostRate)} can be acknowledged before the business operation completes.`;
    secondaryConsequence = 'Queue depth stays low by transferring failure risk to the user-visible operation.';
    routeNote = 'The queue is flowing, but the acknowledgment point weakens the delivery contract.';
  }

  return {
    inputRate,
    retryRate,
    attemptedRate,
    consumerCapacity,
    deliveredRate,
    backlog,
    queueAgeSeconds,
    inFlight,
    dlqRate,
    duplicateEffects,
    lostRate,
    hottestPartitionRate: inputRate * hottestShare,
    hottestPartitionCapacity: perConsumerCapacity,
    activePartitions,
    availableReplicas,
    health,
    deliveryLabel,
    orderingLabel,
    durabilityLabel,
    primaryConsequence,
    secondaryConsequence,
    routeNote,
    recoverySeconds,
    bottleneck,
  };
}

function hottestPartitionRate(inputRate: number, share: number) {
  return inputRate * share;
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string; detail?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={`min-h-14 rounded-md border px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                selected
                  ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-300 dark:bg-blue-300 dark:text-neutral-950'
                  : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-900'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              {option.detail ? (
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected ? 'text-blue-100 dark:text-neutral-800' : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {option.detail}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  const id = `mq-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
          {formatCount(value)}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-700 dark:accent-blue-300"
      />
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{hint}</p>
    </div>
  );
}

function ToggleControl({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-300 bg-white p-3 text-left hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-500">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-blue-700 dark:accent-blue-300"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</span>
      </span>
    </label>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'blue' | 'amber' | 'rose' | 'emerald';
}) {
  const styles = {
    neutral: 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950',
    blue: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60',
    emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60',
  };
  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 break-words text-xl font-bold tracking-normal text-neutral-950 dark:text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function TopologyNode({
  icon,
  eyebrow,
  title,
  metric,
  detail,
  tone,
  status,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  tone: 'blue' | 'amber' | 'violet' | 'emerald' | 'rose';
  status?: 'degraded' | 'failed' | 'active';
}) {
  const tones = {
    blue: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/80',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/80',
    violet: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/80',
    emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/80',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/80',
  };
  return (
    <div className={`relative min-h-40 rounded-md border p-4 ${tones[tone]}`}>
      {status ? (
        <span
          className={`absolute right-3 top-3 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase ${
            status === 'failed'
              ? 'border-rose-400 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
              : status === 'degraded'
                ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
                : 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
          }`}
        >
          {status}
        </span>
      ) : null}
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-current/20 bg-white/80 dark:bg-neutral-950/70">
        {icon}
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase text-neutral-600 dark:text-neutral-300">{eyebrow}</div>
      <div className="mt-1 text-base font-bold text-neutral-950 dark:text-white">{title}</div>
      <div className="mt-2 text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{metric}</div>
      <p className="mt-1 text-xs leading-5 text-neutral-700 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function FlowConnector({ label, danger = false }: { label: string; danger?: boolean }) {
  return (
    <div
      className={`flex min-h-12 items-center justify-center gap-1 text-center text-[11px] font-semibold ${
        danger ? 'text-rose-700 dark:text-rose-300' : 'text-neutral-500 dark:text-neutral-400'
      }`}
      aria-hidden="true"
    >
      <ArrowRight className="hidden h-4 w-4 lg:block" />
      <ArrowDown className="h-4 w-4 lg:hidden" />
      <span className="max-w-20">{label}</span>
    </div>
  );
}

export default function MessageQueueDesigner() {
  const [model, setModel] = useState<QueueModel>(DEFAULT_MODEL);
  const [challenge, setChallenge] = useState<ChallengeId>('healthy');

  const simulation = useMemo(() => calculateSimulation(model, challenge), [model, challenge]);
  const selectedChallenge = CHALLENGES.find((item) => item.id === challenge) ?? CHALLENGES[0];
  const brokerStatus =
    challenge === 'broker-loss'
      ? simulation.availableReplicas === 0
        ? 'failed'
        : 'degraded'
      : simulation.health === 'recovering'
        ? 'active'
        : undefined;
  const consumerStatus =
    challenge === 'consumer-slowdown' || challenge === 'retry-storm' || challenge === 'partition-skew'
      ? 'degraded'
      : challenge === 'recovery'
        ? 'active'
        : undefined;
  const backlogRatio = clamp(simulation.backlog / Math.max(1, simulation.inputRate * 300), 0, 1);
  const capacityRatio = clamp(simulation.attemptedRate / Math.max(1, simulation.consumerCapacity), 0, 1.5);

  const updateModel = <K extends keyof QueueModel>(key: K, value: QueueModel[K]) => {
    setModel((current) => ({ ...current, [key]: value }));
  };

  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-950 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <RadioTower className="h-4 w-4" />
              Queue topology workbench
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-normal sm:text-3xl">
              Design the path, then break it
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Route producer traffic, size partition and consumer lanes, define acknowledgment behavior, and
              observe how pressure changes delivery outcomes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModel(DEFAULT_MODEL);
              setChallenge('healthy');
            }}
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white outline-none hover:border-neutral-400 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RotateCcw className="h-4 w-4" />
            Reset design
          </button>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-50 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
              Challenge the topology
            </div>
            <h3 className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">{selectedChallenge.label}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {selectedChallenge.description}
            </p>
          </div>
          <div className={`w-full rounded-md border px-3 py-2 text-sm font-semibold xl:max-w-md ${HEALTH_STYLES[simulation.health]}`}>
            <span className="flex items-center gap-2">
              {simulation.health === 'healthy' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : simulation.health === 'recovering' ? (
                <RefreshCcw className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {simulation.health === 'healthy'
                ? 'Healthy operating state'
                : simulation.health === 'recovering'
                  ? 'Backlog recovery in progress'
                  : simulation.health === 'warning'
                    ? 'Contract pressure detected'
                    : 'User-visible failure likely'}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {CHALLENGES.map((item) => {
            const Icon = item.icon;
            const selected = challenge === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallenge(item.id)}
                className={`min-h-16 rounded-md border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                  selected
                    ? 'border-neutral-950 bg-neutral-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="mt-2 block text-xs font-semibold">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6" aria-labelledby="queue-topology-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Live topology</div>
            <h3 id="queue-topology-heading" className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
              Follow one message through the system
            </h3>
          </div>
          <p className="max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {simulation.routeNote}
          </p>
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_64px_minmax(0,1.15fr)_64px_minmax(0,1fr)_64px_minmax(0,1fr)]">
          <TopologyNode
            icon={<Zap className="h-5 w-5" />}
            eyebrow="Producers"
            title={model.routing === 'topic' ? 'Event publishers' : 'Work publishers'}
            metric={formatRate(simulation.inputRate)}
            detail={`${model.routing === 'keyed' ? `${model.hotKeyPercent}% configured hot-key share` : ROUTING_OPTIONS.find((item) => item.id === model.routing)?.label}`}
            tone="blue"
          />
          <FlowConnector label={model.routing === 'keyed' ? 'hash key' : model.routing === 'topic' ? 'match topic' : 'enqueue'} />
          <TopologyNode
            icon={<Layers3 className="h-5 w-5" />}
            eyebrow="Broker lanes"
            title={
              model.routing === 'direct'
                ? '1 queue lane'
                : model.routing === 'topic'
                  ? `${model.partitions} bindings`
                  : `${simulation.activePartitions}/${model.partitions} active partitions`
            }
            metric={`${formatCount(simulation.backlog)} queued`}
            detail={`${simulation.availableReplicas} of ${model.replication} broker copies available`}
            tone="amber"
            status={brokerStatus}
          />
          <FlowConnector
            label={simulation.queueAgeSeconds > 0 ? `${formatAge(simulation.queueAgeSeconds)} old` : 'dispatch'}
            danger={simulation.queueAgeSeconds > 60}
          />
          <TopologyNode
            icon={<UsersRound className="h-5 w-5" />}
            eyebrow="Consumer group"
            title={`${model.consumers} consumers`}
            metric={`${formatRate(simulation.consumerCapacity)} capacity`}
            detail={`${formatCount(simulation.inFlight)} in flight at prefetch ${model.prefetch}`}
            tone="violet"
            status={consumerStatus}
          />
          <FlowConnector
            label={simulation.retryRate > 0 ? `${formatRate(simulation.retryRate)} retry` : 'ack result'}
            danger={simulation.retryRate > simulation.inputRate * 0.1}
          />
          <TopologyNode
            icon={<PackageCheck className="h-5 w-5" />}
            eyebrow="Business effect"
            title="Completed work"
            metric={formatRate(simulation.deliveredRate)}
            detail={
              simulation.lostRate > 0
                ? `${formatRate(simulation.lostRate)} exposed to loss`
                : `${formatRate(simulation.duplicateEffects)} duplicate effects`
            }
            tone="emerald"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <div className="rounded-md border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              <span>Queue pressure</span>
              <span className="tabular-nums">
                {Math.round(capacityRatio * 100)}% of consumer capacity
              </span>
            </div>
            <div
              className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
              role="meter"
              aria-label="Attempted work relative to consumer capacity"
              aria-valuemin={0}
              aria-valuemax={150}
              aria-valuenow={Math.round(capacityRatio * 100)}
            >
              <div
                className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                  capacityRatio > 1 ? 'bg-rose-600 dark:bg-rose-400' : capacityRatio > 0.8 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${clamp(capacityRatio * 100, 2, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{simulation.bottleneck}</p>
          </div>
          <div
            className={`rounded-md border p-3 ${
              simulation.dlqRate > 0
                ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60'
                : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
              <Inbox className="h-4 w-4" />
              Dead-letter path
            </div>
            <div className="mt-2 text-lg font-bold text-neutral-950 dark:text-white">
              {formatRate(simulation.dlqRate)}
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {model.orderedRedrive ? 'Redrive preserves the configured key lane.' : 'Redrive can overtake live work.'}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric
            icon={<Inbox className="h-4 w-4" />}
            label="Backlog"
            value={formatCount(simulation.backlog)}
            detail={backlogRatio > 0 ? 'Messages waiting for a lane' : 'No sustained queue growth'}
            tone={simulation.backlog > 0 ? 'amber' : 'emerald'}
          />
          <Metric
            icon={<Clock3 className="h-4 w-4" />}
            label="Oldest age"
            value={formatAge(simulation.queueAgeSeconds)}
            detail="Approximate delay before new work starts"
            tone={simulation.queueAgeSeconds > 60 ? 'rose' : simulation.queueAgeSeconds > 0 ? 'amber' : 'emerald'}
          />
          <Metric
            icon={<Gauge className="h-4 w-4" />}
            label="Throughput"
            value={formatRate(simulation.deliveredRate)}
            detail={`${formatRate(simulation.attemptedRate)} including retries`}
            tone="blue"
          />
          <Metric
            icon={<Box className="h-4 w-4" />}
            label="In flight"
            value={formatCount(simulation.inFlight)}
            detail={`Bounded by ${formatCount(model.prefetch * model.consumers)} prefetched`}
          />
          <Metric
            icon={<DatabaseBackup className="h-4 w-4" />}
            label="Replicas"
            value={`${simulation.availableReplicas}/${model.replication}`}
            detail={simulation.durabilityLabel}
            tone={simulation.availableReplicas < 2 ? 'rose' : 'neutral'}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-800 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <div className="min-w-0 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Control loop 1</div>
              <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Route and retain producer traffic</h3>
            </div>
          </div>
          <div className="mt-5 space-y-6">
            <SegmentedControl
              label="Routing contract"
              value={model.routing}
              options={ROUTING_OPTIONS}
              onChange={(value) => updateModel('routing', value)}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <RangeControl
                label="Producer traffic"
                value={model.producerRate}
                min={100}
                max={5000}
                step={20}
                suffix="/s"
                hint="First attempts entering the broker each second."
                onChange={(value) => updateModel('producerRate', value)}
              />
              <RangeControl
                label={model.routing === 'topic' ? 'Bindings' : 'Partitions'}
                value={model.partitions}
                min={1}
                max={48}
                step={1}
                hint="Upper bound on independent consumer lanes."
                onChange={(value) => updateModel('partitions', value)}
              />
              <RangeControl
                label="Hot-key share"
                value={model.hotKeyPercent}
                min={1}
                max={80}
                step={1}
                suffix="%"
                hint="Share forced through the busiest keyed lane."
                onChange={(value) => updateModel('hotKeyPercent', value)}
              />
              <RangeControl
                label="Replication"
                value={model.replication}
                min={1}
                max={5}
                step={1}
                suffix="x"
                hint="Broker copies available before a failure."
                onChange={(value) => updateModel('replication', value)}
              />
            </div>
            <ToggleControl
              checked={model.durableWrites}
              onChange={(checked) => updateModel('durableWrites', checked)}
              label="Require durable broker writes"
              detail="Accepted work survives process restart only after it reaches durable storage."
            />
          </div>
        </div>

        <div className="min-w-0 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              <CircleGauge className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Control loop 2</div>
              <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Bound consumer work and retries</h3>
            </div>
          </div>
          <div className="mt-5 space-y-6">
            <SegmentedControl
              label="Acknowledgment point"
              value={model.ackMode}
              options={ACK_OPTIONS}
              onChange={(value) => updateModel('ackMode', value)}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <RangeControl
                label="Consumers"
                value={model.consumers}
                min={1}
                max={48}
                step={1}
                hint="Workers competing inside this consumer group."
                onChange={(value) => updateModel('consumers', value)}
              />
              <RangeControl
                label="Processing time"
                value={model.processingMs}
                min={2}
                max={100}
                step={1}
                suffix="ms"
                hint="Healthy service time for one message."
                onChange={(value) => updateModel('processingMs', value)}
              />
              <RangeControl
                label="Prefetch"
                value={model.prefetch}
                min={1}
                max={250}
                step={1}
                hint="Unacknowledged messages reserved per consumer."
                onChange={(value) => updateModel('prefetch', value)}
              />
              <RangeControl
                label="Retry limit"
                value={model.retryLimit}
                min={0}
                max={8}
                step={1}
                hint="Bounded attempts before dead-letter handling."
                onChange={(value) => updateModel('retryLimit', value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleControl
                checked={model.idempotentHandler}
                onChange={(checked) => updateModel('idempotentHandler', checked)}
                label="Idempotent business handler"
                detail="Repeated delivery reuses a stable operation key instead of repeating the effect."
              />
              <ToggleControl
                checked={model.orderedRedrive}
                onChange={(checked) => updateModel('orderedRedrive', checked)}
                label="Ordered retry lane"
                detail="Retries and redrive stay behind earlier work for the same routing key."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className={`rounded-md border p-5 ${HEALTH_STYLES[simulation.health]}`}>
            <div className="flex items-start gap-3">
              <selectedChallenge.icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase">Observed consequence</div>
                <h3 className="mt-1 text-lg font-bold">{simulation.primaryConsequence}</h3>
                <p className="mt-2 text-sm leading-6 opacity-90">{simulation.secondaryConsequence}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-current/20 bg-white/60 p-3 dark:bg-neutral-950/40">
                <div className="text-xs font-semibold uppercase opacity-75">User-visible result</div>
                <p className="mt-1 text-sm font-semibold">
                  {simulation.queueAgeSeconds > 60
                    ? `New work starts ${formatAge(simulation.queueAgeSeconds)} late.`
                    : simulation.lostRate > 0
                      ? `${formatRate(simulation.lostRate)} may never produce an effect.`
                      : simulation.duplicateEffects > 1
                        ? `${formatRate(simulation.duplicateEffects)} duplicate effects require containment.`
                        : 'Requests remain within the modeled queue contract.'}
                </p>
              </div>
              <div className="rounded-md border border-current/20 bg-white/60 p-3 dark:bg-neutral-950/40">
                <div className="text-xs font-semibold uppercase opacity-75">Operator action</div>
                <p className="mt-1 text-sm font-semibold">
                  {challenge === 'partition-skew'
                    ? 'Change the routing key or split the hot entity.'
                    : challenge === 'retry-storm'
                      ? 'Add backoff, jitter, and a retry budget.'
                      : challenge === 'poison-message'
                        ? 'Quarantine, inspect, fix, then redrive selectively.'
                        : challenge === 'broker-loss'
                          ? 'Restore replicas before accepting normal risk.'
                          : challenge === 'consumer-slowdown'
                            ? 'Protect the dependency and add drain capacity.'
                            : challenge === 'recovery'
                              ? 'Keep drain headroom while admitting new work.'
                              : 'Watch age and saturation, not enqueue rate alone.'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <h3 className="text-lg font-bold text-neutral-950 dark:text-white">Resulting contract</h3>
            </div>
            <dl className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
                <dt className="font-medium text-neutral-600 dark:text-neutral-400">Delivery</dt>
                <dd className="font-semibold text-neutral-950 dark:text-white">{simulation.deliveryLabel}</dd>
              </div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
                <dt className="font-medium text-neutral-600 dark:text-neutral-400">Ordering</dt>
                <dd className="font-semibold text-neutral-950 dark:text-white">{simulation.orderingLabel}</dd>
              </div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
                <dt className="font-medium text-neutral-600 dark:text-neutral-400">Durability</dt>
                <dd className="font-semibold text-neutral-950 dark:text-white">{simulation.durabilityLabel}</dd>
              </div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
                <dt className="font-medium text-neutral-600 dark:text-neutral-400">Hot lane</dt>
                <dd className="font-semibold text-neutral-950 dark:text-white">
                  {formatRate(simulation.hottestPartitionRate)} into {formatRate(simulation.hottestPartitionCapacity)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <Network className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Values are an illustrative capacity model, not a product guarantee. Validate service time,
                batching, replication, and failure behavior with workload tests.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
