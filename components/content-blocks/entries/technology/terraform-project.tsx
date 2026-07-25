'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  MoveRight,
  Network,
  RefreshCw,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/terraform-project';
const DEFAULT_DATA_FILE =
  '/api/content/technology/terraform/data/plan-state-dependency-model.json';

type PlanAction =
  | 'create'
  | 'replace'
  | 'update'
  | 'destroy-create'
  | 'state-move'
  | 'no-op';

type ResourceModel = {
  id: string;
  label: string;
  address: string;
  responsibility: string;
};

type PlanCase = {
  id: string;
  label: string;
  summary: string;
  configurationChange: string;
  stateFinding: string;
  networkAction: string;
  serviceAction: string;
  checkAction: string;
  providerBoundary: string;
};

type StateStrategy = {
  id: 'aligned' | 'unmapped-rename' | 'moved-block';
  label: string;
  detail: string;
};

type DependencyMode = {
  id: 'reference' | 'depends-on' | 'none';
  label: string;
  detail: string;
  dataFlow: string;
  planningEffect: string;
};

type PlanModel = {
  title: string;
  description: string;
  defaults: {
    caseId: string;
    stateStrategyId: StateStrategy['id'];
    dependencyId: DependencyMode['id'];
  };
  resources: ResourceModel[];
  planCases: PlanCase[];
  stateStrategies: StateStrategy[];
  dependencyModes: DependencyMode[];
};

type PlanResult = {
  actions: Record<string, PlanAction>;
  waves: Record<string, number>;
  stateResult: string;
  summary: string;
  graphResult: string;
};

const actionStyles: Record<PlanAction, string> = {
  create:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  replace:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  update:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  'destroy-create':
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  'state-move':
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  'no-op':
    'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};

const actionLabels: Record<PlanAction, string> = {
  create: '+ create',
  replace: '-/+ replace',
  update: '~ update',
  'destroy-create': '- destroy / + create',
  'state-move': 'state address move',
  'no-op': 'no remote action',
};

function isPlanModel(value: unknown): value is PlanModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlanModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.caseId
      && candidate.defaults.stateStrategyId
      && candidate.defaults.dependencyId
      && Array.isArray(candidate.resources)
      && candidate.resources.length === 3
      && candidate.resources.every(
        (resource) =>
          typeof resource.id === 'string'
          && typeof resource.label === 'string'
          && typeof resource.address === 'string'
          && typeof resource.responsibility === 'string',
      )
      && Array.isArray(candidate.planCases)
      && candidate.planCases.length >= 3
      && candidate.planCases.every(
        (planCase) =>
          typeof planCase.id === 'string'
          && typeof planCase.label === 'string'
          && typeof planCase.summary === 'string'
          && typeof planCase.configurationChange === 'string'
          && typeof planCase.stateFinding === 'string'
          && typeof planCase.providerBoundary === 'string',
      )
      && Array.isArray(candidate.stateStrategies)
      && candidate.stateStrategies.length === 3
      && Array.isArray(candidate.dependencyModes)
      && candidate.dependencyModes.length === 3,
  );
}

export default function TerraformProject({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PlanModel | null>(null);
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
        if (!isPlanModel(payload)) {
          throw new Error('The plan and state model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the plan model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Plan, state, and graph lab"
            title="Load the Terraform planning model"
            description="The lesson-owned configuration changes and state-address cases are loading."
            icon={Workflow}
            accent="violet"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <PlanStateLab model={model} />
      )}
    </div>
  );
}

function PlanStateLab({ model }: { model: PlanModel }) {
  const [caseId, setCaseId] = useState(model.defaults.caseId);
  const [stateStrategyId, setStateStrategyId] = useState<StateStrategy['id']>(
    model.defaults.stateStrategyId,
  );
  const [dependencyId, setDependencyId] = useState<DependencyMode['id']>(
    model.defaults.dependencyId,
  );

  const planCase =
    model.planCases.find((item) => item.id === caseId) ?? model.planCases[0];
  const stateStrategy =
    model.stateStrategies.find((item) => item.id === stateStrategyId)
    ?? model.stateStrategies[0];
  const dependency =
    model.dependencyModes.find((item) => item.id === dependencyId)
    ?? model.dependencyModes[0];

  const result = useMemo(
    () => calculatePlan(planCase.id, stateStrategy.id, dependency.id),
    [dependency.id, planCase.id, stateStrategy.id],
  );

  function chooseCase(nextCase: PlanCase) {
    setCaseId(nextCase.id);
    setStateStrategyId(
      nextCase.id === 'rename-service' ? 'unmapped-rename' : 'aligned',
    );
  }

  function reset() {
    setCaseId(model.defaults.caseId);
    setStateStrategyId(model.defaults.stateStrategyId);
    setDependencyId(model.defaults.dependencyId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Plan, state, and graph lab"
        title={model.title}
        description={model.description}
        icon={Workflow}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Configuration change
              </legend>
              <div className="mt-3 grid gap-2">
                {model.planCases.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === planCase.id}
                    label={item.label}
                    detail={item.summary}
                    icon={Braces}
                    accent="violet"
                    onClick={() => chooseCase(item)}
                  />
                ))}
              </div>
            </fieldset>

            {planCase.id === 'rename-service' ? (
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. State address handling
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.stateStrategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === stateStrategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Database}
                      accent="blue"
                      onClick={() => setStateStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {planCase.id === 'rename-service' ? '3' : '2'}. Dependency encoding
              </legend>
              <div className="mt-3 grid gap-2">
                {model.dependencyModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === dependency.id}
                    label={item.label}
                    detail={item.detail}
                    icon={GitBranch}
                    accent="cyan"
                    onClick={() => setDependencyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Planned consequence"
              value={result.summary}
              detail="Remote actions plus state-only moves"
              icon={Braces}
              tone={result.summary === 'No remote change' ? 'emerald' : 'violet'}
            />
            <LabMetric
              label="State identity"
              value={result.stateResult}
              detail="Configuration address to remote-object binding"
              icon={Database}
              tone={stateStrategy.id === 'unmapped-rename' ? 'rose' : 'blue'}
            />
            <LabMetric
              label="Execution graph"
              value={result.graphResult}
              detail="Independent actions can share a wave"
              icon={GitBranch}
              tone={dependency.id === 'none' ? 'amber' : 'cyan'}
            />
            <LabMetric
              label="Data flow"
              value={dependency.id === 'reference' ? 'Explicit' : 'Not encoded'}
              detail={dependency.id === 'depends-on' ? 'Order only' : dependency.detail}
              icon={Network}
              tone={dependency.id === 'reference' ? 'emerald' : 'amber'}
            />
          </div>

          <PlanGraph
            resources={model.resources}
            result={result}
            hasDependency={dependency.id !== 'none'}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <ExplanationCard
              icon={Database}
              title="What state contributes"
              body={
                planCase.id === 'rename-service'
                  ? `${planCase.stateFinding} ${result.stateResult}.`
                  : planCase.stateFinding
              }
              tone={stateStrategy.id === 'unmapped-rename' ? 'rose' : 'blue'}
            />
            <ExplanationCard
              icon={GitBranch}
              title="What the graph contributes"
              body={`${dependency.dataFlow} ${dependency.planningEffect}`}
              tone={dependency.id === 'none' ? 'amber' : 'cyan'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Provider boundary
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {planCase.providerBoundary}
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function calculatePlan(
  caseId: string,
  stateStrategyId: StateStrategy['id'],
  dependencyId: DependencyMode['id'],
): PlanResult {
  const waves =
    dependencyId === 'none'
      ? { network: 1, service: 1, check: 1 }
      : { network: 1, service: 2, check: 3 };

  if (caseId === 'replace-upstream') {
    const serviceAction: PlanAction =
      dependencyId === 'reference' ? 'update' : 'no-op';
    return {
      actions: {
        network: 'replace',
        service: serviceAction,
        check: 'no-op',
      },
      waves,
      stateResult: 'Bindings retained',
      summary:
        serviceAction === 'update'
          ? '1 replace, 1 update'
          : '1 replacement',
      graphResult:
        dependencyId === 'none' ? 'No ordering edge' : 'Ordered dependency',
    };
  }

  if (caseId === 'rename-service') {
    const serviceAction: PlanAction =
      stateStrategyId === 'unmapped-rename'
        ? 'destroy-create'
        : stateStrategyId === 'moved-block'
          ? 'state-move'
          : 'no-op';

    return {
      actions: {
        network: 'no-op',
        service: serviceAction,
        check: 'no-op',
      },
      waves,
      stateResult:
        stateStrategyId === 'unmapped-rename'
          ? 'Binding lost'
          : stateStrategyId === 'moved-block'
            ? 'Binding moved'
            : 'Already aligned',
      summary:
        serviceAction === 'destroy-create'
          ? 'Destroy and create'
          : serviceAction === 'state-move'
            ? 'State-only move'
            : 'No remote change',
      graphResult:
        dependencyId === 'none' ? 'No ordering edge' : 'Ordered dependency',
    };
  }

  return {
    actions: {
      network: 'create',
      service: 'create',
      check: 'create',
    },
    waves,
    stateResult: 'New bindings',
    summary: '3 creates',
    graphResult:
      dependencyId === 'none' ? '1 parallel wave' : '3 ordered waves',
  };
}

function PlanGraph({
  resources,
  result,
  hasDependency,
}: {
  resources: ResourceModel[];
  result: PlanResult;
  hasDependency: boolean;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-950 p-4 text-white md:p-5 dark:border-neutral-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-300">
            Execution plan
          </p>
          <h4 className="mt-1 text-lg font-semibold text-white">
            Resource actions by graph wave
          </h4>
        </div>
        <p className="text-xs text-neutral-400">
          Same-wave operations may run concurrently
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        {resources.map((resource, index) => {
          const action = result.actions[resource.id] ?? 'no-op';
          return (
            <div key={resource.id} className="contents">
              <div className="min-w-0 rounded-md border border-neutral-700 bg-neutral-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded bg-neutral-800 px-2 py-1 text-xs font-semibold text-neutral-300">
                    Wave {result.waves[resource.id]}
                  </span>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${actionStyles[action]}`}
                  >
                    {actionLabels[action]}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{resource.label}</p>
                <code className="mt-1 block break-all text-xs text-violet-300">
                  {resource.address}
                </code>
                <p className="mt-3 text-xs leading-5 text-neutral-400">
                  {resource.responsibility}
                </p>
              </div>
              {index < resources.length - 1 ? (
                <div className="flex items-center justify-center py-1 text-neutral-500 lg:py-0">
                  {hasDependency ? (
                    <>
                      <ArrowRight
                        aria-label="Dependency edge"
                        className="hidden h-5 w-5 lg:block"
                      />
                      <MoveRight
                        aria-label="Dependency edge"
                        className="h-5 w-5 rotate-90 lg:hidden"
                      />
                    </>
                  ) : (
                    <span className="rounded border border-dashed border-neutral-700 px-2 py-1 text-[11px] font-semibold uppercase text-neutral-500">
                      no edge
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplanationCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof Database;
  title: string;
  body: string;
  tone: 'blue' | 'cyan' | 'amber' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100',
    amber:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  };

  return (
    <div className={`rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 opacity-80">{body}</p>
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
    <div className="p-5 md:p-6">
      <div
        className={`rounded-md border p-4 ${
          error
            ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
        }`}
      >
        <div className="flex items-start gap-3">
          {error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {error ? 'The model could not be loaded' : 'Loading planning cases'}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {error ?? 'Preparing the state and dependency model.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
