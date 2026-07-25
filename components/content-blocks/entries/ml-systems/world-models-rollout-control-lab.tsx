'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Route,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/world-models/data/rollout-control-scenarios.json';
const BLOCK_ID = 'ml-systems/world-models-rollout-control-lab';

type PolicyId = 'open-loop' | 'receding-horizon' | 'uncertainty-gated';

type Policy = {
  id: PolicyId;
  label: string;
  detail: string;
  errorMultiplier: number;
  uncertaintyPenalty: number;
  correctionCredit: number;
};

type Scenario = {
  id: string;
  label: string;
  context: string;
  defaultHorizon: number;
  oneStepError: number;
  baseDisagreement: number;
  disagreementGrowth: number;
  predictedReturn: number;
  safeErrorBudget: number;
  disagreementGate: number;
  hardRisk: number;
  maxConstraintRisk: number;
  fallback: string;
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultPolicy: PolicyId;
  policies: Policy[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.defaultScenario === 'string' &&
      Array.isArray(data.policies) &&
      data.policies.length === 3 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.oneStepError === 'number' &&
          typeof scenario.maxConstraintRisk === 'number',
      ),
  );
}

function calculateProjection(scenario: Scenario, policy: Policy, horizon: number) {
  const accumulatedError = Math.max(
    scenario.oneStepError,
    scenario.oneStepError * Math.pow(horizon, 1.18) * policy.errorMultiplier - policy.correctionCredit,
  );
  const disagreement = Math.max(
    scenario.baseDisagreement,
    scenario.baseDisagreement +
      scenario.disagreementGrowth * (horizon - 1) * policy.errorMultiplier -
      policy.correctionCredit * 0.25,
  );
  const constraintRisk = Math.min(
    100,
    scenario.hardRisk + accumulatedError * 0.45 + disagreement * 0.28,
  );
  const adjustedReturn = Math.max(
    0,
    scenario.predictedReturn -
      accumulatedError * 0.22 -
      disagreement * policy.uncertaintyPenalty,
  );
  return { accumulatedError, disagreement, constraintRisk, adjustedReturn };
}

function decisionFor(
  scenario: Scenario,
  policy: Policy,
  projection: ReturnType<typeof calculateProjection>,
) {
  if (projection.constraintRisk > scenario.maxConstraintRisk) {
    return {
      status: 'reject' as const,
      title: 'Reject the imagined plan',
      detail: `Projected constraint risk crosses ${scenario.maxConstraintRisk.toFixed(0)}%. ${scenario.fallback}.`,
    };
  }
  if (projection.disagreement > scenario.disagreementGate) {
    return {
      status: 'shorten' as const,
      title: 'Shorten the horizon and gather evidence',
      detail: `Model disagreement crosses the ${scenario.disagreementGate}% gate. Execute at most one reversible probe, observe, and replan.`,
    };
  }
  if (projection.accumulatedError > scenario.safeErrorBudget) {
    return {
      status: 'shorten' as const,
      title: 'The rollout exceeds its error budget',
      detail: `Estimated error is above ${scenario.safeErrorBudget}%. Reduce planning depth or increase the correction cadence.`,
    };
  }
  if (policy.id === 'open-loop' && projection.accumulatedError > scenario.oneStepError * 2.5) {
    return {
      status: 'shorten' as const,
      title: 'Do not execute the full sequence',
      detail: 'The plan is inside hard limits, but open-loop execution carries stale state too far. Replan after the first action.',
    };
  }
  return {
    status: 'execute' as const,
    title: 'Execute one bounded action',
    detail: 'The plan stays inside the current error, disagreement, and constraint boundaries. Observe the real next state before extending it.',
  };
}

export default function WorldModelsRolloutControlLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('warehouse-turn');
  const [policyId, setPolicyId] = useState<PolicyId>('receding-horizon');
  const [horizon, setHorizon] = useState(6);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load rollout cases (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The rollout cases have an invalid contract.');
        const scenario =
          value.scenarios.find((item) => item.id === value.defaultScenario) ?? value.scenarios[0];
        setData(value);
        setScenarioId(scenario.id);
        setPolicyId(value.defaultPolicy);
        setHorizon(scenario.defaultHorizon);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const projection = calculateProjection(scenario, policy, horizon);
    const decision = decisionFor(scenario, policy, projection);
    const credibleHorizon = Array.from({ length: 20 }, (_, index) => index + 1)
      .filter((candidate) => {
        const candidateProjection = calculateProjection(scenario, policy, candidate);
        return (
          candidateProjection.accumulatedError <= scenario.safeErrorBudget &&
          candidateProjection.disagreement <= scenario.disagreementGate &&
          candidateProjection.constraintRisk <= scenario.maxConstraintRisk
        );
      })
      .at(-1) ?? 1;
    const steps = Array.from({ length: Math.min(horizon, 12) }, (_, index) => {
      const step = index + 1;
      return { step, projection: calculateProjection(scenario, policy, step) };
    });
    return { scenario, policy, projection, decision, credibleHorizon, steps };
  }, [data, horizon, policyId, scenarioId]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setHorizon(scenario.defaultHorizon);
  };

  const reset = () => {
    if (!data) return;
    const scenario =
      data.scenarios.find((item) => item.id === data.defaultScenario) ?? data.scenarios[0];
    setScenarioId(scenario.id);
    setPolicyId(data.defaultPolicy);
    setHorizon(scenario.defaultHorizon);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading rollout control lab"
      />
    );
  }

  const statusTone =
    result.decision.status === 'execute'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
      : result.decision.status === 'shorten'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
  const StatusIcon = result.decision.status === 'execute' ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Rollout control room"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the control regime
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.context}
                      accent="amber"
                      onClick={() => chooseScenario(scenario)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Imagined rollout horizon"
                value={horizon}
                output={`${horizon} steps`}
                min={1}
                max={20}
                accent="amber"
                lowLabel="Near evidence"
                highLabel="Far imagination"
                onChange={setHorizon}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the planning policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === result.policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      accent="violet"
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Imagined trajectory
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {result.scenario.label} with {result.policy.label.toLowerCase()}
                  </p>
                </div>
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  Credible horizon: {result.credibleHorizon} steps
                </p>
              </div>

              <ol className="mt-5 flex min-w-0 items-end gap-1" aria-label="Accumulated rollout error by step">
                {result.steps.map(({ step, projection }) => {
                  const unsafe =
                    projection.accumulatedError > result.scenario.safeErrorBudget ||
                    projection.disagreement > result.scenario.disagreementGate;
                  const height = Math.max(18, Math.min(96, projection.accumulatedError * 1.8));
                  return (
                    <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span
                        className={`w-full rounded-t-sm transition-[height] motion-reduce:transition-none ${
                          unsafe ? 'bg-rose-500' : 'bg-cyan-500'
                        }`}
                        style={{ height: `${height}px` }}
                        title={`Step ${step}: ${projection.accumulatedError.toFixed(1)}% estimated error`}
                      />
                      <span className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400">
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {horizon > 12 ? (
                <p className="mt-2 text-right text-xs text-neutral-500 dark:text-neutral-400">
                  First 12 of {horizon} imagined steps shown
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" aria-hidden="true" />
                  Inside model budgets
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" aria-hidden="true" />
                  Error or disagreement boundary crossed
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Accumulated error"
                value={`${result.projection.accumulatedError.toFixed(1)}%`}
                detail={`Budget ${result.scenario.safeErrorBudget}%`}
                icon={Activity}
                tone={
                  result.projection.accumulatedError <= result.scenario.safeErrorBudget
                    ? 'cyan'
                    : 'rose'
                }
              />
              <LabMetric
                label="Model disagreement"
                value={`${result.projection.disagreement.toFixed(1)}%`}
                detail={`Gate ${result.scenario.disagreementGate}%`}
                icon={Gauge}
                tone={
                  result.projection.disagreement <= result.scenario.disagreementGate
                    ? 'violet'
                    : 'rose'
                }
              />
              <LabMetric
                label="Constraint risk"
                value={`${result.projection.constraintRisk.toFixed(1)}%`}
                detail={`Hard limit ${result.scenario.maxConstraintRisk}%`}
                icon={ShieldAlert}
                tone={
                  result.projection.constraintRisk <= result.scenario.maxConstraintRisk
                    ? 'emerald'
                    : 'rose'
                }
              />
              <LabMetric
                label="Adjusted return"
                value={result.projection.adjustedReturn.toFixed(1)}
                detail={`Raw imagined return ${result.scenario.predictedReturn}`}
                icon={TimerReset}
                tone="amber"
              />
            </div>

            <div className={`rounded-md border p-5 ${statusTone}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-lg font-semibold">{result.decision.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.decision.detail}</p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Control interpretation
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                Extending the horizon adds imagined reward but also moves the state farther from real evidence.
                Receding-horizon and uncertainty-gated policies spend compute on repeated correction instead of
                trusting one long trajectory.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
