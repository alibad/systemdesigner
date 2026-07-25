'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Scale,
  Sparkles,
} from 'lucide-react';

import {
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'reference/ml-framework-selector';
const DEFAULT_DATA_FILE = '/api/content/reference/ml-frameworks-comparison/data/framework-selection-model.json';

type CriterionOption = {
  id: string;
  label: string;
  detail: string;
};

type Criterion = {
  id: string;
  label: string;
  options: CriterionOption[];
};

type Framework = {
  id: string;
  label: string;
  artifactBoundary: string;
  evidence: string;
  scores: Record<string, Record<string, number>>;
};

type SelectionModel = {
  title: string;
  description: string;
  scoringNote: string;
  defaults: Record<string, string>;
  criteria: Criterion[];
  frameworks: Framework[];
};

function isSelectionModel(value: unknown): value is SelectionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SelectionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.scoringNote
      && candidate.defaults
      && Array.isArray(candidate.criteria)
      && candidate.criteria.length >= 3
      && candidate.criteria.every((criterion) => (
        criterion.id
        && criterion.label
        && Array.isArray(criterion.options)
        && criterion.options.length >= 2
        && criterion.options.every((option) => option.id && option.label && option.detail)
      ))
      && Array.isArray(candidate.frameworks)
      && candidate.frameworks.length === 3
      && candidate.frameworks.every((framework) => (
        framework.id
        && framework.label
        && framework.artifactBoundary
        && framework.evidence
        && framework.scores
      )),
  );
}

export default function MlFrameworkSelector({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SelectionModel | null>(null);
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
        if (!isSelectionModel(payload)) throw new Error('The framework selection model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Framework decision lab"
            title="Shortlist from explicit constraints"
            description="Loading the lesson-owned scoring evidence."
            icon={Scale}
            accent="blue"
          />
          <LearningLabBody>
            <div className="flex min-h-40 items-center justify-center text-center">
              {error ? (
                <div>
                  <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Loading decision evidence</span>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return <FrameworkSelectionWorkbench model={model} />;
}

function FrameworkSelectionWorkbench({ model }: { model: SelectionModel }) {
  const [selections, setSelections] = useState<Record<string, string>>(model.defaults);

  const results = useMemo(() => {
    return model.frameworks
      .map((framework) => {
        const contributions = model.criteria.map((criterion) => ({
          criterion: criterion.label,
          score: framework.scores[criterion.id]?.[selections[criterion.id]] ?? 0,
        }));
        return {
          ...framework,
          contributions,
          score: contributions.reduce((sum, item) => sum + item.score, 0),
        };
      })
      .sort((left, right) => right.score - left.score);
  }, [model, selections]);

  const maximum = model.criteria.length * 3;
  const winner = results[0];
  const tie = results.length > 1 && results[1].score === winner.score;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Framework decision lab"
          title={model.title}
          description={model.description}
          icon={Scale}
          accent="blue"
          onReset={() => setSelections(model.defaults)}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-5">
              {model.criteria.map((criterion) => (
                <label key={criterion.id} className="block">
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {criterion.label}
                  </span>
                  <select
                    value={selections[criterion.id]}
                    onChange={(event) => setSelections((current) => ({
                      ...current,
                      [criterion.id]: event.target.value,
                    }))}
                    className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {criterion.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {criterion.options.find((option) => option.id === selections[criterion.id])?.detail}
                  </span>
                </label>
              ))}
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Leading shortlist"
              value={tie ? 'Benchmark tie' : winner.label}
              detail={tie ? `${winner.label} and ${results[1].label} share the top score` : `${winner.score} of ${maximum} transparent suitability points`}
              icon={Sparkles}
              tone="blue"
            />
            <LabMetric
              label="Decision inputs"
              value={`${model.criteria.length}`}
              detail="Each contributes zero to three points"
              icon={Boxes}
              tone="violet"
            />
            <LabMetric
              label="Required next step"
              value="Representative test"
              detail="Scores shortlist; measured evidence decides"
              icon={Gauge}
              tone="emerald"
            />
          </div>

          <div className="mt-6 grid gap-4">
            {results.map((framework, index) => (
              <article
                key={framework.id}
                className={`rounded-md border p-4 ${
                  index === 0
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-950 dark:text-white">{framework.label}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{framework.evidence}</p>
                  </div>
                  <span className="rounded-sm bg-neutral-950 px-2.5 py-1 text-sm font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-950">
                    {framework.score} / {maximum}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full bg-blue-500 transition-[width] duration-300"
                    style={{ width: `${(framework.score / maximum) * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {framework.contributions.map((item) => (
                    <span key={item.criterion} className="rounded-sm border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                      {item.criterion}: <strong>{item.score}</strong>
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  <strong>Artifact boundary:</strong> {framework.artifactBoundary}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50">
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Use the ranking to choose what to benchmark, not what to buy.</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{model.scoringNote}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
