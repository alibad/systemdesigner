'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldX,
  TimerReset,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  requestsPerSecond: number;
  failureRatePct: number;
  slowCallRatePct: number;
  windowSeconds: number;
};

type TripDecisionModel = {
  title: string;
  description: string;
  modelNotice: string;
  minimumCalls: number;
  failureRateThresholdPct: number;
  slowCallRateThresholdPct: number;
  slowCallDurationMs: number;
  callTimeoutMs: number;
  bounds: {
    requestsPerSecond: Bounds;
    failureRatePct: Bounds;
    slowCallRatePct: Bounds;
    windowSeconds: Bounds;
  };
  defaults: {
    scenarioId: string;
  };
  scenarios: FailureScenario[];
};

const BLOCK_ID = 'technology/circuit-breaker-impact';

function hasBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isTripDecisionModel(value: unknown): value is TripDecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TripDecisionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNotice
      && typeof candidate.minimumCalls === 'number'
      && typeof candidate.failureRateThresholdPct === 'number'
      && typeof candidate.slowCallRateThresholdPct === 'number'
      && typeof candidate.slowCallDurationMs === 'number'
      && typeof candidate.callTimeoutMs === 'number'
      && candidate.defaults?.scenarioId
      && hasBounds(candidate.bounds?.requestsPerSecond)
      && hasBounds(candidate.bounds?.failureRatePct)
      && hasBounds(candidate.bounds?.slowCallRatePct)
      && hasBounds(candidate.bounds?.windowSeconds)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(
        (scenario) =>
          scenario
          && typeof scenario.id === 'string'
          && typeof scenario.label === 'string'
          && typeof scenario.detail === 'string'
          && typeof scenario.requestsPerSecond === 'number'
          && typeof scenario.failureRatePct === 'number'
          && typeof scenario.slowCallRatePct === 'number'
          && typeof scenario.windowSeconds === 'number',
      ),
  );
}

export default function CircuitBreakerImpact({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<TripDecisionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No trip-decision model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTripDecisionModel(payload)) {
          throw new Error('The trip-decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <BlockState
        error={error}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return <TripDecisionLab model={model} />;
}

function TripDecisionLab({ model }: { model: TripDecisionModel }) {
  const defaultScenario =
    model.scenarios.find((scenario) => scenario.id === model.defaults.scenarioId)
    ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [requestsPerSecond, setRequestsPerSecond] = useState(
    defaultScenario.requestsPerSecond,
  );
  const [failureRatePct, setFailureRatePct] = useState(defaultScenario.failureRatePct);
  const [slowCallRatePct, setSlowCallRatePct] = useState(defaultScenario.slowCallRatePct);
  const [windowSeconds, setWindowSeconds] = useState(defaultScenario.windowSeconds);

  const scenario =
    model.scenarios.find((candidate) => candidate.id === scenarioId) ?? model.scenarios[0];

  const result = useMemo(() => {
    const observedCalls = Math.round(requestsPerSecond * windowSeconds);
    const failures = Math.round(observedCalls * (failureRatePct / 100));
    const slowCalls = Math.round(observedCalls * (slowCallRatePct / 100));
    const enoughEvidence = observedCalls >= model.minimumCalls;
    const failureTrip =
      enoughEvidence && failureRatePct >= model.failureRateThresholdPct;
    const slowCallTrip =
      enoughEvidence && slowCallRatePct >= model.slowCallRateThresholdPct;
    const opens = failureTrip || slowCallTrip;
    const waitSecondsAvoidedPerSecond = opens
      ? requestsPerSecond * (model.callTimeoutMs / 1000)
      : 0;

    return {
      observedCalls,
      failures,
      slowCalls,
      enoughEvidence,
      failureTrip,
      slowCallTrip,
      opens,
      waitSecondsAvoidedPerSecond,
    };
  }, [
    failureRatePct,
    model,
    requestsPerSecond,
    slowCallRatePct,
    windowSeconds,
  ]);

  function selectScenario(nextScenario: FailureScenario) {
    setScenarioId(nextScenario.id);
    setRequestsPerSecond(nextScenario.requestsPerSecond);
    setFailureRatePct(nextScenario.failureRatePct);
    setSlowCallRatePct(nextScenario.slowCallRatePct);
    setWindowSeconds(nextScenario.windowSeconds);
  }

  function reset() {
    selectScenario(defaultScenario);
  }

  const decisionTone = !result.enoughEvidence
    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
    : result.opens
      ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  const DecisionIcon = !result.enoughEvidence
    ? AlertTriangle
    : result.opens
      ? ShieldX
      : CheckCircle2;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trip-decision lab"
          title={model.title}
          description={model.description}
          icon={Waves}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Dependency condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenario.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={Activity}
                      accent={candidate.failureRatePct >= model.failureRateThresholdPct ? 'rose' : 'cyan'}
                      onClick={() => selectScenario(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Request rate"
                value={requestsPerSecond}
                output={`${requestsPerSecond.toLocaleString()} req/s`}
                {...model.bounds.requestsPerSecond}
                lowLabel="Sparse evidence"
                highLabel="Heavy traffic"
                accent="cyan"
                onChange={setRequestsPerSecond}
              />
              <LabRange
                label="Failure rate"
                value={failureRatePct}
                output={`${failureRatePct}%`}
                {...model.bounds.failureRatePct}
                lowLabel="Healthy"
                highLabel="Unavailable"
                accent="rose"
                onChange={setFailureRatePct}
              />
              <LabRange
                label={`Slow calls over ${model.slowCallDurationMs} ms`}
                value={slowCallRatePct}
                output={`${slowCallRatePct}%`}
                {...model.bounds.slowCallRatePct}
                lowLabel="Responsive"
                highLabel="Saturated"
                accent="amber"
                onChange={setSlowCallRatePct}
              />
              <LabRange
                label="Measurement window"
                value={windowSeconds}
                output={`${windowSeconds} s`}
                {...model.bounds.windowSeconds}
                lowLabel="Reactive"
                highLabel="Stable"
                accent="violet"
                onChange={setWindowSeconds}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${decisionTone}`}>
              <div className="flex items-start gap-3">
                <DecisionIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Breaker decision
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {!result.enoughEvidence
                      ? 'Keep measuring: the sample is too small'
                      : result.opens
                        ? 'Open the circuit and fail fast'
                        : 'Keep the circuit closed'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {!result.enoughEvidence
                      ? `The window has ${result.observedCalls} calls, below the ${model.minimumCalls}-call minimum. A small burst must not control the whole dependency path.`
                      : result.opens
                        ? `${result.failureTrip ? 'The failure-rate boundary is crossed. ' : ''}${result.slowCallTrip ? 'The slow-call boundary is crossed. ' : ''}New calls should use the declared degraded path until recovery probes are allowed.`
                        : 'The sample is large enough and both measured rates remain below their configured boundaries.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Observed calls"
                value={result.observedCalls.toLocaleString()}
                detail={`Minimum ${model.minimumCalls.toLocaleString()} calls`}
                icon={Gauge}
                tone={result.enoughEvidence ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Failures"
                value={result.failures.toLocaleString()}
                detail={`${failureRatePct}% vs ${model.failureRateThresholdPct}% trip boundary`}
                icon={ShieldX}
                tone={result.failureTrip ? 'rose' : 'neutral'}
              />
              <LabMetric
                label="Slow calls"
                value={result.slowCalls.toLocaleString()}
                detail={`${slowCallRatePct}% vs ${model.slowCallRateThresholdPct}% trip boundary`}
                icon={Clock3}
                tone={result.slowCallTrip ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Wait avoided"
                value={`${Math.round(result.waitSecondsAvoidedPerSecond).toLocaleString()} s/s`}
                detail={`At a ${model.callTimeoutMs} ms per-attempt timeout`}
                icon={TimerReset}
                tone={result.opens ? 'emerald' : 'neutral'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Request path after this decision
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {model.modelNotice}
                </p>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <FlowNode
                  label="Caller"
                  detail={`${requestsPerSecond.toLocaleString()} requests each second`}
                  tone="blue"
                />
                <FlowArrow label="calls" />
                <FlowNode
                  label={result.opens ? 'Open breaker' : 'Closed breaker'}
                  detail={result.opens ? 'Reject or degrade immediately' : 'Record dependency outcomes'}
                  tone={result.opens ? 'rose' : 'green'}
                />
                <FlowArrow label={result.opens ? 'blocked' : 'forwarded'} muted={result.opens} />
                <FlowNode
                  label={result.opens ? 'Fallback boundary' : 'Dependency'}
                  detail={result.opens ? 'Explicit degraded contract' : `${failureRatePct}% failures observed`}
                  tone={result.opens ? 'amber' : 'violet'}
                />
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BlockState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-40 rounded-lg border p-5 ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
      >
        {error ? (
          <>
            <p className="font-semibold">The trip-decision lab could not be loaded.</p>
            <p className="mt-2 text-sm opacity-75">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FlowNode({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'blue' | 'rose' | 'green' | 'amber' | 'violet';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${tones[tone]}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 text-xs font-semibold uppercase ${
        muted
          ? 'text-rose-600 dark:text-rose-300'
          : 'text-neutral-500 dark:text-neutral-400'
      }`}
    >
      <span className="hidden h-px w-5 bg-current md:block" />
      <span>{label}</span>
      <span aria-hidden="true" className="hidden md:inline">
        {muted ? 'x' : '>'}
      </span>
    </div>
  );
}
