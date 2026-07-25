'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  Layers3,
  LoaderCircle,
  RefreshCcw,
  Route,
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

type Source = {
  id: string;
  label: string;
  detail: string;
  transactional: boolean;
};

type Destination = {
  id: string;
  label: string;
  detail: string;
  count: number;
};

type Choice = {
  id: string;
  label: string;
  detail: string;
};

type Engine = {
  id: 'traditional' | 'stateless';
  label: string;
  transactionBoundary: string;
  queueDurability: string;
  bestWhen: string[];
};

type ExecutionEngineModel = {
  title: string;
  description: string;
  modelNote: string;
  defaultSourceId: string;
  defaultDestinationId: string;
  defaultOutagePolicyId: string;
  defaultBoundaryId: string;
  sources: Source[];
  destinations: Destination[];
  outagePolicies: Choice[];
  boundaries: Choice[];
  engines: Engine[];
};

const BLOCK_ID = 'technology/nifi-execution-engine-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/nifi/data/execution-engine-model.json';

function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Choice>;
  return Boolean(candidate.id && candidate.label && candidate.detail);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isExecutionEngineModel(value: unknown): value is ExecutionEngineModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutionEngineModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && candidate.defaultSourceId
      && candidate.defaultDestinationId
      && candidate.defaultOutagePolicyId
      && candidate.defaultBoundaryId
      && Array.isArray(candidate.sources)
      && candidate.sources.length === 2
      && candidate.sources.every((source) => (
        isChoice(source) && typeof source.transactional === 'boolean'
      ))
      && Array.isArray(candidate.destinations)
      && candidate.destinations.length === 2
      && candidate.destinations.every((destination) => (
        isChoice(destination)
        && Number.isInteger(destination.count)
        && destination.count > 0
      ))
      && Array.isArray(candidate.outagePolicies)
      && candidate.outagePolicies.length === 2
      && candidate.outagePolicies.every(isChoice)
      && Array.isArray(candidate.boundaries)
      && candidate.boundaries.length === 2
      && candidate.boundaries.every(isChoice)
      && Array.isArray(candidate.engines)
      && candidate.engines.length === 2
      && candidate.engines.every((engine) => (
        (engine.id === 'traditional' || engine.id === 'stateless')
        && typeof engine.label === 'string'
        && typeof engine.transactionBoundary === 'string'
        && typeof engine.queueDurability === 'string'
        && isStringArray(engine.bestWhen)
      ))
      && candidate.sources.some((source) => source.id === candidate.defaultSourceId)
      && candidate.destinations.some(
        (destination) => destination.id === candidate.defaultDestinationId,
      )
      && candidate.outagePolicies.some(
        (policy) => policy.id === candidate.defaultOutagePolicyId,
      )
      && candidate.boundaries.some(
        (boundary) => boundary.id === candidate.defaultBoundaryId,
      ),
  );
}

export default function NifiExecutionEngineLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ExecutionEngineModel | null>(null);
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
        if (!isExecutionEngineModel(payload)) {
          throw new Error('The NiFi execution-engine model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the NiFi execution-engine model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Execution contract lab"
            title="Choose Traditional or Stateless execution"
            description="Loading source, destination, and recovery requirements."
            icon={GitBranch}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ExecutionEngineWorkbench model={model} />
      )}
    </div>
  );
}

function ExecutionEngineWorkbench({ model }: { model: ExecutionEngineModel }) {
  const [sourceId, setSourceId] = useState(model.defaultSourceId);
  const [destinationId, setDestinationId] = useState(model.defaultDestinationId);
  const [outagePolicyId, setOutagePolicyId] = useState(model.defaultOutagePolicyId);
  const [boundaryId, setBoundaryId] = useState(model.defaultBoundaryId);

  const source = (
    model.sources.find((candidate) => candidate.id === sourceId)
    ?? model.sources[0]
  );
  const destination = (
    model.destinations.find((candidate) => candidate.id === destinationId)
    ?? model.destinations[0]
  );
  const outagePolicy = (
    model.outagePolicies.find((candidate) => candidate.id === outagePolicyId)
    ?? model.outagePolicies[0]
  );
  const boundary = (
    model.boundaries.find((candidate) => candidate.id === boundaryId)
    ?? model.boundaries[0]
  );

  const decision = useMemo(() => {
    const statelessGaps: string[] = [];

    if (!source.transactional) {
      statelessGaps.push('The source cannot redeliver an unacknowledged transaction.');
    }
    if (destination.count !== 1) {
      statelessGaps.push(
        'Multiple destinations can repeat an earlier external send when a later send rolls back.',
      );
    }
    if (outagePolicy.id === 'buffer') {
      statelessGaps.push(
        'Stateless execution does not persist in-flight inter-processor queues across restart.',
      );
    }
    if (boundary.id === 'processor') {
      statelessGaps.push(
        'The selected processor-level commit boundary is the Traditional engine model.',
      );
    }

    const recommendedId = statelessGaps.length === 0 ? 'stateless' : 'traditional';
    const recommended = (
      model.engines.find((engine) => engine.id === recommendedId)
      ?? model.engines[0]
    );
    const duplicateExposure = destination.count > 1 && boundary.id === 'process-group';
    const restartOutcome = recommended.id === 'traditional'
      ? 'Queued FlowFiles restore at their committed connection'
      : source.transactional
        ? 'The source can redeliver the unacknowledged unit'
        : 'In-flight data can be lost because the source cannot redeliver';

    return {
      duplicateExposure,
      recommended,
      restartOutcome,
      statelessGaps,
    };
  }, [
    boundary.id,
    destination.count,
    model.engines,
    outagePolicy.id,
    source.transactional,
  ]);

  function reset() {
    setSourceId(model.defaultSourceId);
    setDestinationId(model.defaultDestinationId);
    setOutagePolicyId(model.defaultOutagePolicyId);
    setBoundaryId(model.defaultBoundaryId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Execution contract lab"
        title={model.title}
        description={model.description}
        icon={GitBranch}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <ChoiceGroup
              legend="1. Source acknowledgment"
              choices={model.sources}
              selectedId={source.id}
              icon={RefreshCcw}
              accent="blue"
              onSelect={setSourceId}
            />
            <ChoiceGroup
              legend="2. Destination shape"
              choices={model.destinations}
              selectedId={destination.id}
              icon={Route}
              accent="violet"
              onSelect={setDestinationId}
            />
            <ChoiceGroup
              legend="3. Outage behavior"
              choices={model.outagePolicies}
              selectedId={outagePolicy.id}
              icon={Database}
              accent="amber"
              onSelect={setOutagePolicyId}
            />
            <ChoiceGroup
              legend="4. Commit boundary"
              choices={model.boundaries}
              selectedId={boundary.id}
              icon={Layers3}
              accent="emerald"
              onSelect={setBoundaryId}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              decision.recommended.id === 'stateless'
                ? 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50'
                : 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Recommended execution contract
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {decision.recommended.label}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {decision.recommended.id === 'stateless'
                    ? 'The source can redeliver, the flow has one destination, the whole process group should roll back together, and durable internal buffering is not required.'
                    : `Traditional execution satisfies the selected recovery boundary. ${decision.statelessGaps[0]}`}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-2">
            {model.engines.map((engine) => {
              const selected = engine.id === decision.recommended.id;
              const gaps = engine.id === 'stateless' ? decision.statelessGaps : [];

              return (
                <article
                  key={engine.id}
                  className={`rounded-md border p-4 ${
                    selected
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {engine.id === 'traditional' ? (
                        <Boxes aria-hidden="true" className="h-5 w-5 shrink-0" />
                      ) : (
                        <GitBranch aria-hidden="true" className="h-5 w-5 shrink-0" />
                      )}
                      <h4 className="text-base font-semibold">{engine.label}</h4>
                    </div>
                    <span className="shrink-0 rounded-sm border border-current px-2 py-1 text-[11px] font-semibold uppercase">
                      {selected
                        ? 'Recommended'
                        : engine.id === 'stateless' && gaps.length > 0
                          ? 'Has gaps'
                          : 'Alternative'}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase opacity-65">
                    Transaction boundary
                  </p>
                  <p className="mt-1 text-sm leading-5 opacity-85">
                    {engine.transactionBoundary}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-65">
                    Restart behavior
                  </p>
                  <p className="mt-1 text-sm leading-5 opacity-85">
                    {engine.queueDurability}
                  </p>

                  {gaps.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-current/20 pt-4 text-xs leading-5">
                      {gaps.map((gap) => (
                        <p key={gap} className="flex items-start gap-2">
                          <TriangleAlert
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span>{gap}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2 border-t border-current/20 pt-4 text-xs leading-5">
                      {engine.bestWhen.slice(0, 2).map((reason) => (
                        <p key={reason} className="flex items-start gap-2">
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span>{reason}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Source redelivery"
              value={source.transactional ? 'Available' : 'Unavailable'}
              detail={source.transactional
                ? 'An unacknowledged unit can be sent again'
                : 'NiFi cannot ask the source to replay'}
              icon={RefreshCcw}
              tone={source.transactional ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Restart outcome"
              value={decision.recommended.id === 'traditional' ? 'Restore' : 'Redeliver'}
              detail={decision.restartOutcome}
              icon={Database}
              tone="blue"
            />
            <LabMetric
              label="Fan-out risk"
              value={decision.duplicateExposure ? 'Duplicate exposure' : 'Contained'}
              detail={decision.duplicateExposure
                ? 'Make every external effect idempotent'
                : 'The selected boundary has one destination'}
              icon={decision.duplicateExposure ? TriangleAlert : CheckCircle2}
              tone={decision.duplicateExposure ? 'amber' : 'emerald'}
            />
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ChoiceGroup({
  legend,
  choices,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  legend: string;
  choices: Choice[];
  selectedId: string;
  icon: typeof Route;
  accent: 'amber' | 'blue' | 'emerald' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 grid gap-2">
        {choices.map((choice) => (
          <LabChoice
            key={choice.id}
            selected={choice.id === selectedId}
            label={choice.label}
            detail={choice.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(choice.id)}
          />
        ))}
      </div>
    </fieldset>
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
    <LearningLabBody>
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
        {error ? (
          <>
            <CircleAlert aria-hidden="true" className="h-6 w-6 text-rose-500" />
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              Execution-engine data could not be loaded
            </p>
            <p className="max-w-lg text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="h-6 w-6 animate-spin text-violet-500 motion-reduce:animate-none"
            />
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Loading execution contracts...
            </p>
          </>
        )}
      </div>
    </LearningLabBody>
  );
}
