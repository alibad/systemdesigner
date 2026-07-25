'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Braces,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  Layers3,
  LoaderCircle,
  Route,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Architecture = {
  id: string;
  label: string;
  detail: string;
  controlModel: string;
  stateModel: string;
};

type ArchitectureOutcome = {
  fit: string;
  risk: string;
  overhead: string;
  explanation: string;
  path: string[];
  missing: string[];
};

type WorkloadScenario = {
  id: string;
  label: string;
  brief: string;
  requirements: string[];
  recommendedArchitectureId: string;
  outcomes: Record<string, ArchitectureOutcome>;
};

type ArchitectureSelectionData = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultArchitectureId: string;
  architectures: Architecture[];
  scenarios: WorkloadScenario[];
};

const BLOCK_ID = 'genai/langchain-production-architecture-selection-lab';

const architectureIcons: Record<string, LucideIcon> = {
  pipeline: Route,
  agent: Bot,
  graph: GitBranch,
};

const scenarioIcons: Record<string, LucideIcon> = {
  'invoice-extraction': Braces,
  'support-research': Bot,
  'refund-approval': ShieldCheck,
  'incident-remediation': Workflow,
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOutcome(value: unknown): value is ArchitectureOutcome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArchitectureOutcome>;
  return Boolean(
    candidate.fit
      && candidate.risk
      && candidate.overhead
      && candidate.explanation
      && isStringArray(candidate.path)
      && candidate.path.length > 0
      && isStringArray(candidate.missing),
  );
}

function isArchitectureSelectionData(value: unknown): value is ArchitectureSelectionData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArchitectureSelectionData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultArchitectureId
      && Array.isArray(candidate.architectures)
      && candidate.architectures.length === 3
      && candidate.architectures.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.controlModel === 'string'
        && typeof item.stateModel === 'string'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.brief === 'string'
        && isStringArray(scenario.requirements)
        && typeof scenario.recommendedArchitectureId === 'string'
        && Boolean(scenario.outcomes)
        && typeof scenario.outcomes === 'object'
        && Object.values(scenario.outcomes).every(isOutcome)
      )),
  );
}

export default function LangchainProductionArchitectureSelectionLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ArchitectureSelectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No architecture scenario model was supplied.');
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
        if (!isArchitectureSelectionData(payload)) {
          throw new Error('Architecture scenario data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return <ArchitectureLoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }
  if (!data) return <ArchitectureLoadState error={null} />;
  return <ArchitectureSelectionLab data={data} />;
}

function ArchitectureSelectionLab({ data }: { data: ArchitectureSelectionData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialArchitecture = data.architectures.find(
    (item) => item.id === data.defaultArchitectureId,
  ) ?? data.architectures[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [architectureId, setArchitectureId] = useState(initialArchitecture.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const architecture = data.architectures.find((item) => item.id === architectureId)
    ?? data.architectures[0];
  const outcome = scenario.outcomes[architecture.id];

  const model = useMemo(() => {
    const recommended = architecture.id === scenario.recommendedArchitectureId;
    const dangerous = outcome.risk === 'High';
    const fitTone = recommended ? 'emerald' : dangerous ? 'rose' : 'amber';
    const recommendation = data.architectures.find(
      (item) => item.id === scenario.recommendedArchitectureId,
    );
    return { dangerous, fitTone, recommendation, recommended } as const;
  }, [architecture.id, data.architectures, outcome.risk, scenario.recommendedArchitectureId]);

  function chooseScenario(next: WorkloadScenario) {
    setScenarioId(next.id);
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setArchitectureId(initialArchitecture.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Architecture selection lab"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => {
                    const Icon = scenarioIcons[item.id] ?? Workflow;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.brief}
                        icon={Icon}
                        accent="blue"
                        onClick={() => chooseScenario(item)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution model
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.architectures.map((item) => {
                    const Icon = architectureIcons[item.id] ?? Route;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === architecture.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'graph' ? 'violet' : item.id === 'agent' ? 'amber' : 'cyan'}
                        onClick={() => setArchitectureId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Architecture fit"
                value={outcome.fit}
                detail={model.recommended ? 'Matches the workload contract.' : `Recommended: ${model.recommendation?.label ?? 'review the contract'}`}
                icon={model.recommended ? CheckCircle2 : CircleAlert}
                tone={model.fitTone}
              />
              <LabMetric
                label="Control risk"
                value={outcome.risk}
                detail={architecture.controlModel}
                icon={ShieldCheck}
                tone={model.dangerous ? 'rose' : model.recommended ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Operating overhead"
                value={outcome.overhead}
                detail="State, testing, migration, and recovery surface."
                icon={Workflow}
                tone={outcome.overhead === 'High' ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="State boundary"
                value={architecture.id === 'graph' ? 'Thread' : architecture.id === 'agent' ? 'Agent run' : 'Request'}
                detail={architecture.stateModel}
                icon={GitBranch}
                tone={architecture.id === 'graph' ? 'violet' : 'blue'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Execution map
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {scenario.label} through {architecture.label.toLowerCase()}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {architecture.controlModel}
                </span>
              </div>

              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {outcome.path.map((step, index) => (
                  <li key={`${architecture.id}-${step}`} className="relative min-w-0">
                    <div className="h-full rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {step}
                        </span>
                      </div>
                    </div>
                    {index < outcome.path.length - 1 ? (
                      <ArrowRight
                        aria-hidden="true"
                        className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-neutral-50 p-0.5 text-neutral-400 xl:block dark:bg-neutral-900"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required by this workload
                </p>
                <ul className="mt-3 space-y-2">
                  {scenario.requirements.map((requirement) => (
                    <li key={requirement} className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{requirement}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={`rounded-md border p-4 ${
                model.recommended
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : model.dangerous
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}>
                <div className="flex items-start gap-3">
                  {model.recommended ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.dangerous ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`} />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {model.recommended ? 'The boundary matches' : 'The boundary leaves a gap'}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {outcome.explanation}
                    </p>
                    {outcome.missing.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {outcome.missing.map((item) => <li key={item}>Missing: {item}</li>)}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ArchitectureLoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        ) : (
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-600 motion-reduce:animate-none" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Architecture lab unavailable' : 'Loading architecture scenarios...'}
          </p>
          {error ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p> : null}
          {error && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
