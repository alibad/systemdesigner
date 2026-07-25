'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  HeartPulse,
  RotateCcw,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RecoveryProfile = {
  id: string;
  label: string;
  detail: string;
  successRatePct: number;
  slowCallRatePct: number;
  p95LatencyMs: number;
};

type ProbePolicy = {
  id: string;
  label: string;
  detail: string;
  maxFailureRatePct: number;
  maxSlowCallRatePct: number;
  maxP95LatencyMs: number;
  consequence: string;
};

type RecoveryModel = {
  title: string;
  description: string;
  modelNotice: string;
  openWaitSeconds: number;
  slowCallDurationMs: number;
  bounds: {
    probeCalls: {
      min: number;
      max: number;
      step: number;
    };
  };
  defaults: {
    profileId: string;
    policyId: string;
    probeCalls: number;
  };
  profiles: RecoveryProfile[];
  policies: ProbePolicy[];
};

const BLOCK_ID = 'technology/circuit-breaker-recovery-lab';

function isRecoveryModel(value: unknown): value is RecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecoveryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNotice
      && typeof candidate.openWaitSeconds === 'number'
      && typeof candidate.slowCallDurationMs === 'number'
      && candidate.defaults?.profileId
      && candidate.defaults.policyId
      && typeof candidate.defaults.probeCalls === 'number'
      && typeof candidate.bounds?.probeCalls?.min === 'number'
      && typeof candidate.bounds.probeCalls.max === 'number'
      && typeof candidate.bounds.probeCalls.step === 'number'
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(
        (profile) =>
          profile
          && typeof profile.id === 'string'
          && typeof profile.label === 'string'
          && typeof profile.detail === 'string'
          && typeof profile.successRatePct === 'number'
          && typeof profile.slowCallRatePct === 'number'
          && typeof profile.p95LatencyMs === 'number',
      )
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 2
      && candidate.policies.every(
        (policy) =>
          policy
          && typeof policy.id === 'string'
          && typeof policy.label === 'string'
          && typeof policy.detail === 'string'
          && typeof policy.maxFailureRatePct === 'number'
          && typeof policy.maxSlowCallRatePct === 'number'
          && typeof policy.maxP95LatencyMs === 'number'
          && typeof policy.consequence === 'string',
      ),
  );
}

export default function CircuitBreakerRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<RecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No recovery-probe model was supplied.');
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
        if (!isRecoveryModel(payload)) {
          throw new Error('The recovery-probe model is incomplete.');
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
              <p className="font-semibold">The recovery lab could not be loaded.</p>
              <p className="mt-2 text-sm opacity-75">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
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

  return <RecoveryWorkbench model={model} />;
}

function RecoveryWorkbench({ model }: { model: RecoveryModel }) {
  const defaultProfile =
    model.profiles.find((profile) => profile.id === model.defaults.profileId)
    ?? model.profiles[0];
  const defaultPolicy =
    model.policies.find((policy) => policy.id === model.defaults.policyId)
    ?? model.policies[0];
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [policyId, setPolicyId] = useState(defaultPolicy.id);
  const [probeCalls, setProbeCalls] = useState(model.defaults.probeCalls);

  const profile =
    model.profiles.find((candidate) => candidate.id === profileId) ?? model.profiles[0];
  const policy =
    model.policies.find((candidate) => candidate.id === policyId) ?? model.policies[0];

  const result = useMemo(() => {
    const successfulCalls = Math.round(probeCalls * (profile.successRatePct / 100));
    const failedCalls = probeCalls - successfulCalls;
    const slowCalls = Math.round(probeCalls * (profile.slowCallRatePct / 100));
    const measuredFailureRatePct = (failedCalls / probeCalls) * 100;
    const measuredSlowCallRatePct = (slowCalls / probeCalls) * 100;
    const failurePass = measuredFailureRatePct <= policy.maxFailureRatePct;
    const slowPass = measuredSlowCallRatePct <= policy.maxSlowCallRatePct;
    const latencyPass = profile.p95LatencyMs <= policy.maxP95LatencyMs;
    const closes = failurePass && slowPass && latencyPass;

    return {
      successfulCalls,
      failedCalls,
      slowCalls,
      measuredFailureRatePct,
      measuredSlowCallRatePct,
      failurePass,
      slowPass,
      latencyPass,
      closes,
    };
  }, [policy, probeCalls, profile]);

  function reset() {
    setProfileId(defaultProfile.id);
    setPolicyId(defaultPolicy.id);
    setProbeCalls(model.defaults.probeCalls);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Recovery-probe lab"
          title={model.title}
          description={model.description}
          icon={HeartPulse}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Dependency after the wait
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.profiles.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === profile.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={Activity}
                      accent={candidate.successRatePct >= 95 ? 'emerald' : candidate.successRatePct >= 75 ? 'amber' : 'rose'}
                      onClick={() => setProfileId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Half-open probe calls"
                value={probeCalls}
                output={`${probeCalls} calls`}
                {...model.bounds.probeCalls}
                lowLabel="Faster decision"
                highLabel="More evidence"
                accent="cyan"
                onChange={setProbeCalls}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Recovery contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.policies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === policy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={ShieldCheck}
                      accent={candidate.maxFailureRatePct === 0 ? 'emerald' : 'violet'}
                      onClick={() => setPolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                result.closes
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.closes ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Probe decision
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.closes
                      ? 'Close the circuit gradually'
                      : 'Return to open and wait again'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.closes
                      ? 'The limited probes satisfy every selected recovery boundary. Restore normal traffic while watching for a fresh breach.'
                      : 'At least one recovery boundary failed. Full traffic would turn a partial recovery into another overload.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Probe successes"
                value={`${result.successfulCalls}/${probeCalls}`}
                detail={`${Math.round(profile.successRatePct)}% modeled success`}
                icon={TestTube2}
                tone={result.failurePass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Probe failures"
                value={`${result.failedCalls}`}
                detail={`${Math.round(result.measuredFailureRatePct)}% vs ${policy.maxFailureRatePct}% maximum`}
                icon={RotateCcw}
                tone={result.failurePass ? 'neutral' : 'rose'}
              />
              <LabMetric
                label="Slow probes"
                value={`${result.slowCalls}`}
                detail={`${Math.round(result.measuredSlowCallRatePct)}% vs ${policy.maxSlowCallRatePct}% maximum`}
                icon={Clock3}
                tone={result.slowPass ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Probe p95"
                value={`${profile.p95LatencyMs} ms`}
                detail={`Must stay at or below ${policy.maxP95LatencyMs} ms`}
                icon={Gauge}
                tone={result.latencyPass ? 'blue' : 'rose'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Recovery state machine
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {model.modelNotice}
                </p>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-3">
                <StateCard
                  step="1"
                  title="Open"
                  detail={`Fail fast for ${model.openWaitSeconds} seconds`}
                  state="done"
                />
                <StateCard
                  step="2"
                  title="Half-open"
                  detail={`Admit only ${probeCalls} controlled calls`}
                  state="active"
                />
                <StateCard
                  step="3"
                  title={result.closes ? 'Closed' : 'Open again'}
                  detail={result.closes ? 'Resume and keep measuring' : policy.consequence}
                  state={result.closes ? 'healthy' : 'failed'}
                />
              </div>
            </section>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200">
              A half-open decision is not a health-check ping. Use a representative,
              bounded operation and evaluate the same failure and latency semantics
              that opened the breaker.
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function StateCard({
  step,
  title,
  detail,
  state,
}: {
  step: string;
  title: string;
  detail: string;
  state: 'done' | 'active' | 'healthy' | 'failed';
}) {
  const styles = {
    done: 'border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
    active: 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-400 dark:border-cyan-800 dark:bg-cyan-950/35 dark:text-cyan-50',
    healthy: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`rounded-md border p-4 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
          {step}
        </span>
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}
