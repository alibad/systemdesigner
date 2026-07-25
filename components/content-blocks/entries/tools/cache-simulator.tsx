'use client';

import { useMemo, useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Layers3,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThermometerSun,
  TrendingDown,
  Users,
  Waves,
  Zap,
} from 'lucide-react';

type Policy = 'LRU' | 'LFU' | 'FIFO' | 'Random';
type ScenarioId = 'baseline' | 'hot-key' | 'miss-storm' | 'eviction-churn' | 'slow-origin' | 'stale-risk';

interface CacheConfig {
  sizeMb: number;
  policy: Policy;
  ttlSeconds: number;
  levels: number;
}

interface Protections {
  coalescing: boolean;
  jitter: boolean;
  staleWhileRevalidate: boolean;
}

interface Workload {
  id: string;
  name: string;
  summary: string;
  pattern: 'temporal' | 'zipfian' | 'sequential' | 'uniform';
  workingSetMb: number;
  hotPercent: number;
  requestsPerSecond: number;
  originLatencyMs: number;
  originCapacity: number;
  mutationRate: number;
  recommendedPolicy: Policy;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

interface Scenario {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  summary: string;
  icon: typeof Activity;
  trafficMultiplier: number;
  workingSetMultiplier: number;
  originLatencyMultiplier: number;
  expiryFraction: number;
  hotKeyPressure: number;
  mutationMultiplier: number;
}

const WORKLOADS: Workload[] = [
  {
    id: 'social-feed',
    name: 'Social feed',
    summary: 'Recent posts dominate reads',
    pattern: 'temporal',
    workingSetMb: 1800,
    hotPercent: 90,
    requestsPerSecond: 18_000,
    originLatencyMs: 120,
    originCapacity: 7600,
    mutationRate: 0.025,
    recommendedPolicy: 'LRU',
    icon: Users,
  },
  {
    id: 'product-catalog',
    name: 'Product catalog',
    summary: 'Stable products stay popular',
    pattern: 'zipfian',
    workingSetMb: 4200,
    hotPercent: 72,
    requestsPerSecond: 9500,
    originLatencyMs: 85,
    originCapacity: 4400,
    mutationRate: 0.008,
    recommendedPolicy: 'LFU',
    icon: Boxes,
  },
  {
    id: 'analytics-scan',
    name: 'Analytics scan',
    summary: 'Wide reads churn useful keys',
    pattern: 'sequential',
    workingSetMb: 12_000,
    hotPercent: 35,
    requestsPerSecond: 4000,
    originLatencyMs: 240,
    originCapacity: 2200,
    mutationRate: 0.003,
    recommendedPolicy: 'FIFO',
    icon: Activity,
  },
  {
    id: 'game-state',
    name: 'Game state',
    summary: 'Many active players mutate state',
    pattern: 'uniform',
    workingSetMb: 6800,
    hotPercent: 48,
    requestsPerSecond: 22_000,
    originLatencyMs: 65,
    originCapacity: 10_500,
    mutationRate: 0.075,
    recommendedPolicy: 'LRU',
    icon: Zap,
  },
];

const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: 'Steady traffic',
    shortLabel: 'Baseline',
    summary: 'Normal demand and a healthy origin.',
    icon: CheckCircle2,
    trafficMultiplier: 1,
    workingSetMultiplier: 1,
    originLatencyMultiplier: 1,
    expiryFraction: 0,
    hotKeyPressure: 0,
    mutationMultiplier: 1,
  },
  {
    id: 'hot-key',
    label: 'Hot-key skew',
    shortLabel: 'Hot key',
    summary: 'One key attracts a burst of concurrent reads.',
    icon: ThermometerSun,
    trafficMultiplier: 1.35,
    workingSetMultiplier: 1,
    originLatencyMultiplier: 1,
    expiryFraction: 0.06,
    hotKeyPressure: 0.34,
    mutationMultiplier: 1,
  },
  {
    id: 'miss-storm',
    label: 'Miss storm',
    shortLabel: 'Miss storm',
    summary: 'A synchronized expiry turns hot keys cold together.',
    icon: Waves,
    trafficMultiplier: 1.15,
    workingSetMultiplier: 1,
    originLatencyMultiplier: 1.08,
    expiryFraction: 0.28,
    hotKeyPressure: 0.18,
    mutationMultiplier: 1,
  },
  {
    id: 'eviction-churn',
    label: 'Eviction churn',
    shortLabel: 'Churn',
    summary: 'A scan expands the working set and displaces hot keys.',
    icon: RefreshCw,
    trafficMultiplier: 1.1,
    workingSetMultiplier: 2.4,
    originLatencyMultiplier: 1.12,
    expiryFraction: 0,
    hotKeyPressure: 0,
    mutationMultiplier: 1,
  },
  {
    id: 'slow-origin',
    label: 'Origin saturation',
    shortLabel: 'Slow origin',
    summary: 'The dependency slows before cache misses arrive.',
    icon: TrendingDown,
    trafficMultiplier: 1.2,
    workingSetMultiplier: 1,
    originLatencyMultiplier: 4.2,
    expiryFraction: 0,
    hotKeyPressure: 0,
    mutationMultiplier: 1,
  },
  {
    id: 'stale-risk',
    label: 'Stale-content risk',
    shortLabel: 'Stale data',
    summary: 'Writes accelerate while cached values retain a long TTL.',
    icon: AlertTriangle,
    trafficMultiplier: 1,
    workingSetMultiplier: 1,
    originLatencyMultiplier: 1,
    expiryFraction: 0,
    hotKeyPressure: 0,
    mutationMultiplier: 14,
  },
];

const POLICY_DETAILS: Record<Policy, { best: string; multiplier: Record<Workload['pattern'], number> }> = {
  LRU: {
    best: 'Changing hot sets',
    multiplier: { temporal: 1.12, zipfian: 1.02, sequential: 0.62, uniform: 0.76 },
  },
  LFU: {
    best: 'Stable popularity',
    multiplier: { temporal: 1.02, zipfian: 1.14, sequential: 0.7, uniform: 0.74 },
  },
  FIFO: {
    best: 'Simple turnover',
    multiplier: { temporal: 0.86, zipfian: 0.84, sequential: 0.74, uniform: 0.7 },
  },
  Random: {
    best: 'Low overhead',
    multiplier: { temporal: 0.7, zipfian: 0.68, sequential: 0.58, uniform: 0.62 },
  },
};

const SIZE_PRESETS = [256, 1024, 4096, 8192];
const TTL_PRESETS = [0, 300, 3600, 14_400];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
  }).format(Math.round(value));
}

function percent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function milliseconds(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatSize(value: number) {
  if (value >= 1024) {
    const gigabytes = value / 1024;
    return `${gigabytes.toFixed(Number.isInteger(gigabytes) ? 0 : 1)}GB`;
  }
  return `${value}MB`;
}

function formatTtl(value: number) {
  if (value === 0) return 'No expiry';
  if (value >= 3600) return `${value / 3600}h`;
  return `${value / 60}m`;
}

function statusTone(status: 'healthy' | 'strained' | 'critical') {
  if (status === 'critical') {
    return {
      border: 'border-rose-500 dark:border-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-800 dark:text-rose-200',
      solid: 'bg-rose-500',
      label: 'Critical',
    };
  }
  if (status === 'strained') {
    return {
      border: 'border-amber-500 dark:border-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-900 dark:text-amber-100',
      solid: 'bg-amber-500',
      label: 'Strained',
    };
  }
  return {
    border: 'border-emerald-500 dark:border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-200',
    solid: 'bg-emerald-500',
    label: 'Healthy',
  };
}

function RangeControl({
  accentClass,
  description,
  id,
  label,
  max,
  min,
  onChange,
  presets,
  step,
  value,
  valueLabel,
}: {
  accentClass: string;
  description: string;
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  presets: Array<{ label: string; value: number }>;
  step: number;
  value: number;
  valueLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-neutral-950 dark:text-white">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
          {valueLabel}
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
        className={`mt-3 h-2 w-full cursor-pointer ${accentClass}`}
      />
      <div className="mt-3 grid grid-cols-4 gap-1">
        {presets.map((preset) => {
          const selected = value === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset.value)}
              className={`min-h-9 rounded border px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                selected
                  ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}

function ProtectionToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="group flex w-full items-start justify-between gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
    >
      <span>
        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked
            ? 'border-cyan-600 bg-cyan-600 dark:border-cyan-400 dark:bg-cyan-400'
            : 'border-neutral-300 bg-neutral-200 group-hover:border-neutral-500 dark:border-neutral-600 dark:bg-neutral-800'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

function PressureBar({
  current,
  label,
  legend,
  maximum,
  tone,
  value,
}: {
  current: number;
  label: string;
  legend: string;
  maximum: number;
  tone: 'cyan' | 'amber' | 'rose' | 'violet';
  value: string;
}) {
  const width = clamp((current / maximum) * 100, 0, 100);
  const barClass = {
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
  }[tone];

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{legend}</p>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function CacheSimulatorPage() {
  const [config, setConfig] = useState<CacheConfig>({
    sizeMb: 1024,
    policy: 'LRU',
    ttlSeconds: 3600,
    levels: 1,
  });
  const [workloadIndex, setWorkloadIndex] = useState(0);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('baseline');
  const [protections, setProtections] = useState<Protections>({
    coalescing: false,
    jitter: false,
    staleWhileRevalidate: false,
  });

  const workload = WORKLOADS[workloadIndex];
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];

  const result = useMemo(() => {
    const requestsPerSecond = workload.requestsPerSecond * scenario.trafficMultiplier;
    const effectiveWorkingSetMb = workload.workingSetMb * scenario.workingSetMultiplier;
    const coverage = clamp(config.sizeMb / effectiveWorkingSetMb, 0, 1);
    const locality = workload.hotPercent / 100;
    const policyMultiplier = POLICY_DETAILS[config.policy].multiplier[workload.pattern];
    const ttlRetention =
      config.ttlSeconds === 0
        ? 1.04
        : clamp(0.88 + Math.log10(config.ttlSeconds + 1) * 0.045, 0.88, 1.04);
    const levelBoost = 1 + (config.levels - 1) * 0.035;
    const steadyHitRate = clamp(
      (0.16 + coverage * 0.52 + locality * 0.25) * policyMultiplier * ttlRetention * levelBoost,
      0.06,
      0.985,
    );
    const expiryPenalty =
      config.ttlSeconds === 0
        ? 0
        : scenario.expiryFraction * (protections.jitter ? 0.28 : 1);
    const churnPenalty =
      scenarioId === 'eviction-churn'
        ? clamp((1 - coverage) * (config.policy === 'FIFO' ? 0.08 : 0.18), 0, 0.18)
        : 0;
    const hitRate = clamp(steadyHitRate - expiryPenalty - churnPenalty, 0.04, 0.985);
    const hitQps = requestsPerSecond * hitRate;
    const requiredMissQps = requestsPerSecond - hitQps;
    const duplicateMultiplier =
      scenario.hotKeyPressure > 0
        ? protections.coalescing
          ? 0.04
          : 0.9 + scenario.hotKeyPressure * 3.4
        : protections.coalescing
          ? 0.01
          : expiryPenalty * 2.2;
    const duplicateFillQps = requiredMissQps * duplicateMultiplier;
    const backgroundRefreshQps =
      protections.staleWhileRevalidate && (scenarioId === 'slow-origin' || scenarioId === 'stale-risk')
        ? Math.min(requiredMissQps * 0.26, requestsPerSecond * 0.08)
        : 0;
    const originQps = requiredMissQps + duplicateFillQps + backgroundRefreshQps;
    const originUtilization = originQps / workload.originCapacity;
    const queueMultiplier =
      originUtilization <= 0.7
        ? 1
        : 1 + Math.pow((originUtilization - 0.7) / 0.3, 2) * 1.8;
    const effectiveOriginLatency =
      workload.originLatencyMs * scenario.originLatencyMultiplier * clamp(queueMultiplier, 1, 8);
    const cacheLatency = 1.2 + (config.levels - 1) * 0.9;
    const servedStaleFraction =
      protections.staleWhileRevalidate && effectiveOriginLatency > 400
        ? clamp((1 - hitRate) * 0.7, 0, 0.24)
        : 0;
    const averageLatency =
      hitRate * cacheLatency +
      (1 - hitRate - servedStaleFraction) * effectiveOriginLatency +
      servedStaleFraction * (cacheLatency + 2.4);
    const tailLatency =
      effectiveOriginLatency * (originUtilization > 0.85 ? 2.6 : 1.55) +
      Math.max(0, duplicateFillQps / Math.max(1, workload.originCapacity)) * 180;
    const mutationRate = workload.mutationRate * scenario.mutationMultiplier;
    const ttlExposure = config.ttlSeconds === 0 ? 1 : config.ttlSeconds / 14_400;
    const staleResponseRate = clamp(
      hitRate * mutationRate * ttlExposure * (protections.staleWhileRevalidate ? 0.38 : 1),
      0,
      0.42,
    );
    const evictionQps =
      requestsPerSecond *
      (1 - coverage) *
      (scenarioId === 'eviction-churn' ? 0.32 : config.policy === 'Random' ? 0.16 : 0.08);
    const costAvoided = clamp(
      hitRate * 0.84 -
        config.levels * 0.018 -
        (duplicateFillQps / requestsPerSecond) * 0.18 -
        (backgroundRefreshQps / requestsPerSecond) * 0.08,
      0,
      0.92,
    );
    const critical =
      originUtilization >= 1 ||
      tailLatency > 1200 ||
      staleResponseRate > 0.12;
    const strained =
      originUtilization >= 0.72 ||
      averageLatency > 80 ||
      staleResponseRate > 0.045 ||
      evictionQps > requestsPerSecond * 0.2;
    const status: 'healthy' | 'strained' | 'critical' = critical
      ? 'critical'
      : strained
        ? 'strained'
        : 'healthy';
    const dominantRisk =
      staleResponseRate > 0.045
        ? 'freshness'
        : originUtilization >= 0.72
          ? 'origin'
          : evictionQps > requestsPerSecond * 0.2
            ? 'eviction'
            : 'none';

    return {
      averageLatency,
      backgroundRefreshQps,
      cacheLatency,
      costAvoided,
      coverage,
      dominantRisk,
      duplicateFillQps,
      effectiveOriginLatency,
      effectiveWorkingSetMb,
      evictionQps,
      hitQps,
      hitRate,
      originQps,
      originUtilization,
      policyFit: config.policy === workload.recommendedPolicy,
      requestsPerSecond,
      requiredMissQps,
      staleResponseRate,
      status,
      steadyHitRate,
      tailLatency,
    };
  }, [config, protections, scenario, scenarioId, workload]);

  const tone = statusTone(result.status);
  const originWidth = clamp(result.originUtilization * 100, 0, 100);

  const reset = () => {
    setConfig({ sizeMb: 1024, policy: 'LRU', ttlSeconds: 3600, levels: 1 });
    setWorkloadIndex(0);
    setScenarioId('baseline');
    setProtections({ coalescing: false, jitter: false, staleWhileRevalidate: false });
  };

  const diagnosis =
    result.status === 'healthy'
      ? {
          title: 'The cache contains this demand',
          body: 'Most requests stay on the fast path, origin load remains inside its serving envelope, and freshness risk is bounded.',
          action: scenarioId === 'baseline' ? 'Inject a pressure mode to test the miss path.' : 'Keep this protection set and test another workload.',
        }
      : result.dominantRisk === 'freshness'
        ? {
            title: 'Fresh reads are not guaranteed',
            body: `${percent(result.staleResponseRate, 1)} of responses may outlive a source mutation under the modeled TTL and write rate.`,
            action: 'Shorten TTL, add event-driven invalidation, or use stale-while-revalidate only with an explicit freshness bound.',
          }
        : result.dominantRisk === 'origin'
          ? {
              title: 'Misses exceed origin headroom',
              body: `${compact(result.originQps)} origin attempts per second consume ${percent(result.originUtilization)} of modeled capacity.`,
              action: result.duplicateFillQps > result.requiredMissQps * 0.1
                ? 'Enable request coalescing before adding cache memory.'
                : 'Improve useful coverage or reduce the miss-path dependency cost.',
            }
          : {
              title: 'Useful keys are being displaced',
              body: `${compact(result.evictionQps)} keys per second churn while only ${percent(result.coverage)} of the active working set fits.`,
              action: 'Isolate scans, increase useful capacity, or choose an admission policy that protects hot keys.',
            };

  return (
    <section className="not-prose overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-xl shadow-neutral-950/10 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-7 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Cache pressure lab
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">
              Shape demand, trace the miss path, protect the origin
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Every control changes one connected model. Start with useful cache coverage, then inject pressure and see whether misses become bounded work or an incident.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            title="Reset simulator"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded border border-neutral-600 bg-neutral-900 text-neutral-200 hover:border-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:self-auto"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Reset simulator</span>
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase text-neutral-400">Loop 2 · Inject operating pressure</legend>
          <div
            className="mt-2 grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))' }}
          >
            {SCENARIOS.map((item) => {
              const Icon = item.icon;
              const selected = scenarioId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScenarioId(item.id)}
                  className={`min-h-[76px] rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-950 text-white'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <Icon aria-hidden="true" className={`h-4 w-4 ${selected ? 'text-cyan-300' : 'text-neutral-400'}`} />
                    {selected ? <Check aria-hidden="true" className="h-4 w-4 text-cyan-300" /> : null}
                  </span>
                  <span className="mt-2 block text-sm font-semibold">{item.shortLabel}</span>
                  <span className={`mt-1 hidden text-xs leading-4 xl:block ${selected ? 'text-cyan-100' : 'text-neutral-400'}`}>
                    {item.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </header>

      <div className={`flex flex-col gap-3 border-b-2 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7 ${tone.border} ${tone.bg}`}>
        <div className="flex items-start gap-3">
          {result.status === 'healthy' ? (
            <ShieldCheck aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} />
          ) : (
            <ShieldAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} />
          )}
          <div>
            <p className={`text-xs font-semibold uppercase ${tone.text}`}>{tone.label} operating state</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{diagnosis.title}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span><strong className="text-neutral-950 dark:text-white">{percent(result.hitRate, 1)}</strong> hit rate</span>
          <span><strong className="text-neutral-950 dark:text-white">{milliseconds(result.averageLatency)}</strong> average</span>
          <span><strong className="text-neutral-950 dark:text-white">{percent(result.originUtilization)}</strong> origin load</span>
          <span><strong className="text-neutral-950 dark:text-white">{percent(result.staleResponseRate, 1)}</strong> stale risk</span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/45 md:p-6 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Loop 1 · Shape the steady state
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Workload</legend>
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))' }}
            >
              {WORKLOADS.map((item, index) => {
                const Icon = item.icon;
                const selected = workloadIndex === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setWorkloadIndex(index)}
                    className={`min-h-[88px] rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      selected
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50'
                        : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <Icon aria-hidden="true" className={`h-4 w-4 ${selected ? 'text-cyan-700 dark:text-cyan-300' : 'text-neutral-500'}`} />
                      {selected ? <Check aria-hidden="true" className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> : null}
                    </span>
                    <span className="mt-2 block text-sm font-semibold">{item.name}</span>
                    <span className={`mt-1 block text-[11px] leading-4 ${selected ? 'text-cyan-800 dark:text-cyan-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {item.summary}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 space-y-6 border-t border-neutral-300 pt-6 dark:border-neutral-700">
            <RangeControl
              accentClass="accent-cyan-600 dark:accent-cyan-400"
              description={`${percent(result.coverage)} of the active ${formatSize(result.effectiveWorkingSetMb)} working set fits.`}
              id="cache-capacity"
              label="Useful cache capacity"
              min={64}
              max={16_384}
              step={64}
              value={config.sizeMb}
              valueLabel={formatSize(config.sizeMb)}
              onChange={(sizeMb) => setConfig((current) => ({ ...current, sizeMb }))}
              presets={SIZE_PRESETS.map((value) => ({ value, label: formatSize(value) }))}
            />

            <RangeControl
              accentClass="accent-violet-600 dark:accent-violet-400"
              description="Long TTLs retain hits but widen the interval in which a source mutation can be hidden."
              id="cache-ttl"
              label="Expiration window"
              min={0}
              max={14_400}
              step={300}
              value={config.ttlSeconds}
              valueLabel={formatTtl(config.ttlSeconds)}
              onChange={(ttlSeconds) => setConfig((current) => ({ ...current, ttlSeconds }))}
              presets={TTL_PRESETS.map((value) => ({ value, label: formatTtl(value) }))}
            />
          </div>

          <fieldset className="mt-6 border-t border-neutral-300 pt-6 dark:border-neutral-700">
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Eviction policy</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(POLICY_DETAILS) as Policy[]).map((policy) => {
                const selected = config.policy === policy;
                const recommended = workload.recommendedPolicy === policy;
                return (
                  <button
                    key={policy}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setConfig((current) => ({ ...current, policy }))}
                    className={`min-h-[68px] rounded border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50'
                        : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-bold">
                      {policy}
                      {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                    </span>
                    <span className={`mt-1 block text-[11px] ${selected ? 'text-emerald-800 dark:text-emerald-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {recommended ? 'Best fit here' : POLICY_DETAILS[policy].best}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-neutral-300 pt-6 dark:border-neutral-700">
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Cache levels</legend>
            <div className="mt-3 grid grid-cols-3 rounded-md border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={config.levels === level}
                  onClick={() => setConfig((current) => ({ ...current, levels: level }))}
                  className={`h-10 rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    config.levels === level
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                      : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {level === 1 ? 'L1' : `L1 + L${level}`}
                </button>
              ))}
            </div>
          </fieldset>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 md:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Live request path</p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {compact(result.requestsPerSecond)} requests each second
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Cache hit</span>
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-500" />Required miss</span>
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-rose-500" />Duplicate fill</span>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="grid min-h-[260px] gap-0 lg:grid-cols-[160px_minmax(210px,1fr)_190px]">
                <div className="flex flex-col justify-center border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                    <Zap aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-neutral-950 dark:text-white">Incoming demand</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">{compact(result.requestsPerSecond)}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">requests / second</p>
                  <ArrowDown aria-hidden="true" className="mx-auto mt-4 h-5 w-5 text-neutral-400 lg:hidden" />
                </div>

                <div className="relative flex flex-col justify-center gap-6 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r">
                  <ArrowRight aria-hidden="true" className="absolute -left-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-neutral-50 p-1 text-neutral-400 dark:bg-neutral-900 lg:block" />
                  <div>
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-300">Fast path · cache hit</span>
                      <span className="tabular-nums text-neutral-950 dark:text-white">{compact(result.hitQps)}/s</span>
                    </div>
                    <div className="mt-2 h-4 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${result.hitRate * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {percent(result.hitRate, 1)} served in {milliseconds(result.cacheLatency)}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                      <span className="text-amber-700 dark:text-amber-300">Slow path · origin work</span>
                      <span className="tabular-nums text-neutral-950 dark:text-white">{compact(result.originQps)}/s</span>
                    </div>
                    <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-full bg-amber-500 transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${clamp((result.requiredMissQps / result.requestsPerSecond) * 100, 0, 100)}%` }}
                      />
                      <div
                        className="h-full bg-rose-500 transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${clamp((result.duplicateFillQps / result.requestsPerSecond) * 100, 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {compact(result.requiredMissQps)}/s required + {compact(result.duplicateFillQps)}/s duplicate
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-800 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
                  <div className="flex min-w-0 flex-col justify-center p-4">
                    <Server aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Cache</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      {formatSize(config.sizeMb)} across {config.levels} level{config.levels === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col justify-center p-4">
                    <Database aria-hidden="true" className={`h-5 w-5 ${result.originUtilization >= 1 ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`} />
                    <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Origin</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      {milliseconds(result.effectiveOriginLatency)} at {percent(result.originUtilization)} load
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Origin serving envelope</span>
                  <span className={`text-xs font-bold tabular-nums ${result.originUtilization >= 1 ? 'text-rose-700 dark:text-rose-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                    {compact(result.originQps)} / {compact(workload.originCapacity)} req/s
                  </span>
                </div>
                <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone.solid}`}
                    style={{ width: `${originWidth}%` }}
                  />
                  <span aria-hidden="true" className="absolute bottom-0 left-[70%] top-0 w-px bg-neutral-950/60 dark:bg-white/60" />
                </div>
                <div className="mt-2 flex justify-between gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>0</span>
                  <span>70% guardrail</span>
                  <span>100% capacity</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="border-b border-neutral-200 p-5 dark:border-neutral-800 md:p-7 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2">
                <Gauge aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                <p className="text-xs font-semibold uppercase text-neutral-500">Pressure readout</p>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">What moved, and why</h3>

              <div className="mt-6 space-y-6">
                <PressureBar
                  label="Useful working-set coverage"
                  legend={`Cache capacity ÷ active working set (${formatSize(config.sizeMb)} ÷ ${formatSize(result.effectiveWorkingSetMb)})`}
                  current={result.coverage}
                  maximum={1}
                  tone="cyan"
                  value={percent(result.coverage)}
                />
                <PressureBar
                  label="Eviction churn"
                  legend="Estimated displaced keys as a share of incoming requests"
                  current={result.evictionQps / result.requestsPerSecond}
                  maximum={0.35}
                  tone={result.evictionQps > result.requestsPerSecond * 0.2 ? 'rose' : 'amber'}
                  value={`${compact(result.evictionQps)}/s`}
                />
                <PressureBar
                  label="Stale-response exposure"
                  legend="Hit rate × write rate × TTL exposure; SWR lowers, but does not remove, risk"
                  current={result.staleResponseRate}
                  maximum={0.15}
                  tone={result.staleResponseRate > 0.045 ? 'rose' : 'violet'}
                  value={percent(result.staleResponseRate, 1)}
                />
                <PressureBar
                  label="Tail latency"
                  legend="Origin latency amplified by utilization and duplicate fills"
                  current={result.tailLatency}
                  maximum={1500}
                  tone={result.tailLatency > 800 ? 'rose' : 'amber'}
                  value={milliseconds(result.tailLatency)}
                />
              </div>

              <div className="mt-7 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500">Calculation trace</p>
                <dl className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
                  <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-5">
                    <dt className="font-semibold text-neutral-950 dark:text-white">Cache hit rate</dt>
                    <dd className="font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {percent(result.steadyHitRate, 1)} steady − scenario penalties = {percent(result.hitRate, 1)}
                    </dd>
                  </div>
                  <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-5">
                    <dt className="font-semibold text-neutral-950 dark:text-white">Origin attempts</dt>
                    <dd className="font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {compact(result.requiredMissQps)} misses + {compact(result.duplicateFillQps)} duplicate fills + {compact(result.backgroundRefreshQps)} refreshes = {compact(result.originQps)}/s
                    </dd>
                  </div>
                  <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-5">
                    <dt className="font-semibold text-neutral-950 dark:text-white">Average latency</dt>
                    <dd className="font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      hit share × {milliseconds(result.cacheLatency)} + miss share × {milliseconds(result.effectiveOriginLatency)} = {milliseconds(result.averageLatency)}
                    </dd>
                  </div>
                  <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-5">
                    <dt className="font-semibold text-neutral-950 dark:text-white">Cost avoided</dt>
                    <dd className="font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      hit savings − cache tiers − refill amplification = {percent(result.costAvoided)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Assumptions are comparative, not vendor benchmarks. Validate with an access trace, object-size distribution, and an origin load test.
                </p>
              </div>
            </div>

            <aside className="bg-neutral-50 p-5 dark:bg-neutral-900/45 md:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <p className="text-xs font-semibold uppercase text-neutral-500">Protections</p>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Bound the failure path</h3>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Toggle one defense at a time. Each changes a different part of the model.
              </p>

              <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                <ProtectionToggle
                  checked={protections.jitter}
                  label="TTL jitter"
                  description="Spreads synchronized expiry across time."
                  onChange={() => setProtections((current) => ({ ...current, jitter: !current.jitter }))}
                />
                <ProtectionToggle
                  checked={protections.coalescing}
                  label="Request coalescing"
                  description="Lets one request refill a hot missing key."
                  onChange={() => setProtections((current) => ({ ...current, coalescing: !current.coalescing }))}
                />
                <ProtectionToggle
                  checked={protections.staleWhileRevalidate}
                  label="Stale while revalidate"
                  description="Serves bounded stale data while one refresh runs."
                  onChange={() =>
                    setProtections((current) => ({
                      ...current,
                      staleWhileRevalidate: !current.staleWhileRevalidate,
                    }))
                  }
                />
              </div>

              <div className={`mt-6 border-l-4 pl-4 ${tone.border}`}>
                <p className={`text-xs font-semibold uppercase ${tone.text}`}>{scenario.label}</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{diagnosis.title}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{diagnosis.body}</p>
                <p className="mt-3 text-xs font-semibold leading-5 text-neutral-950 dark:text-white">{diagnosis.action}</p>
              </div>

              <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <p className="text-xs font-semibold uppercase text-neutral-500">Policy fit</p>
                <div className="mt-3 flex items-start gap-3">
                  {result.policyFit ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  )}
                  <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {config.policy} is {result.policyFit ? 'the modeled best fit' : `weaker than ${workload.recommendedPolicy}`} for this {workload.pattern} workload.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Scenario {scenario.label}. Hit rate {percent(result.hitRate, 1)}. Average latency {milliseconds(result.averageLatency)}. Origin utilization {percent(result.originUtilization)}. Status {result.status}.
      </p>
    </section>
  );
}
