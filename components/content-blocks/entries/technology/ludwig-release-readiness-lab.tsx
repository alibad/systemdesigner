'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleX,
  ClipboardCheck,
  Eye,
  FileWarning,
  GitPullRequestArrow,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  ScanSearch,
  ServerCog,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/ludwig-release-readiness-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/ludwig/data/release-readiness-model.json';

type StageState = 'ready' | 'degraded' | 'failed';

type Stage = {
  id: string;
  label: string;
  detail: string;
};

type Action = {
  id: string;
  label: string;
  detail: string;
};

type Condition = {
  id: string;
  label: string;
  detail: string;
  expectedActionId: string;
  failedStageIds: string[];
  degradedStageIds: string[];
  impact: string;
  reason: string;
};

type ReleaseReadinessModel = {
  kind: 'ludwig-release-readiness';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    conditionId: string;
    actionId: string;
  };
  stages: Stage[];
  actions: Action[];
  conditions: Condition[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isStage(value: unknown): value is Stage {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail),
  );
}

function isAction(value: unknown): value is Action {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail),
  );
}

function isCondition(value: unknown): value is Condition {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail)
      && isNonEmptyString(value.expectedActionId)
      && isStringArray(value.failedStageIds)
      && isStringArray(value.degradedStageIds)
      && isNonEmptyString(value.impact)
      && isNonEmptyString(value.reason),
  );
}

function isReleaseReadinessModel(
  value: unknown,
): value is ReleaseReadinessModel {
  if (
    !isRecord(value)
    || !isRecord(value.defaults)
    || !Array.isArray(value.stages)
    || !Array.isArray(value.actions)
    || !Array.isArray(value.conditions)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const stages = value.stages;
  const actions = value.actions;
  const conditions = value.conditions;
  const stageIds = new Set(
    stages.filter(isStage).map((stage) => stage.id),
  );

  return value.kind === 'ludwig-release-readiness'
    && value.blockId === BLOCK_ID
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.description)
    && isNonEmptyString(defaults.conditionId)
    && isNonEmptyString(defaults.actionId)
    && stages.length === 4
    && stages.every(isStage)
    && hasUniqueIds(stages)
    && actions.length === 4
    && actions.every(isAction)
    && hasUniqueIds(actions)
    && actions.some((item) => item.id === defaults.actionId)
    && conditions.length === 4
    && conditions.every(isCondition)
    && hasUniqueIds(conditions)
    && conditions.some((item) => item.id === defaults.conditionId)
    && conditions.every((condition) =>
      actions.some((action) => action.id === condition.expectedActionId))
    && conditions.every((condition) =>
      [...condition.failedStageIds, ...condition.degradedStageIds]
        .every((stageId) => stageIds.has(stageId)))
    && isNonEmptyString(value.notice);
}

function getStageState(stage: Stage, condition: Condition): StageState {
  if (condition.failedStageIds.includes(stage.id)) return 'failed';
  if (condition.degradedStageIds.includes(stage.id)) return 'degraded';
  return 'ready';
}

export default function LudwigReleaseReadinessLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ReleaseReadinessModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseReadinessModel(payload)) {
          throw new Error('The Ludwig release-readiness model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Ludwig release-readiness model.',
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

  return <ReleaseReadinessWorkbench model={model} />;
}

function ReleaseReadinessWorkbench({
  model,
}: {
  model: ReleaseReadinessModel;
}) {
  const [conditionId, setConditionId] = useState(model.defaults.conditionId);
  const [actionId, setActionId] = useState(model.defaults.actionId);

  const condition =
    model.conditions.find((item) => item.id === conditionId)
    ?? model.conditions[0];
  const action =
    model.actions.find((item) => item.id === actionId)
    ?? model.actions[0];
  const expectedAction =
    model.actions.find((item) => item.id === condition.expectedActionId)
    ?? model.actions[0];
  const correct = action.id === expectedAction.id;
  const failedCount = condition.failedStageIds.length;
  const degradedCount = condition.degradedStageIds.length;
  const releaseAll = action.id === 'full-release';
  const decisionTone = correct
    ? 'safe'
    : releaseAll || failedCount > 0
      ? 'blocked'
      : 'review';

  function reset() {
    setConditionId(model.defaults.conditionId);
    setActionId(model.defaults.actionId);
  }

  const outcomeStyles = {
    safe: {
      border: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
      icon: CheckCircle2,
      label: 'Safe response',
    },
    review: {
      border: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
      icon: AlertTriangle,
      label: 'Insufficient response',
    },
    blocked: {
      border: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
      icon: CircleX,
      label: 'Unsafe response',
    },
  } as const;
  const outcome = outcomeStyles[decisionTone];
  const OutcomeIcon = outcome.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Release evidence lab"
          title={model.title}
          description={model.description}
          icon={GitPullRequestArrow}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Inject a release condition">
                {model.conditions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === condition.id}
                    label={item.label}
                    detail={item.detail}
                    icon={conditionIcon(item.id)}
                    accent="amber"
                    onClick={() => setConditionId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose the operator response">
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
            <section className={`rounded-md border p-5 ${outcome.border}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {outcome.label}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {correct
                      ? `${action.label} matches the evidence`
                      : `${action.label} does not close the risk`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {correct
                      ? condition.reason
                      : `Preferred response: ${expectedAction.label}. ${condition.reason}`}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Failed gates"
                value={String(failedCount)}
                detail={failedCount > 0
                  ? 'Promotion must stop'
                  : 'No hard gate is failing'}
                icon={Ban}
                tone={failedCount > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Degraded gates"
                value={String(degradedCount)}
                detail={degradedCount > 0
                  ? 'More evidence is required'
                  : 'No uncertain gate'}
                icon={FileWarning}
                tone={degradedCount > 0 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Selected action"
                value={shortAction(action.label)}
                detail={action.detail}
                icon={actionIcon(action.id)}
                tone={correct ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Release decision"
                value={correct ? 'Proceed' : 'Change course'}
                detail={`Expected: ${expectedAction.label}`}
                icon={correct ? ShieldCheck : RotateCcw}
                tone={correct ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evidence path
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    One artifact, four gates
                  </h4>
                </div>
                <span className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {condition.label}
                </span>
              </div>

              <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                {model.stages.map((stage, index) => (
                  <StageFragment
                    key={stage.id}
                    stage={stage}
                    state={getStageState(stage, condition)}
                    index={index}
                    final={index === model.stages.length - 1}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <Explanation
                icon={ServerCog}
                title="User-visible impact"
                detail={condition.impact}
              />
              <Explanation
                icon={ClipboardCheck}
                title="Release invariant"
                detail="The config, preprocessing metadata, weights, evaluation report, and serving contract are one versioned release unit. Promotion requires evidence from that exact unit."
              />
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
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

function StageFragment({
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
  const styles = stageStyles[state];
  const StateIcon = styles.icon;

  return (
    <>
      <div className={`min-w-0 rounded-md border p-4 ${styles.className}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase opacity-75">
            {index + 1}. {stage.label}
          </span>
          <StateIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        </div>
        <p className="mt-3 text-sm font-semibold">{styles.label}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">{stage.detail}</p>
      </div>
      {!final ? (
        <div className="flex items-center justify-center py-1 text-neutral-400 dark:text-neutral-600">
          <ArrowDown aria-hidden="true" className="h-5 w-5 md:hidden" />
          <ArrowRight
            aria-hidden="true"
            className="hidden h-5 w-5 md:block"
          />
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
        <Icon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300"
        />
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
                <AlertTriangle
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-300"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Release-readiness model unavailable
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
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Loading Ludwig release-readiness model
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const stageStyles: Record<
  StageState,
  {
    icon: LucideIcon;
    label: string;
    className: string;
  }
> = {
  ready: {
    icon: CheckCircle2,
    label: 'Evidence ready',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  degraded: {
    icon: CircleDashed,
    label: 'Evidence uncertain',
    className:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  failed: {
    icon: CircleX,
    label: 'Gate failed',
    className:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
};

function conditionIcon(id: string): LucideIcon {
  if (id === 'clean-candidate') return PackageCheck;
  if (id === 'request-schema-drift') return FileWarning;
  if (id === 'category-drift') return ScanSearch;
  return AlertTriangle;
}

function actionIcon(id: string): LucideIcon {
  if (id === 'full-release') return GitPullRequestArrow;
  if (id === 'canary') return ShieldCheck;
  if (id === 'shadow') return Eye;
  return RotateCcw;
}

function shortAction(value: string) {
  if (value === 'Release all traffic') return 'Full release';
  if (value === 'Canary the candidate') return 'Canary';
  if (value === 'Shadow and investigate') return 'Shadow';
  return 'Block';
}
