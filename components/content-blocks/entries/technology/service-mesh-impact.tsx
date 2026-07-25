'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  Network,
  Route,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/technology/service-mesh/data/adoption-decision-model.json';

type Capability = {
  id: string;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requiredCapabilities: string[];
};

type Readiness = {
  id: string;
  label: string;
  detail: string;
  level: number;
};

type Approach = {
  id: string;
  label: string;
  detail: string;
  capabilities: string[];
  minimumReadiness: number;
  operatingShape: string;
  isMesh: boolean;
};

type AdoptionModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    readinessId: string;
  };
  capabilities: Capability[];
  scenarios: Scenario[];
  readiness: Readiness[];
  approaches: Approach[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasUniqueIds(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isAdoptionModel(value: unknown): value is AdoptionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdoptionModel>;

  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaults?.scenarioId !== 'string'
    || typeof candidate.defaults.readinessId !== 'string'
    || !Array.isArray(candidate.capabilities)
    || !Array.isArray(candidate.scenarios)
    || !Array.isArray(candidate.readiness)
    || !Array.isArray(candidate.approaches)
  ) {
    return false;
  }

  const capabilitiesValid = candidate.capabilities.length > 0
    && candidate.capabilities.every((item) => (
      typeof item?.id === 'string'
      && typeof item.label === 'string'
      && typeof item.detail === 'string'
    ))
    && hasUniqueIds(candidate.capabilities);
  const capabilityIds = new Set(candidate.capabilities.map((item) => item.id));

  const scenariosValid = candidate.scenarios.length >= 2
    && candidate.scenarios.every((item) => (
      typeof item?.id === 'string'
      && typeof item.label === 'string'
      && typeof item.detail === 'string'
      && isStringArray(item.requiredCapabilities)
      && item.requiredCapabilities.length > 0
      && item.requiredCapabilities.every((id) => capabilityIds.has(id))
    ))
    && hasUniqueIds(candidate.scenarios);

  const readinessValid = candidate.readiness.length >= 2
    && candidate.readiness.every((item) => (
      typeof item?.id === 'string'
      && typeof item.label === 'string'
      && typeof item.detail === 'string'
      && Number.isInteger(item.level)
      && item.level >= 0
    ))
    && hasUniqueIds(candidate.readiness);

  const approachesValid = candidate.approaches.length >= 2
    && candidate.approaches.every((item) => (
      typeof item?.id === 'string'
      && typeof item.label === 'string'
      && typeof item.detail === 'string'
      && isStringArray(item.capabilities)
      && item.capabilities.every((id) => capabilityIds.has(id))
      && Number.isInteger(item.minimumReadiness)
      && item.minimumReadiness >= 0
      && typeof item.operatingShape === 'string'
      && typeof item.isMesh === 'boolean'
    ))
    && hasUniqueIds(candidate.approaches);

  return Boolean(
    capabilitiesValid
      && scenariosValid
      && readinessValid
      && approachesValid
      && candidate.scenarios.some((item) => item.id === candidate.defaults?.scenarioId)
      && candidate.readiness.some((item) => item.id === candidate.defaults?.readinessId),
  );
}

export default function ServiceMeshAdoptionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AdoptionModel | null>(null);
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
        if (!isAdoptionModel(payload)) {
          throw new Error('The adoption decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the adoption decision model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (model) return <AdoptionWorkbench model={model} />;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Architecture decision lab"
        title="Load the service-mesh decision model"
        description="The lesson-owned requirements and operating-readiness model is loading."
        icon={Network}
        accent="blue"
      />
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    </LearningLab>
  );
}

function AdoptionWorkbench({ model }: { model: AdoptionModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [readinessId, setReadinessId] = useState(model.defaults.readinessId);

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const readiness = model.readiness.find((item) => item.id === readinessId)
    ?? model.readiness[0];

  const result = useMemo(() => {
    const required = new Set(scenario.requiredCapabilities);
    const evaluated = model.approaches.map((approach) => {
      const covered = scenario.requiredCapabilities.filter((id) => (
        approach.capabilities.includes(id)
      ));
      const gaps = scenario.requiredCapabilities.filter((id) => (
        !approach.capabilities.includes(id)
      ));
      const coverage = Math.round((covered.length / required.size) * 100);
      const ready = readiness.level >= approach.minimumReadiness;

      return { approach, covered, coverage, gaps, ready };
    });
    const recommended = evaluated.find((item) => item.gaps.length === 0 && item.ready);
    const technicalFit = evaluated.find((item) => item.gaps.length === 0);
    const bestCoverage = Math.max(...evaluated.map((item) => item.coverage));

    if (recommended) {
      return {
        evaluated,
        bestCoverage,
        recommendation: recommended,
        tone: recommended.approach.isMesh ? 'blue' as const : 'emerald' as const,
        title: `${recommended.approach.label} is the smallest ready fit`,
        detail: recommended.approach.isMesh
          ? 'The selected requirement needs mesh-level controls and the operating owner can support a bounded pilot.'
          : 'The selected requirement is covered without putting a service mesh on the internal request path.',
      };
    }

    if (technicalFit) {
      return {
        evaluated,
        bestCoverage,
        recommendation: technicalFit,
        tone: 'amber' as const,
        title: 'The requirement fits, but the operating model is not ready',
        detail: `${technicalFit.approach.label} covers the controls, but it requires readiness level ${technicalFit.approach.minimumReadiness}. Build ownership or narrow the scope before rollout.`,
      };
    }

    return {
      evaluated,
      bestCoverage,
      recommendation: null,
      tone: 'rose' as const,
      title: 'No modeled approach covers the complete requirement',
      detail: 'Split the requirement, add a supported platform capability, or revisit the architecture before choosing a product.',
    };
  }, [model.approaches, readiness.level, scenario.requiredCapabilities]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setReadinessId(model.defaults.readinessId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Architecture decision lab"
        title={model.title}
        description={model.description}
        icon={Network}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Primary requirement
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={scenarioIcon(item.id)}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Operating owner
              </legend>
              <div className="mt-3 grid gap-2">
                {model.readiness.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === readiness.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.level >= 2 ? Users : Wrench}
                    accent={item.level >= 2 ? 'emerald' : 'amber'}
                    onClick={() => setReadinessId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Required controls"
              value={`${scenario.requiredCapabilities.length}`}
              detail="Every listed control is treated as a hard requirement."
              icon={Layers3}
              tone="blue"
            />
            <LabMetric
              label="Best coverage"
              value={`${result.bestCoverage}%`}
              detail="Capability coverage before operating readiness is applied."
              icon={Gauge}
              tone={result.bestCoverage === 100 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Readiness level"
              value={`${readiness.level}`}
              detail={readiness.label}
              icon={Users}
              tone={readiness.level >= 2 ? 'emerald' : 'amber'}
            />
          </div>

          <div className={`mt-5 rounded-md border p-5 ${resultTone(result.tone)}`}>
            <div className="flex items-start gap-3">
              {result.tone === 'emerald' || result.tone === 'blue' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : result.tone === 'amber' ? (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <h4 className="font-semibold">{result.title}</h4>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <Route aria-hidden="true" className="h-4 w-4 text-neutral-500" />
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Capability comparison
              </h4>
            </div>
            <div className="mt-3 grid gap-3">
              {result.evaluated.map((item) => (
                <ApproachResult
                  key={item.approach.id}
                  item={item}
                  capabilities={model.capabilities}
                  recommended={result.recommendation?.approach.id === item.approach.id}
                  recommendationReady={result.recommendation?.ready ?? false}
                />
              ))}
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ApproachResult({
  item,
  capabilities,
  recommended,
  recommendationReady,
}: {
  item: {
    approach: Approach;
    covered: string[];
    coverage: number;
    gaps: string[];
    ready: boolean;
  };
  capabilities: Capability[];
  recommended: boolean;
  recommendationReady: boolean;
}) {
  const capabilityById = new Map(capabilities.map((capability) => (
    [capability.id, capability]
  )));
  const complete = item.gaps.length === 0;

  return (
    <article
      className={`rounded-md border p-4 ${
        recommended
          ? 'border-blue-400 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
              {item.approach.label}
            </h5>
            {recommended ? (
              <span className="rounded-sm bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                {recommendationReady ? 'Current fit' : 'Technical fit'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {item.approach.detail}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
          {item.coverage}% covered
        </span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={`${item.approach.label} capability coverage`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={item.coverage}
      >
        <div
          className={`h-full ${complete ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${item.coverage}%` }}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <StatusLine
          pass={complete}
          label={complete
            ? 'Covers every selected control'
            : `${item.gaps.length} capability gap${item.gaps.length === 1 ? '' : 's'}`}
        />
        <StatusLine
          pass={item.ready}
          label={item.ready
            ? 'Operating owner meets the model'
            : `Needs readiness level ${item.approach.minimumReadiness}`}
        />
      </div>

      {item.gaps.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
            Missing controls
          </p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-neutral-700 dark:text-neutral-300">
            {item.gaps.map((id) => (
              <li key={id} className="flex items-start gap-2">
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                />
                <span>
                  <span className="font-semibold">{capabilityById.get(id)?.label ?? id}:</span>{' '}
                  {capabilityById.get(id)?.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Operating shape: {item.approach.operatingShape}
      </p>
    </article>
  );
}

function StatusLine({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
      {pass ? (
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600" />
      )}
      <span>{label}</span>
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
    <LearningLabBody>
      {error ? (
        <div
          className="rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">The decision model could not be loaded</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Wrench aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="grid min-h-64 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-center dark:border-neutral-800 dark:bg-neutral-900"
          role="status"
        >
          <div>
            <Network
              aria-hidden="true"
              className="mx-auto h-8 w-8 animate-pulse text-blue-500"
            />
            <p className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              Loading decision model
            </p>
          </div>
        </div>
      )}
    </LearningLabBody>
  );
}

function scenarioIcon(id: string) {
  if (id === 'public-edge') return Route;
  if (id === 'shared-resilience') return Gauge;
  if (id === 'internal-identity') return ShieldCheck;
  return Layers3;
}

function resultTone(tone: 'blue' | 'emerald' | 'amber' | 'rose') {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  };

  return tones[tone];
}
