'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Filter,
  Gauge,
  LoaderCircle,
  Scale,
  SearchCheck,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PriorityMetric = 'f1' | 'precision' | 'recall';

type EvaluationGoal = {
  id: string;
  label: string;
  detail: string;
  threshold: number;
  priorityMetric: PriorityMetric;
};

type EvaluationSlice = {
  id: string;
  label: string;
  detail: string;
};

type EvaluationSample = {
  id: string;
  label: string;
  sliceId: string;
  score: number;
  isMainContent: boolean;
};

type EvaluationModel = {
  title: string;
  description: string;
  defaults: {
    goalId: string;
    sliceId: string;
  };
  goals: EvaluationGoal[];
  slices: EvaluationSlice[];
  samples: EvaluationSample[];
};

const BLOCK_ID = 'technology/boilerplate-detection-evaluation-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/boilerplate-detection/data/evaluation-set.json';

function isEvaluationModel(value: unknown): value is EvaluationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvaluationModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.goalId
      && candidate.defaults.sliceId
      && Array.isArray(candidate.goals)
      && candidate.goals.length >= 3
      && candidate.goals.every((goal) => (
        typeof goal.id === 'string'
        && typeof goal.threshold === 'number'
        && ['f1', 'precision', 'recall'].includes(goal.priorityMetric)
      ))
      && Array.isArray(candidate.slices)
      && candidate.slices.length >= 4
      && Array.isArray(candidate.samples)
      && candidate.samples.length >= 12
      && candidate.samples.every((sample) => (
        typeof sample.id === 'string'
        && typeof sample.score === 'number'
        && typeof sample.isMainContent === 'boolean'
      )),
  );
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function BoilerplateDetectionEvaluationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvaluationModel | null>(null);
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
        if (!isEvaluationModel(payload)) throw new Error('The evaluation data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load evaluation data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <EvaluationWorkbench data={data} />;
}

function EvaluationWorkbench({ data }: { data: EvaluationModel }) {
  const initialGoal = data.goals.find((item) => item.id === data.defaults.goalId) ?? data.goals[0];
  const [goalId, setGoalId] = useState(initialGoal.id);
  const [sliceId, setSliceId] = useState(data.defaults.sliceId);
  const [threshold, setThreshold] = useState(initialGoal.threshold);
  const goal = data.goals.find((item) => item.id === goalId) ?? data.goals[0];
  const slice = data.slices.find((item) => item.id === sliceId) ?? data.slices[0];

  const result = useMemo(() => {
    const samples = sliceId === 'all'
      ? data.samples
      : data.samples.filter((sample) => sample.sliceId === sliceId);
    const truePositive = samples.filter((sample) => sample.score >= threshold && sample.isMainContent).length;
    const falsePositive = samples.filter((sample) => sample.score >= threshold && !sample.isMainContent).length;
    const falseNegative = samples.filter((sample) => sample.score < threshold && sample.isMainContent).length;
    const trueNegative = samples.filter((sample) => sample.score < threshold && !sample.isMainContent).length;
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    const recall = truePositive / Math.max(1, truePositive + falseNegative);
    const f1 = (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall);
    const errors = samples.filter((sample) => (
      sample.score >= threshold ? !sample.isMainContent : sample.isMainContent
    ));
    return {
      errors,
      f1,
      falseNegative,
      falsePositive,
      precision,
      recall,
      samples,
      trueNegative,
      truePositive,
    };
  }, [data.samples, sliceId, threshold]);

  function chooseGoal(nextGoal: EvaluationGoal) {
    setGoalId(nextGoal.id);
    setThreshold(nextGoal.threshold);
  }

  function reset() {
    setGoalId(initialGoal.id);
    setSliceId(data.defaults.sliceId);
    setThreshold(initialGoal.threshold);
  }

  const priorityValue = goal.priorityMetric === 'precision'
    ? result.precision
    : goal.priorityMetric === 'recall'
      ? result.recall
      : result.f1;
  const priorityLabel = goal.priorityMetric === 'f1' ? 'F1 score' : goal.priorityMetric;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation threshold lab"
          title={data.title}
          description={data.description}
          icon={SearchCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product goal
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.goals.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === goal.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.priorityMetric === 'precision' ? Target : item.priorityMetric === 'recall' ? SearchCheck : Scale}
                      accent={item.priorityMetric === 'precision' ? 'blue' : item.priorityMetric === 'recall' ? 'emerald' : 'violet'}
                      onClick={() => chooseGoal(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Filter aria-hidden="true" className="h-4 w-4" />
                  2. Evaluation slice
                </span>
                <select
                  value={sliceId}
                  onChange={(event) => setSliceId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                >
                  {data.slices.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{slice.detail}</span>
              </label>

              <LabRange
                label="3. Keep threshold"
                value={threshold}
                output={`${threshold}/100`}
                min={30}
                max={90}
                step={1}
                accent="violet"
                lowLabel="More coverage"
                highLabel="Cleaner output"
                onChange={setThreshold}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Precision"
                value={percentage(result.precision)}
                detail="Of kept blocks, how many are target content?"
                icon={Target}
                tone={goal.priorityMetric === 'precision' ? 'blue' : 'neutral'}
              />
              <LabMetric
                label="Recall"
                value={percentage(result.recall)}
                detail="Of target blocks, how many were retained?"
                icon={SearchCheck}
                tone={goal.priorityMetric === 'recall' ? 'emerald' : 'neutral'}
              />
              <LabMetric
                label="F1 score"
                value={percentage(result.f1)}
                detail="Harmonic mean of precision and recall"
                icon={Scale}
                tone={goal.priorityMetric === 'f1' ? 'violet' : 'neutral'}
              />
              <LabMetric
                label={`Priority: ${priorityLabel}`}
                value={percentage(priorityValue)}
                detail={`${goal.label} preset on ${result.samples.length} labeled blocks`}
                icon={Gauge}
                tone="amber"
              />
            </div>

            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Confusion matrix</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MatrixCell
                  label="Correctly kept"
                  value={result.truePositive}
                  detail="True positive"
                  tone="emerald"
                />
                <MatrixCell
                  label="Noise included"
                  value={result.falsePositive}
                  detail="False positive"
                  tone="rose"
                />
                <MatrixCell
                  label="Content missed"
                  value={result.falseNegative}
                  detail="False negative"
                  tone="amber"
                />
                <MatrixCell
                  label="Correctly removed"
                  value={result.trueNegative}
                  detail="True negative"
                  tone="blue"
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-start gap-3">
                {result.errors.length
                  ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />}
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    {result.errors.length ? `${result.errors.length} fixture error${result.errors.length === 1 ? '' : 's'} need inspection` : 'No errors in this slice at the selected threshold'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    Thresholds describe a policy for one labeled distribution. Re-run the fixtures when templates, languages, render paths, or extraction code change.
                  </p>
                  {result.errors.length ? (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {result.errors.map((sample) => {
                        const falseInclusion = sample.score >= threshold;
                        return (
                          <li key={sample.id} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                            <div className="flex items-start gap-2">
                              <CircleX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                              <div>
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{sample.label}</p>
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                  Score {sample.score}: {falseInclusion ? 'noise kept' : 'content missed'}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function MatrixCell({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'amber' | 'blue' | 'emerald' | 'rose';
}) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  } as const;

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{detail}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{label}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation threshold lab"
          title={error ? 'Evaluation lab unavailable' : 'Loading evaluation lab'}
          description="The lab measures extraction decisions against labeled page blocks."
          icon={SearchCheck}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading labeled fixtures...'}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
