'use client';

import { useEffect, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  KeyRound,
  Layers3,
  LoaderCircle,
  Network,
  Route,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ModelId = 'key-value' | 'document' | 'graph';
type Fit = 'best' | 'workable' | 'weak';

type AccessModel = {
  id: ModelId;
  label: string;
  detail: string;
};

type ModelOutcome = {
  fit: Fit;
  headline: string;
  explanation: string;
  path: string[];
  indexPlan: string;
  tradeoff: string;
};

type QueryShape = {
  id: string;
  label: string;
  prompt: string;
  requestShape: string[];
  recommendedModelId: ModelId;
  outcomes: Record<ModelId, ModelOutcome>;
};

type ModelingData = {
  title: string;
  description: string;
  defaultQueryId: string;
  models: AccessModel[];
  queryShapes: QueryShape[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/arangodb/data/modeling-query-shapes.json';

const modelMeta: Record<
  ModelId,
  {
    icon: LucideIcon;
    accent: 'blue' | 'violet' | 'emerald';
    eyebrow: string;
  }
> = {
  'key-value': {
    icon: KeyRound,
    accent: 'blue',
    eyebrow: 'Primary-key path',
  },
  document: {
    icon: Braces,
    accent: 'violet',
    eyebrow: 'Attribute query',
  },
  graph: {
    icon: Network,
    accent: 'emerald',
    eyebrow: 'Relationship path',
  },
};

const fitMeta: Record<
  Fit,
  {
    label: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  best: {
    label: 'Natural fit',
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-50',
  },
  workable: {
    label: 'Workable with a cost',
    icon: CircleAlert,
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-50',
  },
  weak: {
    label: 'Query-model mismatch',
    icon: TriangleAlert,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-50',
  },
};

const modelIds: ModelId[] = ['key-value', 'document', 'graph'];
const fitValues: Fit[] = ['best', 'workable', 'weak'];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isModelingData(value: unknown): value is ModelingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ModelingData>;

  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultQueryId !== 'string'
    || !Array.isArray(candidate.models)
    || !Array.isArray(candidate.queryShapes)
    || candidate.models.length !== modelIds.length
    || candidate.queryShapes.length < 3
  ) {
    return false;
  }

  const seenModelIds = new Set<ModelId>();
  const modelsValid = candidate.models.every((model) => {
    if (
      !model
      || !modelIds.includes(model.id)
      || typeof model.label !== 'string'
      || typeof model.detail !== 'string'
    ) {
      return false;
    }
    seenModelIds.add(model.id);
    return true;
  });

  if (!modelsValid || seenModelIds.size !== modelIds.length) return false;

  const queryIds = new Set<string>();
  const queriesValid = candidate.queryShapes.every((query) => {
    if (
      !query
      || typeof query.id !== 'string'
      || typeof query.label !== 'string'
      || typeof query.prompt !== 'string'
      || !isStringArray(query.requestShape)
      || query.requestShape.length < 2
      || !modelIds.includes(query.recommendedModelId)
      || !query.outcomes
      || typeof query.outcomes !== 'object'
    ) {
      return false;
    }

    queryIds.add(query.id);

    return modelIds.every((modelId) => {
      const outcome = query.outcomes[modelId];
      return Boolean(
        outcome
        && fitValues.includes(outcome.fit)
        && typeof outcome.headline === 'string'
        && typeof outcome.explanation === 'string'
        && isStringArray(outcome.path)
        && outcome.path.length === 3
        && typeof outcome.indexPlan === 'string'
        && typeof outcome.tradeoff === 'string',
      );
    });
  });

  return (
    queriesValid
    && queryIds.size === candidate.queryShapes.length
    && queryIds.has(candidate.defaultQueryId)
  );
}

export default function ArangoDBModelingQueryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ModelingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isModelingData(payload)) {
          throw new Error('The ArangoDB query-shape model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the ArangoDB query-shape model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Query-shape decision lab"
          title="Choose an access path before choosing a model"
          description="Loading the document, graph, and key-value decision model."
          icon={Layers3}
          accent="violet"
        />
        <div className="flex min-h-44 items-center justify-center p-6">
          {error ? (
            <div className="max-w-lg text-center">
              <TriangleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
              />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                The decision model could not be loaded.
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 min-h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
              Loading query shapes
            </div>
          )}
        </div>
      </LearningLab>
    );
  }

  return <ModelingWorkbench data={data} />;
}

function ModelingWorkbench({ data }: { data: ModelingData }) {
  const defaultQuery =
    data.queryShapes.find((query) => query.id === data.defaultQueryId)
    ?? data.queryShapes[0];
  const [queryId, setQueryId] = useState(defaultQuery.id);
  const [modelId, setModelId] = useState<ModelId>(defaultQuery.recommendedModelId);

  const query =
    data.queryShapes.find((candidate) => candidate.id === queryId) ?? defaultQuery;
  const model =
    data.models.find((candidate) => candidate.id === modelId) ?? data.models[0];
  const outcome = query.outcomes[model.id];
  const selectedModelMeta = modelMeta[model.id];
  const selectedFitMeta = fitMeta[outcome.fit];
  const FitIcon = selectedFitMeta.icon;
  const ModelIcon = selectedModelMeta.icon;

  function selectQuery(nextQueryId: string) {
    const nextQuery =
      data.queryShapes.find((candidate) => candidate.id === nextQueryId)
      ?? defaultQuery;
    setQueryId(nextQuery.id);
    setModelId(nextQuery.recommendedModelId);
  }

  function reset() {
    setQueryId(defaultQuery.id);
    setModelId(defaultQuery.recommendedModelId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Query-shape decision lab"
        title={data.title}
        description={data.description}
        icon={Layers3}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <div>
              <label
                htmlFor="arangodb-query-shape"
                className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"
              >
                Application query
              </label>
              <select
                id="arangodb-query-shape"
                value={query.id}
                onChange={(event) => selectQuery(event.target.value)}
                className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {data.queryShapes.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {query.prompt}
              </p>
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Required shape
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                {query.requestShape.map((requirement) => (
                  <li key={requirement} className="flex items-start gap-2">
                    <Route
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                    />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Model the dominant operation as
              </legend>
              <div className="mt-3 space-y-2">
                {data.models.map((candidate) => {
                  const meta = modelMeta[candidate.id];
                  return (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === model.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={meta.icon}
                      accent={meta.accent}
                      onClick={() => setModelId(candidate.id)}
                    />
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5" aria-live="polite">
          <section className={`rounded-md border p-5 ${selectedFitMeta.className}`}>
            <div className="flex items-start gap-3">
              <FitIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  {selectedFitMeta.label}
                </p>
                <h4 className="mt-1 text-xl font-semibold">{outcome.headline}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {outcome.explanation}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <ModelIcon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  {selectedModelMeta.eyebrow}
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Trace the selected access path
                </h4>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {outcome.path.map((step, index) => (
                <div key={step} className="relative min-w-0">
                  <div className="h-full rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <p className="mt-3 break-words text-sm font-semibold leading-6 text-neutral-900 dark:text-neutral-100">
                      {step}
                    </p>
                  </div>
                  {index < outcome.path.length - 1 ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-neutral-50 text-neutral-400 sm:block dark:bg-neutral-900"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
              <div className="flex items-center gap-2">
                <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0" />
                <h4 className="text-sm font-semibold">Index and lookup contract</h4>
              </div>
              <p className="mt-2 text-sm leading-6 opacity-85">{outcome.indexPlan}</p>
            </section>
            <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
              <div className="flex items-center gap-2">
                <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                <h4 className="text-sm font-semibold">Cost this choice introduces</h4>
              </div>
              <p className="mt-2 text-sm leading-6 opacity-85">{outcome.tradeoff}</p>
            </section>
          </div>

          <p className="border-l-4 border-violet-500 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950 dark:bg-violet-950/35 dark:text-violet-100">
            These are access paths inside one ArangoDB engine. Choosing “key-value,”
            “document,” or “graph” here does not create three independent databases; it
            changes the collections, indexes, edges, and AQL work needed for this query.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
