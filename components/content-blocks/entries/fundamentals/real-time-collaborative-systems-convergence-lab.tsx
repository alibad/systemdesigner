'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileWarning,
  GitMerge,
  Layers,
  Route,
  ShieldCheck,
  TriangleAlert,
  User,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  principle: string;
};

type Operation = {
  actor: string;
  label: string;
};

type Outcome = {
  replicaA: string;
  replicaB: string;
  retainedIntents: number;
  unresolvedConflicts: number;
  orderA: string[];
  orderB: string[];
  explanation: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  baseState: string;
  operationA: Operation;
  operationB: Operation;
  outcomes: Record<string, Outcome>;
};

type ConvergenceModel = {
  title: string;
  description: string;
  defaults: { scenarioId: string; strategyId: string };
  strategies: Strategy[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'fundamentals/real-time-collaborative-systems-convergence-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/real-time-collaborative-systems/data/convergence-scenarios.json';

function isOutcome(value: unknown): value is Outcome {
  if (!value || typeof value !== 'object') return false;
  const outcome = value as Partial<Outcome>;
  return Boolean(
    typeof outcome.replicaA === 'string'
      && typeof outcome.replicaB === 'string'
      && typeof outcome.retainedIntents === 'number'
      && typeof outcome.unresolvedConflicts === 'number'
      && Array.isArray(outcome.orderA)
      && outcome.orderA.every((item) => typeof item === 'string')
      && Array.isArray(outcome.orderB)
      && outcome.orderB.every((item) => typeof item === 'string')
      && typeof outcome.explanation === 'string',
  );
}

function isConvergenceModel(value: unknown): value is ConvergenceModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ConvergenceModel>;
  if (
    typeof model.title !== 'string'
    || typeof model.description !== 'string'
    || typeof model.defaults?.scenarioId !== 'string'
    || typeof model.defaults.strategyId !== 'string'
    || !Array.isArray(model.strategies)
    || model.strategies.length < 3
    || !Array.isArray(model.scenarios)
    || model.scenarios.length < 3
  ) return false;

  const strategyIds = new Set(model.strategies.map((strategy) => strategy.id));
  return model.strategies.every((strategy) => (
    typeof strategy.id === 'string'
      && typeof strategy.label === 'string'
      && typeof strategy.detail === 'string'
      && typeof strategy.principle === 'string'
  )) && model.scenarios.every((scenario) => (
    typeof scenario.id === 'string'
      && typeof scenario.label === 'string'
      && typeof scenario.detail === 'string'
      && typeof scenario.baseState === 'string'
      && typeof scenario.operationA?.actor === 'string'
      && typeof scenario.operationA.label === 'string'
      && typeof scenario.operationB?.actor === 'string'
      && typeof scenario.operationB.label === 'string'
      && scenario.outcomes
      && [...strategyIds].every((strategyId) => isOutcome(scenario.outcomes[strategyId]))
  ));
}

function strategyIcon(id: string) {
  if (id === 'snapshot-overwrite') return FileWarning;
  if (id === 'typed-stable-merge') return GitMerge;
  return Route;
}

export default function RealTimeCollaborativeSystemsConvergenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ConvergenceModel | null>(null);
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
        if (!isConvergenceModel(payload)) throw new Error('The convergence model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load convergence data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Concurrent edit lab"
            title="Compare opposite delivery orders"
            description="Loading lesson-owned collision scenarios and reconciliation outcomes."
            icon={GitMerge}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ConvergenceLab model={model} />
      )}
    </div>
  );
}

function ConvergenceLab({ model }: { model: ConvergenceModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const strategy = model.strategies.find((item) => item.id === strategyId) ?? model.strategies[0];
  const outcome = scenario.outcomes[strategy.id];

  const result = useMemo(() => {
    const converged = outcome.replicaA === outcome.replicaB;
    const preservesIntent = outcome.retainedIntents === 2;
    const needsReview = outcome.unresolvedConflicts > 0;
    const tone: 'emerald' | 'amber' | 'rose' = !converged
      ? 'rose'
      : preservesIntent && !needsReview
        ? 'emerald'
        : 'amber';
    return { converged, needsReview, preservesIntent, tone };
  }, [outcome]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setStrategyId(model.defaults.strategyId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Concurrent edit lab"
        title={model.title}
        description={model.description}
        icon={GitMerge}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Concurrent collision
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Layers}
                    accent="cyan"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Reconciliation policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === strategy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={strategyIcon(item.id)}
                    accent={item.id === 'raw-offsets' ? 'rose' : item.id === 'typed-stable-merge' ? 'emerald' : 'amber'}
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Replica state"
              value={result.converged ? 'Converged' : 'Diverged'}
              detail={result.converged ? 'Both replicas show the same final state.' : 'Delivery order changed the final state.'}
              icon={result.converged ? CheckCircle2 : TriangleAlert}
              tone={result.converged ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Intent retained"
              value={`${outcome.retainedIntents}/2 edits`}
              detail={result.preservesIntent ? 'Both accepted edits remain inspectable.' : 'One accepted-looking edit disappeared.'}
              icon={Users}
              tone={result.preservesIntent ? 'blue' : 'amber'}
            />
            <LabMetric
              label="Domain review"
              value={result.needsReview ? 'Required' : 'Not required'}
              detail={result.needsReview ? 'The datatype cannot choose the valid business outcome.' : 'The modeled result needs no manual conflict choice.'}
              icon={result.needsReview ? CircleAlert : ShieldCheck}
              tone={result.needsReview ? 'amber' : 'neutral'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Shared starting state</p>
            <p className="mt-2 rounded-md border border-neutral-200 bg-white px-4 py-3 font-mono text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
              {scenario.baseState}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[scenario.operationA, scenario.operationB].map((operation, index) => (
                <div
                  key={operation.actor}
                  className={`rounded-md border p-4 ${index === 0
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50'
                    : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50'}`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                    <User aria-hidden="true" className="h-4 w-4" /> Editor {operation.actor}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{operation.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Opposite arrival paths</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{strategy.principle}</p>
              </div>
              <Route aria-hidden="true" className="h-5 w-5 shrink-0 text-violet-500" />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <ReplicaCard label="Replica A" order={outcome.orderA} value={outcome.replicaA} tone="cyan" />
              <ReplicaCard label="Replica B" order={outcome.orderB} value={outcome.replicaB} tone="violet" />
            </div>
          </div>

          <div className={`rounded-md border p-4 ${result.tone === 'emerald'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            : result.tone === 'amber'
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}
          >
            <div className="flex items-start gap-3">
              {result.tone === 'emerald' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : result.tone === 'amber' ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {!result.converged
                    ? 'The policy fails the convergence invariant.'
                    : result.needsReview
                      ? 'The replicas converge, but the product still owes the user a decision.'
                      : result.preservesIntent
                        ? 'The modeled merge converges and retains both edits.'
                        : 'The replicas converge by discarding accepted-looking intent.'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">{outcome.explanation}</p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ReplicaCard({
  label,
  order,
  value,
  tone,
}: {
  label: string;
  order: string[];
  value: string;
  tone: 'cyan' | 'violet';
}) {
  const colors = tone === 'cyan'
    ? 'border-cyan-300 dark:border-cyan-900'
    : 'border-violet-300 dark:border-violet-900';

  return (
    <div className={`min-w-0 rounded-md border bg-white p-4 dark:bg-neutral-950 ${colors}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone === 'cyan'
          ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
          : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}
        >
          <User aria-hidden="true" className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      </div>
      <ol className="mt-4 space-y-2">
        {order.map((step, index) => (
          <li key={`${step}-${index}`} className="flex gap-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Final state</p>
        <p className="mt-2 break-words font-mono text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Convergence model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading convergence model...
        </div>
      )}
    </div>
  );
}
