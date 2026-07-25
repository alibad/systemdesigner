'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  FileText,
  Gauge,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Capability = 'fullText' | 'phrase' | 'exact' | 'range' | 'sort' | 'retrieve';

type FieldScenario = {
  id: string;
  label: string;
  detail: string;
  field: string;
  sample: string;
  requirements: Capability[];
  analyzedTerms: string[];
  recommendedRecipeId: string;
};

type Structure = {
  id: string;
  label: string;
  role: string;
};

type FieldRecipe = {
  id: string;
  label: string;
  detail: string;
  api: string[];
  analysis: string;
  capabilities: Capability[];
  structures: Structure[];
};

type FieldDesignModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    recipeId: string;
  };
  capabilityLabels: Record<Capability, string>;
  scenarios: FieldScenario[];
  recipes: FieldRecipe[];
};

const BLOCK_ID = 'technology/lucene-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/lucene/data/index-field-design.json';

function isFieldDesignModel(value: unknown): value is FieldDesignModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FieldDesignModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.recipeId
      && candidate.capabilityLabels
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.field === 'string'
        && Array.isArray(scenario.requirements)
        && scenario.requirements.length > 0
        && Array.isArray(scenario.analyzedTerms)
      ))
      && Array.isArray(candidate.recipes)
      && candidate.recipes.length >= 3
      && candidate.recipes.every((recipe) => (
        typeof recipe.id === 'string'
        && Array.isArray(recipe.api)
        && Array.isArray(recipe.capabilities)
        && Array.isArray(recipe.structures)
        && recipe.structures.length > 0
      )),
  );
}

export default function LucenePerformanceCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FieldDesignModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFieldDesignModel(payload)) throw new Error('The Lucene field-design model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the field-design model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <FieldDesignWorkbench data={data} />;
}

function FieldDesignWorkbench({ data }: { data: FieldDesignModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [recipeId, setRecipeId] = useState(data.defaults.recipeId);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const recipe = data.recipes.find((item) => item.id === recipeId) ?? data.recipes[0];

  const result = useMemo(() => {
    const supported = scenario.requirements.filter((item) => recipe.capabilities.includes(item));
    const missing = scenario.requirements.filter((item) => !recipe.capabilities.includes(item));
    const recommended = scenario.recommendedRecipeId === recipe.id;

    if (missing.length > 0) {
      return {
        detail: `${missing.map((item) => data.capabilityLabels[item]).join(', ')} ${missing.length === 1 ? 'is' : 'are'} absent. The query layer cannot recover a structure that was never indexed.`,
        missing,
        recommended,
        supported,
        tone: 'rose' as const,
        verdict: 'This field recipe cannot satisfy the retrieval contract',
      };
    }

    if (!recommended) {
      const recommendedLabel = data.recipes.find((item) => item.id === scenario.recommendedRecipeId)?.label;
      return {
        detail: `The required queries work, but ${recommendedLabel ?? 'the recommended recipe'} expresses this contract more directly. Keep extra structures only when a measured product requirement needs them.`,
        missing,
        recommended,
        supported,
        tone: 'amber' as const,
        verdict: 'The contract works, with an avoidable index path',
      };
    }

    return {
      detail: 'Every required behavior has an explicit index-time structure. Test the analyzer and representative queries before releasing the schema.',
      missing,
      recommended,
      supported,
      tone: 'emerald' as const,
      verdict: 'The field and query contracts align',
    };
  }, [data.capabilityLabels, data.recipes, recipe, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setRecipeId(data.defaults.recipeId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Index design lab"
          title={data.title}
          description={data.description}
          icon={Database}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product question
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileText}
                      accent="blue"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate field recipe
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.recipes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === recipe.id}
                      label={item.label}
                      detail={item.detail}
                      icon={SlidersHorizontal}
                      accent="violet"
                      onClick={() => setRecipeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Contract coverage"
                value={`${result.supported.length} / ${scenario.requirements.length}`}
                detail="Required retrieval behaviors supported"
                icon={CheckCircle2}
                tone={result.missing.length ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Physical paths"
                value={`${recipe.structures.length}`}
                detail="Distinct index structures requested"
                icon={Database}
                tone={recipe.structures.length > 2 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Analysis"
                value={recipe.analysis}
                detail="How text becomes indexed terms"
                icon={Braces}
                tone="violet"
              />
              <LabMetric
                label="Schema decision"
                value={result.missing.length ? 'Change' : result.recommended ? 'Keep' : 'Review'}
                detail="A field-type correction requires reindexing documents"
                icon={Gauge}
                tone={result.missing.length ? 'rose' : result.recommended ? 'emerald' : 'amber'}
              />
            </div>

            <section className={`rounded-md border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                : result.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Index-time trace</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1fr)_auto_minmax(0,1.4fr)] md:items-stretch">
                <TraceCard icon={FileText} title={scenario.field} tone="blue">
                  <code className="break-words text-xs">{scenario.sample}</code>
                </TraceCard>
                <FlowArrow />
                <TraceCard icon={Braces} title={recipe.analysis} tone="violet">
                  {scenario.analyzedTerms.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {scenario.analyzedTerms.map((term) => (
                        <code key={term} className="rounded bg-white/70 px-1.5 py-0.5 text-xs dark:bg-neutral-950/60">{term}</code>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs">No token stream</span>
                  )}
                </TraceCard>
                <FlowArrow />
                <div className="grid min-w-0 gap-2">
                  {recipe.structures.map((structure) => (
                    <div key={structure.id} className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
                      <p className="text-sm font-semibold">{structure.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-75">{structure.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Required behaviors</p>
                <ul className="mt-3 space-y-2">
                  {scenario.requirements.map((capability) => {
                    const supported = recipe.capabilities.includes(capability);
                    return (
                      <li key={capability} className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                        {supported ? (
                          <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                        )}
                        <span>{data.capabilityLabels[capability]}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Lucene field API</p>
                <div className="mt-3 space-y-2">
                  {recipe.api.map((line) => (
                    <code key={line} className="block overflow-x-auto rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                      {line}
                    </code>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TraceCard({
  children,
  icon: Icon,
  title,
  tone,
}: {
  children: ReactNode;
  icon: typeof Search;
  title: string;
  tone: 'blue' | 'violet';
}) {
  const shell = tone === 'blue'
    ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
    : 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100';
  return (
    <div className={`min-w-0 rounded-md border p-4 ${shell}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="break-words text-sm font-semibold">{title}</p>
      </div>
      <div className="mt-3 min-w-0 text-sm leading-6 opacity-80">{children}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <div data-content-block={BLOCK_ID} className="my-7 min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">The index-design lab could not be loaded.</p>
        <p className="mt-2 leading-6 opacity-80">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div data-content-block={BLOCK_ID} className="my-7 min-h-[620px] animate-pulse rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading Lucene index-design lab" />
  );
}
