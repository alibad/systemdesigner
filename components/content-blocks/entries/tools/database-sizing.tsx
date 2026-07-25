'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  Database,
  Flame,
  HardDrive,
  Layers3,
  MemoryStick,
  RefreshCcw,
  Server,
  ShieldAlert,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ChallengeId =
  | 'baseline'
  | 'retention-shock'
  | 'index-growth'
  | 'node-failover'
  | 'hot-partition'
  | 'compaction';

type SizingInputs = {
  rowsPerDay: number;
  rowBytes: number;
  retentionDays: number;
  compressionPct: number;
  indexPct: number;
  replicationFactor: number;
  storageReservePct: number;
  hotDataPct: number;
  readQps: number;
  writeQps: number;
  concurrentConnections: number;
  nodeCount: number;
  memoryGbPerNode: number;
  iopsPerNode: number;
  readQpsPerNode: number;
  writeQpsPerNode: number;
  connectionsPerNode: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  badge: string;
  description: string;
  icon: typeof Activity;
};

type CapacityLaneProps = {
  label: string;
  demand: string;
  capacity: string;
  utilization: number;
  detail: string;
};

const DEFAULT_INPUTS: SizingInputs = {
  rowsPerDay: 2_500_000,
  rowBytes: 1_200,
  retentionDays: 365,
  compressionPct: 38,
  indexPct: 35,
  replicationFactor: 3,
  storageReservePct: 25,
  hotDataPct: 12,
  readQps: 18_000,
  writeQps: 3_000,
  concurrentConnections: 1_200,
  nodeCount: 6,
  memoryGbPerNode: 64,
  iopsPerNode: 14_000,
  readQpsPerNode: 5_000,
  writeQpsPerNode: 1_200,
  connectionsPerNode: 400,
};

const LIMITS: Record<keyof SizingInputs, { min: number; max: number }> = {
  rowsPerDay: { min: 1, max: 10_000_000_000 },
  rowBytes: { min: 1, max: 10_000_000 },
  retentionDays: { min: 1, max: 3_650 },
  compressionPct: { min: 0, max: 90 },
  indexPct: { min: 0, max: 300 },
  replicationFactor: { min: 1, max: 7 },
  storageReservePct: { min: 0, max: 100 },
  hotDataPct: { min: 1, max: 100 },
  readQps: { min: 0, max: 100_000_000 },
  writeQps: { min: 0, max: 100_000_000 },
  concurrentConnections: { min: 0, max: 10_000_000 },
  nodeCount: { min: 1, max: 10_000 },
  memoryGbPerNode: { min: 1, max: 100_000 },
  iopsPerNode: { min: 1, max: 10_000_000 },
  readQpsPerNode: { min: 1, max: 10_000_000 },
  writeQpsPerNode: { min: 1, max: 10_000_000 },
  connectionsPerNode: { min: 1, max: 1_000_000 },
};

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Planned peak',
    badge: 'Healthy case',
    description: 'All nodes are available and traffic is evenly distributed.',
    icon: CheckCircle2,
  },
  {
    id: 'retention-shock',
    label: 'Retention shock',
    badge: '1.8x history',
    description: 'A policy hold extends serving-store retention by 80%.',
    icon: HardDrive,
  },
  {
    id: 'index-growth',
    label: 'Index growth',
    badge: '+45 points',
    description: 'New access paths increase index overhead by 45 percentage points.',
    icon: Layers3,
  },
  {
    id: 'node-failover',
    label: 'Node failover',
    badge: 'One node lost',
    description: 'One node is unavailable and its traffic moves to the survivors.',
    icon: ShieldAlert,
  },
  {
    id: 'hot-partition',
    label: 'Hot partition',
    badge: '45% on one node',
    description: 'A single shard receives 45% of reads and writes.',
    icon: Flame,
  },
  {
    id: 'compaction',
    label: 'Compaction',
    badge: '2.2x write I/O',
    description: 'Background compaction adds temporary disk and write pressure.',
    icon: Workflow,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);

const formatCompact = (value: number, maximumFractionDigits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1_000)), units.length - 1);
  const value = bytes / Math.pow(1_000, unitIndex);
  return `${formatNumber(value, value < 10 ? 2 : value < 100 ? 1 : 0)} ${units[unitIndex]}`;
};

const formatPct = (value: number) => `${formatNumber(value, 0)}%`;

function safeInputs(inputs: SizingInputs): SizingInputs {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => {
      const limit = LIMITS[key as keyof SizingInputs];
      const finiteValue = Number.isFinite(value) ? value : limit.min;
      return [key, clamp(finiteValue, limit.min, limit.max)];
    }),
  ) as unknown as SizingInputs;
}

function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const invalid = !Number.isFinite(value) || value < min || value > max;

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        {unit ? <span className="font-normal text-neutral-500 dark:text-neutral-400">{unit}</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid}
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition focus:ring-2 focus:ring-cyan-500/30 dark:bg-neutral-950 dark:text-white ${
          invalid
            ? 'border-rose-500 focus:border-rose-500'
            : 'border-neutral-300 focus:border-cyan-700 dark:border-neutral-700 dark:focus:border-cyan-400'
        }`}
      />
      {hint ? <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span> : null}
      {invalid ? (
        <span className="mt-1 block text-xs font-semibold text-rose-700 dark:text-rose-300">
          Use {formatNumber(min, 2)} to {formatNumber(max, 2)}.
        </span>
      ) : null}
    </label>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="font-mono text-sm font-black text-neutral-950 dark:text-white">
          {formatNumber(value, step < 1 ? 1 : 0)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-cyan-700 dark:accent-cyan-400"
      />
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span>
    </label>
  );
}

function OptionGroup<T extends number>({
  label,
  value,
  values,
  onChange,
  format,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-900">
        {values.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`min-h-9 rounded px-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                selected
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
              }`}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  detail,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-300">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'neutral' | 'cyan' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    neutral:
      'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/70 dark:text-cyan-100',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100',
    amber:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100',
  };

  return (
    <div className={`min-w-0 border px-3 py-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-xl font-black tracking-normal">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function CapacityLane({ label, demand, capacity, utilization, detail }: CapacityLaneProps) {
  const normalized = Math.max(0, utilization);
  const width = Math.min(normalized * 100, 100);
  const tone =
    normalized > 1
      ? 'bg-rose-500 dark:bg-rose-400'
      : normalized > 0.8
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-emerald-500 dark:bg-emerald-400';
  const textTone =
    normalized > 1
      ? 'text-rose-700 dark:text-rose-300'
      : normalized > 0.8
        ? 'text-amber-800 dark:text-amber-200'
        : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className="border-b border-neutral-200 py-4 last:border-b-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-black text-neutral-950 dark:text-white">{label}</p>
        <p className={`font-mono text-sm font-black ${textTone}`}>{formatPct(normalized * 100)}</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <div className="mt-2 grid gap-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span>{demand} demand / {capacity} capacity</span>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function StorageAllocation({
  dataBytes,
  indexBytes,
  replicaBytes,
  reserveBytes,
  temporaryBytes,
}: {
  dataBytes: number;
  indexBytes: number;
  replicaBytes: number;
  reserveBytes: number;
  temporaryBytes: number;
}) {
  const segments = [
    { label: 'Primary data', value: dataBytes, style: 'bg-cyan-600 dark:bg-cyan-400' },
    { label: 'Primary indexes', value: indexBytes, style: 'bg-violet-600 dark:bg-violet-400' },
    { label: 'Replica copies', value: replicaBytes, style: 'bg-blue-600 dark:bg-blue-400' },
    { label: 'Free-space reserve', value: reserveBytes, style: 'bg-emerald-600 dark:bg-emerald-400' },
    { label: 'Temporary work', value: temporaryBytes, style: 'bg-amber-500 dark:bg-amber-400' },
  ].filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div>
      <div
        className="flex h-8 w-full overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`Provisioned storage of ${formatBytes(total)}, divided into data, indexes, replica copies, free-space reserve, and temporary work`}
      >
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={`h-full min-w-[3px] ${segment.style}`}
            style={{ width: `${(segment.value / Math.max(total, 1)) * 100}%` }}
            title={`${segment.label}: ${formatBytes(segment.value)}`}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex min-w-0 items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-sm ${segment.style}`} aria-hidden="true" />
            <span className="min-w-0 text-xs text-neutral-600 dark:text-neutral-300">
              <strong className="text-neutral-950 dark:text-white">{segment.label}</strong>
              <span className="ml-1 whitespace-nowrap">{formatBytes(segment.value)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DatabaseSizingTool() {
  const [inputs, setInputs] = useState<SizingInputs>(DEFAULT_INPUTS);
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');
  const [showAssumptions, setShowAssumptions] = useState(false);

  const updateInput = <K extends keyof SizingInputs>(key: K, value: SizingInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const commitInput = <K extends keyof SizingInputs>(key: K) => {
    const limit = LIMITS[key];
    setInputs((current) => ({
      ...current,
      [key]: clamp(Number.isFinite(current[key]) ? current[key] : limit.min, limit.min, limit.max),
    }));
  };

  const result = useMemo(() => {
    const model = safeInputs(inputs);
    const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];
    const effectiveRetentionDays =
      model.retentionDays * (challenge.id === 'retention-shock' ? 1.8 : 1);
    const effectiveIndexPct =
      model.indexPct + (challenge.id === 'index-growth' ? 45 : 0);
    const survivingNodes = Math.max(
      1,
      model.nodeCount - (challenge.id === 'node-failover' && model.nodeCount > 1 ? 1 : 0),
    );
    const totalRows = model.rowsPerDay * effectiveRetentionDays;
    const rawBytes = totalRows * model.rowBytes;
    const compressedDataBytes = rawBytes * (1 - model.compressionPct / 100);
    const primaryIndexBytes = compressedDataBytes * (effectiveIndexPct / 100);
    const primaryBytes = compressedDataBytes + primaryIndexBytes;
    const replicaBytes = primaryBytes * Math.max(model.replicationFactor - 1, 0);
    const durableBytes = primaryBytes + replicaBytes;
    const reserveBytes = durableBytes * (model.storageReservePct / 100);
    const temporaryBytes = challenge.id === 'compaction' ? primaryBytes * 0.2 : 0;
    const provisionedBytes = durableBytes + reserveBytes + temporaryBytes;
    const dailyDurableGrowthBytes =
      model.rowsPerDay *
      model.rowBytes *
      (1 - model.compressionPct / 100) *
      (1 + effectiveIndexPct / 100) *
      model.replicationFactor;
    const perNodeStorageBytes = provisionedBytes / survivingNodes;

    const workingSetBytes = primaryBytes * (model.hotDataPct / 100);
    const bufferBytes = survivingNodes * model.memoryGbPerNode * 1_000_000_000;
    const cacheCoverage = Math.min(bufferBytes / Math.max(workingSetBytes, 1), 1);
    const estimatedCacheHitPct = Math.min(99, 35 + cacheCoverage * 64);
    const cacheMissFraction = 1 - estimatedCacheHitPct / 100;
    const effectiveWriteAmplification =
      2 +
      effectiveIndexPct / 100 +
      (challenge.id === 'compaction' ? 2.2 : 0);
    const readIopsDemand = model.readQps * cacheMissFraction * 1.2;
    const writeIopsDemand = model.writeQps * effectiveWriteAmplification;
    const totalIopsDemand = readIopsDemand + writeIopsDemand;
    const totalIopsCapacity = survivingNodes * model.iopsPerNode;

    const readCapacity = survivingNodes * model.readQpsPerNode;
    const writeCapacity = survivingNodes * model.writeQpsPerNode;
    const connectionCapacity = survivingNodes * model.connectionsPerNode;
    const readUtilization = model.readQps / Math.max(readCapacity, 1);
    const writeUtilization = model.writeQps / Math.max(writeCapacity, 1);
    const iopsUtilization = totalIopsDemand / Math.max(totalIopsCapacity, 1);
    const connectionUtilization = model.concurrentConnections / Math.max(connectionCapacity, 1);
    const memoryUtilization = workingSetBytes / Math.max(bufferBytes, 1);
    const evenNodeShare = 1 / survivingNodes;
    const hottestNodeShare = challenge.id === 'hot-partition' ? 0.45 : evenNodeShare;
    const concentrationMultiplier = hottestNodeShare / Math.max(evenNodeShare, 0.0001);
    const hotNodeUtilization =
      Math.max(readUtilization, writeUtilization, iopsUtilization) * concentrationMultiplier;
    const capacityUtilization = Math.max(
      readUtilization,
      writeUtilization,
      iopsUtilization,
      connectionUtilization,
      memoryUtilization,
      hotNodeUtilization,
    );

    const storageReserveConsumed = temporaryBytes > reserveBytes;
    const status =
      capacityUtilization > 1 || storageReserveConsumed
        ? 'overloaded'
        : capacityUtilization > 0.8
          ? 'thin'
          : 'healthy';
    const lanes = [
      { id: 'read', value: readUtilization, label: 'Read throughput' },
      { id: 'write', value: writeUtilization, label: 'Write throughput' },
      { id: 'iops', value: iopsUtilization, label: 'Disk IOPS' },
      { id: 'connections', value: connectionUtilization, label: 'Connections' },
      { id: 'memory', value: memoryUtilization, label: 'Working-set memory' },
      { id: 'hot', value: hotNodeUtilization, label: 'Hottest node' },
    ];
    const bottleneck = [...lanes].sort((left, right) => right.value - left.value)[0];
    const requiredNodes = Math.max(
      Math.ceil(model.readQps / model.readQpsPerNode),
      Math.ceil(model.writeQps / model.writeQpsPerNode),
      Math.ceil(totalIopsDemand / model.iopsPerNode),
      Math.ceil(model.concurrentConnections / model.connectionsPerNode),
      Math.ceil(workingSetBytes / (model.memoryGbPerNode * 1_000_000_000)),
      challenge.id === 'hot-partition'
        ? Math.ceil(
            Math.max(readUtilization, writeUtilization, iopsUtilization) *
              concentrationMultiplier *
              survivingNodes,
          )
        : 1,
    );
    const nodeShortfall = Math.max(0, requiredNodes - survivingNodes);
    const recommendation =
      storageReserveConsumed
        ? `Compaction needs ${formatBytes(temporaryBytes)} of temporary space, more than the ${formatBytes(reserveBytes)} reserve. Increase free space or compact smaller partitions.`
        : bottleneck.id === 'memory' && bottleneck.value > 0.8
          ? `The hot working set is ${formatBytes(workingSetBytes)}. Add memory, reduce the hot-data window, or accept more disk reads.`
          : challenge.id === 'hot-partition' && hotNodeUtilization > 0.8
            ? 'Split or salt the hot key, isolate celebrity tenants, and verify the routing key before adding uniform capacity.'
            : nodeShortfall > 0
              ? `Add at least ${nodeShortfall} node${nodeShortfall === 1 ? '' : 's'} at these tested limits, or reduce the ${bottleneck.label.toLowerCase()} demand.`
              : capacityUtilization > 0.8
                ? `Capacity serves the scenario, but ${bottleneck.label.toLowerCase()} has less than 20% headroom. Raise the tested limit or provision one more node.`
                : 'Keep measured per-node limits, cache-hit rate, and connection-pool saturation aligned with this planning envelope.';

    return {
      model,
      challenge,
      effectiveRetentionDays,
      effectiveIndexPct,
      survivingNodes,
      totalRows,
      rawBytes,
      compressedDataBytes,
      primaryIndexBytes,
      primaryBytes,
      replicaBytes,
      durableBytes,
      reserveBytes,
      temporaryBytes,
      provisionedBytes,
      dailyDurableGrowthBytes,
      perNodeStorageBytes,
      workingSetBytes,
      bufferBytes,
      cacheCoverage,
      estimatedCacheHitPct,
      effectiveWriteAmplification,
      readIopsDemand,
      writeIopsDemand,
      totalIopsDemand,
      totalIopsCapacity,
      readCapacity,
      writeCapacity,
      connectionCapacity,
      readUtilization,
      writeUtilization,
      iopsUtilization,
      connectionUtilization,
      memoryUtilization,
      hottestNodeShare,
      hotNodeUtilization,
      capacityUtilization,
      storageReserveConsumed,
      status,
      bottleneck,
      requiredNodes,
      nodeShortfall,
      recommendation,
    };
  }, [challengeId, inputs]);

  const invalidFields = (Object.keys(inputs) as Array<keyof SizingInputs>).filter((key) => {
    const value = inputs[key];
    return !Number.isFinite(value) || value < LIMITS[key].min || value > LIMITS[key].max;
  });
  const statusLabel =
    result.status === 'healthy'
      ? 'Headroom intact'
      : result.status === 'thin'
        ? 'Headroom thin'
        : 'Capacity breached';
  const statusStyle =
    result.status === 'healthy'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
      : result.status === 'thin'
        ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
        : 'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100';
  const metricTone = result.status === 'healthy' ? 'emerald' : result.status === 'thin' ? 'amber' : 'rose';
  const hitWidth = result.estimatedCacheHitPct;
  const missWidth = 100 - hitWidth;

  return (
    <div
      data-content-block="tools/database-sizing"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
              <Database className="h-4 w-4" aria-hidden="true" />
              Database sizing workbench
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              Size the data and the path that serves it
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Model retained bytes, indexes, replicas, memory, throughput, IOPS, and connections,
              then inject the failure your spreadsheet usually leaves out.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`min-w-0 flex-1 rounded-md border px-3 py-2 lg:flex-none ${statusStyle}`}>
              <p className="text-[11px] font-black uppercase">Scenario status</p>
              <p className="mt-0.5 text-sm font-black">{statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputs(DEFAULT_INPUTS);
                setChallengeId('baseline');
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-neutral-700 text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Reset database sizing inputs"
              title="Reset database sizing inputs"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/70 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Pressure test</p>
            <h2 className="mt-1 text-base font-black text-neutral-950 dark:text-white">Operational challenge</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Challenges change the evaluated scenario, not the values you entered.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CHALLENGES.map((challenge) => {
            const Icon = challenge.icon;
            const selected = challenge.id === challengeId;
            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setChallengeId(challenge.id)}
                className={`min-h-[98px] rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? 'border-cyan-800 bg-cyan-800 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-300 dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-cyan-300 hover:bg-cyan-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/50'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-black">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{challenge.label}</span>
                  </span>
                  <span className={`shrink-0 text-[10px] font-black uppercase ${selected ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {challenge.badge}
                  </span>
                </span>
                <span className={`mt-2 block text-xs leading-5 ${selected ? 'text-cyan-50 dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}`}>
                  {challenge.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {invalidFields.length > 0 ? (
        <div
          role="alert"
          className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100 sm:px-6 lg:px-8"
        >
          <strong>Some inputs are outside the supported range.</strong> Results use the nearest valid
          boundary until those fields are corrected.
        </div>
      ) : null}

      <div className="grid min-w-0 xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:border-b-0 xl:border-r">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
            <SectionHeading
              icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 1"
              title="Data growth and durability"
              detail="Change the row stream, retention, index footprint, compression, or replica policy."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                label="Rows written per day"
                value={inputs.rowsPerDay}
                onChange={(value) => updateInput('rowsPerDay', value)}
                onCommit={() => commitInput('rowsPerDay')}
                {...LIMITS.rowsPerDay}
                step={10_000}
                unit="rows / day"
              />
              <NumberField
                label="Average row size"
                value={inputs.rowBytes}
                onChange={(value) => updateInput('rowBytes', value)}
                onCommit={() => commitInput('rowBytes')}
                {...LIMITS.rowBytes}
                step={100}
                unit="bytes"
                hint="Logical row before compression and indexes."
              />
              <RangeControl
                label="Serving retention"
                value={result.model.retentionDays}
                onChange={(value) => updateInput('retentionDays', value)}
                min={7}
                max={1_825}
                step={1}
                suffix=" days"
                hint="History kept in the serving database, not an archive."
              />
              <RangeControl
                label="Compression savings"
                value={result.model.compressionPct}
                onChange={(value) => updateInput('compressionPct', value)}
                min={0}
                max={80}
                suffix="%"
                hint="Measured storage saved from the primary row data."
              />
              <RangeControl
                label="Index overhead"
                value={result.model.indexPct}
                onChange={(value) => updateInput('indexPct', value)}
                min={0}
                max={150}
                suffix="%"
                hint="Index bytes as a percentage of compressed primary data."
              />
              <OptionGroup
                label="Replication factor"
                value={result.model.replicationFactor}
                values={[1, 2, 3]}
                onChange={(value) => updateInput('replicationFactor', value)}
                format={(value) => `${value}x`}
              />
              <RangeControl
                label="Free-space reserve"
                value={result.model.storageReservePct}
                onChange={(value) => updateInput('storageReservePct', value)}
                min={0}
                max={60}
                suffix="%"
                hint="Unallocated disk for growth, maintenance, and recovery."
              />
              <RangeControl
                label="Hot data window"
                value={result.model.hotDataPct}
                onChange={(value) => updateInput('hotDataPct', value)}
                min={1}
                max={100}
                suffix="%"
                hint="Share of primary data and indexes expected in the working set."
              />
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6">
            <SectionHeading
              icon={<Activity className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Loop 2"
              title="Workload and tested capacity"
              detail="Compare peak reads, writes, and connections with measured per-node limits."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                label="Peak read rate"
                value={inputs.readQps}
                onChange={(value) => updateInput('readQps', value)}
                onCommit={() => commitInput('readQps')}
                {...LIMITS.readQps}
                step={100}
                unit="queries / sec"
              />
              <NumberField
                label="Peak write rate"
                value={inputs.writeQps}
                onChange={(value) => updateInput('writeQps', value)}
                onCommit={() => commitInput('writeQps')}
                {...LIMITS.writeQps}
                step={100}
                unit="writes / sec"
              />
              <NumberField
                label="Concurrent connections"
                value={inputs.concurrentConnections}
                onChange={(value) => updateInput('concurrentConnections', value)}
                onCommit={() => commitInput('concurrentConnections')}
                {...LIMITS.concurrentConnections}
                step={50}
                unit="connections"
              />
              <OptionGroup
                label="Provisioned nodes"
                value={result.model.nodeCount}
                values={[3, 6, 9]}
                onChange={(value) => updateInput('nodeCount', value)}
                format={(value) => `${value} nodes`}
              />
              <NumberField
                label="Memory per node"
                value={inputs.memoryGbPerNode}
                onChange={(value) => updateInput('memoryGbPerNode', value)}
                onCommit={() => commitInput('memoryGbPerNode')}
                {...LIMITS.memoryGbPerNode}
                step={8}
                unit="GB"
              />
              <NumberField
                label="Disk limit per node"
                value={inputs.iopsPerNode}
                onChange={(value) => updateInput('iopsPerNode', value)}
                onCommit={() => commitInput('iopsPerNode')}
                {...LIMITS.iopsPerNode}
                step={500}
                unit="IOPS"
              />
              <NumberField
                label="Tested reads per node"
                value={inputs.readQpsPerNode}
                onChange={(value) => updateInput('readQpsPerNode', value)}
                onCommit={() => commitInput('readQpsPerNode')}
                {...LIMITS.readQpsPerNode}
                step={100}
                unit="queries / sec"
              />
              <NumberField
                label="Tested writes per node"
                value={inputs.writeQpsPerNode}
                onChange={(value) => updateInput('writeQpsPerNode', value)}
                onCommit={() => commitInput('writeQpsPerNode')}
                {...LIMITS.writeQpsPerNode}
                step={100}
                unit="writes / sec"
              />
              <NumberField
                label="Connection limit per node"
                value={inputs.connectionsPerNode}
                onChange={(value) => updateInput('connectionsPerNode', value)}
                onCommit={() => commitInput('connectionsPerNode')}
                {...LIMITS.connectionsPerNode}
                step={50}
                unit="connections"
              />
            </div>
          </section>
        </aside>

        <main className="min-w-0 bg-neutral-50 dark:bg-neutral-900/40">
          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-cyan-800 dark:text-cyan-300">Sizing envelope</p>
                <h2 className="mt-1 text-xl font-black text-neutral-950 dark:text-white">
                  {result.challenge.label}
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {result.challenge.description}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <Metric
                label="Provisioned storage"
                value={formatBytes(result.provisionedBytes)}
                detail={`${formatBytes(result.perNodeStorageBytes)} per surviving node`}
                icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
                tone="cyan"
              />
              <Metric
                label="Working set"
                value={formatBytes(result.workingSetBytes)}
                detail={`${formatPct(result.cacheCoverage * 100)} covered by memory`}
                icon={<MemoryStick className="h-4 w-4" aria-hidden="true" />}
                tone={result.memoryUtilization > 1 ? 'rose' : result.memoryUtilization > 0.8 ? 'amber' : 'neutral'}
              />
              <Metric
                label="Required nodes"
                value={formatNumber(result.requiredNodes)}
                detail={`${result.survivingNodes} survive this scenario`}
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                tone={metricTone}
              />
              <Metric
                label="Primary bottleneck"
                value={result.bottleneck.label}
                detail={`${formatPct(result.bottleneck.value * 100)} utilized`}
                icon={<CircleGauge className="h-4 w-4" aria-hidden="true" />}
                tone={metricTone}
              />
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Storage allocation</p>
                    <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                      See every byte added to the primary data
                    </h2>
                  </div>
                  <p className="font-mono text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    {formatBytes(result.dailyDurableGrowthBytes)} / day
                  </p>
                </div>
                <div className="mt-5">
                  <StorageAllocation
                    dataBytes={result.compressedDataBytes}
                    indexBytes={result.primaryIndexBytes}
                    replicaBytes={result.replicaBytes}
                    reserveBytes={result.reserveBytes}
                    temporaryBytes={result.temporaryBytes}
                  />
                </div>
                <div className="mt-5 rounded-md border border-neutral-200 bg-white px-4 py-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  <strong className="text-neutral-950 dark:text-white">Storage formula:</strong>{' '}
                  rows/day x {formatNumber(result.effectiveRetentionDays)} days x row bytes x
                  (1 - compression) x (1 + index overhead) x replication, then add the{' '}
                  {formatPct(result.model.storageReservePct)} free-space reserve
                  {result.temporaryBytes > 0 ? ' and compaction work space' : ''}.
                </div>
              </div>

              <div className="min-w-0 border-t border-neutral-200 pt-6 dark:border-neutral-800 2xl:border-l 2xl:border-t-0 2xl:pl-8 2xl:pt-0">
                <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Growth checkpoints</p>
                <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  Retention fills the serving store
                </h2>
                <div className="mt-5 space-y-4">
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const checkpointDays = result.effectiveRetentionDays * ratio;
                    const checkpointBytes =
                      result.durableBytes * ratio + result.reserveBytes * ratio;
                    return (
                      <div key={ratio}>
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="font-bold text-neutral-700 dark:text-neutral-200">
                            Day {formatNumber(checkpointDays)}
                          </span>
                          <span className="font-mono font-bold text-neutral-950 dark:text-white">
                            {formatBytes(checkpointBytes)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className="h-full rounded-full bg-cyan-600 dark:bg-cyan-400"
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  This assumes a steady ingest rate and immediate expiration after the retention window.
                  Backups and archives are intentionally excluded.
                </p>
              </div>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Serving path</p>
                <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  Trace workload from connections to disk
                </h2>
              </div>
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Cache hit rate is an illustrative estimate, not a benchmark.
              </p>
            </div>

            <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <Activity className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Clients</p>
                <p className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  {formatCompact(result.model.readQps + result.model.writeQps)} QPS
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatCompact(result.model.concurrentConnections)} concurrent
                </p>
              </div>
              <ArrowRight className="mx-auto h-5 w-5 self-center rotate-90 text-neutral-400 md:rotate-0" aria-hidden="true" />
              <div className="border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <Server className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Surviving fleet</p>
                <p className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  {result.survivingNodes} nodes
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  hottest gets {formatPct(result.hottestNodeShare * 100)}
                </p>
              </div>
              <ArrowRight className="mx-auto h-5 w-5 self-center rotate-90 text-neutral-400 md:rotate-0" aria-hidden="true" />
              <div className="border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <MemoryStick className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Buffer cache</p>
                <p className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  {formatPct(result.estimatedCacheHitPct)} hit
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatBytes(result.bufferBytes)} available
                </p>
              </div>
              <ArrowRight className="mx-auto h-5 w-5 self-center rotate-90 text-neutral-400 md:rotate-0" aria-hidden="true" />
              <div className="border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <HardDrive className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <p className="mt-3 text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Disk path</p>
                <p className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  {formatCompact(result.totalIopsDemand)} IOPS
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {formatPct(result.iopsUtilization * 100)} utilized
                </p>
              </div>
            </div>

            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${formatPct(hitWidth)} cache hits and ${formatPct(missWidth)} cache misses`}>
              <span className="h-full bg-emerald-500 dark:bg-emerald-400" style={{ width: `${hitWidth}%` }} />
              <span className="h-full bg-amber-500 dark:bg-amber-400" style={{ width: `${missWidth}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
              <span><strong className="text-emerald-700 dark:text-emerald-300">Memory:</strong> {formatPct(hitWidth)}</span>
              <span><strong className="text-amber-800 dark:text-amber-200">Disk:</strong> {formatPct(missWidth)}</span>
              <span><strong className="text-neutral-950 dark:text-white">Write amplification:</strong> {formatNumber(result.effectiveWriteAmplification, 1)}x</span>
            </div>
          </section>

          <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6 lg:px-8">
            <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-neutral-500 dark:text-neutral-400">Capacity lanes</p>
                <h2 className="mt-1 text-lg font-black text-neutral-950 dark:text-white">
                  One saturated lane can reject the design
                </h2>
                <div className="mt-3">
                  <CapacityLane
                    label="Read throughput"
                    demand={`${formatCompact(result.model.readQps)} QPS`}
                    capacity={`${formatCompact(result.readCapacity)} QPS`}
                    utilization={result.readUtilization}
                    detail="Measured query limit"
                  />
                  <CapacityLane
                    label="Write throughput"
                    demand={`${formatCompact(result.model.writeQps)} QPS`}
                    capacity={`${formatCompact(result.writeCapacity)} QPS`}
                    utilization={result.writeUtilization}
                    detail={`${formatNumber(result.effectiveWriteAmplification, 1)}x write amplification`}
                  />
                  <CapacityLane
                    label="Disk IOPS"
                    demand={`${formatCompact(result.totalIopsDemand)} IOPS`}
                    capacity={`${formatCompact(result.totalIopsCapacity)} IOPS`}
                    utilization={result.iopsUtilization}
                    detail={`${formatCompact(result.readIopsDemand)} read + ${formatCompact(result.writeIopsDemand)} write`}
                  />
                  <CapacityLane
                    label="Connections"
                    demand={`${formatCompact(result.model.concurrentConnections)} open`}
                    capacity={`${formatCompact(result.connectionCapacity)} open`}
                    utilization={result.connectionUtilization}
                    detail="Pool before database"
                  />
                  <CapacityLane
                    label="Working-set memory"
                    demand={formatBytes(result.workingSetBytes)}
                    capacity={formatBytes(result.bufferBytes)}
                    utilization={result.memoryUtilization}
                    detail="Primary hot data + indexes"
                  />
                  <CapacityLane
                    label="Hottest node"
                    demand={formatPct(result.hottestNodeShare * 100)}
                    capacity={`${formatPct(100 / result.survivingNodes)} even share`}
                    utilization={result.hotNodeUtilization}
                    detail="Concentrated lane pressure"
                  />
                </div>
              </div>

              <div className="min-w-0 border-t border-neutral-200 pt-6 dark:border-neutral-800 2xl:border-l 2xl:border-t-0 2xl:pl-8 2xl:pt-0">
                <div className={`border p-4 ${statusStyle}`}>
                  <div className="flex items-start gap-3">
                    {result.status === 'healthy' ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    )}
                    <div>
                      <p className="text-xs font-black uppercase">{statusLabel}</p>
                      <h2 className="mt-1 text-lg font-black">{result.bottleneck.label}</h2>
                      <p className="mt-2 text-sm leading-6">{result.recommendation}</p>
                    </div>
                  </div>
                </div>
                <dl className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">Rows retained</dt>
                    <dd className="text-right font-bold text-neutral-950 dark:text-white">{formatCompact(result.totalRows)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">Raw primary data</dt>
                    <dd className="text-right font-bold text-neutral-950 dark:text-white">{formatBytes(result.rawBytes)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">Durable stored bytes</dt>
                    <dd className="text-right font-bold text-neutral-950 dark:text-white">{formatBytes(result.durableBytes)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">Effective index overhead</dt>
                    <dd className="text-right font-bold text-neutral-950 dark:text-white">{formatPct(result.effectiveIndexPct)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="px-4 py-5 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-expanded={showAssumptions}
              onClick={() => setShowAssumptions((current) => !current)}
              className="flex w-full items-center justify-between gap-4 text-left text-sm font-black text-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-white"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                Illustrative assumptions and formulas
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{showAssumptions ? 'Hide' : 'Show'}</span>
            </button>
            {showAssumptions ? (
              <div className="mt-4 grid gap-5 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300 md:grid-cols-2">
                <div>
                  <p className="font-black text-neutral-950 dark:text-white">Storage model</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    <li>Compression applies to primary row data before index overhead.</li>
                    <li>Replication multiplies primary data and indexes, not free-space reserve.</li>
                    <li>Backups, snapshots, archive storage, and cross-region transfer are excluded.</li>
                    <li>Compaction temporarily needs 20% of primary data plus indexes.</li>
                  </ul>
                </div>
                <div>
                  <p className="font-black text-neutral-950 dark:text-white">Serving model</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    <li>Cache hit estimate = 35% + 64% x working-set memory coverage, capped at 99%.</li>
                    <li>Read misses cost 1.2 IOPS; writes cost 2 + index ratio IOPS before compaction.</li>
                    <li>Per-node read, write, IOPS, and connection limits must come from load tests.</li>
                    <li>The hottest-node lane applies traffic concentration to the busiest tested limit.</li>
                  </ul>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
