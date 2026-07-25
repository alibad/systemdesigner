'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  History,
  RadioTower,
  RefreshCw,
  Route,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type UseCase = {
  id: string;
  label: string;
  detail: string;
  maxAgeMs: number;
  requiresCompleteHistory: boolean;
  requiredFidelity: 'operational' | 'validated';
};

type Policy = {
  id: string;
  label: string;
  detail: string;
};

type ReconciliationOutcome = {
  accepted: boolean;
  resultingSequence: number;
  resultingValue: string;
  stateAgeMs: number;
  history: 'complete' | 'gap' | 'rollback';
  reason: string;
};

type ObservationScenario = {
  id: string;
  label: string;
  detail: string;
  physicalValue: string;
  incomingSequence: number;
  incomingValue: string;
  incomingAgeMs: number;
  currentSequence: number;
  currentValue: string;
  currentAgeMs: number;
  fidelity: 'operational' | 'validated';
  outcomes: Record<string, ReconciliationOutcome>;
};

type SynchronizationModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
    useCaseId: string;
  };
  useCases: UseCase[];
  policies: Policy[];
  scenarios: ObservationScenario[];
};

const BLOCK_ID = 'fundamentals/digital-twin-orchestration-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/digital-twin-orchestration/data/synchronization-scenarios.json';

function isOutcome(value: unknown): value is ReconciliationOutcome {
  if (!value || typeof value !== 'object') return false;
  const outcome = value as Partial<ReconciliationOutcome>;
  return Boolean(
    typeof outcome.accepted === 'boolean'
      && typeof outcome.resultingSequence === 'number'
      && typeof outcome.resultingValue === 'string'
      && typeof outcome.stateAgeMs === 'number'
      && ['complete', 'gap', 'rollback'].includes(outcome.history ?? '')
      && typeof outcome.reason === 'string',
  );
}

function isSynchronizationModel(value: unknown): value is SynchronizationModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<SynchronizationModel>;
  if (
    typeof model.title !== 'string'
    || typeof model.description !== 'string'
    || typeof model.defaults?.scenarioId !== 'string'
    || typeof model.defaults.policyId !== 'string'
    || typeof model.defaults.useCaseId !== 'string'
    || !Array.isArray(model.useCases)
    || model.useCases.length < 3
    || !Array.isArray(model.policies)
    || model.policies.length < 2
    || !Array.isArray(model.scenarios)
    || model.scenarios.length < 3
  ) return false;

  const policyIds = model.policies.map((policy) => policy.id);
  return model.useCases.every((useCase) => (
    typeof useCase.id === 'string'
      && typeof useCase.label === 'string'
      && typeof useCase.detail === 'string'
      && typeof useCase.maxAgeMs === 'number'
      && typeof useCase.requiresCompleteHistory === 'boolean'
      && ['operational', 'validated'].includes(useCase.requiredFidelity)
  )) && model.policies.every((policy) => (
    typeof policy.id === 'string'
      && typeof policy.label === 'string'
      && typeof policy.detail === 'string'
  )) && model.scenarios.every((scenario) => (
    typeof scenario.id === 'string'
      && typeof scenario.label === 'string'
      && typeof scenario.detail === 'string'
      && typeof scenario.physicalValue === 'string'
      && typeof scenario.incomingSequence === 'number'
      && typeof scenario.incomingValue === 'string'
      && typeof scenario.incomingAgeMs === 'number'
      && typeof scenario.currentSequence === 'number'
      && typeof scenario.currentValue === 'string'
      && typeof scenario.currentAgeMs === 'number'
      && ['operational', 'validated'].includes(scenario.fidelity)
      && scenario.outcomes
      && policyIds.every((policyId) => isOutcome(scenario.outcomes[policyId]))
  ));
}

export default function DigitalTwinOrchestrationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SynchronizationModel | null>(null);
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
        if (!isSynchronizationModel(payload)) {
          throw new Error('The synchronization model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load synchronization data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Synchronization lab"
            title="Reconcile telemetry into trustworthy state"
            description="Loading lesson-owned observation sequences and use-case contracts."
            icon={RefreshCw}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <SynchronizationLab model={model} />
      )}
    </div>
  );
}

function SynchronizationLab({ model }: { model: SynchronizationModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [policyId, setPolicyId] = useState(model.defaults.policyId);
  const [useCaseId, setUseCaseId] = useState(model.defaults.useCaseId);

  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const policy = model.policies.find((item) => item.id === policyId) ?? model.policies[0];
  const useCase = model.useCases.find((item) => item.id === useCaseId) ?? model.useCases[0];
  const outcome = scenario.outcomes[policy.id];

  const qualification = useMemo(() => {
    const fresh = outcome.stateAgeMs <= useCase.maxAgeMs;
    const historyReady = !useCase.requiresCompleteHistory || outcome.history === 'complete';
    const fidelityReady = useCase.requiredFidelity === 'operational'
      || scenario.fidelity === 'validated';
    const qualified = fresh && historyReady && fidelityReady && outcome.history !== 'rollback';
    const blockers = [
      !fresh ? `State is ${formatDuration(outcome.stateAgeMs)}, beyond the ${formatDuration(useCase.maxAgeMs)} contract.` : null,
      !historyReady && outcome.history === 'gap' ? 'The event history has an unresolved sequence gap.' : null,
      !fidelityReady ? 'This model has not been validated for this decision.' : null,
      outcome.history === 'rollback' ? 'The policy moved the twin backward to an older observation.' : null,
    ].filter((item): item is string => Boolean(item));
    return { fresh, historyReady, fidelityReady, qualified, blockers };
  }, [outcome, scenario.fidelity, useCase]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setPolicyId(model.defaults.policyId);
    setUseCaseId(model.defaults.useCaseId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Synchronization lab"
        title={model.title}
        description={model.description}
        icon={RefreshCw}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Incoming observation
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={RadioTower}
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
                {model.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Route}
                    accent={item.id === 'arrival-order' ? 'amber' : 'violet'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Intended use
              </legend>
              <div className="mt-3 grid gap-2">
                {model.useCases.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === useCase.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'closed-loop' ? ShieldCheck : ScanSearch}
                    accent={item.id === 'closed-loop' ? 'rose' : 'blue'}
                    onClick={() => setUseCaseId(item.id)}
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
              label="Update decision"
              value={outcome.accepted ? 'Accepted' : 'Rejected'}
              detail={outcome.reason}
              icon={outcome.accepted ? BadgeCheck : CircleAlert}
              tone={outcome.history === 'rollback' ? 'rose' : outcome.accepted ? 'cyan' : 'amber'}
            />
            <LabMetric
              label="Twin state age"
              value={formatDuration(outcome.stateAgeMs)}
              detail={`Freshness contract: at most ${formatDuration(useCase.maxAgeMs)}.`}
              icon={Clock3}
              tone={qualification.fresh ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Use-case gate"
              value={qualification.qualified ? 'Qualified' : 'Blocked'}
              detail={`${useCase.label}; ${scenario.fidelity} model fidelity.`}
              icon={qualification.qualified ? ShieldCheck : TriangleAlert}
              tone={qualification.qualified ? 'emerald' : 'rose'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Observation-to-state path
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
              <FlowStage
                icon={Activity}
                eyebrow="Physical asset"
                title={scenario.physicalValue}
                detail="What the instrumented process is doing now"
                tone="cyan"
              />
              <FlowArrow />
              <FlowStage
                icon={RadioTower}
                eyebrow={`Observation #${scenario.incomingSequence}`}
                title={scenario.incomingValue}
                detail={`${formatDuration(scenario.incomingAgeMs)} old at ingestion`}
                tone="violet"
              />
              <FlowArrow />
              <FlowStage
                icon={Database}
                eyebrow={`Twin state #${outcome.resultingSequence}`}
                title={outcome.resultingValue}
                detail={outcome.history === 'complete' ? 'Monotonic history' : outcome.history === 'gap' ? 'Sequence gap recorded' : 'State moved backward'}
                tone={outcome.history === 'complete' ? 'emerald' : 'rose'}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
            <div className={`rounded-md border p-4 ${
              qualification.qualified
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {qualification.qualified ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {qualification.qualified
                      ? `The twin can support ${useCase.label.toLowerCase()}.`
                      : `Do not use this state for ${useCase.label.toLowerCase()}.`}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {qualification.qualified
                      ? 'Freshness, event history, and model fidelity satisfy this explicit contract.'
                      : qualification.blockers.join(' ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                Fidelity is multidimensional
              </div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                <li><strong>Structural:</strong> entities and relationships match the use case.</li>
                <li><strong>Temporal:</strong> state age is inside its declared budget.</li>
                <li><strong>Behavioral:</strong> the model is validated for the decision it informs.</li>
              </ul>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function FlowStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'cyan' | 'violet' | 'emerald' | 'rose';
}) {
  const styles = {
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 break-words text-lg font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowRight className="hidden h-5 w-5 md:block" />
      <span className="h-5 w-px bg-neutral-300 md:hidden dark:bg-neutral-700" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-40 items-center justify-center">
        {error ? (
          <div className="max-w-md text-center">
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              Synchronization data could not be loaded
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <History aria-hidden="true" className="h-5 w-5 animate-pulse text-cyan-500" />
            Loading observation model…
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}
