'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GitBranch,
  Layers3,
  Network,
  RefreshCw,
  Route,
  Search,
  ShieldQuestion,
  Sparkles,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Capability = {
  id: string;
  label: string;
  detail: string;
};

type QueryScenario = {
  id: string;
  label: string;
  query: string;
  brief: string;
  requiredCapabilities: string[];
  evidenceShape: string;
  baselineFailure: string;
};

type RetrievalStrategy = {
  id: string;
  label: string;
  detail: string;
  capabilities: string[];
  queryExecutions: number;
  modelDecisions: number;
  retryLimit: number;
  stages: string[];
  operationalCost: string;
  failureSurface: string;
};

type StrategyEscalationData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
  };
  scenarios: QueryScenario[];
  capabilities: Capability[];
  strategies: RetrievalStrategy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/advanced-rag/data/strategy-escalation-model.json';
const BLOCK_ID = 'genai/advanced-rag';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStrategyEscalationData(value: unknown): value is StrategyEscalationData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<StrategyEscalationData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.strategyId === 'string'
      && Array.isArray(data.capabilities)
      && data.capabilities.length > 0
      && data.capabilities.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.query === 'string'
        && typeof item.brief === 'string'
        && isStringArray(item.requiredCapabilities)
        && typeof item.evidenceShape === 'string'
        && typeof item.baselineFailure === 'string'
      ))
      && Array.isArray(data.strategies)
      && data.strategies.length > 0
      && data.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isStringArray(item.capabilities)
        && typeof item.queryExecutions === 'number'
        && typeof item.modelDecisions === 'number'
        && typeof item.retryLimit === 'number'
        && isStringArray(item.stages)
        && item.stages.length > 0
        && typeof item.operationalCost === 'string'
        && typeof item.failureSurface === 'string'
      )),
  );
}

export default function AdvancedRagStrategyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<StrategyEscalationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        if (!isStrategyEscalationData(payload)) {
          throw new Error('The strategy model is incomplete.');
        }
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the strategy model.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadState
          error={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : (
        <StrategyLab data={data} />
      )}
    </div>
  );
}

function StrategyLab({ data }: { data: StrategyEscalationData }) {
  const initialScenario = data.scenarios.find(
    (item) => item.id === data.defaults.scenarioId,
  ) ?? data.scenarios[0];
  const initialStrategy = data.strategies.find(
    (item) => item.id === data.defaults.strategyId,
  ) ?? data.strategies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [strategyId, setStrategyId] = useState(initialStrategy.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId)
    ?? data.scenarios[0];
  const strategy = data.strategies.find((item) => item.id === strategyId)
    ?? data.strategies[0];

  const model = useMemo(() => {
    const supported = new Set(strategy.capabilities);
    const covered = scenario.requiredCapabilities.filter((item) => supported.has(item));
    const missing = scenario.requiredCapabilities.filter((item) => !supported.has(item));
    return { covered, missing };
  }, [scenario, strategy]);

  function reset() {
    setScenarioId(initialScenario.id);
    setStrategyId(initialStrategy.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Pattern escalation lab"
        title={data.title}
        description={data.description}
        icon={GitBranch}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Query shape
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.brief}
                    icon={item.id === 'mixed-workload' ? Route : FileSearch}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Retrieval pattern
              </legend>
              <div className="mt-3 space-y-2">
                {data.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === strategy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={strategyIcon(item.id)}
                    accent="violet"
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5">
          <section
            aria-label="Selected query"
            className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Search aria-hidden="true" className="h-4 w-4" />
              Query to support
            </div>
            <p className="mt-2 text-base font-semibold leading-6 text-neutral-950 dark:text-white">
              “{scenario.query}”
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Expected evidence: {scenario.evidenceShape}.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Capabilities"
              value={`${model.covered.length} / ${scenario.requiredCapabilities.length}`}
              detail="Required capabilities covered"
              icon={CheckCircle2}
              tone={model.missing.length === 0 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Search lists"
              value={String(strategy.queryExecutions)}
              detail="Explicit online query executions"
              icon={Search}
              tone="blue"
            />
            <LabMetric
              label="Model decisions"
              value={String(strategy.modelDecisions)}
              detail="Planning or routing calls"
              icon={Sparkles}
              tone="violet"
            />
            <LabMetric
              label="Fallback limit"
              value={String(strategy.retryLimit)}
              detail="Maximum retrieval retries"
              icon={RefreshCw}
              tone={strategy.retryLimit > 0 ? 'amber' : 'neutral'}
            />
          </div>

          <section aria-label="Retrieval path">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected path
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {strategy.label}
                </h4>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {strategy.operationalCost}
              </p>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {strategy.stages.map((stage, index) => (
                <li
                  key={stage}
                  className="relative min-w-0 rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-xs font-semibold text-white dark:bg-violet-400 dark:text-violet-950">
                    {index + 1}
                  </span>
                  <p className="mt-3 text-sm font-semibold leading-5">{stage}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Capability fit">
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Capability fit
            </h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {scenario.requiredCapabilities.map((capabilityId) => {
                const capability = data.capabilities.find(
                  (item) => item.id === capabilityId,
                );
                const covered = model.covered.includes(capabilityId);
                if (!capability) return null;

                return (
                  <div
                    key={capability.id}
                    className={`flex items-start gap-3 rounded-md border p-3 ${
                      covered
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                        : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    }`}
                  >
                    {covered ? (
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                    ) : (
                      <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{capability.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">
                        {capability.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            aria-live="polite"
            className={`rounded-md border p-5 ${
              model.missing.length === 0
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
            }`}
          >
            <div className="flex items-start gap-3">
              {model.missing.length === 0 ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
              ) : (
                <ShieldQuestion
                  aria-hidden="true"
                  className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300"
                />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950 dark:text-white">
                  {model.missing.length === 0
                    ? 'The pattern covers this synthetic query contract'
                    : `The pattern still misses ${model.missing.length} required capability${model.missing.length === 1 ? '' : 'ies'}`}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.missing.length === 0
                    ? 'Coverage is permission to evaluate this design, not proof that it improves production quality.'
                    : scenario.baselineFailure}
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  New failure surface: {strategy.failureSurface}
                </p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function strategyIcon(strategyId: string) {
  if (strategyId === 'multi-query-fusion') return GitBranch;
  if (strategyId === 'hierarchical') return Network;
  if (strategyId === 'hyde') return Braces;
  if (strategyId === 'adaptive') return Workflow;
  return Layers3;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Pattern escalation lab"
        title="Loading the retrieval strategy model"
        description="The lesson keeps query contracts and strategy assumptions in a co-located data file."
        icon={GitBranch}
        accent="violet"
      />
      <LearningLabBody>
        <div
          className={`flex min-h-48 items-center justify-center rounded-md border p-6 text-center ${
            error
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
        >
          <div>
            {error ? (
              <CircleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-700 dark:text-rose-300"
              />
            ) : (
              <RefreshCw
                aria-hidden="true"
                className="mx-auto h-7 w-7 animate-spin text-violet-700 motion-reduce:animate-none dark:text-violet-300"
              />
            )}
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading strategy data...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-white dark:text-neutral-950"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
