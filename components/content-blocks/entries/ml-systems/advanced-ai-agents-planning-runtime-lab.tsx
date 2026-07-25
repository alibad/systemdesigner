'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  FileCheck2,
  GitBranch,
  Route,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/advanced-ai-agents-planning-runtime-lab';

type RuntimeGate = {
  id: string;
  label: string;
  detail: string;
  revalidateEvery: number;
  approvalStrength: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  steps: number;
  safeHorizon: number;
  requiredApprovalStrength: number;
  stateChangeStep: number;
  risk: string;
  success: string;
  escalation: string;
  actionLabels: string[];
};

type PlanningRuntimeData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    horizon: number;
    gateId: string;
  };
  horizonRange: {
    min: number;
    max: number;
    step: number;
  };
  gates: RuntimeGate[];
  scenarios: Scenario[];
};

function isPlanningRuntimeData(value: unknown): value is PlanningRuntimeData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PlanningRuntimeData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.horizon === 'number'
      && typeof data.defaults.gateId === 'string'
      && data.horizonRange
      && typeof data.horizonRange.min === 'number'
      && typeof data.horizonRange.max === 'number'
      && typeof data.horizonRange.step === 'number'
      && Array.isArray(data.gates)
      && data.gates.length >= 2
      && data.gates.every((gate) => (
        typeof gate.id === 'string'
        && typeof gate.label === 'string'
        && typeof gate.detail === 'string'
        && typeof gate.revalidateEvery === 'number'
        && typeof gate.approvalStrength === 'number'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 2
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.steps === 'number'
        && typeof scenario.safeHorizon === 'number'
        && typeof scenario.requiredApprovalStrength === 'number'
        && typeof scenario.stateChangeStep === 'number'
        && typeof scenario.risk === 'string'
        && typeof scenario.success === 'string'
        && typeof scenario.escalation === 'string'
        && Array.isArray(scenario.actionLabels)
        && scenario.actionLabels.length === scenario.steps
        && scenario.actionLabels.every((label) => typeof label === 'string')
      )),
  );
}

export default function AdvancedAiAgentsPlanningRuntimeLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PlanningRuntimeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No planning-runtime scenario data was supplied.');
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
        if (!isPlanningRuntimeData(payload)) {
          throw new Error('Planning-runtime scenario data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError message={error} />;
  if (!data) return <LoadState />;
  return <PlanningRuntimeModel data={data} />;
}

function PlanningRuntimeModel({ data }: { data: PlanningRuntimeData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialGate = data.gates.find((item) => item.id === data.defaults.gateId)
    ?? data.gates[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [horizon, setHorizon] = useState(data.defaults.horizon);
  const [gateId, setGateId] = useState(initialGate.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const gate = data.gates.find((item) => item.id === gateId) ?? data.gates[0];

  const model = useMemo(() => {
    const committedSteps = Math.min(horizon, scenario.steps);
    const stalePlanSteps = Math.max(0, committedSteps - scenario.safeHorizon);
    const checks = gate.revalidateEvery === 1
      ? scenario.steps
      : Math.ceil(scenario.steps / gate.revalidateEvery);
    const discardedSteps = gate.revalidateEvery === 1 ? stalePlanSteps : 0;
    const exposedSteps = gate.revalidateEvery === 1 ? 0 : stalePlanSteps;
    const approvalGap = Math.max(
      0,
      scenario.requiredApprovalStrength - gate.approvalStrength,
    );
    const bounded = exposedSteps === 0 && approvalGap === 0;
    const needsReplanning = bounded && discardedSteps > 0;

    const verdict = bounded
      ? needsReplanning
        ? 'Bounded, with plan repair'
        : 'Bounded execution contract'
      : approvalGap > 0 && exposedSteps > 0
        ? 'Stop: stale state and authority gaps'
        : approvalGap > 0
          ? 'Stop: approval boundary is too weak'
          : 'Stop: stale actions can reach a tool';

    const explanation = bounded
      ? needsReplanning
        ? `The runtime blocks ${discardedSteps} stale planned step${discardedSteps === 1 ? '' : 's'}, observes fresh state, and asks the planner for a replacement.`
        : scenario.success
      : scenario.escalation;

    return {
      approvalGap,
      bounded,
      checks,
      committedSteps,
      discardedSteps,
      exposedSteps,
      explanation,
      needsReplanning,
      verdict,
    };
  }, [gate, horizon, scenario]);

  function chooseScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
    setHorizon(Math.min(data.defaults.horizon, nextScenario.steps));
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setHorizon(data.defaults.horizon);
    setGateId(initialGate.id);
  }

  const VerdictIcon = model.bounded ? BadgeCheck : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Planning and runtime boundary lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Choose the workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={GitBranch}
                      accent="cyan"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Actions committed before observing"
                value={horizon}
                output={`${horizon} step${horizon === 1 ? '' : 's'}`}
                min={data.horizonRange.min}
                max={Math.min(data.horizonRange.max, scenario.steps)}
                step={data.horizonRange.step}
                accent="violet"
                lowLabel="Short rolling plan"
                highLabel="Long fixed plan"
                onChange={setHorizon}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  3. Choose the runtime gate
                </legend>
                <div className="mt-3 space-y-2">
                  {data.gates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === gate.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.approvalStrength > 1 ? UserCheck : ShieldCheck}
                      accent={item.approvalStrength > 1 ? 'amber' : 'emerald'}
                      onClick={() => setGateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${
              model.bounded
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                <VerdictIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{model.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">{model.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Fresh runtime checks"
                value={`${model.checks}/${scenario.steps}`}
                detail="Checks performed immediately before actions"
                icon={FileCheck2}
                tone={model.checks === scenario.steps ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Plan work discarded"
                value={String(model.discardedSteps)}
                detail="Stale proposals blocked before external effect"
                icon={Clock3}
                tone={model.discardedSteps > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Stale actions exposed"
                value={String(model.exposedSteps)}
                detail="Outdated actions that can reach a tool"
                icon={AlertTriangle}
                tone={model.exposedSteps > 0 ? 'rose' : 'emerald'}
              />
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Proposed trajectory
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {scenario.label}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Environment may change at step {scenario.stateChangeStep}
                </p>
              </div>

              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {scenario.actionLabels.map((label, index) => {
                  const step = index + 1;
                  const afterChange = step >= scenario.stateChangeStep;
                  const beyondSafePlan = step > scenario.safeHorizon && step <= model.committedSteps;
                  const blockedForFreshCheck = beyondSafePlan && gate.revalidateEvery === 1;
                  const exposed = beyondSafePlan && gate.revalidateEvery !== 1;
                  const state = exposed
                    ? 'Exposed stale action'
                    : blockedForFreshCheck
                      ? 'Revalidate before action'
                      : afterChange
                        ? 'Observe current state'
                        : 'Current proposal';

                  return (
                    <li
                      key={`${step}-${label}`}
                      className={`min-w-0 rounded-md border p-3 ${
                        exposed
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                          : blockedForFreshCheck
                            ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {step}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{state}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure pressure</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{scenario.risk}</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Required authority</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.approvalGap === 0
                    ? 'The selected gate meets the scenario approval boundary.'
                    : `The selected gate is ${model.approvalGap} control level${model.approvalGap === 1 ? '' : 's'} below the required boundary.`}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading planning and runtime boundary lab"
    />
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      role="alert"
    >
      {message}
    </div>
  );
}
