'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Category = {
  id: string;
  label: string;
  detail: string;
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  scores: Record<string, number>;
};

type WeightPreset = {
  id: string;
  label: string;
  detail: string;
  weights: Record<string, number>;
};

type AggregationData = {
  defaultPresetId: string;
  defaultCriticalFloorPct: number;
  criticalCategoryId: string;
  criticalFloorMinPct: number;
  criticalFloorMaxPct: number;
  categories: Category[];
  candidates: Candidate[];
  presets: WeightPreset[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/composite-benchmarks-mmlu/data/category-aggregation.json';

function isNumberRecord(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every((item) => typeof item === 'number');
}

function isAggregationData(value: unknown): value is AggregationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AggregationData>;
  return typeof candidate.defaultPresetId === 'string'
    && typeof candidate.defaultCriticalFloorPct === 'number'
    && typeof candidate.criticalCategoryId === 'string'
    && Array.isArray(candidate.categories)
    && candidate.categories.length > 0
    && Array.isArray(candidate.candidates)
    && candidate.candidates.length >= 2
    && candidate.candidates.every((item) => isNumberRecord(item.scores))
    && Array.isArray(candidate.presets)
    && candidate.presets.length > 0
    && candidate.presets.every((item) => isNumberRecord(item.weights));
}

function formatPct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export default function CompositeBenchmarksMmluAggregationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AggregationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [presetId, setPresetId] = useState('');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [criticalFloorPct, setCriticalFloorPct] = useState(70);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isAggregationData(payload)) throw new Error('Aggregation data is incomplete.');

        const defaultPreset = payload.presets.find((item) => item.id === payload.defaultPresetId)
          ?? payload.presets[0];
        if (active) {
          setData(payload);
          setPresetId(defaultPreset.id);
          setWeights({ ...defaultPreset.weights });
          setCriticalFloorPct(payload.defaultCriticalFloorPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load aggregation data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const model = useMemo(() => {
    if (!data) return null;
    const totalWeight = data.categories.reduce(
      (total, category) => total + (weights[category.id] ?? 0),
      0,
    );
    if (totalWeight <= 0) return null;

    const normalizedWeights = Object.fromEntries(
      data.categories.map((category) => [
        category.id,
        ((weights[category.id] ?? 0) / totalWeight) * 100,
      ]),
    );
    const candidates = data.candidates.map((candidate) => {
      const weightedScore = data.categories.reduce(
        (total, category) => (
          total + (candidate.scores[category.id] ?? 0) * normalizedWeights[category.id] / 100
        ),
        0,
      );
      const criticalScore = candidate.scores[data.criticalCategoryId] ?? 0;
      return {
        ...candidate,
        weightedScore,
        criticalScore,
        eligible: criticalScore >= criticalFloorPct,
      };
    });

    const aggregateWinner = [...candidates].sort((a, b) => b.weightedScore - a.weightedScore)[0];
    const eligibleCandidates = candidates
      .filter((candidate) => candidate.eligible)
      .sort((a, b) => b.weightedScore - a.weightedScore);
    const releaseWinner = eligibleCandidates[0] ?? null;

    const decision = !releaseWinner
      ? 'Block both candidates'
      : releaseWinner.id === aggregateWinner.id
        ? `${releaseWinner.label} leads and clears the floor`
        : `${aggregateWinner.label} wins the average but fails the floor`;
    const explanation = !releaseWinner
      ? `Neither candidate reaches the ${criticalFloorPct}% professional-domain minimum. Changing weights cannot repair a hard requirement.`
      : releaseWinner.id === aggregateWinner.id
        ? `${releaseWinner.label} is the highest weighted candidate among those eligible for this contract. A canary still needs product and safety evidence.`
        : `${releaseWinner.label} is the only release-eligible choice. The hard floor prevents strengths in other categories from cancelling the professional-domain failure.`;

    return {
      aggregateWinner,
      candidates,
      decision,
      explanation,
      normalizedWeights,
      releaseWinner,
    };
  }, [criticalFloorPct, data, weights]);

  function selectPreset(preset: WeightPreset) {
    setPresetId(preset.id);
    setWeights({ ...preset.weights });
  }

  function updateWeight(categoryId: string, value: number) {
    setPresetId('custom');
    setWeights((current) => ({ ...current, [categoryId]: value }));
  }

  function reset() {
    if (!data) return;
    const defaultPreset = data.presets.find((item) => item.id === data.defaultPresetId)
      ?? data.presets[0];
    setPresetId(defaultPreset.id);
    setWeights({ ...defaultPreset.weights });
    setCriticalFloorPct(data.defaultCriticalFloorPct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Category aggregation lab"
        title="Change the average without changing either model"
        description="Select a weighting contract, tune each category's influence, and set a professional-domain floor. The lab separates the aggregate winner from the release-eligible candidate."
        icon={Scale}
        accent="violet"
        onReset={data ? reset : undefined}
      />

      {!data || !model ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Aggregation contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.presets.map((preset) => (
                    <LabChoice
                      key={preset.id}
                      selected={preset.id === presetId}
                      label={preset.label}
                      detail={preset.detail}
                      icon={Layers3}
                      accent={preset.id === 'product-critical' ? 'amber' : 'violet'}
                      onClick={() => selectPreset(preset)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Category importance
                </legend>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Raw weights normalize automatically. Moving one control changes every category&apos;s final share.
                </p>
                <div className="mt-4 space-y-5">
                  {data.categories.map((category) => (
                    <LabRange
                      key={category.id}
                      label={category.label}
                      value={weights[category.id] ?? 1}
                      output={formatPct(model.normalizedWeights[category.id] ?? 0, 0)}
                      min={1}
                      max={100}
                      step={1}
                      lowLabel="Low influence"
                      highLabel="High influence"
                      accent={category.id === data.criticalCategoryId ? 'amber' : 'blue'}
                      onChange={(value) => updateWeight(category.id, value)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Professional-domain floor"
                value={criticalFloorPct}
                output={formatPct(criticalFloorPct, 0)}
                min={data.criticalFloorMinPct}
                max={data.criticalFloorMaxPct}
                step={1}
                lowLabel="Permissive"
                highLabel="Strict"
                accent="rose"
                onChange={setCriticalFloorPct}
              />
            </div>
          )}
        >
          <div className="min-h-[680px] min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {model.candidates.map((candidate, index) => (
                <LabMetric
                  key={candidate.id}
                  label={`${candidate.label} weighted score`}
                  value={formatPct(candidate.weightedScore)}
                  detail={`${candidate.criticalScore}% professional; ${candidate.eligible ? 'clears' : 'fails'} floor`}
                  icon={Gauge}
                  tone={index === 0 ? 'blue' : 'violet'}
                />
              ))}
              <LabMetric
                label="Aggregate leader"
                value={model.aggregateWinner.label}
                detail="Highest score under the current weights"
                icon={BarChart3}
                tone="amber"
              />
              <LabMetric
                label="Release-eligible leader"
                value={model.releaseWinner?.label ?? 'None'}
                detail={`Must clear the ${criticalFloorPct}% professional floor`}
                icon={model.releaseWinner ? CheckCircle2 : CircleAlert}
                tone={model.releaseWinner ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 min-w-0" aria-label="Category score and contribution comparison">
              <div className="flex items-start gap-3">
                <SlidersHorizontal aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Where the weighted scores come from
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    Each category contributes its score multiplied by the normalized weight shown beside it.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {data.categories.map((category) => (
                  <CategoryComparison
                    key={category.id}
                    category={category}
                    candidates={model.candidates}
                    weightPct={model.normalizedWeights[category.id] ?? 0}
                    critical={category.id === data.criticalCategoryId}
                    floorPct={criticalFloorPct}
                  />
                ))}
              </div>
            </section>

            <div
              className={`mt-5 rounded-md border p-5 ${
                model.releaseWinner
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {model.releaseWinner ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {model.explanation}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Synthetic teaching scores. The category mapping and weighting presets illustrate decision behavior; they are not official MMLU results.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function CategoryComparison({
  category,
  candidates,
  weightPct,
  critical,
  floorPct,
}: {
  category: Category;
  candidates: Array<Candidate & { weightedScore: number; criticalScore: number; eligible: boolean }>;
  weightPct: number;
  critical: boolean;
  floorPct: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{category.label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{category.detail}</p>
        </div>
        <span className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold tabular-nums text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
          {formatPct(weightPct, 0)} weight
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {candidates.map((candidate, index) => {
          const score = candidate.scores[category.id] ?? 0;
          const contribution = score * weightPct / 100;
          const failsFloor = critical && score < floorPct;
          return (
            <div key={candidate.id} className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 break-words font-semibold text-neutral-800 dark:text-neutral-100">
                  {candidate.label}
                </span>
                <span className={failsFloor ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-neutral-600 dark:text-neutral-300'}>
                  {formatPct(score, 0)}
                </span>
              </div>
              <div
                className="relative mt-2 h-5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                role="img"
                aria-label={`${candidate.label} scores ${formatPct(score, 0)} in ${category.label}, contributing ${contribution.toFixed(1)} points to the weighted score.`}
              >
                <div
                  className={`h-full ${failsFloor ? 'bg-rose-500' : index === 0 ? 'bg-blue-500' : 'bg-violet-500'}`}
                  style={{ width: `${score}%` }}
                />
                {critical ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                    style={{ left: `${floorPct}%` }}
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Contribution: {contribution.toFixed(1)} points{failsFloor ? '; below hard floor' : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[460px] place-items-center p-6 text-center">
        {error ? (
          <div className="max-w-md">
            <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Aggregation data could not load</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <div role="status">
            <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Loading category evidence...</p>
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
