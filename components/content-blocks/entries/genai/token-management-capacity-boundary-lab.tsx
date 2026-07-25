'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Gauge,
  Hourglass,
  MessageSquareText,
  Repeat2,
  ShieldCheck,
  TimerReset,
  Waves,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OutputProfile = {
  id: string;
  label: string;
  detail: string;
  outputTokens: number;
};

type Boundary = {
  id: string;
  label: string;
  detail: string;
  maxQueueSeconds: number;
  retryShare: number;
  behavior: string;
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  baseRequestsPerMinute: number;
  inputTokens: number;
  tokensPerMinuteLimit: number;
  concurrencyLimit: number;
  timeToFirstTokenMs: number;
  outputTokensPerSecond: number;
  deadlineMs: number;
  baseFailureRate: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  recommendedBoundaryId: string;
};

type CapacityBoundaryModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    outputProfileId: string;
    boundaryId: string;
    trafficMultiplier: number;
  };
  outputProfiles: OutputProfile[];
  boundaries: Boundary[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/token-management-capacity-boundary-lab';

function isCapacityBoundaryModel(value: unknown): value is CapacityBoundaryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityBoundaryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.outputProfiles)
      && candidate.outputProfiles.length > 0
      && Array.isArray(candidate.boundaries)
      && candidate.boundaries.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function TokenManagementCapacityBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityBoundaryModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No capacity-boundary model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityBoundaryModel(payload)) {
          throw new Error('Capacity-boundary data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load capacity data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <CapacityBoundaryLab data={data} /> : <LoadState />}
    </div>
  );
}

function CapacityBoundaryLab({ data }: { data: CapacityBoundaryModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [outputProfileId, setOutputProfileId] = useState(data.defaults.outputProfileId);
  const [boundaryId, setBoundaryId] = useState(data.defaults.boundaryId);
  const [trafficMultiplier, setTrafficMultiplier] = useState(data.defaults.trafficMultiplier);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const outputProfile = data.outputProfiles.find((item) => item.id === outputProfileId)
    ?? data.outputProfiles[0];
  const boundary = data.boundaries.find((item) => item.id === boundaryId) ?? data.boundaries[0];

  const result = useMemo(() => {
    const userRequestsPerMinute = scenario.baseRequestsPerMinute * trafficMultiplier;
    const serviceTimeMs = scenario.timeToFirstTokenMs
      + (outputProfile.outputTokens / scenario.outputTokensPerSecond) * 1000;
    const missesDeadline = serviceTimeMs > scenario.deadlineMs;
    const timeoutRate = Math.min(
      0.8,
      scenario.baseFailureRate + (missesDeadline ? 0.35 : 0),
    );
    const attemptMultiplier = 1 + timeoutRate * boundary.retryShare;
    const attemptsPerMinute = userRequestsPerMinute * attemptMultiplier;
    const tokensPerAttempt = scenario.inputTokens + outputProfile.outputTokens;
    const tokenDemandPerMinute = attemptsPerMinute * tokensPerAttempt;
    const requiredConcurrency = (attemptsPerMinute / 60) * (serviceTimeMs / 1000);
    const tokenUtilization = tokenDemandPerMinute / scenario.tokensPerMinuteLimit;
    const concurrencyUtilization = requiredConcurrency / scenario.concurrencyLimit;
    const admissionRate = Math.min(
      1,
      1 / Math.max(tokenUtilization, 0.0001),
      1 / Math.max(concurrencyUtilization, 0.0001),
    );
    const admittedUserRequests = userRequestsPerMinute * admissionRate;
    const overflowRequests = Math.max(0, userRequestsPerMinute - admittedUserRequests);
    const overflowRatio = overflowRequests / Math.max(userRequestsPerMinute, 1);
    const queueWaitSeconds = boundary.id === 'fail-fast'
      ? 0
      : Math.min(boundary.maxQueueSeconds, overflowRatio * (serviceTimeMs / 1000) * 3);
    const p95LatencyMs = serviceTimeMs + queueWaitSeconds * 1000;
    const processedAttemptsPerHour = attemptsPerMinute * admissionRate * 60;
    const costPerAttempt = (
      scenario.inputTokens * scenario.inputPricePerMillion
      + outputProfile.outputTokens * scenario.outputPricePerMillion
    ) / 1_000_000;
    const costPerHour = processedAttemptsPerHour * costPerAttempt;
    const recommended = boundary.id === scenario.recommendedBoundaryId;
    const retryAmplification = Math.max(0, attemptsPerMinute - userRequestsPerMinute);

    let state: 'healthy' | 'pressured' | 'overloaded' = 'healthy';
    if (tokenUtilization > 1 || concurrencyUtilization > 1 || missesDeadline) {
      state = 'overloaded';
    } else if (tokenUtilization > 0.8 || concurrencyUtilization > 0.8 || p95LatencyMs > scenario.deadlineMs * 0.8) {
      state = 'pressured';
    }

    let verdict = 'Healthy: requests remain inside token, concurrency, and deadline limits';
    if (state === 'pressured') {
      verdict = 'Pressure rising: preserve headroom before the next burst';
    } else if (boundary.id === 'retry-all') {
      verdict = 'Overloaded: retries add demand to the saturated route';
    } else if (boundary.id === 'bounded-queue') {
      verdict = 'Degraded safely: bounded waiting and shedding protect the route';
    } else if (state === 'overloaded') {
      verdict = 'Degraded explicitly: excess work fails before it forms a hidden queue';
    }

    const queuedNow = boundary.id === 'fail-fast'
      ? 0
      : Math.round(Math.min(
        overflowRequests / 60 * boundary.maxQueueSeconds,
        userRequestsPerMinute / 60 * boundary.maxQueueSeconds,
      ));
    const shedPerMinute = state === 'overloaded'
      ? Math.round(overflowRequests * (boundary.id === 'retry-all' ? 0 : 1))
      : 0;

    return {
      admissionRate,
      admittedUserRequests,
      attemptsPerMinute,
      concurrencyUtilization,
      costPerHour,
      missesDeadline,
      p95LatencyMs,
      queuedNow,
      recommended,
      requiredConcurrency,
      retryAmplification,
      serviceTimeMs,
      shedPerMinute,
      state,
      tokenDemandPerMinute,
      tokenUtilization,
      userRequestsPerMinute,
      verdict,
    };
  }, [boundary, outputProfile, scenario, trafficMultiplier]);

  const chooseScenario = (next: Scenario) => {
    setScenarioId(next.id);
    setBoundaryId(next.recommendedBoundaryId);
    setTrafficMultiplier(1);
  };

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setOutputProfileId(data.defaults.outputProfileId);
    setBoundaryId(data.defaults.boundaryId);
    setTrafficMultiplier(data.defaults.trafficMultiplier);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Serving pressure lab"
        title={data.title}
        description={data.description}
        icon={Waves}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the workload
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.brief}
                    icon={MessageSquareText}
                    accent="blue"
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Set the answer envelope
              </legend>
              <div className="mt-3 space-y-2">
                {data.outputProfiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === outputProfile.id}
                    label={item.label}
                    detail={`${item.detail} ${item.outputTokens.toLocaleString()} output tokens.`}
                    icon={Zap}
                    accent={item.id === 'concise' ? 'emerald' : item.id === 'detailed' ? 'violet' : 'cyan'}
                    onClick={() => setOutputProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Traffic multiplier"
              value={trafficMultiplier}
              output={`${trafficMultiplier.toFixed(1)}x`}
              min={0.5}
              max={3}
              step={0.1}
              accent="amber"
              lowLabel="Quiet"
              highLabel="Surge"
              onChange={setTrafficMultiplier}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose the failure boundary
              </legend>
              <div className="mt-3 space-y-2">
                {data.boundaries.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === boundary.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'retry-all' ? Repeat2 : item.id === 'fail-fast' ? Ban : ShieldCheck}
                    accent={item.id === 'retry-all' ? 'rose' : item.id === 'fail-fast' ? 'amber' : 'emerald'}
                    onClick={() => setBoundaryId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${stateClasses(result.state)}`}>
            <div className="flex items-start gap-3">
              {result.state === 'healthy' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{result.verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {boundary.behavior}
                </p>
              </div>
            </div>
          </div>

          <section aria-label="Token pressure trace">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Pressure trace
            </p>
            <div className="mt-3 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <FlowStage
                label="Arrival"
                value={`${Math.round(result.userRequestsPerMinute).toLocaleString()} req/min`}
                detail={`${trafficMultiplier.toFixed(1)}x product traffic`}
                icon={Waves}
                tone="blue"
              />
              <FlowConnector />
              <FlowStage
                label="Attempts"
                value={`${Math.round(result.attemptsPerMinute).toLocaleString()} calls/min`}
                detail={result.retryAmplification > 0
                  ? `+${Math.round(result.retryAmplification)} retry calls/min`
                  : 'No retry amplification'}
                icon={Repeat2}
                tone={result.retryAmplification > result.userRequestsPerMinute * 0.1 ? 'rose' : 'violet'}
              />
              <FlowConnector />
              <FlowStage
                label="Provider work"
                value={`${formatDuration(result.serviceTimeMs)} each`}
                detail={`${outputProfile.outputTokens.toLocaleString()} output tokens`}
                icon={Gauge}
                tone={result.missesDeadline ? 'rose' : 'amber'}
              />
              <FlowConnector />
              <FlowStage
                label="User outcome"
                value={`${Math.round(result.admittedUserRequests).toLocaleString()} admitted`}
                detail={result.shedPerMinute > 0
                  ? `${result.shedPerMinute.toLocaleString()} shed per minute`
                  : 'No load shedding'}
                icon={result.shedPerMinute > 0 ? Ban : CheckCircle2}
                tone={result.state === 'healthy' ? 'emerald' : result.state === 'pressured' ? 'amber' : 'rose'}
              />
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Shared capacity envelope
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {Math.round(result.admissionRate * 100)}% of incoming work can start
                </h4>
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Boundary: {boundary.label}
              </p>
            </div>

            <div className="mt-5 space-y-5">
              <PressureBar
                label="Token-rate pressure"
                value={result.tokenUtilization}
                amount={`${Math.round(result.tokenDemandPerMinute).toLocaleString()} / ${scenario.tokensPerMinuteLimit.toLocaleString()} tokens/min`}
              />
              <PressureBar
                label="Generation concurrency"
                value={result.concurrencyUtilization}
                amount={`${result.requiredConcurrency.toFixed(1)} / ${scenario.concurrencyLimit} active slots`}
              />
              <PressureBar
                label="Deadline pressure"
                value={result.p95LatencyMs / scenario.deadlineMs}
                amount={`${formatDuration(result.p95LatencyMs)} / ${formatDuration(scenario.deadlineMs)} deadline`}
              />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Consequence
              label="Queue now"
              value={result.queuedNow === 0 ? 'No hidden queue' : `${result.queuedNow} requests waiting`}
              detail={boundary.maxQueueSeconds === 0
                ? 'Excess requests receive an immediate typed overload result.'
                : `Waiting is capped at ${boundary.maxQueueSeconds} seconds.`}
              icon={Hourglass}
              tone={result.queuedNow > 0 ? 'amber' : 'emerald'}
            />
            <Consequence
              label="Estimated p95"
              value={formatDuration(result.p95LatencyMs)}
              detail={`Service time starts at ${formatDuration(result.serviceTimeMs)} before queueing.`}
              icon={Clock3}
              tone={result.p95LatencyMs > scenario.deadlineMs ? 'rose' : 'blue'}
            />
            <Consequence
              label="Illustrative spend"
              value={`${formatMoney(result.costPerHour)} / hour`}
              detail="Uses the scenario's configurable unit rates for all admitted attempts."
              icon={CircleDollarSign}
              tone="violet"
            />
            <Consequence
              label="Boundary fit"
              value={result.recommended ? 'Matches workload' : 'Alternative boundary'}
              detail={`Recommended: ${data.boundaries.find((item) => item.id === scenario.recommendedBoundaryId)?.label ?? scenario.recommendedBoundaryId}.`}
              icon={TimerReset}
              tone={result.recommended ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function FlowStage({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
  tone: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const toneClasses = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${toneClasses[tone]}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </p>
      <p className="mt-2 break-words text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex items-center justify-center text-neutral-300 dark:text-neutral-700" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function PressureBar({ label, value, amount }: { label: string; value: number; amount: string }) {
  const percent = Math.round(value * 100);
  const width = Math.min(100, percent);
  const barClass = value > 1
    ? 'bg-rose-500 dark:bg-rose-400'
    : value > 0.8
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-emerald-500 dark:bg-emerald-400';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{amount}</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full transition-[width] motion-reduce:transition-none ${barClass}`} style={{ width: `${width}%` }} />
      </div>
      <p className={`mt-1 text-xs font-semibold tabular-nums ${value > 1 ? 'text-rose-700 dark:text-rose-300' : value > 0.8 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
        {percent}% utilized{value > 1 ? `, ${percent - 100}% beyond the limit` : ''}
      </p>
    </div>
  );
}

function Consequence({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
  tone: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const iconClasses = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <span className={`rounded-md p-2 ${iconClasses[tone]}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 break-words font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function stateClasses(state: 'healthy' | 'pressured' | 'overloaded') {
  if (state === 'healthy') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  }
  if (state === 'pressured') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  }
  return 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
}

function formatDuration(milliseconds: number) {
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.round(milliseconds)}ms`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function LoadState() {
  return (
    <LearningLab>
      <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-500 dark:text-neutral-400">
        Loading serving pressure lab...
      </div>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <div className="m-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
        <p className="flex items-center gap-2 font-semibold">
          <CircleAlert aria-hidden="true" className="h-4 w-4" />
          Serving pressure lab unavailable
        </p>
        <p className="mt-2 text-sm opacity-80">{detail}</p>
      </div>
    </LearningLab>
  );
}
