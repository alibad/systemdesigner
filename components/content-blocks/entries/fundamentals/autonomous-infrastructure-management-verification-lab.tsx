'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Network,
  RefreshCcw,
  Repeat2,
  Route,
  Scale,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/autonomous-infrastructure-management-verification-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/autonomous-infrastructure-management/data/closed-loop-recovery-model.json';

type Range = { min: number; max: number; step: number };
type Scenario = {
  id: string;
  label: string;
  detail: string;
  requiredResponse: string;
  settlingSeconds: number;
  maximumSafeScope: number;
  baselineImpact: number;
  containedImpact: number;
};
type ResponseOption = { id: string; label: string; detail: string };
type VerificationPolicy = ResponseOption & { strength: number };

type RecoveryModel = {
  kind: 'autonomous-closed-loop-recovery';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    responseId: string;
    verificationId: string;
    scopePercent: number;
    signalDelaySeconds: number;
    cooldownSeconds: number;
    maximumAttempts: number;
  };
  ranges: {
    scopePercent: Range;
    signalDelaySeconds: Range;
    cooldownSeconds: Range;
    maximumAttempts: Range;
  };
  scenarios: Scenario[];
  responses: ResponseOption[];
  verificationPolicies: VerificationPolicy[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isRecoveryModel(value: unknown): value is RecoveryModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'autonomous-closed-loop-recovery'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && isRecord(value.ranges)
      && Array.isArray(value.scenarios)
      && Array.isArray(value.responses)
      && Array.isArray(value.verificationPolicies),
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export default function AutonomousInfrastructureManagementVerificationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [responseId, setResponseId] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [scopePercent, setScopePercent] = useState(1);
  const [signalDelaySeconds, setSignalDelaySeconds] = useState(5);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [maximumAttempts, setMaximumAttempts] = useState(1);

  useEffect(() => {
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
          throw new Error('The closed-loop recovery model is incomplete.');
        }
        setModel(payload);
        setScenarioId(payload.defaults.scenarioId);
        setResponseId(payload.defaults.responseId);
        setVerificationId(payload.defaults.verificationId);
        setScopePercent(payload.defaults.scopePercent);
        setSignalDelaySeconds(payload.defaults.signalDelaySeconds);
        setCooldownSeconds(payload.defaults.cooldownSeconds);
        setMaximumAttempts(payload.defaults.maximumAttempts);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the recovery model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario =
    model?.scenarios.find((item) => item.id === scenarioId) ?? model?.scenarios[0];
  const response =
    model?.responses.find((item) => item.id === responseId) ?? model?.responses[0];
  const verification =
    model?.verificationPolicies.find((item) => item.id === verificationId)
    ?? model?.verificationPolicies[0];

  const result = useMemo(() => {
    if (!scenario || !response || !verification) return null;

    const actionMatches = response.id === scenario.requiredResponse;
    const scopeSafe = scopePercent <= scenario.maximumSafeScope;
    const stable = cooldownSeconds >= scenario.settlingSeconds;
    const verified = verification.strength >= 3;
    const attemptsSafe = maximumAttempts <= 3;
    const blockers = [
      !actionMatches
        ? 'The selected action does not remove the modeled incident cause.'
        : null,
      !scopeSafe
        ? `The ${scopePercent}% action exceeds the ${scenario.maximumSafeScope}% safe step for this loop.`
        : null,
      !stable
        ? `The controller can act again before the ${formatDuration(scenario.settlingSeconds)} settling period ends.`
        : null,
      !attemptsSafe
        ? 'The retry envelope permits repeated mutations instead of escalation.'
        : null,
      !verified
        ? 'The selected signal proves execution or resource health, not user-facing recovery.'
        : null,
    ].filter((item): item is string => Boolean(item));

    const status = !actionMatches
      ? 'Wrong action'
      : !scopeSafe
        ? 'Unsafe step'
        : !stable
          ? 'Oscillating'
          : !attemptsSafe
            ? 'Retry amplification'
            : !verified
              ? 'False success'
              : 'Contained';
    const impact = actionMatches && scopeSafe
      ? scenario.containedImpact
      : scenario.baselineImpact;
    const actionEnvelope = Math.min(100, scopePercent * maximumAttempts);

    return {
      actionEnvelope,
      blockers,
      impact,
      ready: blockers.length === 0,
      status,
      timeToEvidence: signalDelaySeconds + scenario.settlingSeconds,
    };
  }, [
    cooldownSeconds,
    maximumAttempts,
    response,
    scenario,
    scopePercent,
    signalDelaySeconds,
    verification,
  ]);

  if (!model || !scenario || !response || !verification || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Closed-loop recovery lab"
            title="Verify the service, not the action receipt"
            description="Loading incidents, responses, feedback delays, and verification policies."
            icon={RefreshCcw}
            accent="emerald"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading recovery model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setScenarioId(model.defaults.scenarioId);
    setResponseId(model.defaults.responseId);
    setVerificationId(model.defaults.verificationId);
    setScopePercent(model.defaults.scopePercent);
    setSignalDelaySeconds(model.defaults.signalDelaySeconds);
    setCooldownSeconds(model.defaults.cooldownSeconds);
    setMaximumAttempts(model.defaults.maximumAttempts);
  };
  const OutcomeIcon = result.ready ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Closed-loop recovery lab"
          title={model.title}
          description={model.description}
          icon={RefreshCcw}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject an incident
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'demand-spike' ? Scale : item.id === 'zone-loss' ? Network : Activity}
                      accent={item.id === 'zone-loss' ? 'rose' : item.id === 'bad-rollout' ? 'amber' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose a response
                </legend>
                <div className="mt-3 space-y-2">
                  {model.responses.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === response.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'rollback' ? Undo2 : item.id === 'shift-traffic' ? Route : item.id === 'scale' ? Scale : Repeat2}
                      accent={item.id === scenario.requiredResponse ? 'emerald' : 'blue'}
                      onClick={() => setResponseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite">
            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Verification signal
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {model.verificationPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === verification.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'service-slo' ? ShieldCheck : item.id === 'resource-health' ? Gauge : Activity}
                    accent={item.strength >= 3 ? 'emerald' : item.strength >= 2 ? 'blue' : 'amber'}
                    onClick={() => setVerificationId(item.id)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="mb-5 text-sm font-semibold text-neutral-950 dark:text-white">
                Tune the feedback loop
              </p>
              <div className="grid gap-x-7 gap-y-7 md:grid-cols-2">
                <LabRange
                  label="Action scope"
                  value={scopePercent}
                  output={`${scopePercent}%`}
                  {...model.ranges.scopePercent}
                  lowLabel="One target"
                  highLabel="Whole fleet"
                  accent="blue"
                  onChange={setScopePercent}
                />
                <LabRange
                  label="Signal delay"
                  value={signalDelaySeconds}
                  output={formatDuration(signalDelaySeconds)}
                  {...model.ranges.signalDelaySeconds}
                  lowLabel="Fresh"
                  highLabel="Stale"
                  accent="amber"
                  onChange={setSignalDelaySeconds}
                />
                <LabRange
                  label="Cooldown"
                  value={cooldownSeconds}
                  output={formatDuration(cooldownSeconds)}
                  {...model.ranges.cooldownSeconds}
                  lowLabel="React again"
                  highLabel="Wait for settling"
                  accent="violet"
                  onChange={setCooldownSeconds}
                />
                <LabRange
                  label="Maximum attempts"
                  value={maximumAttempts}
                  output={`${maximumAttempts}`}
                  {...model.ranges.maximumAttempts}
                  lowLabel="Escalate early"
                  highLabel="Repeat mutations"
                  accent="rose"
                  onChange={setMaximumAttempts}
                />
              </div>
            </section>

            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Loop state"
                value={result.status}
                detail={result.ready ? 'Every modeled guardrail passes' : 'At least one guardrail fails'}
                icon={RefreshCcw}
                tone={result.ready ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Time to evidence"
                value={formatDuration(result.timeToEvidence)}
                detail="Signal delay plus settling period"
                icon={Clock3}
                tone="blue"
              />
              <LabMetric
                label="Action envelope"
                value={`${result.actionEnvelope}%`}
                detail="Scope multiplied by permitted attempts"
                icon={Network}
                tone={result.actionEnvelope <= scenario.maximumSafeScope * 2 ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Modeled impact"
                value={`${result.impact}%`}
                detail="Illustrative affected request share after the response"
                icon={Activity}
                tone={result.ready ? 'cyan' : 'rose'}
              />
            </div>

            <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Recovery trace
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <TraceStep
                  number="1"
                  label="Observe"
                  value={`${verification.label}, ${formatDuration(signalDelaySeconds)} old`}
                  tone={verification.strength >= 3 ? 'blue' : 'amber'}
                />
                <TraceStep
                  number="2"
                  label="Decide"
                  value={`${response.label} for ${scenario.label.toLowerCase()}`}
                  tone={response.id === scenario.requiredResponse ? 'violet' : 'rose'}
                />
                <TraceStep
                  number="3"
                  label="Act"
                  value={`${scopePercent}% scope, up to ${maximumAttempts} attempts`}
                  tone={scopePercent <= scenario.maximumSafeScope ? 'cyan' : 'rose'}
                />
                <TraceStep
                  number="4"
                  label="Verify"
                  value={`${formatDuration(cooldownSeconds)} cooldown before another action`}
                  tone={cooldownSeconds >= scenario.settlingSeconds ? 'emerald' : 'rose'}
                />
              </div>
            </section>

            <section
              className={`mt-6 rounded-md border p-4 ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.ready
                      ? 'The modeled loop contains the incident and verifies recovery'
                      : `The modeled loop ends in ${result.status.toLowerCase()}`}
                  </p>
                  {result.ready ? (
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      Persist the incident, decision, policy version, action identity,
                      observations, and terminal outcome so an operator can audit or replay
                      the decision.
                    </p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
                      {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The incident percentages and timings are teaching fixtures, not universal
              infrastructure benchmarks. Calibrate action size, settling time, and release
              gates from the real service and its dependencies.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TraceStep({
  number,
  label,
  value,
  tone,
}: {
  number: string;
  label: string;
  value: string;
  tone: 'blue' | 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  } as const;
  return (
    <div className={`rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-80">{value}</p>
    </div>
  );
}
