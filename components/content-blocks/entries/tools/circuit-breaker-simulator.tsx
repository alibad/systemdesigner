'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  ShieldX,
  TimerReset,
  Users,
  Zap,
} from 'lucide-react';

type BreakerState = 'closed' | 'open' | 'half-open';
type ScenarioId = 'steady' | 'outage' | 'latency' | 'retry' | 'recovery' | 'custom';

type BreakerPolicy = {
  failureThresholdPct: number;
  minimumRequests: number;
  windowSeconds: number;
  openSeconds: number;
  healthyProbes: number;
  timeoutMs: number;
};

type TrafficProfile = {
  requestsPerSecond: number;
  dependencyErrorPct: number;
  dependencyLatencyMs: number;
  retries: number;
};

type OutcomeTotals = {
  requested: number;
  admitted: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  rejected: number;
};

type TickRecord = {
  second: number;
  stateBefore: BreakerState;
  stateAfter: BreakerState;
  requested: number;
  admitted: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  rejected: number;
  transition: string | null;
};

type SimulatorRuntime = {
  second: number;
  state: BreakerState;
  openedAt: number | null;
  healthyProbeCount: number;
  ticks: TickRecord[];
  totals: OutcomeTotals;
};

type RangeControlProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  leftLabel: string;
  rightLabel: string;
  description?: string;
  onChange: (value: number) => void;
};

const DEFAULT_POLICY: BreakerPolicy = {
  failureThresholdPct: 50,
  minimumRequests: 20,
  windowSeconds: 5,
  openSeconds: 4,
  healthyProbes: 4,
  timeoutMs: 800,
};

const DEFAULT_TRAFFIC: TrafficProfile = {
  requestsPerSecond: 40,
  dependencyErrorPct: 4,
  dependencyLatencyMs: 180,
  retries: 0,
};

const EMPTY_TOTALS: OutcomeTotals = {
  requested: 0,
  admitted: 0,
  succeeded: 0,
  failed: 0,
  timedOut: 0,
  rejected: 0,
};

const INITIAL_RUNTIME: SimulatorRuntime = {
  second: 0,
  state: 'closed',
  openedAt: null,
  healthyProbeCount: 0,
  ticks: [],
  totals: EMPTY_TOTALS,
};

const SCENARIOS: Array<{
  id: Exclude<ScenarioId, 'custom'>;
  label: string;
  detail: string;
  traffic: TrafficProfile;
}> = [
  {
    id: 'steady',
    label: 'Healthy',
    detail: 'Fast dependency, low errors',
    traffic: DEFAULT_TRAFFIC,
  },
  {
    id: 'outage',
    label: 'Outage',
    detail: 'Every admitted call fails',
    traffic: {
      requestsPerSecond: 40,
      dependencyErrorPct: 100,
      dependencyLatencyMs: 300,
      retries: 0,
    },
  },
  {
    id: 'latency',
    label: 'Latency spike',
    detail: 'Responses exceed the timeout',
    traffic: {
      requestsPerSecond: 40,
      dependencyErrorPct: 2,
      dependencyLatencyMs: 1_800,
      retries: 0,
    },
  },
  {
    id: 'retry',
    label: 'Retry storm',
    detail: 'Failures amplify dependency load',
    traffic: {
      requestsPerSecond: 70,
      dependencyErrorPct: 45,
      dependencyLatencyMs: 950,
      retries: 3,
    },
  },
  {
    id: 'recovery',
    label: 'Recovery',
    detail: 'Healthy probes can close the circuit',
    traffic: {
      requestsPerSecond: 40,
      dependencyErrorPct: 0,
      dependencyLatencyMs: 120,
      retries: 0,
    },
  },
];

const STATE_COPY: Record<
  BreakerState,
  { label: string; short: string; condition: string }
> = {
  closed: {
    label: 'Closed',
    short: 'Calls are admitted',
    condition: 'Open when rolling failure evidence crosses the policy.',
  },
  open: {
    label: 'Open',
    short: 'Calls fail fast',
    condition: 'Wait for the cooldown before permitting recovery probes.',
  },
  'half-open': {
    label: 'Half-open',
    short: 'Only probes are admitted',
    condition: 'Close after healthy probes; reopen on the first failed probe.',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percent(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  leftLabel,
  rightLabel,
  description,
  onChange,
}: RangeControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-sm font-semibold text-neutral-900 dark:text-white">
            {label}
          </label>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
        <output
          htmlFor={id}
          className="shrink-0 rounded-md bg-neutral-100 px-2.5 py-1 text-sm font-bold text-neutral-950 dark:bg-neutral-800 dark:text-white"
        >
          {value.toLocaleString()}
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
        className="h-2 w-full cursor-pointer accent-cyan-700 dark:accent-cyan-400"
      />
      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function StateNode({
  state,
  active,
}: {
  state: BreakerState;
  active: boolean;
}) {
  const activeClasses: Record<BreakerState, string> = {
    closed: 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-neutral-950',
    open: 'border-rose-700 bg-rose-700 text-white dark:border-rose-300 dark:bg-rose-300 dark:text-neutral-950',
    'half-open': 'border-amber-500 bg-amber-400 text-neutral-950 dark:border-amber-300 dark:bg-amber-300',
  };

  return (
    <div
      className={`min-h-36 rounded-md border-2 p-4 ${
        active
          ? activeClasses[state]
          : 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
      }`}
      aria-current={active ? 'step' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-normal">
          {STATE_COPY[state].label}
        </p>
        {active ? (
          <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-bold">
            Active
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-base font-bold">{STATE_COPY[state].short}</p>
      <p className={`mt-2 text-xs leading-5 ${active ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {STATE_COPY[state].condition}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'cyan' | 'emerald' | 'rose' | 'amber';
}) {
  const toneClasses = {
    cyan: 'border-cyan-600',
    emerald: 'border-emerald-600',
    rose: 'border-rose-600',
    amber: 'border-amber-500',
  }[tone];

  return (
    <div className={`min-h-28 border-l-4 bg-white p-4 dark:bg-neutral-950 ${toneClasses}`}>
      <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-normal text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function simulateSecond(
  runtime: SimulatorRuntime,
  policy: BreakerPolicy,
  traffic: TrafficProfile,
): SimulatorRuntime {
  const second = runtime.second + 1;
  let stateBefore = runtime.state;
  let openedAt = runtime.openedAt;
  let healthyProbeCount = runtime.healthyProbeCount;
  let transition: string | null = null;

  if (
    stateBefore === 'open' &&
    openedAt !== null &&
    second - openedAt >= policy.openSeconds
  ) {
    stateBefore = 'half-open';
    healthyProbeCount = 0;
    transition = 'Cooldown elapsed: admit recovery probes';
  }

  const timeoutFailure = traffic.dependencyLatencyMs > policy.timeoutMs;
  const dependencyFailureRatio = timeoutFailure
    ? 1
    : traffic.dependencyErrorPct / 100;
  const retryMultiplier = 1 + traffic.retries * dependencyFailureRatio;
  const requested = Math.max(
    1,
    Math.round(traffic.requestsPerSecond * retryMultiplier),
  );

  let admitted = requested;
  if (stateBefore === 'open') admitted = 0;
  if (stateBefore === 'half-open') {
    const probesRemaining = Math.max(1, policy.healthyProbes - healthyProbeCount);
    admitted = Math.min(requested, probesRemaining, 2);
  }

  const rejected = requested - admitted;
  const failed = timeoutFailure
    ? 0
    : Math.min(admitted, Math.round(admitted * (traffic.dependencyErrorPct / 100)));
  const timedOut = timeoutFailure ? admitted : 0;
  const succeeded = Math.max(0, admitted - failed - timedOut);

  let stateAfter = stateBefore;
  let nextOpenedAt = openedAt;
  let nextHealthyProbeCount = healthyProbeCount;

  const provisionalTick: TickRecord = {
    second,
    stateBefore,
    stateAfter,
    requested,
    admitted,
    succeeded,
    failed,
    timedOut,
    rejected,
    transition,
  };

  if (stateBefore === 'closed') {
    const evidence = [...runtime.ticks, provisionalTick]
      .filter(
        (tick) =>
          tick.stateBefore === 'closed' &&
          tick.second > second - policy.windowSeconds,
      );
    const evidenceRequests = evidence.reduce((sum, tick) => sum + tick.admitted, 0);
    const evidenceFailures = evidence.reduce(
      (sum, tick) => sum + tick.failed + tick.timedOut,
      0,
    );
    const evidenceFailurePct = percent(evidenceFailures, evidenceRequests);

    if (
      evidenceRequests >= policy.minimumRequests &&
      evidenceFailurePct >= policy.failureThresholdPct
    ) {
      stateAfter = 'open';
      nextOpenedAt = second;
      nextHealthyProbeCount = 0;
      transition = `Opened at ${evidenceFailurePct.toFixed(0)}% failures`;
    }
  } else if (stateBefore === 'half-open') {
    if (failed + timedOut > 0) {
      stateAfter = 'open';
      nextOpenedAt = second;
      nextHealthyProbeCount = 0;
      transition = 'Probe failed: reopen the circuit';
    } else {
      nextHealthyProbeCount += succeeded;
      if (nextHealthyProbeCount >= policy.healthyProbes) {
        stateAfter = 'closed';
        nextOpenedAt = null;
        nextHealthyProbeCount = 0;
        transition = 'Probe target met: close the circuit';
      }
    }
  }

  const nextTick: TickRecord = {
    ...provisionalTick,
    stateAfter,
    transition,
  };

  return {
    second,
    state: stateAfter,
    openedAt: nextOpenedAt,
    healthyProbeCount: nextHealthyProbeCount,
    ticks: [...runtime.ticks, nextTick].slice(-24),
    totals: {
      requested: runtime.totals.requested + requested,
      admitted: runtime.totals.admitted + admitted,
      succeeded: runtime.totals.succeeded + succeeded,
      failed: runtime.totals.failed + failed,
      timedOut: runtime.totals.timedOut + timedOut,
      rejected: runtime.totals.rejected + rejected,
    },
  };
}

export default function CircuitBreakerSimulator() {
  const [policy, setPolicy] = useState<BreakerPolicy>(DEFAULT_POLICY);
  const [traffic, setTraffic] = useState<TrafficProfile>(DEFAULT_TRAFFIC);
  const [scenario, setScenario] = useState<ScenarioId>('steady');
  const [runtime, setRuntime] = useState<SimulatorRuntime>(INITIAL_RUNTIME);
  const [running, setRunning] = useState(false);

  const advance = useCallback(
    (seconds = 1) => {
      setRuntime((current) => {
        let next = current;
        for (let index = 0; index < seconds; index += 1) {
          next = simulateSecond(next, policy, traffic);
        }
        return next;
      });
    },
    [policy, traffic],
  );

  useEffect(() => {
    if (!running) return undefined;
    const intervalId = window.setInterval(() => advance(), 750);
    return () => window.clearInterval(intervalId);
  }, [advance, running]);

  const updatePolicy = <Key extends keyof BreakerPolicy>(
    key: Key,
    value: BreakerPolicy[Key],
  ) => {
    setPolicy((current) => ({ ...current, [key]: value }));
  };

  const updateTraffic = <Key extends keyof TrafficProfile>(
    key: Key,
    value: TrafficProfile[Key],
  ) => {
    setScenario('custom');
    setTraffic((current) => ({ ...current, [key]: value }));
  };

  const applyScenario = (id: Exclude<ScenarioId, 'custom'>) => {
    const selected = SCENARIOS.find((candidate) => candidate.id === id);
    if (!selected) return;
    setScenario(id);
    setTraffic(selected.traffic);
  };

  const resetEvidence = () => {
    setRunning(false);
    setRuntime(INITIAL_RUNTIME);
  };

  const rollingEvidence = useMemo(
    () =>
      runtime.ticks.filter(
        (tick) =>
          tick.stateBefore === 'closed' &&
          tick.second > runtime.second - policy.windowSeconds,
      ),
    [policy.windowSeconds, runtime.second, runtime.ticks],
  );
  const rollingRequests = rollingEvidence.reduce(
    (sum, tick) => sum + tick.admitted,
    0,
  );
  const rollingFailures = rollingEvidence.reduce(
    (sum, tick) => sum + tick.failed + tick.timedOut,
    0,
  );
  const rollingFailurePct = percent(rollingFailures, rollingRequests);
  const evidenceReady = rollingRequests >= policy.minimumRequests;
  const thresholdCrossed =
    evidenceReady && rollingFailurePct >= policy.failureThresholdPct;
  const latestTick = runtime.ticks.at(-1);
  const timeoutRisk = traffic.dependencyLatencyMs > policy.timeoutMs;
  const retryMultiplier =
    1 +
    traffic.retries *
      (timeoutRisk ? 1 : traffic.dependencyErrorPct / 100);
  const dependencyAttempts = Math.round(
    traffic.requestsPerSecond * retryMultiplier,
  );
  const cooldownRemaining =
    runtime.state === 'open' && runtime.openedAt !== null
      ? Math.max(0, policy.openSeconds - (runtime.second - runtime.openedAt))
      : 0;
  const fallbackPct = percent(runtime.totals.rejected, runtime.totals.requested);
  const servedPct = percent(runtime.totals.succeeded, runtime.totals.requested);

  let consequenceTitle = 'Dependency path is serving users';
  let consequenceBody =
    'The circuit is closed. Requests reach the dependency and successful responses return normally.';
  let consequenceTone =
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';

  if (runtime.state === 'open') {
    consequenceTitle = 'Fallback is protecting the dependency';
    consequenceBody = `${cooldownRemaining}s remain before probes. New calls fail fast instead of waiting on the unhealthy dependency.`;
    consequenceTone =
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100';
  } else if (runtime.state === 'half-open') {
    consequenceTitle = 'Recovery is being sampled';
    consequenceBody = `${runtime.healthyProbeCount} of ${policy.healthyProbes} healthy probes are confirmed. Most requests still receive fallback.`;
    consequenceTone =
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100';
  } else if (thresholdCrossed || timeoutRisk) {
    consequenceTitle = 'Users are exposed to a failing path';
    consequenceBody =
      'Advance the clock to record this evidence. Until the breaker opens, calls spend time and capacity on the unhealthy dependency.';
    consequenceTone =
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100';
  }

  const displayTicks: Array<TickRecord | null> = [
    ...Array(Math.max(0, 12 - runtime.ticks.slice(-12).length)).fill(null),
    ...runtime.ticks.slice(-12),
  ];

  return (
    <section
      data-content-block="tools/circuit-breaker-simulator"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-neutral-950">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-cyan-300">
                Resilience workbench
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-normal sm:text-2xl">
                Trace the breaker, not just the error rate
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-300">
                Tune the policy, pressure the dependency, and advance a deterministic
                clock to see exactly why calls are admitted, rejected, or probed.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((current) => !current)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-neutral-600 px-3 py-2 text-sm font-semibold text-white hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {running ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              {running ? 'Pause clock' : 'Play clock'}
            </button>
            <button
              type="button"
              onClick={resetEvidence}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-600 text-white hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label="Reset simulation evidence"
              title="Reset simulation evidence"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-white px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
              Challenge the healthy configuration
            </h3>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Scenario presets only change dependency pressure. The breaker keeps its
              evidence, so you can inject a failure and then switch to recovery.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {SCENARIOS.map((item) => {
            const selected = scenario === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => applyScenario(item.id)}
                className={`min-h-16 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:focus-visible:ring-cyan-400 ${
                  selected
                    ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                }`}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span
                  className={`mt-1 block text-xs leading-4 ${
                    selected
                      ? 'text-neutral-300 dark:text-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {item.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid border-b border-neutral-200 dark:border-neutral-800 xl:grid-cols-2">
        <section className="border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 xl:border-b-0 xl:border-r">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-xs font-bold text-white dark:bg-cyan-300 dark:text-neutral-950">
              1
            </span>
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Define the breaker contract
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                These controls decide how much evidence is enough and how cautiously
                recovery is tested.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <RangeControl
              id="breaker-failure-threshold"
              label="Failure threshold"
              value={policy.failureThresholdPct}
              min={10}
              max={90}
              step={5}
              suffix="%"
              leftLabel="10% sensitive"
              rightLabel="90% tolerant"
              description="Rolling failures needed to open."
              onChange={(value) => updatePolicy('failureThresholdPct', value)}
            />
            <RangeControl
              id="breaker-minimum-requests"
              label="Minimum request volume"
              value={policy.minimumRequests}
              min={5}
              max={100}
              step={5}
              suffix=""
              leftLabel="5 requests"
              rightLabel="100 requests"
              description="Ignore tiny, noisy samples."
              onChange={(value) => updatePolicy('minimumRequests', value)}
            />
            <RangeControl
              id="breaker-window"
              label="Rolling window"
              value={policy.windowSeconds}
              min={2}
              max={12}
              suffix="s"
              leftLabel="2s reactive"
              rightLabel="12s stable"
              onChange={(value) => updatePolicy('windowSeconds', value)}
            />
            <RangeControl
              id="breaker-open-duration"
              label="Open cooldown"
              value={policy.openSeconds}
              min={2}
              max={12}
              suffix="s"
              leftLabel="2s"
              rightLabel="12s"
              onChange={(value) => updatePolicy('openSeconds', value)}
            />
            <RangeControl
              id="breaker-probes"
              label="Healthy probes to close"
              value={policy.healthyProbes}
              min={2}
              max={12}
              suffix=""
              leftLabel="2 probes"
              rightLabel="12 probes"
              onChange={(value) => updatePolicy('healthyProbes', value)}
            />
            <RangeControl
              id="breaker-timeout"
              label="Dependency timeout"
              value={policy.timeoutMs}
              min={200}
              max={2_000}
              step={100}
              suffix="ms"
              leftLabel="200ms"
              rightLabel="2,000ms"
              onChange={(value) => updatePolicy('timeoutMs', value)}
            />
          </div>
        </section>

        <section className="bg-white p-4 dark:bg-neutral-950 sm:p-6">
          <div className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white dark:bg-violet-300 dark:text-neutral-950">
              2
            </span>
            <div>
              <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                Shape traffic and dependency health
              </h3>
              <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Traffic, errors, latency, and retries determine downstream pressure and
                the evidence the policy observes.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <RangeControl
              id="breaker-traffic"
              label="User request rate"
              value={traffic.requestsPerSecond}
              min={5}
              max={150}
              step={5}
              suffix="/s"
              leftLabel="5 req/s"
              rightLabel="150 req/s"
              onChange={(value) => updateTraffic('requestsPerSecond', value)}
            />
            <RangeControl
              id="breaker-error-rate"
              label="Dependency error rate"
              value={traffic.dependencyErrorPct}
              min={0}
              max={100}
              step={5}
              suffix="%"
              leftLabel="0%"
              rightLabel="100%"
              onChange={(value) => updateTraffic('dependencyErrorPct', value)}
            />
            <RangeControl
              id="breaker-latency"
              label="Dependency latency"
              value={traffic.dependencyLatencyMs}
              min={50}
              max={3_000}
              step={50}
              suffix="ms"
              leftLabel="50ms"
              rightLabel="3,000ms"
              onChange={(value) => updateTraffic('dependencyLatencyMs', value)}
            />
            <RangeControl
              id="breaker-retries"
              label="Retries per failed call"
              value={traffic.retries}
              min={0}
              max={4}
              suffix=""
              leftLabel="No retries"
              rightLabel="4 retries"
              onChange={(value) => updateTraffic('retries', value)}
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
                Dependency attempts
              </p>
              <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                {formatNumber(dependencyAttempts)}/s
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {retryMultiplier.toFixed(2)}x user load
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
                Timeout verdict
              </p>
              <p className={`mt-1 text-xl font-bold ${timeoutRisk ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {timeoutRisk ? 'Will time out' : 'Within budget'}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {traffic.dependencyLatencyMs.toLocaleString()}ms vs {policy.timeoutMs.toLocaleString()}ms
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="border-b border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
              Simulation clock · t+{runtime.second}s
            </p>
            <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
              Follow every state transition
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              One step represents one second of requests. Run a burst to build rolling
              evidence, then select Recovery to observe cooldown and probes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => advance()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-950 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:hover:border-neutral-500"
            >
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Step 1s
            </button>
            <button
              type="button"
              onClick={() => advance(8)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-bold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:bg-cyan-300 dark:text-neutral-950 dark:hover:bg-cyan-200 dark:focus-visible:ring-cyan-300 dark:focus-visible:ring-offset-neutral-900"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              Run 8s
            </button>
          </div>
        </div>

        <div
          className="mt-6 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
          aria-label={`Circuit breaker state machine. ${STATE_COPY[runtime.state].label} is active.`}
          role="img"
        >
          <StateNode state="closed" active={runtime.state === 'closed'} />
          <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
            <ArrowRight className="hidden h-5 w-5 md:block" />
            <ArrowDown className="h-5 w-5 md:hidden" />
          </div>
          <StateNode state="open" active={runtime.state === 'open'} />
          <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
            <ArrowRight className="hidden h-5 w-5 md:block" />
            <ArrowDown className="h-5 w-5 md:hidden" />
          </div>
          <StateNode state="half-open" active={runtime.state === 'half-open'} />
        </div>

        <div
          className={`mt-4 rounded-md border p-4 ${consequenceTone}`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {runtime.state === 'open' ? (
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : runtime.state === 'half-open' ? (
              <TimerReset className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-bold">{consequenceTitle}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{consequenceBody}</p>
              {latestTick?.transition ? (
                <p className="mt-2 border-t border-current/20 pt-2 text-xs font-bold">
                  Transition at t+{latestTick.second}s: {latestTick.transition}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
              Rolling evidence and request outcomes
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              The breaker evaluates admitted failures inside the configured window.
              Rejected calls protect the dependency but still require a fallback.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold ${
              thresholdCrossed
                ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                : evidenceReady
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
            }`}
          >
            {evidenceReady ? 'Window active' : 'Gathering sample'}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Rolling failures"
            value={`${rollingFailurePct.toFixed(0)}%`}
            detail={`${formatNumber(rollingFailures)} of ${formatNumber(rollingRequests)} admitted calls`}
            tone={thresholdCrossed ? 'rose' : 'cyan'}
          />
          <Metric
            label="Successful outcomes"
            value={`${servedPct.toFixed(0)}%`}
            detail={`${formatNumber(runtime.totals.succeeded)} user requests completed`}
            tone="emerald"
          />
          <Metric
            label="Fast fallback"
            value={`${fallbackPct.toFixed(0)}%`}
            detail={`${formatNumber(runtime.totals.rejected)} requests rejected by the breaker`}
            tone="amber"
          />
          <Metric
            label="Failure budget"
            value={`${policy.failureThresholdPct}%`}
            detail={`${formatNumber(policy.minimumRequests)} minimum calls across ${policy.windowSeconds}s`}
            tone="rose"
          />
        </div>

        <div className="mt-6 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="min-w-[680px] p-4">
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              {[
                ['bg-emerald-500', 'Succeeded'],
                ['bg-rose-500', 'Failed'],
                ['bg-amber-400', 'Timed out'],
                ['bg-violet-500', 'Rejected'],
              ].map(([color, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
            <div className="grid h-44 grid-cols-12 items-end gap-2" role="img" aria-label="Request outcomes for the latest twelve simulated seconds">
              {displayTicks.map((tick, index) => {
                if (!tick) {
                  return (
                    <div key={`empty-${index}`} className="flex h-full flex-col justify-end">
                      <div className="h-28 rounded-sm border border-dashed border-neutral-300 dark:border-neutral-700" />
                      <span className="mt-2 text-center text-[11px] text-neutral-400">-</span>
                    </div>
                  );
                }

                const total = Math.max(1, tick.requested);
                const segments = [
                  { key: 'succeeded', value: tick.succeeded, className: 'bg-emerald-500' },
                  { key: 'failed', value: tick.failed, className: 'bg-rose-500' },
                  { key: 'timed-out', value: tick.timedOut, className: 'bg-amber-400' },
                  { key: 'rejected', value: tick.rejected, className: 'bg-violet-500' },
                ];

                return (
                  <div
                    key={tick.second}
                    className="flex h-full min-w-0 flex-col justify-end"
                    title={`t+${tick.second}s: ${tick.succeeded} succeeded, ${tick.failed} failed, ${tick.timedOut} timed out, ${tick.rejected} rejected`}
                  >
                    <div className="flex h-28 flex-col justify-end overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                      {segments.map((segment) =>
                        segment.value > 0 ? (
                          <span
                            key={segment.key}
                            className={segment.className}
                            style={{
                              height: `${Math.max(3, percent(segment.value, total))}%`,
                            }}
                          />
                        ) : null,
                      )}
                    </div>
                    <span className="mt-2 truncate text-center text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      {tick.second}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-100 p-4 dark:bg-neutral-900 sm:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div>
            <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
              Request path at t+{runtime.second}s
            </h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              Counts show the latest simulated second, not cumulative totals.
            </p>
            <div className="mt-5 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="min-h-32 rounded-md border border-sky-300 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/50">
                <Users className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">User traffic</p>
                <p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-200">
                  {formatNumber(latestTick?.requested ?? dependencyAttempts)}/s
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Includes retry amplification
                </p>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" aria-hidden="true" />
              <ArrowDown className="mx-auto h-5 w-5 text-neutral-400 sm:hidden" aria-hidden="true" />
              <div className="min-h-32 rounded-md border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-950/50">
                <ShieldCheck className="h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Circuit breaker</p>
                <p className="mt-1 text-xl font-bold text-cyan-800 dark:text-cyan-200">
                  {STATE_COPY[runtime.state].label}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {formatNumber(latestTick?.admitted ?? 0)} admitted · {formatNumber(latestTick?.rejected ?? 0)} rejected
                </p>
              </div>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" aria-hidden="true" />
              <ArrowDown className="mx-auto h-5 w-5 text-neutral-400 sm:hidden" aria-hidden="true" />
              <div className="min-h-32 rounded-md border border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/50">
                <Server className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Dependency</p>
                <p className="mt-1 text-xl font-bold text-violet-800 dark:text-violet-200">
                  {traffic.dependencyLatencyMs.toLocaleString()}ms
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {traffic.dependencyErrorPct}% errors before timeouts
                </p>
              </div>
            </div>
          </div>

          <aside className="border-l-4 border-neutral-950 bg-white p-5 dark:border-white dark:bg-neutral-950">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
              <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                Operator readout
              </h3>
            </div>
            <dl className="mt-5 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Current state</dt>
                <dd className="font-bold text-neutral-950 dark:text-white">
                  {STATE_COPY[runtime.state].label}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Evidence sample</dt>
                <dd className="font-bold text-neutral-950 dark:text-white">
                  {formatNumber(rollingRequests)} calls
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Cooldown</dt>
                <dd className="font-bold text-neutral-950 dark:text-white">
                  {runtime.state === 'open' ? `${cooldownRemaining}s` : 'Inactive'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-neutral-500 dark:text-neutral-400">Recovery probes</dt>
                <dd className="font-bold text-neutral-950 dark:text-white">
                  {runtime.healthyProbeCount}/{policy.healthyProbes}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex items-start gap-2 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                An open circuit is a controlled degradation. It protects capacity, but
                the product still needs cached data, a default response, or a clear
                retry-later message.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </section>
  );
}
