'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileClock,
  History,
  LoaderCircle,
  MessageSquareReply,
  Repeat2,
  ShieldCheck,
  Workflow,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Fit = 'recommended' | 'blocked' | 'possible';
type WorkflowType = {
  id: string;
  label: string;
  detail: string;
  invocation: string;
  maximumDuration: string;
  executionGuarantee: string;
  history: string;
  integrationPatterns: string;
  sideEffectRule: string;
  observability: string;
};
type Evaluation = {
  workflowTypeId: string;
  fit: Fit;
  rationale: string;
  checks: string[];
};
type Scenario = {
  id: string;
  label: string;
  detail: string;
  contract: string;
  evaluations: Evaluation[];
};
type WorkflowModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultWorkflowTypeId: string;
  workflowTypes: WorkflowType[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'technology/step-functions-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/step-functions/data/workflow-type-scenarios.json';

const fitMeta: Record<Fit, {
  label: string;
  heading: string;
  icon: LucideIcon;
  tone: 'emerald' | 'amber' | 'rose';
  className: string;
}> = {
  recommended: {
    label: 'Fits the contract',
    heading: 'This workflow mode satisfies the defining requirements',
    icon: CheckCircle2,
    tone: 'emerald',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  possible: {
    label: 'Possible with trade-offs',
    heading: 'Use only after accepting the changed caller or reliability contract',
    icon: CircleAlert,
    tone: 'amber',
    className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  blocked: {
    label: 'Contract mismatch',
    heading: 'This mode cannot provide one or more required semantics',
    icon: XCircle,
    tone: 'rose',
    className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
};

function isWorkflowModel(value: unknown): value is WorkflowModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkflowModel>;
  const typeIds = new Set(candidate.workflowTypes?.map((item) => item.id));

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultWorkflowTypeId
      && Array.isArray(candidate.workflowTypes)
      && candidate.workflowTypes.length === 3
      && candidate.workflowTypes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.maximumDuration === 'string'
        && typeof item.executionGuarantee === 'string'
        && typeof item.history === 'string'
        && typeof item.integrationPatterns === 'string'
        && typeof item.sideEffectRule === 'string'
        && typeof item.observability === 'string'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 4
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.contract === 'string'
        && Array.isArray(scenario.evaluations)
        && scenario.evaluations.length === 3
        && scenario.evaluations.every((evaluation) => (
          typeIds.has(evaluation.workflowTypeId)
          && ['recommended', 'blocked', 'possible'].includes(evaluation.fit)
          && typeof evaluation.rationale === 'string'
          && Array.isArray(evaluation.checks)
          && evaluation.checks.length >= 2
        ))
      )),
  );
}

export default function StepFunctionsWorkflowTypeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<WorkflowModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isWorkflowModel(payload)) throw new Error('The workflow-type model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setModel(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load workflow semantics.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Workflow semantics lab"
            title="Choose a mode from the execution contract"
            description="Loading Standard and Express workflow semantics."
            icon={Workflow}
            accent="blue"
          />
          <div className="flex min-h-48 items-center justify-center p-6">
            {error ? (
              <div className="text-center">
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading workflow modes
              </div>
            )}
          </div>
        </LearningLab>
      ) : (
        <WorkflowTypeWorkbench model={model} />
      )}
    </div>
  );
}

function WorkflowTypeWorkbench({ model }: { model: WorkflowModel }) {
  const defaultScenario = model.scenarios.find((item) => item.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const defaultWorkflowType = model.workflowTypes.find((item) => item.id === model.defaultWorkflowTypeId)
    ?? model.workflowTypes[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [workflowTypeId, setWorkflowTypeId] = useState(defaultWorkflowType.id);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? defaultScenario;
  const workflowType = model.workflowTypes.find((item) => item.id === workflowTypeId)
    ?? defaultWorkflowType;
  const evaluation = scenario.evaluations.find((item) => item.workflowTypeId === workflowType.id)
    ?? scenario.evaluations[0];
  const meta = fitMeta[evaluation.fit];
  const VerdictIcon = meta.icon;

  function reset() {
    setScenarioId(defaultScenario.id);
    setWorkflowTypeId(defaultWorkflowType.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Workflow semantics lab"
        title={model.title}
        description={model.description}
        icon={Workflow}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload scenario
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'payment-saga' ? ShieldCheck : item.id === 'event-transform' ? Repeat2 : item.id === 'api-composition' ? MessageSquareReply : Clock3}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Candidate mode
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workflowTypes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workflowType.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'standard' ? History : Zap}
                    accent={item.id === 'standard' ? 'violet' : item.id === 'async-express' ? 'cyan' : 'emerald'}
                    onClick={() => setWorkflowTypeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Required contract</p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{scenario.contract}</h4>
          </section>

          <section className={`rounded-md border p-5 ${meta.className}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">{meta.label}</p>
                <h4 className="mt-1 text-lg font-semibold">{meta.heading}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{evaluation.rationale}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric label="Maximum duration" value={workflowType.maximumDuration} detail={workflowType.invocation} icon={Clock3} tone="blue" />
            <LabMetric label="Workflow guarantee" value={workflowType.executionGuarantee} detail="This does not make external side effects exactly once" icon={Repeat2} tone="violet" />
            <LabMetric label="Execution history" value={workflowType.history} detail={workflowType.observability} icon={FileClock} tone="cyan" />
            <LabMetric label=".sync and callback" value={workflowType.integrationPatterns} detail="Request-response integrations remain available in every mode" icon={MessageSquareReply} tone={workflowType.id === 'standard' ? 'emerald' : 'amber'} />
            <LabMetric label="Side effects" value={workflowType.sideEffectRule} detail="Stable operation keys must survive retries and redrives" icon={ShieldCheck} tone="amber" />
            <LabMetric label="Scenario fit" value={meta.label} detail={workflowType.label} icon={VerdictIcon} tone={meta.tone} />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">What to prove before deployment</p>
            </header>
            <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {evaluation.checks.map((item, index) => (
                <li key={item} className="flex gap-3 px-4 py-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            Workflow type is immutable after state-machine creation. Treat this as an architecture decision, and verify current quotas, regional support, logging, and account-specific billing separately from the semantic fit shown here.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
