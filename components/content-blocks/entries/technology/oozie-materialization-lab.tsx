'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileCheck2,
  Layers3,
  LoaderCircle,
  Route,
  SkipForward,
  TimerOff,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/oozie-materialization-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/oozie/data/materialization-model.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  nominalTime: string;
  actualDelayMinutes: number;
  timeoutMinutes: number;
  backlogActions: number;
  inputUri: string;
  outputPartition: string;
};

type DataState = {
  id: string;
  label: string;
  detail: string;
  directoryExists: boolean;
  markers: string[];
};

type ReadinessContract = {
  id: string;
  label: string;
  detail: string;
  marker: string | null;
  warning: string;
};

type ExecutionStrategy = {
  id: 'FIFO' | 'LIFO' | 'LAST_ONLY' | 'NONE';
  label: string;
  detail: string;
};

type ConfigurationLayer = {
  id: string;
  label: string;
  detail: string;
  source: string;
  outputRoot: string;
};

type MaterializationModel = {
  kind: 'oozie-materialization';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    dataStateId: string;
    readinessContractId: string;
    executionStrategyId: ExecutionStrategy['id'];
    configurationLayerId: string;
  };
  scenarios: Scenario[];
  dataStates: DataState[];
  readinessContracts: ReadinessContract[];
  executionStrategies: ExecutionStrategy[];
  configurationLayers: ConfigurationLayer[];
  noneToleranceMinutes: number;
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isMaterializationModel(value: unknown): value is MaterializationModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'oozie-materialization'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.scenarios)
      && value.scenarios.length >= 3
      && Array.isArray(value.dataStates)
      && value.dataStates.length >= 3
      && Array.isArray(value.readinessContracts)
      && value.readinessContracts.length >= 3
      && Array.isArray(value.executionStrategies)
      && value.executionStrategies.length >= 4
      && Array.isArray(value.configurationLayers)
      && value.configurationLayers.length >= 3
      && typeof value.noneToleranceMinutes === 'number'
      && typeof value.notice === 'string',
  );
}

export default function OozieMaterializationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MaterializationModel | null>(null);
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
        if (!isMaterializationModel(payload)) {
          throw new Error('The Oozie materialization model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the materialization model.',
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

  return <MaterializationWorkbench model={model} />;
}

function MaterializationWorkbench({ model }: { model: MaterializationModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [dataStateId, setDataStateId] = useState(model.defaults.dataStateId);
  const [contractId, setContractId] = useState(model.defaults.readinessContractId);
  const [strategyId, setStrategyId] = useState(model.defaults.executionStrategyId);
  const [configurationLayerId, setConfigurationLayerId] = useState(
    model.defaults.configurationLayerId,
  );

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const dataState =
    model.dataStates.find((item) => item.id === dataStateId) ?? model.dataStates[0];
  const contract =
    model.readinessContracts.find((item) => item.id === contractId)
    ?? model.readinessContracts[0];
  const strategy =
    model.executionStrategies.find((item) => item.id === strategyId)
    ?? model.executionStrategies[0];
  const configuration =
    model.configurationLayers.find((item) => item.id === configurationLayerId)
    ?? model.configurationLayers[0];

  const result = useMemo(() => {
    const markerSatisfied = contract.marker
      ? dataState.markers.includes(contract.marker)
      : dataState.directoryExists;
    const predicateSatisfied = dataState.directoryExists && markerSatisfied;
    const timedOut = scenario.actualDelayMinutes >= scenario.timeoutMinutes;
    const ready = predicateSatisfied && !timedOut;
    const state = timedOut ? 'TIMEDOUT' : ready ? 'READY' : 'WAITING';

    let strategyEligibleActions = scenario.backlogActions;
    if (strategy.id === 'LAST_ONLY') {
      strategyEligibleActions = Math.min(1, strategyEligibleActions);
    }
    if (strategy.id === 'NONE') {
      strategyEligibleActions =
        scenario.actualDelayMinutes <= model.noneToleranceMinutes ? 1 : 0;
    }

    const runnableActions = ready ? strategyEligibleActions : 0;
    const skippedActions = Math.max(
      0,
      scenario.backlogActions - strategyEligibleActions,
    );
    const outputPath = `${configuration.outputRoot}/${scenario.outputPartition}`;

    return {
      markerSatisfied,
      outputPath,
      ready,
      runnableActions,
      skippedActions,
      state,
      timedOut,
    };
  }, [configuration, contract, dataState, model.noneToleranceMinutes, scenario, strategy]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setDataStateId(model.defaults.dataStateId);
    setContractId(model.defaults.readinessContractId);
    setStrategyId(model.defaults.executionStrategyId);
    setConfigurationLayerId(model.defaults.configurationLayerId);
  }

  const StateIcon = result.ready ? CheckCircle2 : result.timedOut ? TimerOff : Clock3;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Coordinator materialization lab"
          title={model.title}
          description={model.description}
          icon={CalendarClock}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Select a schedule condition">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={CalendarClock}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Declare readiness">
                {model.readinessContracts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === contract.id}
                    label={item.label}
                    detail={item.detail}
                    icon={FileCheck2}
                    accent="emerald"
                    onClick={() => setContractId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Observe storage">
                {model.dataStates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === dataState.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Database}
                    accent="violet"
                    onClick={() => setDataStateId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Nominal-time trace
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <TraceNode
                  icon={CalendarClock}
                  label="Nominal slot"
                  value={scenario.nominalTime}
                />
                <TraceArrow />
                <TraceNode
                  icon={FileCheck2}
                  label="Data predicate"
                  value={result.markerSatisfied ? 'Satisfied' : 'Not satisfied'}
                />
                <TraceArrow />
                <TraceNode icon={StateIcon} label="Coordinator action" value={result.state} />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Action state"
                value={result.state}
                detail={`${scenario.actualDelayMinutes} min after nominal time`}
                icon={StateIcon}
                tone={result.ready ? 'emerald' : result.timedOut ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Timeout"
                value={`${scenario.timeoutMinutes} min`}
                detail="WAITING can become TIMEDOUT only before submission"
                icon={Clock3}
                tone="amber"
              />
              <LabMetric
                label="Runnable"
                value={String(result.runnableActions)}
                detail={`${result.skippedActions} of ${scenario.backlogActions} backlog actions skipped`}
                icon={Route}
                tone={result.runnableActions > 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Effective config"
                value={configuration.label}
                detail={configuration.source}
                icon={Layers3}
                tone="violet"
              />
            </div>

            <ChoiceGroup label="Backlog execution strategy" horizontal>
              {model.executionStrategies.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === strategy.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.id === 'LAST_ONLY' || item.id === 'NONE' ? SkipForward : Route}
                  accent="amber"
                  onClick={() => setStrategyId(item.id)}
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup label="Highest layer setting outputRoot" horizontal>
              {model.configurationLayers.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === configuration.id}
                  label={item.label}
                  detail={item.detail}
                  icon={Layers3}
                  accent="violet"
                  onClick={() => setConfigurationLayerId(item.id)}
                />
              ))}
            </ChoiceGroup>

            <section
              className={`rounded-md border p-5 ${
                result.ready
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.timedOut
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <StateIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Materialization decision
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.ready
                      ? 'The workflow may be submitted'
                      : result.timedOut
                        ? 'The coordinator action timed out'
                        : 'Keep the action waiting for its declared input'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.ready
                      ? `The ${contract.label.toLowerCase()} contract is satisfied. The run writes to ${result.outputPath}.`
                      : result.timedOut
                        ? `The action reached its ${scenario.timeoutMinutes}-minute timeout before a workflow was submitted. Rerun policy must decide whether to re-evaluate ${scenario.inputUri}.`
                        : `${contract.warning} The observed storage state does not prove ${scenario.inputUri} is complete.`}
                  </p>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
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
  horizontal = false,
  label,
}: {
  children: ReactNode;
  horizontal?: boolean;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className={`mt-3 grid gap-2 ${horizontal ? 'md:grid-cols-2' : ''}`}>
        {children}
      </div>
    </fieldset>
  );
}

function TraceNode({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function TraceArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <span className="hidden sm:inline">-&gt;</span>
      <span className="sm:hidden">|</span>
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
        <LearningLabHeader
          eyebrow="Coordinator materialization lab"
          title="Decide when a scheduled action is actually ready"
          description="Loading nominal-time, data-readiness, and execution-policy scenarios."
          icon={CalendarClock}
          accent="cyan"
        />
        <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
            >
              {error} Retry
            </button>
          ) : (
            <>
              <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
              Loading materialization model...
            </>
          )}
        </div>
      </LearningLab>
    </div>
  );
}
