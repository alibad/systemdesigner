'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calculator,
  CircleAlert,
  Gauge,
  Layers3,
  RefreshCw,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Aggregation = 'arithmetic' | 'geometric' | 'worst-case';
type Direction = 'higher' | 'lower';

type Task = {
  id: string;
  label: string;
  detail: string;
  rawLabel: string;
  unit: string;
  direction: Direction;
  baseline: number;
  reference: number;
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  rawScores: Record<string, number>;
};

type WeightPreset = {
  id: string;
  label: string;
  detail: string;
  weights: Record<string, number>;
};

type RankingData = {
  kind: 'composite-normalization-ranking';
  blockId: string;
  teachingDataNotice: string;
  defaultPresetId: string;
  defaultAggregation: Aggregation;
  sensitivityStep: number;
  tasks: Task[];
  candidates: Candidate[];
  presets: WeightPreset[];
};

type RankedCandidate = Candidate & {
  score: number;
  normalizedScores: Record<string, number>;
};

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/composite-benchmarks/data/normalization-ranking-model.json';

const aggregationChoices: Array<{
  id: Aggregation;
  label: string;
  detail: string;
}> = [
  {
    id: 'arithmetic',
    label: 'Arithmetic mean',
    detail: 'Allows a strong component to compensate for a weak one.',
  },
  {
    id: 'geometric',
    label: 'Geometric mean',
    detail: 'Penalizes imbalance across positive normalized scores.',
  },
  {
    id: 'worst-case',
    label: 'Worst case',
    detail: 'Uses the weakest component as the summary and ignores weights.',
  },
];

const candidateStyles = [
  {
    bar: 'bg-blue-500 dark:bg-blue-400',
    badge: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
  },
  {
    bar: 'bg-violet-500 dark:bg-violet-400',
    badge: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  },
  {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  },
];

function isNumberRecord(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    );
}

function isRankingData(value: unknown): value is RankingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RankingData>;
  return candidate.kind === 'composite-normalization-ranking'
    && typeof candidate.blockId === 'string'
    && typeof candidate.teachingDataNotice === 'string'
    && typeof candidate.defaultPresetId === 'string'
    && (
      candidate.defaultAggregation === 'arithmetic'
      || candidate.defaultAggregation === 'geometric'
      || candidate.defaultAggregation === 'worst-case'
    )
    && typeof candidate.sensitivityStep === 'number'
    && Array.isArray(candidate.tasks)
    && candidate.tasks.length >= 3
    && candidate.tasks.every(
      (task) => task.direction === 'higher' || task.direction === 'lower',
    )
    && Array.isArray(candidate.candidates)
    && candidate.candidates.length >= 2
    && candidate.candidates.every((item) => isNumberRecord(item.rawScores))
    && Array.isArray(candidate.presets)
    && candidate.presets.length > 0
    && candidate.presets.every((item) => isNumberRecord(item.weights));
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(rawValue: number, task: Task) {
  const denominator = task.direction === 'higher'
    ? task.reference - task.baseline
    : task.baseline - task.reference;
  if (denominator === 0) return 0;
  const numerator = task.direction === 'higher'
    ? rawValue - task.baseline
    : task.baseline - rawValue;
  return clamp((numerator / denominator) * 100);
}

function aggregate(
  candidate: Candidate,
  tasks: Task[],
  normalizedWeights: Record<string, number>,
  aggregation: Aggregation,
) {
  const normalizedScores = Object.fromEntries(
    tasks.map((task) => [
      task.id,
      normalize(candidate.rawScores[task.id] ?? task.baseline, task),
    ]),
  );
  const values = tasks.map((task) => normalizedScores[task.id]);

  let score: number;
  if (aggregation === 'worst-case') {
    score = Math.min(...values);
  } else if (aggregation === 'geometric') {
    score = Math.exp(
      tasks.reduce(
        (sum, task) => (
          sum
          + (normalizedWeights[task.id] ?? 0)
          * Math.log(Math.max(normalizedScores[task.id], 0.001))
        ),
        0,
      ),
    );
  } else {
    score = tasks.reduce(
      (sum, task) => (
        sum + normalizedScores[task.id] * (normalizedWeights[task.id] ?? 0)
      ),
      0,
    );
  }

  return { ...candidate, normalizedScores, score };
}

function rankCandidates(
  data: RankingData,
  weights: Record<string, number>,
  aggregation: Aggregation,
) {
  const totalWeight = data.tasks.reduce(
    (sum, task) => sum + Math.max(0, weights[task.id] ?? 0),
    0,
  );
  const normalizedWeights = Object.fromEntries(
    data.tasks.map((task) => [
      task.id,
      totalWeight > 0 ? Math.max(0, weights[task.id] ?? 0) / totalWeight : 0,
    ]),
  );
  const ranked = data.candidates
    .map((candidate) => aggregate(candidate, data.tasks, normalizedWeights, aggregation))
    .sort((left, right) => right.score - left.score);
  return { normalizedWeights, ranked };
}

function formatScore(value: number) {
  return value.toFixed(1);
}

function formatRaw(value: number, task: Task) {
  return task.unit === '%' ? `${value}%` : `${value.toLocaleString()} ${task.unit}`;
}

export default function CompositeBenchmarksNormalizationRankingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [presetId, setPresetId] = useState('');
  const [aggregation, setAggregation] = useState<Aggregation>('arithmetic');
  const [weights, setWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isRankingData(payload)) throw new Error('Ranking model is incomplete.');
        const preset = payload.presets.find(
          (item) => item.id === payload.defaultPresetId,
        ) ?? payload.presets[0];
        if (active) {
          setData(payload);
          setPresetId(preset.id);
          setAggregation(payload.defaultAggregation);
          setWeights({ ...preset.weights });
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load ranking data.',
          );
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
    const current = rankCandidates(data, weights, aggregation);
    const leader = current.ranked[0];
    const runnerUp = current.ranked[1];
    const probes = data.tasks.flatMap((task) => {
      const currentWeight = weights[task.id] ?? 1;
      return [
        {
          label: `More ${task.label.toLowerCase()}`,
          weights: { ...weights, [task.id]: currentWeight + data.sensitivityStep },
        },
        {
          label: `Less ${task.label.toLowerCase()}`,
          weights: {
            ...weights,
            [task.id]: Math.max(1, currentWeight - data.sensitivityStep),
          },
        },
      ];
    });
    const flips = aggregation === 'worst-case'
      ? []
      : probes.flatMap((probe) => {
        const nextLeader = rankCandidates(data, probe.weights, aggregation).ranked[0];
        return nextLeader.id === leader.id
          ? []
          : [{ label: probe.label, leader: nextLeader.label }];
      });
    return {
      ...current,
      flips,
      leader,
      margin: leader.score - runnerUp.score,
      runnerUp,
    };
  }, [aggregation, data, weights]);

  function selectPreset(preset: WeightPreset) {
    setPresetId(preset.id);
    setWeights({ ...preset.weights });
  }

  function updateWeight(taskId: string, value: number) {
    setPresetId('custom');
    setWeights((current) => ({ ...current, [taskId]: value }));
  }

  function reset() {
    if (!data) return;
    const preset = data.presets.find(
      (item) => item.id === data.defaultPresetId,
    ) ?? data.presets[0];
    setPresetId(preset.id);
    setAggregation(data.defaultAggregation);
    setWeights({ ...preset.weights });
  }

  return (
    <div data-content-block={data?.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Composite score workbench"
          title="Make the ranking policy visible"
          description="Normalize mixed-unit task results, change their influence, and compare three aggregation rules. The candidates never change; only the scoring contract does."
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
                    1. Decision policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.presets.map((preset) => (
                      <LabChoice
                        key={preset.id}
                        selected={preset.id === presetId}
                        label={preset.label}
                        detail={preset.detail}
                        icon={SlidersHorizontal}
                        accent={preset.id === 'speed-and-robustness' ? 'emerald' : 'violet'}
                        onClick={() => selectPreset(preset)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Aggregation rule
                  </legend>
                  <div className="mt-3 space-y-2">
                    {aggregationChoices.map((choice) => (
                      <LabChoice
                        key={choice.id}
                        selected={choice.id === aggregation}
                        label={choice.label}
                        detail={choice.detail}
                        icon={choice.id === 'worst-case' ? ShieldCheck : Calculator}
                        accent={choice.id === 'worst-case' ? 'rose' : 'blue'}
                        onClick={() => setAggregation(choice.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset disabled={aggregation === 'worst-case'}>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Component influence
                  </legend>
                  {aggregation === 'worst-case' ? (
                    <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                      Worst-case scoring uses the minimum normalized component. Weights do not change it.
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-5">
                    {data.tasks.map((task) => (
                      <LabRange
                        key={task.id}
                        label={task.label}
                        value={weights[task.id] ?? 1}
                        output={`${((model.normalizedWeights[task.id] ?? 0) * 100).toFixed(0)}%`}
                        min={1}
                        max={100}
                        step={1}
                        lowLabel="Low influence"
                        highLabel="High influence"
                        accent={task.direction === 'higher' ? 'blue' : 'emerald'}
                        onChange={(value) => updateWeight(task.id, value)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[760px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Current leader"
                  value={model.leader.label}
                  detail={`${aggregationChoices.find((item) => item.id === aggregation)?.label} contract`}
                  icon={BarChart3}
                  tone="violet"
                />
                <LabMetric
                  label="Leader score"
                  value={formatScore(model.leader.score)}
                  detail="Normalized 0-100 teaching scale"
                  icon={Gauge}
                  tone="blue"
                />
                <LabMetric
                  label="Margin"
                  value={`${formatScore(model.margin)} pts`}
                  detail={`Ahead of ${model.runnerUp.label}`}
                  icon={Activity}
                  tone={model.margin < 2.5 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Stress-test flips"
                  value={aggregation === 'worst-case' ? 'N/A' : `${model.flips.length} / 8`}
                  detail={`One weight moved by ${data.sensitivityStep} raw points`}
                  icon={model.flips.length > 0 ? CircleAlert : ShieldCheck}
                  tone={model.flips.length > 0 ? 'rose' : 'emerald'}
                />
              </div>

              <section className="mt-5" aria-labelledby="composite-ranking-title">
                <div className="flex items-start gap-3">
                  <Layers3
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300"
                  />
                  <div>
                    <h4
                      id="composite-ranking-title"
                      className="text-base font-semibold text-neutral-950 dark:text-white"
                    >
                      Ranking under the current contract
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      The scalar orders candidates, but each row keeps the component profile visible.
                    </p>
                  </div>
                </div>

                <ol className="mt-4 grid gap-3 md:grid-cols-3">
                  {model.ranked.map((candidate, index) => (
                    <li
                      key={candidate.id}
                      className={`rounded-md border p-4 ${candidateStyles[index % candidateStyles.length].badge}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase opacity-70">
                            Rank {index + 1}
                          </p>
                          <p className="mt-1 text-lg font-semibold">{candidate.label}</p>
                        </div>
                        <span className="text-2xl font-semibold tabular-nums">
                          {formatScore(candidate.score)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 opacity-75">{candidate.detail}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-6" aria-labelledby="normalization-map-title">
                <div className="flex items-start gap-3">
                  <Gauge
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300"
                  />
                  <div>
                    <h4
                      id="normalization-map-title"
                      className="text-base font-semibold text-neutral-950 dark:text-white"
                    >
                      Raw measurements become comparable components
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      Each task is mapped from its declared baseline to reference. Lower-is-better measurements reverse direction before aggregation.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {data.tasks.map((task) => (
                    <article
                      key={task.id}
                      className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h5 className="font-semibold text-neutral-950 dark:text-white">
                            {task.label}
                          </h5>
                          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                            {task.detail}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                          {task.direction === 'higher' ? (
                            <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {task.direction === 'higher' ? 'Higher is better' : 'Lower is better'}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {model.ranked.map((candidate) => {
                          const originalIndex = data.candidates.findIndex(
                            (item) => item.id === candidate.id,
                          );
                          const normalized = candidate.normalizedScores[task.id];
                          return (
                            <div key={candidate.id}>
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                                  {candidate.label}
                                </span>
                                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                                  {formatRaw(candidate.rawScores[task.id], task)} → {formatScore(normalized)}
                                </span>
                              </div>
                              <div
                                className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                                role="img"
                                aria-label={`${candidate.label} ${task.label}: ${formatScore(normalized)} normalized points`}
                              >
                                <div
                                  className={`h-full rounded-full ${candidateStyles[originalIndex % candidateStyles.length].bar}`}
                                  style={{ width: `${normalized}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                        Baseline {formatRaw(task.baseline, task)} · reference {formatRaw(task.reference, task)} · effective weight {((model.normalizedWeights[task.id] ?? 0) * 100).toFixed(0)}%
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section
                className={`mt-5 rounded-md border p-5 ${
                  model.flips.length > 0
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {model.flips.length > 0 ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                    />
                  ) : (
                    <ShieldCheck
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                    />
                  )}
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">
                      {aggregation === 'worst-case'
                        ? 'Weights cannot change this ordering'
                        : model.flips.length > 0
                          ? 'The ranking is policy-sensitive'
                          : 'The tested weight changes keep the same leader'}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {aggregation === 'worst-case'
                        ? `The weakest normalized component determines every score. ${model.leader.label} has the strongest minimum component under the declared normalization.`
                        : model.flips.length > 0
                          ? `${model.flips.slice(0, 3).map((flip) => `${flip.label} → ${flip.leader}`).join('; ')}. Preserve the component profile and avoid presenting one winner as policy-free.`
                          : `None of the eight one-slider stress tests changes ${model.leader.label}'s lead. This is useful sensitivity evidence, not proof that every reasonable policy agrees.`}
                    </p>
                  </div>
                </div>
              </section>

              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {data.teachingDataNotice}
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
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
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
        <p className="font-semibold">
          {error ? 'The scoring model could not load.' : 'Loading the scoring model…'}
        </p>
        {error ? <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{error}</p> : null}
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
