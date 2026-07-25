'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  History,
  Layers3,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PlanFit = 'best' | 'risky' | 'wrong';
type LaneState = 'healthy' | 'active' | 'paused' | 'stale' | 'unsafe' | 'ready';

type Lane = {
  id: string;
  label: string;
  role: string;
};

type LaneStatus = {
  state: LaneState;
  detail: string;
};

type RecoveryStage = {
  id: string;
  label: string;
  owner: string;
  action: string;
  result: string;
  lanes: Record<string, LaneStatus>;
};

type RecoveryPlan = {
  id: string;
  label: string;
  detail: string;
  fit: PlanFit;
  verdict: string;
  stages: RecoveryStage[];
  verification: string[];
};

type RecoveryScenario = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  plans: RecoveryPlan[];
};

type ProjectionRecoveryModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  lanes: Lane[];
  scenarios: RecoveryScenario[];
};

const BLOCK_ID = 'technology/event-sourcing-projection-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/event-sourcing/data/projection-recovery-scenarios.json';

const fitMeta: Record<
  PlanFit,
  { label: string; icon: LucideIcon; tone: 'emerald' | 'amber' | 'rose'; className: string }
> = {
  best: {
    label: 'Evidence-aligned recovery',
    icon: ShieldCheck,
    tone: 'emerald',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  risky: {
    label: 'Works with explicit user impact',
    icon: TriangleAlert,
    tone: 'amber',
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  wrong: {
    label: 'Does not repair the failed boundary',
    icon: XCircle,
    tone: 'rose',
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
};

const laneMeta: Record<
  LaneState,
  { label: string; icon: LucideIcon; className: string }
> = {
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  active: {
    label: 'Active',
    icon: PlayCircle,
    className:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
  },
  paused: {
    label: 'Paused',
    icon: PauseCircle,
    className:
      'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  },
  stale: {
    label: 'Stale',
    icon: History,
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  unsafe: {
    label: 'Unsafe',
    icon: ShieldAlert,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  ready: {
    label: 'Ready for cutover',
    icon: ShieldCheck,
    className:
      'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  },
};

const laneIcons: LucideIcon[] = [Database, Eye, Layers3, ArrowRight];

function isProjectionRecoveryModel(value: unknown): value is ProjectionRecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProjectionRecoveryModel>;
  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultScenarioId !== 'string'
    || !Array.isArray(candidate.lanes)
    || candidate.lanes.length !== 4
    || !Array.isArray(candidate.scenarios)
    || candidate.scenarios.length < 3
  ) {
    return false;
  }

  const laneIds = new Set(
    candidate.lanes
      .filter((lane) => (
        typeof lane.id === 'string'
        && typeof lane.label === 'string'
        && typeof lane.role === 'string'
      ))
      .map((lane) => lane.id),
  );
  if (laneIds.size !== candidate.lanes.length) return false;

  return candidate.scenarios.every((scenario) => (
    typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && typeof scenario.symptom === 'string'
    && Array.isArray(scenario.plans)
    && scenario.plans.length >= 3
    && scenario.plans.every((plan) => (
      typeof plan.id === 'string'
      && typeof plan.label === 'string'
      && typeof plan.detail === 'string'
      && ['best', 'risky', 'wrong'].includes(plan.fit)
      && typeof plan.verdict === 'string'
      && Array.isArray(plan.verification)
      && plan.verification.length >= 3
      && Array.isArray(plan.stages)
      && plan.stages.length >= 4
      && plan.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.owner === 'string'
        && typeof stage.action === 'string'
        && typeof stage.result === 'string'
        && stage.lanes
        && typeof stage.lanes === 'object'
        && [...laneIds].every((laneId) => {
          const status = stage.lanes[laneId];
          return Boolean(
            status
            && ['healthy', 'active', 'paused', 'stale', 'unsafe', 'ready'].includes(
              status.state,
            )
            && typeof status.detail === 'string',
          );
        })
      ))
    ))
  ));
}

export default function EventSourcingProjectionRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ProjectionRecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isProjectionRecoveryModel(payload)) {
          throw new Error('The projection-recovery model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load projection-recovery scenarios.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Projection recovery lab"
            title="Rebuild derived state without guessing at correctness"
            description="Loading incident runbooks and cutover states."
            icon={Layers3}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <RecoveryWorkbench model={model} />
      )}
    </div>
  );
}

function RecoveryWorkbench({ model }: { model: ProjectionRecoveryModel }) {
  const defaultScenario =
    model.scenarios.find((scenario) => scenario.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [planId, setPlanId] = useState(defaultScenario.plans[0].id);
  const [stageIndex, setStageIndex] = useState(0);

  const scenario =
    model.scenarios.find((candidate) => candidate.id === scenarioId) ?? defaultScenario;
  const plan = scenario.plans.find((candidate) => candidate.id === planId)
    ?? scenario.plans[0];
  const stage = plan.stages[Math.min(stageIndex, plan.stages.length - 1)];
  const fit = fitMeta[plan.fit];
  const FitIcon = fit.icon;

  function selectScenario(nextScenarioId: string) {
    const nextScenario =
      model.scenarios.find((candidate) => candidate.id === nextScenarioId)
      ?? defaultScenario;
    setScenarioId(nextScenario.id);
    setPlanId(nextScenario.plans[0].id);
    setStageIndex(0);
  }

  function selectPlan(nextPlanId: string) {
    setPlanId(nextPlanId);
    setStageIndex(0);
  }

  function reset() {
    setScenarioId(defaultScenario.id);
    setPlanId(defaultScenario.plans[0].id);
    setStageIndex(0);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Projection recovery lab"
        title={model.title}
        description={model.description}
        icon={Layers3}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <div>
              <label
                htmlFor="event-sourcing-recovery-scenario"
                className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"
              >
                Projection incident
              </label>
              <select
                id="event-sourcing-recovery-scenario"
                value={scenario.id}
                onChange={(event) => selectScenario(event.target.value)}
                className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {model.scenarios.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {scenario.detail}
              </p>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Observed symptom
                  </p>
                  <p className="mt-2 text-sm leading-6">{scenario.symptom}</p>
                </div>
              </div>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Recovery plan
              </legend>
              <div className="mt-3 space-y-2">
                {scenario.plans.map((candidate) => {
                  const candidateFit = fitMeta[candidate.fit];
                  return (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === plan.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidateFit.icon}
                      accent={candidateFit.tone}
                      onClick={() => selectPlan(candidate.id)}
                    />
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-5" aria-live="polite">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Recovery stage {stageIndex + 1} of {plan.stages.length}
                </p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {stage.label}
                </h4>
              </div>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
                Owner: {stage.owner}
              </span>
            </div>
            <div
              className="mt-4 grid grid-cols-4 gap-2"
              aria-label={`Stage ${stageIndex + 1} of ${plan.stages.length}`}
            >
              {plan.stages.map((candidate, index) => (
                <div key={candidate.id} className="min-w-0">
                  <div
                    className={`h-2 rounded-full ${
                      index <= stageIndex
                        ? 'bg-cyan-500 dark:bg-cyan-400'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  />
                  <p
                    className={`mt-2 hidden truncate text-xs sm:block ${
                      index === stageIndex
                        ? 'font-semibold text-neutral-950 dark:text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {candidate.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Action at this stage
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {stage.action}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {model.lanes.map((lane, index) => {
              const status = stage.lanes[lane.id];
              const meta = laneMeta[status.state];
              const LaneIcon = laneIcons[index] ?? Database;
              const StatusIcon = meta.icon;
              return (
                <div
                  key={lane.id}
                  className={`min-w-0 rounded-md border p-4 ${meta.className}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <LaneIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <p className="text-sm font-semibold">{lane.label}</p>
                      </div>
                      <p className="mt-1 text-xs opacity-70">{lane.role}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/25 px-2 py-1 text-[11px] font-semibold">
                      <StatusIcon aria-hidden="true" className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 opacity-85">{status.detail}</p>
                </div>
              );
            })}
          </div>

          <div className={`rounded-md border p-4 ${fit.className}`}>
            <div className="flex items-start gap-3">
              <FitIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">{fit.label}</p>
                <p className="mt-2 text-sm leading-6">{stage.result}</p>
                {stageIndex === plan.stages.length - 1 ? (
                  <p className="mt-2 border-t border-current/20 pt-2 text-sm font-semibold">
                    {plan.verdict}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={stageIndex === 0}
              onClick={() => setStageIndex((value) => Math.max(0, value - 1))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Previous stage
            </button>
            <button
              type="button"
              disabled={stageIndex === plan.stages.length - 1}
              onClick={() => setStageIndex((value) => Math.min(plan.stages.length - 1, value + 1))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cyan-500 dark:text-neutral-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-offset-neutral-950"
            >
              Advance recovery
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {stageIndex === plan.stages.length - 1 ? (
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence required before closing the incident
              </p>
              <ul className="mt-3 space-y-2">
                {plan.verification.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300"
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-40 items-center justify-center p-5 md:p-6">
      {error ? (
        <div className="max-w-md text-center">
          <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Projection scenarios unavailable
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading projection runbooks
        </div>
      )}
    </div>
  );
}
