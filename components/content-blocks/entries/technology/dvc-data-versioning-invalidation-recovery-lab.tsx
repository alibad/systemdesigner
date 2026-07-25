'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleX,
  CloudDownload,
  DatabaseBackup,
  FolderSync,
  GitCompareArrows,
  LoaderCircle,
  Play,
  RotateCcw,
  TriangleAlert,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/dvc-data-versioning-invalidation-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/dvc-data-versioning/data/invalidation-recovery-model.json';

type StageState = 'rerun' | 'cached' | 'restored' | 'invalid' | 'stale' | 'blocked';
type OutcomeGrade = 'safe' | 'waste' | 'blocked';

type Stage = {
  id: string;
  label: string;
  detail: string;
  output: string;
};

type Action = {
  id: string;
  label: string;
  detail: string;
  command: string;
};

type Outcome = {
  grade: OutcomeGrade;
  headline: string;
  detail: string;
  stageStates: StageState[];
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  changedInput: string;
  expectedActionId: string;
  reason: string;
  outcomes: Record<string, Outcome>;
};

type InvalidationRecoveryModel = {
  kind: 'dvc-invalidation-recovery';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    actionId: string;
  };
  stages: Stage[];
  actions: Action[];
  scenarios: Scenario[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isInvalidationRecoveryModel(value: unknown): value is InvalidationRecoveryModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'dvc-invalidation-recovery'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.stages)
      && value.stages.length === 3
      && Array.isArray(value.actions)
      && value.actions.length >= 4
      && Array.isArray(value.scenarios)
      && value.scenarios.length >= 4
      && typeof value.notice === 'string',
  );
}

export default function DVCDataVersioningInvalidationRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<InvalidationRecoveryModel | null>(null);
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
        if (!isInvalidationRecoveryModel(payload)) {
          throw new Error('The DVC invalidation and recovery model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the invalidation and recovery model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <InvalidationRecoveryWorkbench model={model} />;
}

function InvalidationRecoveryWorkbench({
  model,
}: {
  model: InvalidationRecoveryModel;
}) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [actionId, setActionId] = useState(model.defaults.actionId);

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const action =
    model.actions.find((item) => item.id === actionId) ?? model.actions[0];
  const expectedAction =
    model.actions.find((item) => item.id === scenario.expectedActionId)
    ?? model.actions[0];
  const outcome =
    scenario.outcomes[action.id] ?? scenario.outcomes[scenario.expectedActionId];

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setActionId(model.defaults.actionId);
  }

  function chooseScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
  }

  const safe = outcome.grade === 'safe';
  const blocked = outcome.grade === 'blocked';
  const OutcomeIcon = safe ? CheckCircle2 : blocked ? CircleX : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Invalidation and recovery lab"
          title={model.title}
          description={model.description}
          icon={GitCompareArrows}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Inject a project change">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={scenarioIcon(item.id)}
                    accent="violet"
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose an operator action">
                {model.actions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === action.id}
                    label={item.label}
                    detail={item.detail}
                    icon={actionIcon(item.id)}
                    accent="cyan"
                    onClick={() => setActionId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section
              className={`rounded-md border p-5 ${
                safe
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : blocked
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {safe ? 'Narrow and correct' : blocked ? 'Recovery blocked' : 'Valid but wasteful'}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{outcome.headline}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Changed input"
                value={shortInput(scenario.changedInput)}
                detail={scenario.changedInput}
                icon={GitCompareArrows}
                tone="violet"
              />
              <LabMetric
                label="Selected action"
                value={action.command}
                detail={action.label}
                icon={actionIcon(action.id)}
                tone={safe ? 'emerald' : blocked ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Stages rerun"
                value={String(outcome.stageStates.filter((state) => state === 'rerun').length)}
                detail={`${outcome.stageStates.filter((state) => state === 'cached').length} unchanged or cached`}
                icon={Play}
                tone="blue"
              />
              <LabMetric
                label="Decision"
                value={safe ? 'Proceed' : blocked ? 'Stop' : 'Narrow it'}
                detail={
                  safe
                    ? 'Preserves revision intent'
                    : `Preferred: ${expectedAction.command}`
                }
                icon={OutcomeIcon}
                tone={safe ? 'emerald' : blocked ? 'rose' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Pipeline consequence
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {scenario.label}
                  </h4>
                </div>
                <span className="rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {action.command}
                </span>
              </div>

              <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                {model.stages.map((stage, index) => (
                  <PipelineFragment
                    key={stage.id}
                    stage={stage}
                    state={outcome.stageStates[index] ?? 'blocked'}
                    index={index}
                    final={index === model.stages.length - 1}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <Explanation
                icon={Workflow}
                title="Why the graph changes"
                detail={scenario.reason}
              />
              <Explanation
                icon={DatabaseBackup}
                title="Narrowest expected action"
                detail={`${expectedAction.command} — ${expectedAction.detail}`}
              />
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">{children}</div>
    </fieldset>
  );
}

function PipelineFragment({
  final,
  index,
  stage,
  state,
}: {
  final: boolean;
  index: number;
  stage: Stage;
  state: StageState;
}) {
  const style = stateStyles[state];
  const StateIcon = style.icon;

  return (
    <>
      <div className={`min-w-0 rounded-md border p-4 ${style.className}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase opacity-75">
            {index + 1}. {stage.label}
          </span>
          <StateIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        </div>
        <p className="mt-3 text-sm font-semibold">{style.label}</p>
        <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
        <p className="mt-3 break-words font-mono text-[11px] opacity-75">{stage.output}</p>
      </div>
      {!final ? (
        <div className="flex items-center justify-center py-1 text-neutral-400 dark:text-neutral-600">
          <ArrowRight aria-hidden="true" className="h-5 w-5 rotate-90 md:rotate-0" />
        </div>
      ) : null}
    </>
  );
}

function Explanation({
  detail,
  icon: Icon,
  title,
}: {
  detail: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {detail}
      </p>
    </div>
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
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-56 items-center justify-center">
            {error ? (
              <div className="max-w-md text-center" role="alert">
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-300"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Pipeline decision model unavailable
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading invalidation and recovery model
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const stateStyles: Record<
  StageState,
  { className: string; icon: LucideIcon; label: string }
> = {
  rerun: {
    className:
      'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
    icon: RotateCcw,
    label: 'Rerun',
  },
  cached: {
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    icon: CheckCircle2,
    label: 'Keep valid',
  },
  restored: {
    className:
      'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
    icon: FolderSync,
    label: 'Restore exact output',
  },
  invalid: {
    className:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    icon: TriangleAlert,
    label: 'Invalidated',
  },
  stale: {
    className:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    icon: CircleX,
    label: 'Stale output',
  },
  blocked: {
    className:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    icon: CircleX,
    label: 'Blocked',
  },
};

function scenarioIcon(id: string): LucideIcon {
  if (id === 'prepare-code') return GitCompareArrows;
  if (id === 'train-parameter') return Workflow;
  if (id === 'workspace-deleted') return FolderSync;
  return CloudDownload;
}

function actionIcon(id: string): LucideIcon {
  if (id === 'targeted-repro') return Play;
  if (id === 'checkout') return FolderSync;
  if (id === 'pull') return CloudDownload;
  return RotateCcw;
}

function shortInput(value: string) {
  if (value.length <= 24) return value;
  return `${value.slice(0, 21)}...`;
}
