"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Database,
  Gauge,
  RotateCcw,
  Server,
  ShieldCheck,
  TimerOff,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type ArrivalModel = "open" | "closed";
type ChallengeId =
  | "planned-ramp"
  | "ramp-spike"
  | "soak-leak"
  | "dependency-slowdown"
  | "retry-storm"
  | "capacity-wall";

type TrafficInputs = {
  arrivalModel: ArrivalModel;
  targetRps: number;
  virtualUsers: number;
  pacingMs: number;
  durationMinutes: number;
  rampMinutes: number;
  writePercent: number;
};

type SystemInputs = {
  instances: number;
  instanceCapacityRps: number;
  dependencyLatencyMs: number;
  dependencyCapacityRps: number;
  dependencyErrorPercent: number;
  maxRetries: number;
  timeoutMs: number;
  memoryHeadroomPercent: number;
};

type ThresholdInputs = {
  targetP95Ms: number;
  targetErrorPercent: number;
  targetSaturationPercent: number;
  stopP99Ms: number;
  stopErrorPercent: number;
  stopQueueDepth: number;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  modifiers: string[];
  trafficMultiplier?: number;
  appCapacityMultiplier?: number;
  dependencyLatencyMultiplier?: number;
  dependencyCapacityMultiplier?: number;
  minimumDependencyError?: number;
  minimumRetries?: number;
  leakPercentPerHour?: number;
};

type Criterion = {
  label: string;
  actual: string;
  target: string;
  passed: boolean;
};

type StopCondition = {
  label: string;
  actual: string;
  target: string;
  triggered: boolean;
};

const DEFAULT_TRAFFIC: TrafficInputs = {
  arrivalModel: "open",
  targetRps: 1_800,
  virtualUsers: 600,
  pacingMs: 750,
  durationMinutes: 30,
  rampMinutes: 5,
  writePercent: 20,
};

const DEFAULT_SYSTEM: SystemInputs = {
  instances: 6,
  instanceCapacityRps: 520,
  dependencyLatencyMs: 65,
  dependencyCapacityRps: 2_600,
  dependencyErrorPercent: 1,
  maxRetries: 1,
  timeoutMs: 1_200,
  memoryHeadroomPercent: 35,
};

const DEFAULT_THRESHOLDS: ThresholdInputs = {
  targetP95Ms: 450,
  targetErrorPercent: 1,
  targetSaturationPercent: 80,
  stopP99Ms: 1_500,
  stopErrorPercent: 5,
  stopQueueDepth: 5_000,
};

const CHALLENGES: Challenge[] = [
  {
    id: "planned-ramp",
    label: "Planned ramp",
    badge: "Reference",
    description:
      "Increase traffic gradually to the configured peak and hold it inside the expected service envelope.",
    icon: CheckCircle2,
    modifiers: ["Configured ramp", "No fault injection"],
  },
  {
    id: "ramp-spike",
    label: "Ramp spike",
    badge: "2.4x burst",
    description:
      "A steady ramp is interrupted by an abrupt launch burst before the fleet has time to add capacity.",
    icon: Zap,
    trafficMultiplier: 2.4,
    modifiers: ["Peak traffic x 2.4", "Abrupt arrival-rate change"],
  },
  {
    id: "soak-leak",
    label: "Soak leak",
    badge: "12% / hour",
    description:
      "A minimum three-hour soak slowly consumes memory headroom and reduces useful application capacity.",
    icon: Clock3,
    leakPercentPerHour: 12,
    modifiers: ["Duration at least 180 minutes", "Capacity falls as headroom disappears"],
  },
  {
    id: "dependency-slowdown",
    label: "Dependency slowdown",
    badge: "5x latency",
    description:
      "A required downstream service gets slower and loses throughput while the application stays reachable.",
    icon: Database,
    dependencyLatencyMultiplier: 5,
    dependencyCapacityMultiplier: 0.6,
    minimumDependencyError: 4,
    modifiers: ["Dependency latency x 5", "Dependency capacity x 0.6", "Error floor 4%"],
  },
  {
    id: "retry-storm",
    label: "Retry storm",
    badge: "Failure feedback",
    description:
      "Dependency failures trigger immediate retries, increasing attempts against the same constrained service.",
    icon: RotateCcw,
    dependencyCapacityMultiplier: 0.75,
    minimumDependencyError: 28,
    minimumRetries: 3,
    modifiers: ["At least 3 retries", "Dependency error floor 28%", "Capacity x 0.75"],
  },
  {
    id: "capacity-wall",
    label: "Capacity wall",
    badge: "Fixed fleet",
    description:
      "Traffic climbs beyond tested fleet throughput while half of the expected scaling capacity is unavailable.",
    icon: Server,
    trafficMultiplier: 2,
    appCapacityMultiplier: 0.55,
    modifiers: ["Traffic x 2", "Application capacity x 0.55"],
  },
];

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-blue-400 dark:disabled:bg-neutral-900 dark:disabled:text-neutral-600";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);

const formatRps = (value: number) => `${formatNumber(value)} RPS`;
const formatMs = (value: number) => `${formatNumber(value)} ms`;
const formatPercent = (value: number) =>
  `${formatNumber(value, value < 10 ? 1 : 0)}%`;

function expectedAttemptCount(failureRate: number, retries: number) {
  let attempts = 1;
  let retryProbability = failureRate;

  for (let retry = 0; retry < retries; retry += 1) {
    attempts += retryProbability;
    retryProbability *= failureRate;
  }

  return attempts;
}

function NumberField({
  id,
  label,
  helper,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  helper?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200"
      >
        <span>{label}</span>
        {suffix ? (
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {suffix}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          if (Number.isFinite(nextValue)) {
            onChange(clamp(nextValue, min, max));
          }
        }}
        className={INPUT_CLASS}
      />
      {helper ? (
        <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {helper}
        </p>
      ) : null}
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
  valueLabel,
  lowLabel,
  highLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel: string;
  lowLabel: string;
  highLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200"
      >
        <span>{label}</span>
        <span className="font-mono text-blue-700 dark:text-blue-300">
          {valueLabel}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer accent-blue-600 dark:accent-blue-400"
      />
      <div className="mt-1.5 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "blue" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    neutral:
      "border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100",
    blue: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    rose: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
  }[tone];

  return (
    <div className={`min-w-0 rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-current opacity-70">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-2 break-words text-2xl font-bold">{value}</div>
      <p className="mt-1 text-xs leading-5 text-current opacity-75">{detail}</p>
    </div>
  );
}

function TrafficProfileChart({
  traffic,
  capacity,
  durationMinutes,
}: {
  traffic: number[];
  capacity: number[];
  durationMinutes: number;
}) {
  const maximum = Math.max(...traffic, ...capacity, 1) * 1.08;
  const width = 720;
  const height = 220;
  const left = 40;
  const right = 16;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const points = (values: number[]) =>
    values
      .map((value, index) => {
        const x = left + (index / Math.max(1, values.length - 1)) * plotWidth;
        const y = top + plotHeight - (value / maximum) * plotHeight;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-blue-600 dark:bg-blue-400" />
          Offered traffic
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 border-t-2 border-dashed border-emerald-600 dark:border-emerald-400" />
          Estimated throughput ceiling
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto min-h-44 w-full"
          role="img"
          aria-label="Estimated offered traffic and throughput ceiling over the configured test duration"
        >
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = top + plotHeight - plotHeight * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  className="stroke-neutral-200 dark:stroke-neutral-800"
                  strokeWidth="1"
                />
                <text
                  x={left - 7}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
                >
                  {formatNumber(maximum * ratio)}
                </text>
              </g>
            );
          })}
          <polyline
            points={points(capacity)}
            fill="none"
            className="stroke-emerald-600 dark:stroke-emerald-400"
            strokeWidth="3"
            strokeDasharray="8 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={points(traffic)}
            fill="none"
            className="stroke-blue-600 dark:stroke-blue-400"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x={left}
            y={height - 10}
            className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
          >
            0 min
          </text>
          <text
            x={width - right}
            y={height - 10}
            textAnchor="end"
            className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
          >
            {formatNumber(durationMinutes)} min
          </text>
        </svg>
      </div>
    </div>
  );
}

function BudgetBar({
  label,
  value,
  threshold,
  maximum,
  passed,
}: {
  label: string;
  value: number;
  threshold: number;
  maximum: number;
  passed: boolean;
}) {
  const valueWidth = clamp((value / maximum) * 100, 0, 100);
  const thresholdPosition = clamp((threshold / maximum) * 100, 0, 100);

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {label}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Target {formatMs(threshold)}
          </div>
        </div>
        <div
          className={`font-mono text-sm font-bold ${
            passed
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {formatMs(value)}
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${
            passed
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-rose-500 dark:bg-rose-400"
          }`}
          style={{ width: `${valueWidth}%` }}
        />
        <span
          className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
          style={{ left: `${thresholdPosition}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default function LoadTestingTool() {
  const [traffic, setTraffic] = useState<TrafficInputs>(DEFAULT_TRAFFIC);
  const [system, setSystem] = useState<SystemInputs>(DEFAULT_SYSTEM);
  const [thresholds, setThresholds] =
    useState<ThresholdInputs>(DEFAULT_THRESHOLDS);
  const [challengeId, setChallengeId] =
    useState<ChallengeId>("planned-ramp");

  const model = useMemo(() => {
    const challenge =
      CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];
    const readFraction = (100 - traffic.writePercent) / 100;
    const writeFraction = traffic.writePercent / 100;
    const workUnitsPerRequest = readFraction + writeFraction * 2.8;
    const dependencyOpsPerRequest =
      readFraction * 0.45 + writeFraction * 1.9;
    const durationMinutes =
      challenge.id === "soak-leak"
        ? Math.max(180, traffic.durationMinutes)
        : traffic.durationMinutes;
    const leakPercent = clamp(
      ((challenge.leakPercentPerHour ?? 0) * durationMinutes) / 60,
      0,
      70,
    );
    const remainingHeadroom = Math.max(
      0,
      system.memoryHeadroomPercent - leakPercent,
    );
    const leakCapacityMultiplier =
      challenge.id === "soak-leak"
        ? clamp(
            0.45 +
              (remainingHeadroom / Math.max(1, system.memoryHeadroomPercent)) *
                0.55,
            0.45,
            1,
          )
        : 1;
    const dependencyLatencyMs =
      system.dependencyLatencyMs *
      (challenge.dependencyLatencyMultiplier ?? 1);
    const baseServiceMs =
      42 + dependencyLatencyMs * dependencyOpsPerRequest + writeFraction * 35;
    const closedLoopRps =
      (traffic.virtualUsers * 1_000) /
      Math.max(1, baseServiceMs + traffic.pacingMs);
    const configuredRps =
      traffic.arrivalModel === "open" ? traffic.targetRps : closedLoopRps;
    const trafficMultiplier = challenge.trafficMultiplier ?? 1;
    const offeredRps = configuredRps * trafficMultiplier;
    const appCapacityUnits =
      system.instances *
      system.instanceCapacityRps *
      (challenge.appCapacityMultiplier ?? 1) *
      leakCapacityMultiplier;
    const appCapacityRps = appCapacityUnits / workUnitsPerRequest;
    const dependencyCapacityRps =
      system.dependencyCapacityRps *
      (challenge.dependencyCapacityMultiplier ?? 1);
    const retries = Math.max(
      system.maxRetries,
      challenge.minimumRetries ?? 0,
    );
    const configuredDependencyFailure = Math.max(
      system.dependencyErrorPercent / 100,
      (challenge.minimumDependencyError ?? 0) / 100,
    );

    let dependencyFailure = configuredDependencyFailure;
    let attempts = expectedAttemptCount(dependencyFailure, retries);
    let appAcceptedRps = Math.min(offeredRps, appCapacityRps);
    let dependencyDemandRps =
      appAcceptedRps * dependencyOpsPerRequest * attempts;
    let dependencyUtilization =
      dependencyDemandRps / Math.max(1, dependencyCapacityRps);

    const overloadFailure = clamp(
      (dependencyUtilization - 0.85) * 0.32,
      0,
      0.5,
    );
    dependencyFailure = clamp(
      configuredDependencyFailure + overloadFailure,
      0,
      0.82,
    );
    attempts = expectedAttemptCount(dependencyFailure, retries);
    dependencyDemandRps =
      appAcceptedRps * dependencyOpsPerRequest * attempts;
    dependencyUtilization =
      dependencyDemandRps / Math.max(1, dependencyCapacityRps);

    const dependencyLogicalCapacityRps =
      dependencyCapacityRps /
      Math.max(0.01, dependencyOpsPerRequest * attempts);
    const admittedRps = Math.min(
      offeredRps,
      appCapacityRps,
      dependencyLogicalCapacityRps,
    );
    const appUtilization = offeredRps / Math.max(1, appCapacityRps);
    const criticalUtilization = Math.max(
      appUtilization,
      dependencyUtilization,
    );
    const boundedUtilization = Math.min(criticalUtilization, 0.98);
    const queueFactor =
      criticalUtilization <= 0.65
        ? 0
        : criticalUtilization >= 1
          ? 6 + (criticalUtilization - 1) * 10
          : Math.pow(
                (criticalUtilization - 0.65) /
                  Math.max(0.04, 1 - boundedUtilization),
                1.18,
              ) * 0.18;
    const queueDelayMs = Math.min(
      system.timeoutMs * 1.8,
      baseServiceMs * queueFactor,
    );
    const retryPenaltyMs = dependencyLatencyMs * Math.max(0, attempts - 1);
    const leakTailMultiplier = 1 + leakPercent / 180;
    const p50Ms =
      (baseServiceMs + queueDelayMs * 0.24 + retryPenaltyMs * 0.35) *
      leakTailMultiplier;
    const p95Ms =
      (baseServiceMs + queueDelayMs + retryPenaltyMs) *
      (1.55 + Math.max(0, criticalUtilization - 0.7) * 0.9) *
      leakTailMultiplier;
    const p99Ms =
      (baseServiceMs + queueDelayMs * 1.65 + retryPenaltyMs * 1.4) *
      (2.15 + Math.max(0, criticalUtilization - 0.7) * 1.2) *
      leakTailMultiplier;
    const capacityLoss = clamp(
      (offeredRps - admittedRps) / Math.max(1, offeredRps),
      0,
      1,
    );
    const finalDependencyFailure = Math.pow(
      dependencyFailure,
      retries + 1,
    );
    const requestDependencyFailure =
      1 -
      Math.pow(
        1 - finalDependencyFailure,
        Math.max(0.25, dependencyOpsPerRequest),
      );
    const timeoutFailure =
      p99Ms > system.timeoutMs
        ? clamp(((p99Ms - system.timeoutMs) / p99Ms) * 0.32, 0, 0.32)
        : 0;
    const errorFraction =
      1 -
      (1 - capacityLoss) *
        (1 - requestDependencyFailure) *
        (1 - timeoutFailure);
    const errorPercent = clamp(errorFraction * 100, 0, 100);
    const successfulRps = admittedRps * (1 - errorFraction);
    const queueDepth =
      Math.max(0, offeredRps - admittedRps) *
        (system.timeoutMs / 1_000) +
      (criticalUtilization > 0.85
        ? admittedRps * (criticalUtilization - 0.85) * 0.25
        : 0);
    const concurrency = offeredRps * (p50Ms / 1_000);
    const requiredVirtualUsers = Math.ceil(
      offeredRps * ((p50Ms + traffic.pacingMs) / 1_000),
    );
    const totalRequests = admittedRps * durationMinutes * 60;
    const estimatedErrors = totalRequests * errorFraction;
    const throughputCeiling = Math.min(
      appCapacityRps,
      dependencyLogicalCapacityRps,
    );

    const criteria: Criterion[] = [
      {
        label: "P95 latency",
        actual: formatMs(p95Ms),
        target: `<= ${formatMs(thresholds.targetP95Ms)}`,
        passed: p95Ms <= thresholds.targetP95Ms,
      },
      {
        label: "Error rate",
        actual: formatPercent(errorPercent),
        target: `<= ${formatPercent(thresholds.targetErrorPercent)}`,
        passed: errorPercent <= thresholds.targetErrorPercent,
      },
      {
        label: "Peak saturation",
        actual: formatPercent(criticalUtilization * 100),
        target: `<= ${formatPercent(thresholds.targetSaturationPercent)}`,
        passed:
          criticalUtilization * 100 <=
          thresholds.targetSaturationPercent,
      },
    ];
    const stopConditions: StopCondition[] = [
      {
        label: "P99 latency stop",
        actual: formatMs(p99Ms),
        target: `> ${formatMs(thresholds.stopP99Ms)}`,
        triggered: p99Ms > thresholds.stopP99Ms,
      },
      {
        label: "Error-rate stop",
        actual: formatPercent(errorPercent),
        target: `> ${formatPercent(thresholds.stopErrorPercent)}`,
        triggered: errorPercent > thresholds.stopErrorPercent,
      },
      {
        label: "Queue-depth stop",
        actual: formatNumber(queueDepth),
        target: `> ${formatNumber(thresholds.stopQueueDepth)}`,
        triggered: queueDepth > thresholds.stopQueueDepth,
      },
    ];
    const triggeredStops = stopConditions.filter((item) => item.triggered);
    const failedCriteria = criteria.filter((item) => !item.passed);
    const verdict: "pass" | "fail" | "abort" =
      triggeredStops.length > 0
        ? "abort"
        : failedCriteria.length > 0
          ? "fail"
          : "pass";

    const pointCount = 12;
    const trafficProfile = Array.from({ length: pointCount }, (_, index) => {
      const progress = index / (pointCount - 1);
      const rampShare = clamp(
        traffic.rampMinutes / Math.max(1, durationMinutes),
        0.05,
        0.8,
      );
      const rampProgress = clamp(progress / rampShare, 0, 1);

      if (challenge.id === "ramp-spike") {
        const spike =
          index < 5 ? 1 : index === 5 ? 1.45 : index <= 7 ? 2.4 : 1.3;
        return configuredRps * rampProgress * spike;
      }
      if (challenge.id === "soak-leak") {
        return configuredRps * (0.94 + Math.sin(index * 1.7) * 0.025);
      }
      if (challenge.id === "capacity-wall") {
        return configuredRps * rampProgress * (1 + progress);
      }
      return configuredRps * rampProgress * trafficMultiplier;
    });
    const capacityProfile = Array.from(
      { length: pointCount },
      (_, index) => {
        if (challenge.id !== "soak-leak") return throughputCeiling;
        const progress = index / (pointCount - 1);
        const progressiveLeakMultiplier = clamp(
          1 - (leakPercent / 100) * progress,
          0.45,
          1,
        );
        return Math.min(
          (system.instances *
            system.instanceCapacityRps *
            progressiveLeakMultiplier) /
            workUnitsPerRequest,
          dependencyLogicalCapacityRps,
        );
      },
    );

    const bottleneck =
      appUtilization >= dependencyUtilization
        ? "Application fleet"
        : "Required dependency";
    const requestedModel =
      traffic.arrivalModel === "open"
        ? `${formatRps(offeredRps)} open-loop arrival`
        : `${formatNumber(traffic.virtualUsers)} closed-loop virtual users`;

    return {
      challenge,
      durationMinutes,
      readPercent: 100 - traffic.writePercent,
      workUnitsPerRequest,
      dependencyOpsPerRequest,
      configuredRps,
      offeredRps,
      appCapacityRps,
      dependencyCapacityRps,
      dependencyLogicalCapacityRps,
      admittedRps,
      successfulRps,
      appUtilization,
      dependencyUtilization,
      criticalUtilization,
      dependencyFailure,
      attempts,
      baseServiceMs,
      p50Ms,
      p95Ms,
      p99Ms,
      errorPercent,
      queueDepth,
      concurrency,
      requiredVirtualUsers,
      totalRequests,
      estimatedErrors,
      remainingHeadroom,
      leakPercent,
      trafficProfile,
      capacityProfile,
      throughputCeiling,
      criteria,
      stopConditions,
      triggeredStops,
      failedCriteria,
      verdict,
      bottleneck,
      requestedModel,
    };
  }, [challengeId, system, thresholds, traffic]);

  const reset = () => {
    setTraffic(DEFAULT_TRAFFIC);
    setSystem(DEFAULT_SYSTEM);
    setThresholds(DEFAULT_THRESHOLDS);
    setChallengeId("planned-ramp");
  };

  const verdictStyle = {
    pass: {
      label: "Plan passes",
      icon: ShieldCheck,
      panel:
        "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
      text: "text-emerald-950 dark:text-emerald-100",
      badge:
        "bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950",
      message:
        "The estimate stays inside every acceptance threshold and no stop condition fires.",
    },
    fail: {
      label: "Plan fails",
      icon: XCircle,
      panel:
        "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
      text: "text-amber-950 dark:text-amber-100",
      badge: "bg-amber-700 text-white dark:bg-amber-300 dark:text-amber-950",
      message:
        "The test can continue, but one or more acceptance thresholds are outside the target.",
    },
    abort: {
      label: "Stop condition",
      icon: TimerOff,
      panel:
        "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40",
      text: "text-rose-950 dark:text-rose-100",
      badge: "bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950",
      message:
        "The estimated run crosses a safety limit. A real test should stop and preserve the system under test.",
    },
  }[model.verdict];
  const VerdictIcon = verdictStyle.icon;

  return (
    <section
      data-content-block="tools/load-testing"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-300">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Load-test design workbench
            </div>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Design the run before generating traffic
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300 sm:text-base">
              Shape arrivals, model service limits, inject failure, and decide
              whether the planned run should pass, fail, or stop.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 text-xs font-bold text-blue-200">
              Planning estimate, not measured data
            </span>
            <button
              type="button"
              onClick={reset}
              title="Reset load-test plan"
              aria-label="Reset load-test plan"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <section aria-labelledby="challenge-heading">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">
              Challenge mode
            </div>
            <h3
              id="challenge-heading"
              className="mt-1 text-xl font-bold text-neutral-950 dark:text-white"
            >
              Pressure-test the healthy plan
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CHALLENGES.map((challenge) => {
              const Icon = challenge.icon;
              const selected = challenge.id === challengeId;
              return (
                <button
                  key={challenge.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChallengeId(challenge.id)}
                  className={`min-w-0 rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-950 ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-300 dark:bg-blue-300 dark:text-blue-950"
                      : "border-neutral-200 bg-white text-neutral-900 hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                        selected
                          ? "bg-white/20 text-white dark:bg-blue-950/15 dark:text-blue-950"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {challenge.badge}
                    </span>
                  </div>
                  <div className="mt-3 font-bold">{challenge.label}</div>
                  <p
                    className={`mt-1 text-sm leading-5 ${
                      selected
                        ? "text-blue-50 dark:text-blue-950/75"
                        : "text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    {challenge.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.challenge.modifiers.map((modifier) => (
              <span
                key={modifier}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
              >
                {modifier}
              </span>
            ))}
          </div>
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.35fr)]">
          <div className="min-w-0 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <section
              aria-labelledby="traffic-heading"
              className="border-b border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  1
                </div>
                <div>
                  <h3
                    id="traffic-heading"
                    className="text-lg font-bold text-neutral-950 dark:text-white"
                  >
                    Shape traffic and workload
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
                    Choose how load is generated, then define journey cost.
                  </p>
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Arrival model
                </legend>
                <div className="grid grid-cols-2 rounded-md bg-neutral-100 p-1 dark:bg-neutral-950">
                  {(
                    [
                      {
                        value: "open",
                        label: "Open-loop RPS",
                        detail: "Fixed arrivals",
                      },
                      {
                        value: "closed",
                        label: "Closed-loop VUs",
                        detail: "Iteration pacing",
                      },
                    ] as const
                  ).map((option) => {
                    const selected =
                      traffic.arrivalModel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setTraffic((current) => ({
                            ...current,
                            arrivalModel: option.value,
                          }))
                        }
                        className={`rounded-md px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          selected
                            ? "bg-white text-blue-800 shadow-sm dark:bg-blue-300 dark:text-blue-950"
                            : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                        }`}
                      >
                        <span className="block text-sm font-bold">
                          {option.label}
                        </span>
                        <span className="block text-xs opacity-75">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <NumberField
                  id="load-target-rps"
                  label="Target arrival rate"
                  suffix="RPS"
                  value={traffic.targetRps}
                  min={1}
                  max={100_000}
                  disabled={traffic.arrivalModel !== "open"}
                  helper="Open-loop generators maintain arrivals even when responses slow."
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      targetRps: value,
                    }))
                  }
                />
                <NumberField
                  id="load-virtual-users"
                  label="Virtual users"
                  suffix="VUs"
                  value={traffic.virtualUsers}
                  min={1}
                  max={100_000}
                  disabled={traffic.arrivalModel !== "closed"}
                  helper="Closed-loop users wait for a response and then apply pacing."
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      virtualUsers: value,
                    }))
                  }
                />
                <NumberField
                  id="load-pacing"
                  label="Pacing after iteration"
                  suffix="ms"
                  value={traffic.pacingMs}
                  min={0}
                  max={60_000}
                  helper="Used to estimate VU demand in both planning modes."
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      pacingMs: value,
                    }))
                  }
                />
                <NumberField
                  id="load-duration"
                  label="Test duration"
                  suffix="minutes"
                  value={traffic.durationMinutes}
                  min={1}
                  max={1_440}
                  helper={
                    challengeId === "soak-leak"
                      ? "The soak challenge uses at least 180 minutes."
                      : "Excludes setup, data seeding, and cool-down."
                  }
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      durationMinutes: value,
                    }))
                  }
                />
                <NumberField
                  id="load-ramp"
                  label="Ramp duration"
                  suffix="minutes"
                  value={traffic.rampMinutes}
                  min={1}
                  max={Math.max(1, traffic.durationMinutes)}
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      rampMinutes: value,
                    }))
                  }
                />
              </div>

              <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <RangeField
                  id="load-write-mix"
                  label="Write-heavy journey share"
                  value={traffic.writePercent}
                  min={0}
                  max={80}
                  valueLabel={`${traffic.writePercent}% writes`}
                  lowLabel="Read-heavy"
                  highLabel="Write-heavy"
                  onChange={(value) =>
                    setTraffic((current) => ({
                      ...current,
                      writePercent: value,
                    }))
                  }
                />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md bg-blue-50 p-3 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100">
                    <div className="text-xs font-bold uppercase opacity-70">
                      Reads
                    </div>
                    <div className="mt-1 text-xl font-bold">
                      {model.readPercent}%
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      1.0 work unit
                    </div>
                  </div>
                  <div className="rounded-md bg-violet-50 p-3 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
                    <div className="text-xs font-bold uppercase opacity-70">
                      Writes
                    </div>
                    <div className="mt-1 text-xl font-bold">
                      {traffic.writePercent}%
                    </div>
                    <div className="mt-1 text-xs opacity-75">
                      2.8 work units
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="system-heading"
              className="border-b border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  2
                </div>
                <div>
                  <h3
                    id="system-heading"
                    className="text-lg font-bold text-neutral-950 dark:text-white"
                  >
                    Define the system envelope
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
                    Use limits measured in a controlled environment when available.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  id="load-instances"
                  label="Application instances"
                  value={system.instances}
                  min={1}
                  max={1_000}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      instances: value,
                    }))
                  }
                />
                <NumberField
                  id="load-instance-capacity"
                  label="Tested capacity / instance"
                  suffix="work units/s"
                  value={system.instanceCapacityRps}
                  min={1}
                  max={100_000}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      instanceCapacityRps: value,
                    }))
                  }
                />
                <NumberField
                  id="load-dependency-latency"
                  label="Dependency baseline"
                  suffix="ms"
                  value={system.dependencyLatencyMs}
                  min={1}
                  max={60_000}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      dependencyLatencyMs: value,
                    }))
                  }
                />
                <NumberField
                  id="load-dependency-capacity"
                  label="Dependency capacity"
                  suffix="operations/s"
                  value={system.dependencyCapacityRps}
                  min={1}
                  max={1_000_000}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      dependencyCapacityRps: value,
                    }))
                  }
                />
                <NumberField
                  id="load-dependency-errors"
                  label="Dependency error rate"
                  suffix="%"
                  value={system.dependencyErrorPercent}
                  min={0}
                  max={80}
                  step={0.1}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      dependencyErrorPercent: value,
                    }))
                  }
                />
                <NumberField
                  id="load-retries"
                  label="Maximum retries"
                  value={system.maxRetries}
                  min={0}
                  max={5}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      maxRetries: value,
                    }))
                  }
                />
                <NumberField
                  id="load-timeout"
                  label="Request timeout"
                  suffix="ms"
                  value={system.timeoutMs}
                  min={50}
                  max={120_000}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      timeoutMs: value,
                    }))
                  }
                />
                <NumberField
                  id="load-memory-headroom"
                  label="Memory headroom"
                  suffix="%"
                  value={system.memoryHeadroomPercent}
                  min={1}
                  max={80}
                  onChange={(value) =>
                    setSystem((current) => ({
                      ...current,
                      memoryHeadroomPercent: value,
                    }))
                  }
                />
              </div>
            </section>

            <section
              aria-labelledby="threshold-heading"
              className="p-4 sm:p-5"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  3
                </div>
                <div>
                  <h3
                    id="threshold-heading"
                    className="text-lg font-bold text-neutral-950 dark:text-white"
                  >
                    Set acceptance and stop limits
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
                    Acceptance defines success. Stop limits protect the test system.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  id="load-target-p95"
                  label="Pass: P95 latency"
                  suffix="ms"
                  value={thresholds.targetP95Ms}
                  min={10}
                  max={120_000}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      targetP95Ms: value,
                    }))
                  }
                />
                <NumberField
                  id="load-target-errors"
                  label="Pass: error rate"
                  suffix="%"
                  value={thresholds.targetErrorPercent}
                  min={0}
                  max={50}
                  step={0.1}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      targetErrorPercent: value,
                    }))
                  }
                />
                <NumberField
                  id="load-target-saturation"
                  label="Pass: saturation"
                  suffix="%"
                  value={thresholds.targetSaturationPercent}
                  min={10}
                  max={100}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      targetSaturationPercent: value,
                    }))
                  }
                />
                <NumberField
                  id="load-stop-p99"
                  label="Stop: P99 latency"
                  suffix="ms"
                  value={thresholds.stopP99Ms}
                  min={50}
                  max={120_000}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      stopP99Ms: value,
                    }))
                  }
                />
                <NumberField
                  id="load-stop-errors"
                  label="Stop: error rate"
                  suffix="%"
                  value={thresholds.stopErrorPercent}
                  min={0.1}
                  max={100}
                  step={0.1}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      stopErrorPercent: value,
                    }))
                  }
                />
                <NumberField
                  id="load-stop-queue"
                  label="Stop: queue depth"
                  suffix="requests"
                  value={thresholds.stopQueueDepth}
                  min={1}
                  max={1_000_000}
                  onChange={(value) =>
                    setThresholds((current) => ({
                      ...current,
                      stopQueueDepth: value,
                    }))
                  }
                />
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-5">
            <section
              aria-live="polite"
              className={`rounded-lg border p-5 ${verdictStyle.panel} ${verdictStyle.text}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <VerdictIcon
                    className="mt-0.5 h-6 w-6 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase opacity-70">
                      Estimated run verdict
                    </div>
                    <h3 className="mt-1 text-2xl font-bold">
                      {verdictStyle.label}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
                      {verdictStyle.message}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase ${verdictStyle.badge}`}
                >
                  {model.challenge.label}
                </span>
              </div>
              <div className="mt-4 border-t border-current/15 pt-4 text-sm">
                <strong>{model.requestedModel}</strong>
                <span className="mx-2 opacity-50">/</span>
                <span>{model.bottleneck} is the tightest constraint</span>
              </div>
            </section>

            <section
              aria-label="Estimated load-test metrics"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Metric
                icon={Activity}
                label="Offered load"
                value={formatRps(model.offeredRps)}
                detail={`${formatRps(model.successfulRps)} estimated successful`}
                tone="blue"
              />
              <Metric
                icon={Users}
                label="Concurrency"
                value={formatNumber(model.concurrency, 1)}
                detail={
                  traffic.arrivalModel === "open"
                    ? `${formatNumber(model.requiredVirtualUsers)} VUs estimated with pacing`
                    : `${formatNumber(traffic.virtualUsers)} VUs configured`
                }
              />
              <Metric
                icon={Gauge}
                label="Saturation"
                value={formatPercent(model.criticalUtilization * 100)}
                detail={`${formatPercent(model.appUtilization * 100)} app / ${formatPercent(model.dependencyUtilization * 100)} dependency`}
                tone={
                  model.criticalUtilization * 100 <=
                  thresholds.targetSaturationPercent
                    ? "emerald"
                    : model.criticalUtilization < 1
                      ? "amber"
                      : "rose"
                }
              />
              <Metric
                icon={AlertTriangle}
                label="Errors"
                value={formatPercent(model.errorPercent)}
                detail={`${formatNumber(model.estimatedErrors)} of ${formatNumber(model.totalRequests)} admitted requests`}
                tone={
                  model.errorPercent <= thresholds.targetErrorPercent
                    ? "emerald"
                    : model.errorPercent <= thresholds.stopErrorPercent
                      ? "amber"
                      : "rose"
                }
              />
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">
                    Traffic profile
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                    Offered load versus estimated ceiling
                  </h3>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatNumber(model.durationMinutes)} minute plan
                </div>
              </div>
              <TrafficProfileChart
                traffic={model.trafficProfile}
                capacity={model.capacityProfile}
                durationMinutes={model.durationMinutes}
              />
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-violet-700 dark:text-violet-300">
                  Request path
                </div>
                <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
                  Trace pressure through the system
                </h3>
              </div>
              <div className="grid min-w-0 items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="min-w-0 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                  <Users className="h-5 w-5" aria-hidden="true" />
                  <div className="mt-3 text-xs font-bold uppercase opacity-65">
                    Load generator
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {formatRps(model.offeredRps)}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {formatNumber(traffic.pacingMs)} ms pacing
                  </div>
                </div>
                <div className="flex items-center justify-center text-neutral-400">
                  <ArrowRight
                    className="h-5 w-5 rotate-90 lg:rotate-0"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={`min-w-0 rounded-md border p-4 ${
                    model.appUtilization <= 0.8
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                  }`}
                >
                  <Server className="h-5 w-5" aria-hidden="true" />
                  <div className="mt-3 text-xs font-bold uppercase opacity-65">
                    Application fleet
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {formatPercent(model.appUtilization * 100)}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {formatRps(model.appCapacityRps)} logical capacity
                  </div>
                </div>
                <div className="flex items-center justify-center text-neutral-400">
                  <ArrowRight
                    className="h-5 w-5 rotate-90 lg:rotate-0"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={`min-w-0 rounded-md border p-4 ${
                    model.dependencyUtilization <= 0.8
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                  }`}
                >
                  <Database className="h-5 w-5" aria-hidden="true" />
                  <div className="mt-3 text-xs font-bold uppercase opacity-65">
                    Required dependency
                  </div>
                  <div className="mt-1 text-lg font-bold">
                    {formatPercent(model.dependencyUtilization * 100)}
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    {formatNumber(model.attempts, 2)} attempts / operation
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-950">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Admitted throughput
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold">
                    {formatRps(model.admittedRps)}
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-950">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Estimated queue
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold">
                    {formatNumber(model.queueDepth)} requests
                  </div>
                </div>
                <div className="rounded-md bg-neutral-100 p-3 dark:bg-neutral-950">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Memory headroom
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold">
                    {formatPercent(model.remainingHeadroom)}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-5 flex items-center gap-2">
                  <BarChart3
                    className="h-5 w-5 text-blue-700 dark:text-blue-300"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
                    Latency percentiles
                  </h3>
                </div>
                <div className="space-y-5">
                  <BudgetBar
                    label="P50"
                    value={model.p50Ms}
                    threshold={thresholds.targetP95Ms}
                    maximum={Math.max(
                      model.p99Ms,
                      thresholds.stopP99Ms,
                      thresholds.targetP95Ms,
                    )}
                    passed={model.p50Ms <= thresholds.targetP95Ms}
                  />
                  <BudgetBar
                    label="P95"
                    value={model.p95Ms}
                    threshold={thresholds.targetP95Ms}
                    maximum={Math.max(
                      model.p99Ms,
                      thresholds.stopP99Ms,
                      thresholds.targetP95Ms,
                    )}
                    passed={model.p95Ms <= thresholds.targetP95Ms}
                  />
                  <BudgetBar
                    label="P99"
                    value={model.p99Ms}
                    threshold={thresholds.stopP99Ms}
                    maximum={Math.max(
                      model.p99Ms,
                      thresholds.stopP99Ms,
                    )}
                    passed={model.p99Ms <= thresholds.stopP99Ms}
                  />
                </div>
                <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Percentiles are deterministic planning estimates derived from
                  configured service time, queue pressure, retries, and scenario
                  modifiers. Replace them with measured histograms after a real run.
                </p>
              </section>

              <section className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="mb-5 flex items-center gap-2">
                  <CircleGauge
                    className="h-5 w-5 text-violet-700 dark:text-violet-300"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
                    Acceptance criteria
                  </h3>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {model.criteria.map((criterion) => (
                    <div
                      key={criterion.label}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      {criterion.passed ? (
                        <CheckCircle2
                          className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">
                          {criterion.label}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {criterion.target}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-sm font-bold">
                        {criterion.actual}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <TimerOff
                      className="h-5 w-5 text-rose-700 dark:text-rose-300"
                      aria-hidden="true"
                    />
                    <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
                      Automatic stop conditions
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    A real runner should stop new arrivals, retain diagnostics,
                    and cool down when any safety condition fires.
                  </p>
                </div>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                  {model.stopConditions.map((condition) => (
                    <div
                      key={condition.label}
                      className={`rounded-md border p-3 ${
                        condition.triggered
                          ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
                          : "border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {condition.triggered ? (
                          <AlertTriangle
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        )}
                        <span>{condition.label}</span>
                      </div>
                      <div className="mt-2 font-mono text-sm font-bold">
                        {condition.actual}
                      </div>
                      <div className="mt-1 text-xs opacity-70">
                        Trigger {condition.target}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <div className="flex gap-3">
                <Gauge className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Interpret the estimate correctly</div>
                  <p className="mt-1 opacity-80">
                    This model helps expose contradictory targets and unsafe test
                    plans. It is not telemetry and does not claim to predict
                    production exactly. Calibrate per-instance capacity, service
                    times, failure rates, and journey weights from controlled
                    experiments before approving a real run.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
