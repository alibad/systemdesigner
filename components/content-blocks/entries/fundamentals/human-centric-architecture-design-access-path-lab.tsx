'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Activity,
  Check,
  CheckCircle2,
  CircleAlert,
  FileText,
  Gauge,
  Keyboard,
  Languages,
  RefreshCw,
  RotateCcw,
  Route,
  SignalLow,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/human-centric-architecture-design-access-path-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/human-centric-architecture-design/data/access-path-contracts.json';

type Stage = {
  id: string;
  label: string;
  description: string;
};

type UserContext = {
  id: string;
  label: string;
  description: string;
  requiredCapabilityIds: string[];
};

type ServiceScenario = {
  id: string;
  label: string;
  description: string;
  consequence: string;
  baselineTransferKb: number;
  leanTransferKb: number;
  requiredCapabilityIds: string[];
};

type Capability = {
  id: string;
  label: string;
  description: string;
  stageIds: string[];
};

type AccessPathModel = {
  kind: 'human-centric-access-path';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    contextId: string;
    selectedCapabilityIds: string[];
  };
  stages: Stage[];
  contexts: UserContext[];
  scenarios: ServiceScenario[];
  capabilities: Capability[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAccessPathModel(value: unknown): value is AccessPathModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccessPathModel>;

  return Boolean(
    candidate.kind === 'human-centric-access-path'
      && candidate.blockId === BLOCK_ID
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaults?.scenarioId === 'string'
      && typeof candidate.defaults.contextId === 'string'
      && isStringArray(candidate.defaults.selectedCapabilityIds)
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 4
      && candidate.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.description === 'string'
      ))
      && Array.isArray(candidate.contexts)
      && candidate.contexts.length >= 3
      && candidate.contexts.every((context) => (
        typeof context.id === 'string'
        && typeof context.label === 'string'
        && typeof context.description === 'string'
        && isStringArray(context.requiredCapabilityIds)
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.description === 'string'
        && typeof scenario.consequence === 'string'
        && typeof scenario.baselineTransferKb === 'number'
        && typeof scenario.leanTransferKb === 'number'
        && isStringArray(scenario.requiredCapabilityIds)
      ))
      && Array.isArray(candidate.capabilities)
      && candidate.capabilities.length >= 8
      && candidate.capabilities.every((capability) => (
        typeof capability.id === 'string'
        && typeof capability.label === 'string'
        && typeof capability.description === 'string'
        && isStringArray(capability.stageIds)
      )),
  );
}

export default function HumanCentricArchitectureAccessPathLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AccessPathModel | null>(null);
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
        if (!isAccessPathModel(payload)) {
          throw new Error('The access-path contract data is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load access-path data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Access-path stress lab"
            title="Load the human constraints"
            description="The lesson-owned service scenarios and architecture contracts are loading."
            icon={Accessibility}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <AccessPathLab model={model} />
      )}
    </div>
  );
}

function AccessPathLab({ model }: { model: AccessPathModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [contextId, setContextId] = useState(model.defaults.contextId);
  const [selected, setSelected] = useState(
    () => new Set(model.defaults.selectedCapabilityIds),
  );

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const context = model.contexts.find((item) => item.id === contextId)
    ?? model.contexts[0];

  const result = useMemo(() => {
    const requiredIds = new Set([
      ...scenario.requiredCapabilityIds,
      ...context.requiredCapabilityIds,
    ]);
    const missing = model.capabilities.filter(
      (capability) => requiredIds.has(capability.id) && !selected.has(capability.id),
    );
    const stageResults = model.stages.map((stage) => {
      const required = model.capabilities.filter(
        (capability) => (
          requiredIds.has(capability.id)
          && capability.stageIds.includes(stage.id)
        ),
      );
      const blockers = required.filter((capability) => !selected.has(capability.id));
      return { ...stage, blockers, required };
    });
    const selectedRequiredCount = requiredIds.size - missing.length;
    const transferKb = selected.has('small-core-payload')
      ? scenario.leanTransferKb
      : scenario.baselineTransferKb;

    return {
      missing,
      requiredCount: requiredIds.size,
      selectedRequiredCount,
      stageResults,
      taskReady: missing.length === 0,
      transferKb,
    };
  }, [context.requiredCapabilityIds, model.capabilities, model.stages, scenario, selected]);

  function toggleCapability(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setContextId(model.defaults.contextId);
    setSelected(new Set(model.defaults.selectedCapabilityIds));
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Access-path stress lab"
        title={model.title}
        description={model.description}
        icon={Accessibility}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Core service task
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.description}
                    icon={FileText}
                    accent="cyan"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. User context
              </legend>
              <div className="mt-3 grid gap-2">
                {model.contexts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === context.id}
                    label={item.label}
                    detail={item.description}
                    icon={contextIcon(item.id)}
                    accent="violet"
                    onClick={() => setContextId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div
          className={`rounded-md border p-4 ${
            result.taskReady
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {result.taskReady ? (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
              />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
              />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                User-visible outcome
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.taskReady
                  ? 'The complete task path remains available'
                  : `The task is blocked at ${result.stageResults.filter((stage) => stage.blockers.length > 0).map((stage) => stage.label.toLowerCase()).join(', ')}`}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.taskReady
                  ? `The selected contracts address the ${context.label.toLowerCase()} context for this task. Verify the behavior with representative users and assistive technology.`
                  : scenario.consequence}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LabMetric
            label="Required contracts"
            value={`${result.selectedRequiredCount}/${result.requiredCount}`}
            detail={result.taskReady ? 'All present' : `${result.missing.length} missing`}
            icon={Route}
            tone={result.taskReady ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Core transfer"
            value={`${result.transferKb} KiB`}
            detail={selected.has('small-core-payload') ? 'Essential path isolated' : 'Optional payload still coupled'}
            icon={Gauge}
            tone={selected.has('small-core-payload') ? 'cyan' : 'amber'}
          />
          <LabMetric
            label="Interruption"
            value={selected.has('save-resume') ? 'Resumable' : 'Restart'}
            detail="Draft state after a dropped connection"
            icon={RotateCcw}
            tone={selected.has('save-resume') ? 'violet' : 'rose'}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <Route aria-hidden="true" className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Task path
            </h4>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {result.stageResults.map((stage, index) => (
              <PathStage
                key={stage.id}
                index={index}
                label={stage.label}
                description={stage.description}
                blockers={stage.blockers}
              />
            ))}
          </div>
        </div>

        <fieldset className="mt-7">
          <legend className="text-sm font-semibold text-neutral-950 dark:text-white">
            3. Architecture contracts
          </legend>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Toggle contracts and observe which parts of the task path survive.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {model.capabilities.map((capability) => (
              <CapabilityToggle
                key={capability.id}
                capability={capability}
                selected={selected.has(capability.id)}
                required={
                  scenario.requiredCapabilityIds.includes(capability.id)
                  || context.requiredCapabilityIds.includes(capability.id)
                }
                onToggle={() => toggleCapability(capability.id)}
              />
            ))}
          </div>
        </fieldset>

        {!result.taskReady ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
            <p className="text-xs font-semibold uppercase text-rose-800 dark:text-rose-200">
              Missing for this task and context
            </p>
            <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-rose-950 marker:text-rose-600 dark:text-rose-100 dark:marker:text-rose-300">
              {result.missing.map((capability) => (
                <li key={capability.id}>{capability.label}: {capability.description}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </LearningLabBody>
    </LearningLab>
  );
}

function contextIcon(id: string) {
  if (id.includes('keyboard')) return Keyboard;
  if (id.includes('screen-reader')) return Accessibility;
  if (id.includes('rtl')) return Languages;
  return Activity;
}

function PathStage({
  index,
  label,
  description,
  blockers,
}: {
  index: number;
  label: string;
  description: string;
  blockers: Capability[];
}) {
  const ready = blockers.length === 0;

  return (
    <div
      className={`relative min-w-0 rounded-md border p-4 ${
        ready
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
          {index + 1}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
          {ready ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <X aria-hidden="true" className="h-3.5 w-3.5" />}
          {ready ? 'Available' : 'Blocked'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{description}</p>
      {!ready ? (
        <p className="mt-3 text-xs font-medium leading-5 text-rose-800 dark:text-rose-200">
          Missing: {blockers.map((item) => item.label).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function CapabilityToggle({
  capability,
  selected,
  required,
  onToggle,
}: {
  capability: Capability;
  selected: boolean;
  required: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`min-h-[116px] rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
        selected
          ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
            selected
              ? 'border-cyan-600 bg-cyan-600 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-neutral-950'
              : 'border-neutral-400 text-transparent dark:border-neutral-600'
          }`}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{capability.label}</span>
            {required ? (
              <span className="rounded-sm border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Required here
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs leading-5 opacity-75">
            {capability.description}
          </span>
        </span>
      </span>
    </button>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="min-h-[420px] p-6">
        <div
          className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
          <p className="mt-3 font-semibold">Access-path data could not be loaded</p>
          <p className="mt-1 leading-6">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] items-center justify-center p-6" role="status">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <SignalLow
          aria-hidden="true"
          className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none"
        />
        <p className="mt-3">Loading access-path contracts...</p>
      </div>
    </div>
  );
}
