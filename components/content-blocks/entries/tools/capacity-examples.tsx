'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CloudLightning,
  Database,
  Gauge,
  HardDrive,
  Images,
  Info,
  MessageSquareText,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  Server,
  ShoppingCart,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type ScenarioId = 'messaging' | 'media' | 'commerce' | 'search' | 'inference';
type ChallengeId = 'planned' | 'launch-spike' | 'slow-dependency' | 'region-loss';
type CapacityStatus = 'healthy' | 'constrained' | 'overloaded';

interface EstimatorInputs {
  dailyActionsMillions: number;
  requestsPerAction: number;
  payloadKb: number;
  peakFactor: number;
  serviceUnits: number;
  rpsPerUnit: number;
  retentionDays: number;
  replicas: number;
}

interface Scenario {
  id: ScenarioId;
  label: string;
  category: string;
  description: string;
  icon: LucideIcon;
  defaults: EstimatorInputs;
  architecture: [string, string, string];
  designNote: string;
}

interface Challenge {
  id: ChallengeId;
  label: string;
  description: string;
  icon: LucideIcon;
  demandMultiplier: number;
  availableCapacity: number;
  latencyMultiplier: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'messaging',
    label: 'Realtime messaging',
    category: 'High event volume',
    description: 'Small payloads, high concurrency, and bursty fan-out.',
    icon: MessageSquareText,
    defaults: {
      dailyActionsMillions: 1000,
      requestsPerAction: 2.4,
      payloadKb: 1.5,
      peakFactor: 3.2,
      serviceUnits: 80,
      rpsPerUnit: 1800,
      retentionDays: 30,
      replicas: 3,
    },
    architecture: ['Gateway', 'Message service', 'Durable log'],
    designNote: 'Partition by conversation or recipient while keeping retries idempotent.',
  },
  {
    id: 'media',
    label: 'Photo and media feed',
    category: 'Storage heavy',
    description: 'Large objects, derived variants, and read amplification.',
    icon: Images,
    defaults: {
      dailyActionsMillions: 220,
      requestsPerAction: 7,
      payloadKb: 420,
      peakFactor: 4,
      serviceUnits: 90,
      rpsPerUnit: 1600,
      retentionDays: 365,
      replicas: 3,
    },
    architecture: ['Upload edge', 'Media pipeline', 'Object store'],
    designNote: 'Move bytes through object storage and a CDN, not through the metadata database.',
  },
  {
    id: 'commerce',
    label: 'Commerce checkout',
    category: 'Burst sensitive',
    description: 'Moderate volume with many synchronous dependency calls.',
    icon: ShoppingCart,
    defaults: {
      dailyActionsMillions: 45,
      requestsPerAction: 14,
      payloadKb: 8,
      peakFactor: 8,
      serviceUnits: 70,
      rpsPerUnit: 1400,
      retentionDays: 730,
      replicas: 3,
    },
    architecture: ['Checkout API', 'Order workflow', 'Ledger store'],
    designNote: 'Protect inventory and payment dependencies with deadlines and bounded retries.',
  },
  {
    id: 'search',
    label: 'Search service',
    category: 'Read amplified',
    description: 'Query fan-out across shards with a strict latency budget.',
    icon: Search,
    defaults: {
      dailyActionsMillions: 320,
      requestsPerAction: 8,
      payloadKb: 6,
      peakFactor: 5.5,
      serviceUnits: 135,
      rpsPerUnit: 1500,
      retentionDays: 14,
      replicas: 2,
    },
    architecture: ['Query router', 'Index shards', 'Result cache'],
    designNote: 'Budget fan-out explicitly because one search can become many shard requests.',
  },
  {
    id: 'inference',
    label: 'AI inference',
    category: 'Compute bound',
    description: 'Lower request volume with expensive work per request.',
    icon: Bot,
    defaults: {
      dailyActionsMillions: 36,
      requestsPerAction: 1,
      payloadKb: 32,
      peakFactor: 5,
      serviceUnits: 12,
      rpsPerUnit: 260,
      retentionDays: 14,
      replicas: 2,
    },
    architecture: ['Request router', 'Model workers', 'Response cache'],
    designNote: 'Validate throughput with the real model, batch policy, and response-length mix.',
  },
];

const CHALLENGES: Challenge[] = [
  {
    id: 'planned',
    label: 'Planned load',
    description: 'Expected peak with the whole fleet available.',
    icon: CheckCircle2,
    demandMultiplier: 1,
    availableCapacity: 1,
    latencyMultiplier: 1,
  },
  {
    id: 'launch-spike',
    label: 'Launch spike',
    description: 'Demand arrives 2.8x above the planned peak.',
    icon: Zap,
    demandMultiplier: 2.8,
    availableCapacity: 1,
    latencyMultiplier: 1.2,
  },
  {
    id: 'slow-dependency',
    label: 'Slow dependency',
    description: 'Retries add load while useful capacity falls.',
    icon: CloudLightning,
    demandMultiplier: 1.35,
    availableCapacity: 0.55,
    latencyMultiplier: 4.5,
  },
  {
    id: 'region-loss',
    label: 'Region loss',
    description: 'Surviving regions absorb traffic with 45% less capacity.',
    icon: TriangleAlert,
    demandMultiplier: 1.15,
    availableCapacity: 0.55,
    latencyMultiplier: 2.1,
  },
];

const STATUS_STYLES: Record<CapacityStatus, {
  label: string;
  panel: string;
  badge: string;
  bar: string;
  icon: LucideIcon;
}> = {
  healthy: {
    label: 'Healthy reserve',
    panel: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    badge: 'bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    icon: CheckCircle2,
  },
  constrained: {
    label: 'Headroom at risk',
    panel: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    badge: 'bg-amber-700 text-white dark:bg-amber-300 dark:text-amber-950',
    bar: 'bg-amber-500 dark:bg-amber-400',
    icon: AlertTriangle,
  },
  overloaded: {
    label: 'Capacity exceeded',
    panel: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
    badge: 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950',
    bar: 'bg-rose-500 dark:bg-rose-400',
    icon: TriangleAlert,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatCompact(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);
}

function formatRate(value: number) {
  return `${formatCompact(value)}/s`;
}

function formatMillions(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}B`;
  }
  return `${formatCompact(value)}M`;
}

function formatStorage(gigabytes: number) {
  if (gigabytes >= 1_000_000) {
    return `${(gigabytes / 1_000_000).toFixed(gigabytes >= 10_000_000 ? 0 : 1)} PB`;
  }
  if (gigabytes >= 1000) {
    return `${(gigabytes / 1000).toFixed(gigabytes >= 100_000 ? 0 : 1)} TB`;
  }
  return `${gigabytes.toFixed(gigabytes >= 100 ? 0 : 1)} GB`;
}

function formatBandwidth(megabitsPerSecond: number) {
  if (megabitsPerSecond >= 1_000_000) {
    return `${(megabitsPerSecond / 1_000_000).toFixed(1)} Tbps`;
  }
  if (megabitsPerSecond >= 1000) {
    return `${(megabitsPerSecond / 1000).toFixed(1)} Gbps`;
  }
  return `${megabitsPerSecond.toFixed(1)} Mbps`;
}

function RangeControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="border-b border-neutral-200 pb-4 last:border-0 last:pb-0 dark:border-neutral-800">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <label htmlFor={id} className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {label}
          </label>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(clamp(value - step, min, max))}
            aria-label={`Decrease ${label}`}
            title={`Decrease ${label}`}
            disabled={value <= min}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <output
            htmlFor={id}
            className="min-w-16 rounded-md bg-neutral-100 px-2.5 py-1 text-center font-mono text-sm font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {displayValue}
          </output>
          <button
            type="button"
            onClick={() => onChange(clamp(value + step, min, max))}
            aria-label={`Increase ${label}`}
            title={`Increase ${label}`}
            disabled={value >= max}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? clamp(nextValue, min, max) : min);
        }}
        className="h-2 w-full cursor-pointer accent-indigo-600 dark:accent-indigo-400"
      />
      <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function CapacityExamplesPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('messaging');
  const [challengeId, setChallengeId] = useState<ChallengeId>('planned');
  const [inputs, setInputs] = useState<EstimatorInputs>({ ...SCENARIOS[0].defaults });

  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];
  const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];

  const model = useMemo(() => {
    const dailyActions = inputs.dailyActionsMillions * 1_000_000;
    const dailyRequests = dailyActions * inputs.requestsPerAction;
    const averageActionsPerSecond = dailyActions / 86_400;
    const averageRps = dailyRequests / 86_400;
    const plannedPeakRps = averageRps * inputs.peakFactor;
    const challengedPeakRps = plannedPeakRps * challenge.demandMultiplier;
    const challengedPeakActionsPerSecond = (
      averageActionsPerSecond
      * inputs.peakFactor
      * challenge.demandMultiplier
    );
    const availableRps = inputs.serviceUnits * inputs.rpsPerUnit * challenge.availableCapacity;
    const utilization = availableRps > 0 ? (challengedPeakRps / availableRps) * 100 : 999;
    const headroomRps = Math.max(0, availableRps - challengedPeakRps);
    const droppedRps = Math.max(0, challengedPeakRps - availableRps);
    const requiredUnits = Math.ceil(
      challengedPeakRps / Math.max(1, inputs.rpsPerUnit * 0.7 * challenge.availableCapacity),
    );
    const storedGigabytes = (
      dailyActions
      * inputs.payloadKb
      * inputs.retentionDays
      * inputs.replicas
    ) / 1_000_000;
    const peakBandwidthMbps = (challengedPeakActionsPerSecond * inputs.payloadKb * 8) / 1000;
    const dailyTransferTerabytes = (dailyActions * inputs.payloadKb) / 1_000_000_000;
    const queueDelayMultiplier = utilization <= 70
      ? 1
      : 1 + Math.min(8, Math.pow((utilization - 70) / 28, 2));
    const estimatedP95Ms = Math.round(70 * challenge.latencyMultiplier * queueDelayMultiplier);
    const status: CapacityStatus = utilization <= 70
      ? 'healthy'
      : utilization <= 90
        ? 'constrained'
        : 'overloaded';

    return {
      dailyActions,
      dailyRequests,
      averageRps,
      plannedPeakRps,
      challengedPeakRps,
      availableRps,
      utilization,
      headroomRps,
      droppedRps,
      requiredUnits,
      storedGigabytes,
      peakBandwidthMbps,
      dailyTransferTerabytes,
      estimatedP95Ms,
      status,
    };
  }, [challenge, inputs]);

  const statusStyle = STATUS_STYLES[model.status];
  const StatusIcon = statusStyle.icon;
  const utilizationWidth = `${Math.min(100, Math.max(2, model.utilization))}%`;

  const updateInput = <Key extends keyof EstimatorInputs>(key: Key, value: EstimatorInputs[Key]) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const selectScenario = (nextScenario: Scenario) => {
    setScenarioId(nextScenario.id);
    setInputs({ ...nextScenario.defaults });
    setChallengeId('planned');
  };

  const resetScenario = () => {
    setInputs({ ...scenario.defaults });
    setChallengeId('planned');
  };

  const recommendation = model.status === 'overloaded'
    ? `Add ${Math.max(0, model.requiredUnits - inputs.serviceUnits)} service units or shed ${formatRate(model.droppedRps)} before requests enter the dependency path.`
    : model.status === 'constrained'
      ? `Provision ${Math.max(0, model.requiredUnits - inputs.serviceUnits)} more service units to restore the 30% target reserve.`
      : `${formatRate(model.headroomRps)} remains for variance; validate the ${formatCompact(inputs.rpsPerUnit)} RPS-per-unit assumption with a representative load test.`;

  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
    >
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-6 text-white dark:border-neutral-800 dark:bg-black sm:px-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Capacity estimation workbench
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Turn product demand into an operating envelope</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Start from an illustrative workload, expose every multiplier, then test whether the
              provisioned fleet survives a bad day.
            </p>
          </div>
          <button
            type="button"
            onClick={resetScenario}
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-neutral-700 px-3 text-sm font-semibold text-white transition-colors hover:border-neutral-500 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:self-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset example
          </button>
        </div>
      </header>

      <section className="border-b border-neutral-200 px-5 py-6 dark:border-neutral-800 sm:px-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose a workload</p>
            <h3 className="mt-1 text-lg font-bold">Use an example as a starting hypothesis</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Info className="h-4 w-4" aria-hidden="true" />
            Illustrative assumptions, not company facts
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Workload examples">
          {SCENARIOS.map((item) => {
            const Icon = item.icon;
            const selected = item.id === scenarioId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectScenario(item)}
                aria-pressed={selected}
                className={`min-h-28 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  selected
                    ? 'border-indigo-700 bg-indigo-700 text-white dark:border-indigo-300 dark:bg-indigo-300 dark:text-indigo-950'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={`text-[10px] font-semibold uppercase ${selected ? 'text-indigo-100 dark:text-indigo-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {item.category}
                  </span>
                </div>
                <span className="mt-4 block text-sm font-bold">{item.label}</span>
                <span className={`mt-1 block text-xs leading-5 ${selected ? 'text-indigo-100 dark:text-indigo-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.65fr)]">
        <aside className="border-b border-neutral-200 bg-neutral-50 px-5 py-6 dark:border-neutral-800 dark:bg-neutral-950 xl:border-b-0 xl:border-r sm:px-7">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">2. Shape demand</p>
            <h3 className="mt-1 text-lg font-bold">Traffic assumptions</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              These controls form the demand loop. Each change recomputes the request path and byte rate.
            </p>
          </div>

          <div className="space-y-4">
            <RangeControl
              id="capacity-daily-actions"
              label="Daily user actions"
              hint="Messages, uploads, checkouts, searches, or inference calls."
              value={inputs.dailyActionsMillions}
              min={1}
              max={1200}
              step={1}
              displayValue={formatMillions(inputs.dailyActionsMillions)}
              onChange={(value) => updateInput('dailyActionsMillions', value)}
            />
            <RangeControl
              id="capacity-request-amplification"
              label="Requests per action"
              hint="Include fan-out, internal calls, and read amplification."
              value={inputs.requestsPerAction}
              min={1}
              max={20}
              step={0.1}
              displayValue={`${inputs.requestsPerAction.toFixed(1)}x`}
              onChange={(value) => updateInput('requestsPerAction', value)}
            />
            <RangeControl
              id="capacity-peak-factor"
              label="Peak-to-average factor"
              hint="The busiest interval compared with the daily average."
              value={inputs.peakFactor}
              min={1}
              max={12}
              step={0.1}
              displayValue={`${inputs.peakFactor.toFixed(1)}x`}
              onChange={(value) => updateInput('peakFactor', value)}
            />
            <RangeControl
              id="capacity-payload"
              label="Payload per user action"
              hint="Compressed external bytes; internal request fan-out is excluded."
              value={inputs.payloadKb}
              min={0.5}
              max={2000}
              step={0.5}
              displayValue={`${formatCompact(inputs.payloadKb)} KB`}
              onChange={(value) => updateInput('payloadKb', value)}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <section className="border-b border-neutral-200 px-5 py-6 dark:border-neutral-800 sm:px-7">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">Demand breakdown</p>
                <h3 className="mt-1 text-xl font-bold">{scenario.label}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {scenario.designNote}
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Invariant:</span>{' '}
                daily requests = actions x requests per action
              </div>
            </div>

            <div className="mt-6 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/45">
                <span className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Daily actions</span>
                <strong className="mt-2 block text-2xl text-blue-950 dark:text-blue-50">
                  {formatCompact(model.dailyActions)}
                </strong>
                <span className="mt-1 block text-xs text-blue-800/80 dark:text-blue-200/80">Product demand</span>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-neutral-400 md:block" aria-hidden="true" />
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/45">
                <span className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Daily requests</span>
                <strong className="mt-2 block text-2xl text-violet-950 dark:text-violet-50">
                  {formatCompact(model.dailyRequests)}
                </strong>
                <span className="mt-1 block text-xs text-violet-800/80 dark:text-violet-200/80">
                  {inputs.requestsPerAction.toFixed(1)}x amplification
                </span>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-neutral-400 md:block" aria-hidden="true" />
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/45">
                <span className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">Planned peak</span>
                <strong className="mt-2 block text-2xl text-cyan-950 dark:text-cyan-50">
                  {formatRate(model.plannedPeakRps)}
                </strong>
                <span className="mt-1 block text-xs text-cyan-800/80 dark:text-cyan-200/80">
                  {inputs.peakFactor.toFixed(1)}x average
                </span>
              </div>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-5 py-6 dark:border-neutral-800 sm:px-7">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">3. Provision the envelope</p>
              <h3 className="mt-1 text-lg font-bold">Capacity and durability assumptions</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                This is the supply loop. Change fleet throughput or data durability without changing product demand.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
              <RangeControl
                id="capacity-service-units"
                label="Provisioned service units"
                hint="Instances, pods, workers, or accelerator replicas."
                value={inputs.serviceUnits}
                min={1}
                max={500}
                step={1}
                displayValue={formatCompact(inputs.serviceUnits)}
                onChange={(value) => updateInput('serviceUnits', value)}
              />
              <RangeControl
                id="capacity-rps-per-unit"
                label="Sustainable RPS per unit"
                hint="A benchmark result at acceptable tail latency, not a vendor maximum."
                value={inputs.rpsPerUnit}
                min={50}
                max={5000}
                step={10}
                displayValue={formatRate(inputs.rpsPerUnit)}
                onChange={(value) => updateInput('rpsPerUnit', value)}
              />
              <RangeControl
                id="capacity-retention"
                label="Retention"
                hint="How long the stored payload remains online."
                value={inputs.retentionDays}
                min={1}
                max={1095}
                step={1}
                displayValue={`${formatCompact(inputs.retentionDays)} days`}
                onChange={(value) => updateInput('retentionDays', value)}
              />
              <RangeControl
                id="capacity-replicas"
                label="Data copies"
                hint="Primary plus replicas; compression and indexes are excluded."
                value={inputs.replicas}
                min={1}
                max={5}
                step={1}
                displayValue={`${inputs.replicas}x`}
                onChange={(value) => updateInput('replicas', value)}
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-5 py-6 dark:border-neutral-800 sm:px-7">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300">4. Challenge the plan</p>
                <h3 className="mt-1 text-lg font-bold">What happens on a bad day?</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Select a mode to change demand, available capacity, and latency together.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Capacity challenge modes">
              {CHALLENGES.map((item) => {
                const Icon = item.icon;
                const selected = item.id === challengeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChallengeId(item.id)}
                    aria-pressed={selected}
                    className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      selected
                        ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <span className={`mt-2 block text-xs leading-5 ${selected ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="px-5 py-6 sm:px-7" aria-live="polite">
            <div className={`rounded-lg border p-5 ${statusStyle.panel}`}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <div className={`rounded-md p-2 ${statusStyle.badge}`}>
                    <StatusIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold uppercase ${statusStyle.badge}`}>
                      {statusStyle.label}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-neutral-950 dark:text-white">
                      {model.utilization.toFixed(0)}% of available service capacity
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {recommendation}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <span className="block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Estimated p95</span>
                  <strong className="mt-1 block text-2xl text-neutral-950 dark:text-white">
                    {formatCompact(model.estimatedP95Ms)} ms
                  </strong>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">queueing heuristic</span>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex justify-between gap-4 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Demand {formatRate(model.challengedPeakRps)}</span>
                  <span>Available {formatRate(model.availableRps)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded bg-white/80 shadow-inner dark:bg-black/40">
                  <div
                    className={`h-full rounded transition-[width] duration-300 motion-reduce:transition-none ${statusStyle.bar}`}
                    style={{ width: utilizationWidth }}
                  />
                </div>
                {model.droppedRps > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    {formatRate(model.droppedRps)} cannot be served without queueing, shedding, or scale-out.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid border-y border-neutral-200 dark:border-neutral-800 md:grid-cols-3">
              <div className="py-5 md:pr-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  Compute budget
                </div>
                <strong className="mt-2 block text-2xl">{model.requiredUnits} units required</strong>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  peak RPS / (unit RPS x 70% target x available fleet)
                </p>
              </div>
              <div className="border-t border-neutral-200 py-5 md:border-l md:border-t-0 md:px-6 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <HardDrive className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Storage budget
                </div>
                <strong className="mt-2 block text-2xl">{formatStorage(model.storedGigabytes)}</strong>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  actions x payload x {inputs.retentionDays} days x {inputs.replicas} copies
                </p>
              </div>
              <div className="border-t border-neutral-200 py-5 md:border-l md:border-t-0 md:pl-6 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Network className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                  Network budget
                </div>
                <strong className="mt-2 block text-2xl">{formatBandwidth(model.peakBandwidthMbps)}</strong>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {model.dailyTransferTerabytes.toFixed(model.dailyTransferTerabytes >= 100 ? 0 : 1)} TB/day of logical user payload
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex min-w-[620px] items-center justify-between gap-3" aria-label={`${scenario.label} capacity path`}>
                {scenario.architecture.map((node, index) => (
                  <div key={node} className="contents">
                    <div className="w-40 rounded-lg border border-neutral-300 bg-white p-3 text-center dark:border-neutral-700 dark:bg-neutral-950">
                      {index === 0 && <Activity className="mx-auto h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
                      {index === 1 && <Server className="mx-auto h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />}
                      {index === 2 && <Database className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
                      <span className="mt-2 block text-sm font-bold">{node}</span>
                      <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                        {index === 0 && formatRate(model.challengedPeakRps)}
                        {index === 1 && `${inputs.serviceUnits} units`}
                        {index === 2 && formatStorage(model.storedGigabytes)}
                      </span>
                    </div>
                    {index < scenario.architecture.length - 1 && (
                      <div className="flex min-w-16 flex-1 items-center" aria-hidden="true">
                        <div className={`h-1 w-full ${model.status === 'overloaded' ? 'bg-rose-400 dark:bg-rose-600' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
                        <ArrowRight className="-ml-1 h-5 w-5 shrink-0 text-neutral-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col justify-between gap-3 text-sm text-neutral-600 dark:text-neutral-400 md:flex-row md:items-center">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Decimal units are used. Compute follows amplified internal requests; storage and network follow one payload per user action.
                  Protocol overhead, indexes, compression, backups, and growth are excluded.
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 font-semibold">
                <Link href="/tools/capacity-planning" className="text-indigo-700 hover:underline dark:text-indigo-300">
                  Build a custom plan
                </Link>
                <Link href="/tools/load-testing" className="text-indigo-700 hover:underline dark:text-indigo-300">
                  Validate with load
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
