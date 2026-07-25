'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Cable,
  CheckCircle2,
  Clock3,
  DollarSign,
  Gauge,
  RotateCcw,
  Server,
  TriangleAlert,
  Zap,
} from 'lucide-react';

const MONTH_SECONDS = 30 * 24 * 60 * 60;
const CAPACITY_TIERS_GBPS = [1, 2.5, 5, 10, 25, 40, 100, 200, 400];

const DEFAULTS = {
  requestsPerSecond: 1_200,
  payloadKB: 64,
  compressionPct: 45,
  protocolOverheadPct: 12,
  peakMultiplier: 3,
  linkCapacityGbps: 2,
  targetUtilizationPct: 70,
  bulkTransferTB: 12,
  transferWindowHours: 6,
  egressCostPerGB: 0.05,
};

type CapacityStatus = 'healthy' | 'pressure' | 'overload';

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  onChange: (value: number) => void;
};

type RangeFieldProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  leftLabel: string;
  rightLabel: string;
  onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRate(gbps: number) {
  if (!Number.isFinite(gbps)) return 'Unavailable';
  if (gbps < 1) return `${Math.round(gbps * 1_000).toLocaleString()} Mbps`;
  return `${gbps.toLocaleString(undefined, { maximumFractionDigits: gbps >= 100 ? 0 : 2 })} Gbps`;
}

function formatTransfer(tb: number) {
  if (!Number.isFinite(tb)) return 'Unavailable';
  if (tb >= 1_000) {
    return `${(tb / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} PB`;
  }
  return `${tb.toLocaleString(undefined, { maximumFractionDigits: 1 })} TB`;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-md border border-neutral-300 bg-white transition focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-600/20 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-cyan-400">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = event.currentTarget.valueAsNumber;
            if (Number.isFinite(nextValue)) {
              onChange(clamp(nextValue, min, max));
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 bg-transparent px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none dark:text-white"
        />
        <span className="flex min-w-14 items-center justify-center border-l border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {unit}
        </span>
      </div>
      {hint ? <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
  );
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  leftLabel,
  rightLabel,
  onChange,
}: RangeFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
        <output
          htmlFor={id}
          className="min-w-16 rounded-md bg-neutral-100 px-2 py-1 text-center text-sm font-bold text-neutral-950 dark:bg-neutral-800 dark:text-white"
        >
          {value}
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
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer accent-cyan-600 dark:accent-cyan-400"
      />
      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function LoopHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-bold text-neutral-950 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: 'cyan' | 'violet' | 'emerald' | 'amber';
}) {
  const accentClasses = {
    cyan: 'border-cyan-500 text-cyan-700 dark:text-cyan-300',
    violet: 'border-violet-500 text-violet-700 dark:text-violet-300',
    emerald: 'border-emerald-500 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-500 text-amber-700 dark:text-amber-300',
  }[accent];

  return (
    <div className={`min-h-28 border-l-4 bg-white p-4 dark:bg-neutral-950 ${accentClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-normal text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

export default function BandwidthCalculator() {
  const [requestsPerSecond, setRequestsPerSecond] = useState(DEFAULTS.requestsPerSecond);
  const [payloadKB, setPayloadKB] = useState(DEFAULTS.payloadKB);
  const [compressionPct, setCompressionPct] = useState(DEFAULTS.compressionPct);
  const [protocolOverheadPct, setProtocolOverheadPct] = useState(DEFAULTS.protocolOverheadPct);
  const [peakMultiplier, setPeakMultiplier] = useState(DEFAULTS.peakMultiplier);
  const [linkCapacityGbps, setLinkCapacityGbps] = useState(DEFAULTS.linkCapacityGbps);
  const [targetUtilizationPct, setTargetUtilizationPct] = useState(DEFAULTS.targetUtilizationPct);
  const [bulkTransferTB, setBulkTransferTB] = useState(DEFAULTS.bulkTransferTB);
  const [transferWindowHours, setTransferWindowHours] = useState(DEFAULTS.transferWindowHours);
  const [egressCostPerGB, setEgressCostPerGB] = useState(DEFAULTS.egressCostPerGB);
  const [challengeActive, setChallengeActive] = useState(false);

  const safeRequestsPerSecond = Math.max(1, requestsPerSecond);
  const safePayloadKB = Math.max(0.1, payloadKB);
  const safeLinkCapacityGbps = Math.max(0.1, linkCapacityGbps);
  const safeTransferWindowHours = Math.max(0.25, transferWindowHours);

  const compressionFactor = 1 - compressionPct / 100;
  const overheadFactor = 1 + protocolOverheadPct / 100;
  const effectivePayloadKB = safePayloadKB * compressionFactor * overheadFactor;
  const uncompressedAverageGbps =
    (safeRequestsPerSecond * safePayloadKB * overheadFactor * 8) / 1_000_000;
  const averageGbps =
    (safeRequestsPerSecond * effectivePayloadKB * 8) / 1_000_000;
  const compressionSavingsGbps = Math.max(0, uncompressedAverageGbps - averageGbps);
  const monthlyTransferTB = (averageGbps / 8 / 1_000) * MONTH_SECONDS;

  const challengeDemandFactor = challengeActive ? 2 : 1;
  const challengeCapacityFactor = challengeActive ? 0.65 : 1;
  const peakRps = safeRequestsPerSecond * peakMultiplier * challengeDemandFactor;
  const peakGbps = averageGbps * peakMultiplier * challengeDemandFactor;
  const availableCapacityGbps = safeLinkCapacityGbps * challengeCapacityFactor;
  const safeCapacityGbps = availableCapacityGbps * (targetUtilizationPct / 100);
  const physicalUtilizationPct = (peakGbps / availableCapacityGbps) * 100;
  const targetGapGbps = peakGbps - safeCapacityGbps;
  const physicalGapGbps = peakGbps - availableCapacityGbps;

  let status: CapacityStatus = 'healthy';
  if (physicalGapGbps > 0) status = 'overload';
  else if (targetGapGbps > 0) status = 'pressure';

  const shedRatio = status === 'overload' ? clamp(physicalGapGbps / peakGbps, 0, 1) : 0;
  const estimatedRejectedRps = peakRps * shedRatio;
  const configuredCapacityRequired =
    peakGbps / (targetUtilizationPct / 100) / challengeCapacityFactor;
  const recommendedCapacityTier =
    CAPACITY_TIERS_GBPS.find((tier) => tier >= configuredCapacityRequired) ??
    Math.ceil(configuredCapacityRequired / 100) * 100;

  const bulkTransferGbps =
    (Math.max(0.01, bulkTransferTB) * 1_000 * 8) / (safeTransferWindowHours * 3_600);
  const safeSpareGbps = Math.max(0, safeCapacityGbps - peakGbps);
  const transferFits = bulkTransferGbps <= safeSpareGbps;
  const minimumWindowHours =
    safeSpareGbps > 0
      ? (Math.max(0.01, bulkTransferTB) * 1_000 * 8) / (safeSpareGbps * 3_600)
      : Number.POSITIVE_INFINITY;
  const estimatedTransferCost = Math.max(0.01, bulkTransferTB) * 1_000 * egressCostPerGB;

  const statusContent = {
    healthy: {
      label: 'Capacity healthy',
      summary: `${formatRate(safeCapacityGbps - peakGbps)} remains inside the target envelope.`,
      guidance: `Keep the ${linkCapacityGbps} Gbps link and load-test at ${Math.ceil(peakRps).toLocaleString()} req/s before launch.`,
      classes:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
      badge: 'bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950',
      Icon: CheckCircle2,
    },
    pressure: {
      label: 'Headroom exhausted',
      summary: `Demand fits physically, but exceeds the ${targetUtilizationPct}% operating target by ${formatRate(targetGapGbps)}.`,
      guidance: `Provision ${recommendedCapacityTier} Gbps or reduce effective payload before adding background traffic.`,
      classes:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
      badge: 'bg-amber-700 text-white dark:bg-amber-300 dark:text-amber-950',
      Icon: TriangleAlert,
    },
    overload: {
      label: 'Link overloaded',
      summary: `${formatRate(physicalGapGbps)} cannot cross the surviving link; about ${Math.round(estimatedRejectedRps).toLocaleString()} req/s must queue or shed.`,
      guidance: `Provision at least ${recommendedCapacityTier} Gbps, add an equivalent parallel path, or reduce payload demand before failover.`,
      classes:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
      badge: 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950',
      Icon: TriangleAlert,
    },
  }[status];

  const StatusIcon = statusContent.Icon;
  const comparisonMax = Math.max(peakGbps, availableCapacityGbps, 0.1);

  const reset = () => {
    setRequestsPerSecond(DEFAULTS.requestsPerSecond);
    setPayloadKB(DEFAULTS.payloadKB);
    setCompressionPct(DEFAULTS.compressionPct);
    setProtocolOverheadPct(DEFAULTS.protocolOverheadPct);
    setPeakMultiplier(DEFAULTS.peakMultiplier);
    setLinkCapacityGbps(DEFAULTS.linkCapacityGbps);
    setTargetUtilizationPct(DEFAULTS.targetUtilizationPct);
    setBulkTransferTB(DEFAULTS.bulkTransferTB);
    setTransferWindowHours(DEFAULTS.transferWindowHours);
    setEgressCostPerGB(DEFAULTS.egressCostPerGB);
    setChallengeActive(false);
  };

  return (
    <section
      data-content-block="tools/bandwidth-calculator"
      aria-labelledby="bandwidth-workbench-title"
      className="not-prose overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 text-neutral-950 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:flex lg:items-center lg:justify-between lg:gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-cyan-300">
            <Activity aria-hidden="true" className="h-4 w-4" />
            Capacity planning workbench
          </div>
          <h2 id="bandwidth-workbench-title" className="mt-2 text-2xl font-bold tracking-normal">
            Size the path, then break it safely
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-300">
            Turn workload demand into throughput, test the surviving link, and schedule bulk traffic without hiding the math.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0 lg:justify-end">
          <button
            type="button"
            aria-pressed={challengeActive}
            onClick={() => setChallengeActive((active) => !active)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${
              challengeActive
                ? 'border-rose-300 bg-rose-300 text-rose-950 hover:bg-rose-200'
                : 'border-neutral-600 bg-neutral-900 text-white hover:border-cyan-300 hover:text-cyan-200'
            }`}
          >
            <Zap aria-hidden="true" className="h-4 w-4" />
            {challengeActive ? 'Failover injected' : 'Inject failover'}
          </button>
          <button
            type="button"
            onClick={reset}
            title="Reset calculator"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-600 bg-neutral-900 text-neutral-200 transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Reset calculator</span>
          </button>
        </div>
      </header>

      <div className="grid xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="border-b border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900 xl:border-b-0 xl:border-r">
          <div className="space-y-5 p-4 sm:p-6">
            <LoopHeading
              number="1"
              title="Shape service demand"
              description="Request rate and effective payload determine the continuous network load."
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                id="bandwidth-rps"
                label="Average request rate"
                value={requestsPerSecond}
                min={1}
                max={10_000_000}
                unit="req/s"
                onChange={setRequestsPerSecond}
              />
              <NumberField
                id="bandwidth-payload"
                label="Payload before compression"
                value={payloadKB}
                min={0.1}
                max={1_000_000}
                step={0.1}
                unit="KB"
                hint="Decimal units: 1 KB = 1,000 bytes."
                onChange={setPayloadKB}
              />
            </div>
            <RangeField
              id="bandwidth-compression"
              label="Compression reduction"
              value={compressionPct}
              min={0}
              max={90}
              suffix="%"
              leftLabel="Raw payload"
              rightLabel="Smaller wire payload"
              onChange={setCompressionPct}
            />
            <RangeField
              id="bandwidth-overhead"
              label="Protocol overhead"
              value={protocolOverheadPct}
              min={0}
              max={40}
              suffix="%"
              leftLabel="Lean framing"
              rightLabel="Headers + encryption"
              onChange={setProtocolOverheadPct}
            />
          </div>

          <div className="space-y-5 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:p-6">
            <LoopHeading
              number="2"
              title="Protect the peak"
              description="Set a utilization target so retries and bursts still have somewhere to go."
            />
            <RangeField
              id="bandwidth-peak"
              label="Peak multiplier"
              value={peakMultiplier}
              min={1}
              max={10}
              step={0.5}
              suffix="x"
              leftLabel="Flat demand"
              rightLabel="Burst-heavy"
              onChange={setPeakMultiplier}
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <NumberField
                id="bandwidth-link-capacity"
                label="Provisioned link"
                value={linkCapacityGbps}
                min={0.1}
                max={400}
                step={0.1}
                unit="Gbps"
                onChange={setLinkCapacityGbps}
              />
              <RangeField
                id="bandwidth-target-utilization"
                label="Maximum target utilization"
                value={targetUtilizationPct}
                min={40}
                max={95}
                suffix="%"
                leftLabel="More headroom"
                rightLabel="Higher density"
                onChange={setTargetUtilizationPct}
              />
            </div>
          </div>

          <div className="space-y-5 border-t border-neutral-200 p-4 dark:border-neutral-800 sm:p-6">
            <LoopHeading
              number="3"
              title="Schedule bulk transfer"
              description="A backup or migration needs both a completion window and spare capacity."
            />
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <NumberField
                id="bandwidth-bulk-transfer"
                label="Transfer volume"
                value={bulkTransferTB}
                min={0.01}
                max={100_000}
                step={0.1}
                unit="TB"
                onChange={setBulkTransferTB}
              />
              <NumberField
                id="bandwidth-transfer-window"
                label="Completion window"
                value={transferWindowHours}
                min={0.25}
                max={720}
                step={0.25}
                unit="hours"
                onChange={setTransferWindowHours}
              />
              <NumberField
                id="bandwidth-egress-cost"
                label="Egress price assumption"
                value={egressCostPerGB}
                min={0}
                max={10}
                step={0.001}
                unit="$/GB"
                hint="Editable assumption; verify actual tiers and contracts."
                onChange={setEgressCostPerGB}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 p-4 sm:p-6">
          <div
            role="status"
            aria-live="polite"
            className={`min-h-40 rounded-lg border p-4 sm:p-5 ${statusContent.classes}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${statusContent.badge}`}>
                  <StatusIcon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{statusContent.label}</h3>
                    {challengeActive ? (
                      <span className="rounded-full border border-current px-2 py-0.5 text-xs font-bold">
                        2x demand · 35% path loss
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6">{statusContent.summary}</p>
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-normal opacity-70">Peak utilization</p>
                <p className="mt-1 text-3xl font-bold tracking-normal">
                  {physicalUtilizationPct.toLocaleString(undefined, { maximumFractionDigits: 0 })}%
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-current/20 pt-3 text-sm font-semibold">
              Capacity action: {statusContent.guidance}
            </div>
          </div>

          <div className="grid overflow-hidden rounded-lg border border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Wire payload"
              value={`${effectivePayloadKB.toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`}
              detail={`${compressionPct}% compression, then ${protocolOverheadPct}% overhead`}
              accent="cyan"
            />
            <Metric
              label="Average demand"
              value={formatRate(averageGbps)}
              detail={`${safeRequestsPerSecond.toLocaleString()} req/s continuously`}
              accent="violet"
            />
            <Metric
              label="Peak demand"
              value={formatRate(peakGbps)}
              detail={`${peakMultiplier}x peak${challengeActive ? ' and failover load' : ''}`}
              accent="amber"
            />
            <Metric
              label="30-day transfer"
              value={formatTransfer(monthlyTransferTB)}
              detail={`${formatRate(compressionSavingsGbps)} saved by compression`}
              accent="emerald"
            />
          </div>

          <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
                  <Gauge aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  Demand against the surviving path
                </div>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The target line reserves operational headroom; physical capacity is the hard ceiling.
                </p>
              </div>
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Recommended provisioned tier: <span className="text-neutral-950 dark:text-white">{recommendedCapacityTier} Gbps</span>
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between gap-4 text-xs font-semibold">
                  <span>Peak demand</span>
                  <span>{formatRate(peakGbps)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                      status === 'overload' ? 'bg-rose-600' : status === 'pressure' ? 'bg-amber-500' : 'bg-violet-600'
                    }`}
                    style={{ width: `${Math.min(100, (peakGbps / comparisonMax) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between gap-4 text-xs font-semibold">
                  <span>Available after scenario</span>
                  <span>{formatRate(availableCapacityGbps)}</span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-cyan-600 transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${Math.min(100, (availableCapacityGbps / comparisonMax) * 100)}%` }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                    style={{
                      left: `${Math.min(
                        99,
                        (safeCapacityGbps / comparisonMax) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid items-center gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="min-h-24 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-left dark:border-cyan-900 dark:bg-cyan-950/40">
                <Server aria-hidden="true" className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                <p className="mt-2 text-xs font-bold text-cyan-950 dark:text-cyan-100">Application demand</p>
                <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-200">{peakRps.toLocaleString()} req/s</p>
              </div>
              <ArrowRight aria-hidden="true" className="mx-auto h-4 w-4 rotate-90 text-neutral-400 sm:rotate-0" />
              <div className="min-h-24 rounded-md border border-violet-200 bg-violet-50 p-3 text-left dark:border-violet-900 dark:bg-violet-950/40">
                <Activity aria-hidden="true" className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                <p className="mt-2 text-xs font-bold text-violet-950 dark:text-violet-100">Encoded traffic</p>
                <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">{formatRate(peakGbps)}</p>
              </div>
              <ArrowRight aria-hidden="true" className="mx-auto h-4 w-4 rotate-90 text-neutral-400 sm:rotate-0" />
              <div className="min-h-24 rounded-md border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900 dark:bg-amber-950/40">
                <Cable aria-hidden="true" className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <p className="mt-2 text-xs font-bold text-amber-950 dark:text-amber-100">Surviving link</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{formatRate(availableCapacityGbps)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Clock3 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    Bulk-transfer window
                  </div>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    The transfer shares only the safe spare capacity left after peak service traffic.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    transferFits
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                      : 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100'
                  }`}
                >
                  {transferFits ? 'Window fits' : 'Window misses'}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Required transfer rate</p>
                  <p className="mt-1 text-lg font-bold">{formatRate(bulkTransferGbps)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Safe spare capacity</p>
                  <p className="mt-1 text-lg font-bold">{formatRate(safeSpareGbps)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Estimated egress</p>
                  <p className="mt-1 text-lg font-bold">{formatMoney(estimatedTransferCost)}</p>
                </div>
              </div>

              <p className="mt-4 border-t border-neutral-200 pt-3 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                {transferFits
                  ? `This transfer finishes in ${transferWindowHours} hours while preserving the ${targetUtilizationPct}% service target.`
                  : Number.isFinite(minimumWindowHours)
                    ? `Extend the window to at least ${minimumWindowHours.toFixed(1)} hours, move the job off-peak, or add capacity.`
                    : 'No safe spare capacity remains. Restore service headroom before scheduling background transfer.'}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-300 bg-neutral-950 p-4 text-white dark:border-neutral-700 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                <DollarSign aria-hidden="true" className="h-4 w-4" />
                Calculation contract
              </div>
              <dl className="mt-4 space-y-4 text-xs leading-5">
                <div>
                  <dt className="font-bold text-white">Continuous demand</dt>
                  <dd className="mt-1 font-mono text-neutral-300">
                    req/s × effective KB × 8 ÷ 1,000,000 = Gbps
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-white">Safe capacity</dt>
                  <dd className="mt-1 font-mono text-neutral-300">
                    link Gbps × surviving path × utilization target
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-white">Transfer rate</dt>
                  <dd className="mt-1 font-mono text-neutral-300">
                    TB × 1,000 × 8 ÷ window seconds = Gbps
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex items-start gap-2 border-t border-neutral-700 pt-4 text-xs leading-5 text-neutral-300">
                <Gauge aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>Costs exclude volume tiers, taxes, CDN effects, and private contracts. Treat the editable price as an assumption.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
