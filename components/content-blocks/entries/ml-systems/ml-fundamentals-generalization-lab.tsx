'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  FlaskConical,
  Gauge,
  ScanSearch,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ml-fundamentals/data/generalization-lab.json';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
  default: number;
};

type NoiseLevel = {
  id: string;
  label: string;
  detail: string;
  trainPenalty: number;
  validationPenalty: number;
};

type LabData = {
  title: string;
  description: string;
  complexity: RangeDefinition;
  examples: RangeDefinition;
  shift: RangeDefinition;
  defaultNoise: string;
  noiseLevels: NoiseLevel[];
};

type Scores = {
  train: number;
  validation: number;
  gap: number;
};

function isRange(value: unknown): value is RangeDefinition {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeDefinition>;
  return [range.min, range.max, range.step, range.default].every(
    (item) => typeof item === 'number',
  );
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      isRange(data.complexity) &&
      isRange(data.examples) &&
      isRange(data.shift) &&
      typeof data.defaultNoise === 'string' &&
      Array.isArray(data.noiseLevels) &&
      data.noiseLevels.length > 0,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scoreModel({
  complexity,
  examples,
  shift,
  noise,
}: {
  complexity: number;
  examples: number;
  shift: number;
  noise: NoiseLevel;
}): Scores {
  const sampleBoost = Math.min(0.1, Math.log10(Math.max(1, examples / 200)) * 0.065);
  const train = clamp(
    0.61 + complexity * 0.036 + sampleBoost * 0.25 - noise.trainPenalty,
    0.45,
    0.985,
  );
  const validation = clamp(
    0.54 + complexity * 0.064 - complexity * complexity * 0.005 + sampleBoost -
      noise.validationPenalty -
      (shift / 100) * 0.42,
    0.35,
    0.95,
  );
  return { train, validation, gap: train - validation };
}

function chartPoints(values: number[]) {
  return values
    .map((value, index) => {
      const x = 14 + (index / Math.max(1, values.length - 1)) * 292;
      const y = 110 - ((value - 0.35) / 0.65) * 88;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function MlFundamentalsGeneralizationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complexity, setComplexity] = useState(5);
  const [examples, setExamples] = useState(1000);
  const [shift, setShift] = useState(0);
  const [noiseId, setNoiseId] = useState('medium');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The generalization data does not match the expected format.');
        }
        setData(value);
        setComplexity(value.complexity.default);
        setExamples(value.examples.default);
        setShift(value.shift.default);
        setNoiseId(value.defaultNoise);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const noise = data.noiseLevels.find((item) => item.id === noiseId) ?? data.noiseLevels[0];
    const scores = scoreModel({ complexity, examples, shift, noise });
    const curve = Array.from({ length: data.complexity.max - data.complexity.min + 1 }, (_, index) => {
      const candidateComplexity = data.complexity.min + index;
      return scoreModel({ complexity: candidateComplexity, examples, shift, noise });
    });
    const diagnosis =
      shift >= 25
        ? {
            label: 'Distribution-shift risk',
            explanation: 'The unseen population differs enough that aggregate validation no longer predicts this slice reliably.',
            action: 'Collect or review examples from the shifted slice, then report its metric separately before retraining.',
            tone: 'rose' as const,
          }
        : scores.train < 0.78 && scores.validation < 0.75
          ? {
              label: 'Underfitting',
              explanation: 'Training and unseen quality are both low, so the model has not captured enough useful signal.',
              action: 'Improve features or add capacity gradually; do not tune only against the holdout.',
              tone: 'amber' as const,
            }
          : scores.gap > 0.12
            ? {
                label: 'Overfitting',
                explanation: 'Training quality is much stronger than unseen quality, so extra fit is not transferring.',
                action: 'Try simpler capacity, more representative examples, regularization, or earlier stopping.',
                tone: 'rose' as const,
              }
            : noise.id === 'high' && scores.validation < 0.76
              ? {
                  label: 'Signal-limited',
                  explanation: 'Inconsistent labels cap useful quality even though the train/validation gap is controlled.',
                  action: 'Audit label definitions and disagreement before buying more model capacity.',
                  tone: 'amber' as const,
                }
              : {
                  label: 'Balanced fit',
                  explanation: 'Training and representative unseen quality are both useful without a large gap.',
                  action: 'Test important slices, latency, and failure behavior before a controlled rollout.',
                  tone: 'emerald' as const,
                };
    return { noise, scores, curve, diagnosis };
  }, [complexity, data, examples, noiseId, shift]);

  const reset = () => {
    if (!data) return;
    setComplexity(data.complexity.default);
    setExamples(data.examples.default);
    setShift(data.shift.default);
    setNoiseId(data.defaultNoise);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading generalization lab"
      />
    );
  }

  const currentIndex = complexity - data.complexity.min;
  const currentX = 14 + (currentIndex / Math.max(1, result.curve.length - 1)) * 292;
  const currentTrainY = 110 - ((result.scores.train - 0.35) / 0.65) * 88;
  const currentValidationY = 110 - ((result.scores.validation - 0.35) / 0.65) * 88;

  return (
    <div data-content-block="ml-systems/ml-fundamentals-generalization-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Generalization lab"
          title={data.title}
          description={data.description}
          icon={FlaskConical}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange
                label="Model complexity"
                value={complexity}
                output={`${complexity} / ${data.complexity.max}`}
                min={data.complexity.min}
                max={data.complexity.max}
                step={data.complexity.step}
                accent="violet"
                lowLabel="simple boundary"
                highLabel="high capacity"
                onChange={setComplexity}
              />
              <LabRange
                label="Training examples"
                value={examples}
                output={examples.toLocaleString()}
                min={data.examples.min}
                max={data.examples.max}
                step={data.examples.step}
                accent="cyan"
                lowLabel="small sample"
                highLabel="broader sample"
                onChange={setExamples}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Label quality
                </legend>
                <div className="mt-3 space-y-2">
                  {data.noiseLevels.map((noise) => (
                    <LabChoice
                      key={noise.id}
                      selected={noise.id === result.noise.id}
                      label={noise.label}
                      detail={noise.detail}
                      icon={Sparkles}
                      accent={noise.id === 'high' ? 'rose' : noise.id === 'medium' ? 'amber' : 'emerald'}
                      onClick={() => setNoiseId(noise.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Unseen population shift"
                value={shift}
                output={`${shift}%`}
                min={data.shift.min}
                max={data.shift.max}
                step={data.shift.step}
                accent="rose"
                lowLabel="representative"
                highLabel="different population"
                onChange={setShift}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Current diagnosis
                </p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {result.diagnosis.label}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  result.diagnosis.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : result.diagnosis.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                }`}
              >
                {result.diagnosis.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                )}
                Illustrative evidence model
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Training score"
                value={formatPercent(result.scores.train)}
                detail="Performance on examples used to fit parameters."
                icon={Activity}
                tone="cyan"
              />
              <LabMetric
                label="Unseen score"
                value={formatPercent(result.scores.validation)}
                detail="Modeled performance on representative held-out examples."
                icon={ScanSearch}
                tone={result.scores.validation >= 0.78 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Generalization gap"
                value={formatPercent(result.scores.gap)}
                detail="Training score minus unseen score; smaller is not sufficient unless both are useful."
                icon={Gauge}
                tone={result.scores.gap > 0.12 ? 'rose' : 'violet'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Fit as complexity changes
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Training cyan, unseen violet
                </p>
              </div>
              <svg
                className="mt-4 h-auto w-full"
                viewBox="0 0 320 126"
                role="img"
                aria-label={`Training score ${formatPercent(result.scores.train)} and unseen score ${formatPercent(result.scores.validation)} at complexity ${complexity}`}
              >
                {[22, 44, 66, 88, 110].map((y) => (
                  <line
                    key={y}
                    x1="14"
                    x2="306"
                    y1={y}
                    y2={y}
                    className="stroke-neutral-200 dark:stroke-neutral-800"
                    strokeWidth="1"
                  />
                ))}
                <line
                  x1={currentX}
                  x2={currentX}
                  y1="14"
                  y2="114"
                  className="stroke-neutral-400 dark:stroke-neutral-600"
                  strokeDasharray="4 4"
                />
                <polyline
                  fill="none"
                  points={chartPoints(result.curve.map((point) => point.train))}
                  className="stroke-cyan-600 dark:stroke-cyan-400"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  fill="none"
                  points={chartPoints(result.curve.map((point) => point.validation))}
                  className="stroke-violet-600 dark:stroke-violet-400"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={currentX} cy={currentTrainY} r="4" className="fill-cyan-600 dark:fill-cyan-400" />
                <circle cx={currentX} cy={currentValidationY} r="4" className="fill-violet-600 dark:fill-violet-400" />
              </svg>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>simpler</span>
                <span>model complexity</span>
                <span>more capacity</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-950 dark:text-white">
                  <BarChart3 aria-hidden="true" className="h-4 w-4" />
                  <p className="text-sm font-semibold">What the evidence says</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.diagnosis.explanation}
                </p>
              </div>
              <div
                className={`rounded-md border p-4 ${
                  result.diagnosis.tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : result.diagnosis.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                      : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                }`}
              >
                <div className="flex items-center gap-2 text-neutral-950 dark:text-white">
                  <Database aria-hidden="true" className="h-4 w-4" />
                  <p className="text-sm font-semibold">Best next experiment</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.diagnosis.action}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
