'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Scale,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type GoldLabel = 'harmful' | 'legitimate';

type Candidate = {
  id: string;
  label: string;
  detail: string;
};

type Observation = {
  id: string;
  label: string;
  gold: GoldLabel;
  slice: string;
  weight: number;
  scores: Record<string, number>;
};

type ThresholdData = {
  defaultModelId: string;
  defaultThresholdPct: number;
  defaultDailyItems: number;
  reviewCapacityPerDay: number;
  gates: {
    minimumHarmRecallPct: number;
    maximumLegitimateFprPct: number;
    maximumWorstSliceMissPct: number;
  };
  models: Candidate[];
  observations: Observation[];
};

const BLOCK_ID = 'genai/toxigen-hatecheck-evaluation-threshold-slice-lab';
const DEFAULT_DATA_FILE =
  '/api/content/genai/toxigen-hatecheck-evaluation/data/threshold-slice-evidence.json';

function isThresholdData(value: unknown): value is ThresholdData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ThresholdData>;
  return typeof candidate.defaultModelId === 'string'
    && typeof candidate.defaultThresholdPct === 'number'
    && typeof candidate.defaultDailyItems === 'number'
    && typeof candidate.reviewCapacityPerDay === 'number'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.models)
    && candidate.models.length > 0
    && Array.isArray(candidate.observations)
    && candidate.observations.length > 0;
}

const percent = (value: number) => `${value.toFixed(1)}%`;

export default function ToxigenHatecheckEvaluationThresholdSliceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ThresholdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modelId, setModelId] = useState('');
  const [thresholdPct, setThresholdPct] = useState(58);
  const [dailyItems, setDailyItems] = useState(20_000);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isThresholdData(payload)) throw new Error('Threshold evidence is incomplete.');
        if (!active) return;
        setData(payload);
        setModelId(payload.defaultModelId);
        setThresholdPct(payload.defaultThresholdPct);
        setDailyItems(payload.defaultDailyItems);
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load threshold evidence.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const candidate = data?.models.find((item) => item.id === modelId) ?? data?.models[0];

  const result = useMemo(() => {
    if (!data || !candidate) return null;

    let truePositive = 0;
    let falsePositive = 0;
    let trueNegative = 0;
    let falseNegative = 0;
    const harmfulBySlice = new Map<string, { total: number; missed: number }>();

    const scored = data.observations.map((observation) => {
      const score = observation.scores[candidate.id];
      const predictedHarmful = score >= thresholdPct;
      if (observation.gold === 'harmful') {
        const slice = harmfulBySlice.get(observation.slice) ?? { total: 0, missed: 0 };
        slice.total += observation.weight;
        if (predictedHarmful) truePositive += observation.weight;
        else {
          falseNegative += observation.weight;
          slice.missed += observation.weight;
        }
        harmfulBySlice.set(observation.slice, slice);
      } else if (predictedHarmful) {
        falsePositive += observation.weight;
      } else {
        trueNegative += observation.weight;
      }

      return { ...observation, score, predictedHarmful };
    });

    const harmfulTotal = truePositive + falseNegative;
    const legitimateTotal = falsePositive + trueNegative;
    const total = harmfulTotal + legitimateTotal;
    const harmRecallPct = harmfulTotal ? (truePositive / harmfulTotal) * 100 : 0;
    const legitimateFprPct = legitimateTotal ? (falsePositive / legitimateTotal) * 100 : 0;
    const sliceRates = Array.from(harmfulBySlice.entries()).map(([slice, counts]) => ({
      slice,
      missPct: counts.total ? (counts.missed / counts.total) * 100 : 0,
    }));
    const worstSlice = sliceRates.reduce(
      (worst, item) => (item.missPct > worst.missPct ? item : worst),
      sliceRates[0] ?? { slice: 'No harmful slice', missPct: 0 },
    );
    const flaggedRate = total ? (truePositive + falsePositive) / total : 0;
    const flaggedDaily = Math.round(dailyItems * flaggedRate);

    const blockers = [
      harmRecallPct < data.gates.minimumHarmRecallPct
        ? `Harm recall is below ${data.gates.minimumHarmRecallPct}%.`
        : null,
      legitimateFprPct > data.gates.maximumLegitimateFprPct
        ? `Legitimate false positives exceed ${data.gates.maximumLegitimateFprPct}%.`
        : null,
      worstSlice.missPct > data.gates.maximumWorstSliceMissPct
        ? `${worstSlice.slice} misses exceed ${data.gates.maximumWorstSliceMissPct}%.`
        : null,
      flaggedDaily > data.reviewCapacityPerDay
        ? `Review demand exceeds capacity by ${(flaggedDaily - data.reviewCapacityPerDay).toLocaleString()} items per day.`
        : null,
    ].filter(Boolean) as string[];

    return {
      blockers,
      flaggedDaily,
      falseNegative,
      falsePositive,
      harmRecallPct,
      legitimateFprPct,
      scored,
      trueNegative,
      truePositive,
      worstSlice,
    };
  }, [candidate, dailyItems, data, thresholdPct]);

  function reset() {
    if (!data) return;
    setModelId(data.defaultModelId);
    setThresholdPct(data.defaultThresholdPct);
    setDailyItems(data.defaultDailyItems);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Threshold and slice lab"
          title="Move the threshold and watch both errors move"
          description="Choose a synthetic candidate, set its operating threshold, and scale daily traffic. The release decision checks harm, legitimate use, worst-slice behavior, and reviewer capacity separately."
          icon={Scale}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((current) => current + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Choose a candidate
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.models.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={option.id === candidate.id}
                        label={option.label}
                        detail={option.detail}
                        icon={Layers3}
                        accent={option.id === 'contextual-v2' ? 'blue' : option.id === 'safety-heavy-v3' ? 'rose' : 'amber'}
                        onClick={() => setModelId(option.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Harmful decision threshold"
                  value={thresholdPct}
                  output={`${thresholdPct}%`}
                  min={30}
                  max={90}
                  step={2}
                  lowLabel="Catch more"
                  highLabel="Flag less"
                  accent="rose"
                  onChange={setThresholdPct}
                />

                <LabRange
                  label="Daily items"
                  value={dailyItems}
                  output={dailyItems.toLocaleString()}
                  min={5_000}
                  max={50_000}
                  step={5_000}
                  lowLabel="5K"
                  highLabel="50K"
                  accent="blue"
                  onChange={setDailyItems}
                />

                <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="font-semibold text-neutral-950 dark:text-white">Frozen release gates</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    <li>Recall at least {data.gates.minimumHarmRecallPct}%</li>
                    <li>Legitimate FPR at most {data.gates.maximumLegitimateFprPct}%</li>
                    <li>Worst-slice misses at most {data.gates.maximumWorstSliceMissPct}%</li>
                    <li>Review capacity {data.reviewCapacityPerDay.toLocaleString()} per day</li>
                  </ul>
                </div>
              </div>
            )}
          >
            <div className="min-w-0">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Harm recall"
                  value={percent(result.harmRecallPct)}
                  detail={`${result.truePositive} detected / ${result.truePositive + result.falseNegative} harmful`}
                  icon={ShieldAlert}
                  tone={result.harmRecallPct >= data.gates.minimumHarmRecallPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Legitimate FPR"
                  value={percent(result.legitimateFprPct)}
                  detail={`${result.falsePositive} overflagged / ${result.falsePositive + result.trueNegative} legitimate`}
                  icon={Gauge}
                  tone={result.legitimateFprPct <= data.gates.maximumLegitimateFprPct ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Worst harm slice"
                  value={percent(result.worstSlice.missPct)}
                  detail={`${result.worstSlice.slice} miss rate`}
                  icon={BarChart3}
                  tone={result.worstSlice.missPct <= data.gates.maximumWorstSliceMissPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Daily review"
                  value={result.flaggedDaily.toLocaleString()}
                  detail={`Capacity ${data.reviewCapacityPerDay.toLocaleString()}`}
                  icon={UsersRound}
                  tone={result.flaggedDaily <= data.reviewCapacityPerDay ? 'blue' : 'amber'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Score landscape</p>
                    <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">Which slices cross {thresholdPct}%?</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Bar length is the synthetic harmful score</p>
                </div>
                <div className="mt-4 space-y-3">
                  {result.scored.map((observation) => (
                    <ScoreRow key={observation.id} observation={observation} threshold={thresholdPct} />
                  ))}
                </div>
              </section>

              <section
                className={`mt-5 rounded-md border p-5 ${
                  result.blockers.length === 0
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {result.blockers.length === 0 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-neutral-950 dark:text-white">
                      {result.blockers.length === 0 ? 'Eligible for a monitored canary' : 'Hold the user-visible rollout'}
                    </h4>
                    {result.blockers.length === 0 ? (
                      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        All declared teaching gates pass. Confirm the operating point on independent product evidence before exposing users.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                      </ul>
                    )}
                    <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Synthetic teaching evidence. Counts are weighted observations, not ToxiGen or HateCheck leaderboard results.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function ScoreRow({
  observation,
  threshold,
}: {
  observation: Observation & { score: number; predictedHarmful: boolean };
  threshold: number;
}) {
  const correct = observation.predictedHarmful === (observation.gold === 'harmful');
  return (
    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(150px,0.9fr)_minmax(180px,1.4fr)_92px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{observation.label}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{observation.slice} · n={observation.weight}</p>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${observation.gold === 'harmful' ? 'bg-rose-500' : 'bg-blue-500'}`}
          style={{ width: `${observation.score}%` }}
        />
        <span className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white" style={{ left: `${threshold}%` }} />
      </div>
      <span className={`text-xs font-semibold ${correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
        {observation.score}% · {correct ? 'correct' : 'error'}
      </span>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-64 p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Threshold evidence could not be loaded</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400" aria-label="Loading threshold and slice lab">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> Loading threshold evidence
        </div>
      )}
    </div>
  );
}
