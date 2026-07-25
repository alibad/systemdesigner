'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Container,
  LoaderCircle,
  ServerCog,
  SlidersHorizontal,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requirements: string[];
};

type Priority = {
  id: string;
  label: string;
  detail: string;
  requirement: string;
};

type DeploymentOption = {
  id: string;
  label: string;
  operatorOwns: string;
  runtimeScope: string;
  supports: string[];
  strengths: string[];
  constraints: string[];
};

type DeploymentModel = {
  title: string;
  description: string;
  modelNote: string;
  defaultScenarioId: string;
  defaultPriorityId: string;
  capabilities: Record<string, string>;
  scenarios: Scenario[];
  priorities: Priority[];
  options: DeploymentOption[];
};

const BLOCK_ID = 'technology/emr-cost';
const DEFAULT_DATA_FILE = '/api/content/technology/emr/data/deployment-options.json';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDeploymentModel(value: unknown): value is DeploymentModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeploymentModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && candidate.defaultScenarioId
      && candidate.defaultPriorityId
      && candidate.capabilities
      && typeof candidate.capabilities === 'object'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && isStringArray(scenario.requirements)
      ))
      && Array.isArray(candidate.priorities)
      && candidate.priorities.length >= 3
      && candidate.priorities.every((priority) => (
        typeof priority.id === 'string'
        && typeof priority.label === 'string'
        && typeof priority.detail === 'string'
        && typeof priority.requirement === 'string'
      ))
      && Array.isArray(candidate.options)
      && candidate.options.length === 3
      && candidate.options.every((option) => (
        typeof option.id === 'string'
        && typeof option.label === 'string'
        && typeof option.operatorOwns === 'string'
        && typeof option.runtimeScope === 'string'
        && isStringArray(option.supports)
        && isStringArray(option.strengths)
        && isStringArray(option.constraints)
      ))
      && candidate.scenarios.some((scenario) => scenario.id === candidate.defaultScenarioId)
      && candidate.priorities.some((priority) => priority.id === candidate.defaultPriorityId),
  );
}

export default function EmrDeploymentPlanner({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<DeploymentModel | null>(null);
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
        if (!isDeploymentModel(payload)) {
          throw new Error('The EMR deployment model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the EMR deployment model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Deployment decision lab"
            title="Choose the EMR execution boundary"
            description="Loading workload requirements and deployment options."
            icon={CloudCog}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <DeploymentWorkbench model={model} />
      )}
    </div>
  );
}

function DeploymentWorkbench({ model }: { model: DeploymentModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaultScenarioId);
  const [priorityId, setPriorityId] = useState(model.defaultPriorityId);

  const scenario = (
    model.scenarios.find((candidate) => candidate.id === scenarioId)
    ?? model.scenarios[0]
  );
  const priority = (
    model.priorities.find((candidate) => candidate.id === priorityId)
    ?? model.priorities[0]
  );

  const requirements = useMemo(
    () => [...new Set([...scenario.requirements, priority.requirement])],
    [priority.requirement, scenario.requirements],
  );
  const results = useMemo(
    () => model.options
      .map((option) => {
        const matched = requirements.filter((requirement) => (
          option.supports.includes(requirement)
        ));
        return {
          option,
          matched,
          missing: requirements.filter((requirement) => !matched.includes(requirement)),
        };
      })
      .sort((left, right) => right.matched.length - left.matched.length),
    [model.options, requirements],
  );
  const bestMatchCount = results[0]?.matched.length ?? 0;
  const recommended = results.filter((result) => result.matched.length === bestMatchCount);

  function reset() {
    setScenarioId(model.defaultScenarioId);
    setPriorityId(model.defaultPriorityId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Deployment decision lab"
        title={model.title}
        description={model.description}
        icon={CloudCog}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload shape
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === scenario.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Boxes}
                    accent="blue"
                    onClick={() => setScenarioId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Strongest platform priority
              </legend>
              <div className="mt-3 grid gap-2">
                {model.priorities.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === priority.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={SlidersHorizontal}
                    accent="violet"
                    onClick={() => setPriorityId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
            <p className="text-xs font-semibold uppercase opacity-75">Decision consequence</p>
            <h4 className="mt-1 text-xl font-semibold">
              {recommended.length === 1
                ? `${recommended[0].option.label} covers every selected requirement best`
                : `${recommended.map((result) => result.option.label).join(' and ')} need a tie-breaker`}
            </h4>
            <p className="mt-2 text-sm leading-6 opacity-85">
              {recommended.length === 1
                ? `The recommendation satisfies ${bestMatchCount} of ${requirements.length} explicit requirements. Confirm service availability, quotas, release compatibility, security controls, and measured workload behavior before committing.`
                : 'The current requirements do not distinguish the leading options. Add a framework, infrastructure-ownership, startup, networking, or tenancy constraint before choosing.'}
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map(({ option, matched, missing }) => {
              const isRecommended = matched.length === bestMatchCount;
              return (
                <article
                  key={option.id}
                  className={`rounded-md border p-4 ${
                    isRecommended
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <OptionIcon id={option.id} />
                      <h4 className="text-base font-semibold">{option.label}</h4>
                    </div>
                    <span className="shrink-0 rounded-sm border border-current px-2 py-1 text-[11px] font-semibold uppercase">
                      {isRecommended ? 'Best fit' : `${matched.length}/${requirements.length}`}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-65">
                    You operate
                  </p>
                  <p className="mt-1 text-sm leading-5 opacity-85">{option.operatorOwns}</p>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-65">
                    Runtime scope
                  </p>
                  <p className="mt-1 text-sm leading-5 opacity-85">{option.runtimeScope}</p>
                  <div className="mt-4 space-y-2 text-xs">
                    {matched.map((requirement) => (
                      <p key={requirement} className="flex items-start gap-2">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{model.capabilities[requirement]}</span>
                      </p>
                    ))}
                    {missing.map((requirement) => (
                      <p key={requirement} className="flex items-start gap-2 opacity-75">
                        <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Does not directly provide: {model.capabilities[requirement]}</span>
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Requirements"
              value={`${requirements.length}`}
              detail="Scenario plus platform priority"
              icon={SlidersHorizontal}
              tone="blue"
            />
            <LabMetric
              label="Top coverage"
              value={`${bestMatchCount} / ${requirements.length}`}
              detail="Explicit capability matches, not a performance score"
              icon={CheckCircle2}
              tone={bestMatchCount === requirements.length ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Price claim"
              value="None"
              detail="Use current regional pricing and measured resource consumption"
              icon={CircleAlert}
              tone="neutral"
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

function OptionIcon({ id }: { id: string }) {
  const Icon = id === 'serverless' ? CloudCog : id === 'eks' ? Container : ServerCog;
  return <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />;
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
      <div
        role={error ? 'alert' : 'status'}
        className="flex min-h-40 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60"
      >
        <div>
          {error ? (
            <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-400" />
          )}
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            {error ?? 'Loading the deployment model...'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </LearningLabBody>
  );
}
