'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ClipboardList,
  Gauge,
  Scale,
  TriangleAlert,
  Users,
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
  '/api/content/ml-systems/healthcare-ai/data/screening-workload-lab.json';
const BLOCK_ID = 'ml-systems/healthcare-ai-screening-workload-lab';

type RangeDefinition = { min: number; max: number; step: number };
type OperatingPoint = {
  id: string;
  label: string;
  detail: string;
  sensitivityPct: number;
  specificityPct: number;
};
type LabData = {
  title: string;
  description: string;
  defaults: {
    cohortSize: number;
    prevalencePct: number;
    operatingPointId: string;
  };
  cohortRange: RangeDefinition;
  prevalenceRange: RangeDefinition;
  dailyReviewCapacity: number;
  operatingPoints: OperatingPoint[];
};

function isRange(value: unknown): value is RangeDefinition {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeDefinition>;
  return [range.min, range.max, range.step].every((item) => typeof item === 'number');
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.cohortSize === 'number'
      && typeof data.defaults.prevalencePct === 'number'
      && typeof data.defaults.operatingPointId === 'string'
      && isRange(data.cohortRange)
      && isRange(data.prevalenceRange)
      && typeof data.dailyReviewCapacity === 'number'
      && Array.isArray(data.operatingPoints)
      && data.operatingPoints.length >= 2
      && data.operatingPoints.every((point) => (
        typeof point.id === 'string'
        && typeof point.label === 'string'
        && typeof point.detail === 'string'
        && typeof point.sensitivityPct === 'number'
        && typeof point.specificityPct === 'number'
      )),
  );
}

export default function HealthcareAiScreeningWorkloadLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohortSize, setCohortSize] = useState(1000);
  const [prevalencePct, setPrevalencePct] = useState(8);
  const [operatingPointId, setOperatingPointId] = useState('balanced');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Screening workload data is incomplete.');
        setData(payload);
        setCohortSize(payload.defaults.cohortSize);
        setPrevalencePct(payload.defaults.prevalencePct);
        setOperatingPointId(payload.defaults.operatingPointId);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const operatingPoint = data?.operatingPoints.find((point) => point.id === operatingPointId)
    ?? data?.operatingPoints[0];

  const result = useMemo(() => {
    if (!data || !operatingPoint) return null;
    const positiveCases = Math.round(cohortSize * prevalencePct / 100);
    const negativeCases = cohortSize - positiveCases;
    const truePositive = Math.round(positiveCases * operatingPoint.sensitivityPct / 100);
    const falseNegative = positiveCases - truePositive;
    const trueNegative = Math.round(negativeCases * operatingPoint.specificityPct / 100);
    const falsePositive = negativeCases - trueNegative;
    const reviewQueue = truePositive + falsePositive;
    const ppv = reviewQueue > 0 ? truePositive / reviewQueue * 100 : 0;
    const reviewLoadPct = reviewQueue / data.dailyReviewCapacity * 100;
    const overflow = Math.max(0, reviewQueue - data.dailyReviewCapacity);

    return {
      falseNegative,
      falsePositive,
      overflow,
      positiveCases,
      ppv,
      reviewLoadPct,
      reviewQueue,
      trueNegative,
      truePositive,
    };
  }, [cohortSize, data, operatingPoint, prevalencePct]);

  function reset() {
    if (!data) return;
    setCohortSize(data.defaults.cohortSize);
    setPrevalencePct(data.defaults.prevalencePct);
    setOperatingPointId(data.defaults.operatingPointId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Screening workload lab"
          title={data?.title ?? 'See the review queue behind a model score'}
          description={data?.description ?? 'Loading the illustrative workload model...'}
          icon={Activity}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !operatingPoint || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Choose an operating point
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.operatingPoints.map((point) => (
                      <LabChoice
                        key={point.id}
                        selected={point.id === operatingPoint.id}
                        label={`${point.label}: ${point.sensitivityPct}% / ${point.specificityPct}%`}
                        detail={point.detail}
                        icon={Gauge}
                        accent={point.id === 'sensitive' ? 'rose' : point.id === 'specific' ? 'emerald' : 'cyan'}
                        onClick={() => setOperatingPointId(point.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Daily eligible cohort"
                  value={cohortSize}
                  output={cohortSize.toLocaleString()}
                  min={data.cohortRange.min}
                  max={data.cohortRange.max}
                  step={data.cohortRange.step}
                  accent="blue"
                  lowLabel="Smaller service"
                  highLabel="Larger service"
                  onChange={setCohortSize}
                />

                <LabRange
                  label="3. Outcome prevalence"
                  value={prevalencePct}
                  output={`${prevalencePct}%`}
                  min={data.prevalenceRange.min}
                  max={data.prevalenceRange.max}
                  step={data.prevalenceRange.step}
                  accent="violet"
                  lowLabel="Rare in cohort"
                  highLabel="Common in cohort"
                  onChange={setPrevalencePct}
                />
              </div>
            )}
          >
            <div aria-live="polite">
              <div className={`rounded-md border p-4 ${result.overflow > 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'}`}>
                <div className="flex items-start gap-3">
                  {result.overflow > 0 ? (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  ) : (
                    <ClipboardList aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  )}
                  <div>
                    <p className="font-semibold text-neutral-950 dark:text-white">
                      {result.overflow > 0
                        ? `The modeled queue exceeds daily review capacity by ${result.overflow}`
                        : 'The modeled queue fits the illustrative daily review capacity'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      Capacity is fixed at {data.dailyReviewCapacity} reviews per day. This is workflow math, not evidence that an operating point is clinically acceptable.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <LabMetric
                  label="Positive results"
                  value={result.reviewQueue.toLocaleString()}
                  detail={`${result.reviewLoadPct.toFixed(0)}% of illustrative review capacity`}
                  icon={ClipboardList}
                  tone={result.overflow > 0 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Positive predictive value"
                  value={`${result.ppv.toFixed(1)}%`}
                  detail={`${result.truePositive} of ${result.reviewQueue} positive results are modeled true positives`}
                  icon={Scale}
                  tone="violet"
                />
                <LabMetric
                  label="Modeled positives"
                  value={result.positiveCases.toLocaleString()}
                  detail={`${prevalencePct}% of the eligible cohort`}
                  icon={Users}
                  tone="blue"
                />
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Expected cases in the daily cohort
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MatrixCell label="True positive" value={result.truePositive} detail="Positive case sent to review" tone="emerald" />
                  <MatrixCell label="False positive" value={result.falsePositive} detail="Negative case sent to review" tone="amber" />
                  <MatrixCell label="False negative" value={result.falseNegative} detail="Positive case left to the ordinary pathway" tone="rose" />
                  <MatrixCell label="True negative" value={result.trueNegative} detail="Negative case not sent to review" tone="neutral" />
                </div>
              </div>

              <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                <p className="font-semibold text-neutral-950 dark:text-white">What changed?</p>
                <p className="mt-1">
                  {prevalencePct <= 4
                    ? 'At low prevalence, even a fairly specific model can send many negative cases to review. Report predictive values and workload in the deployment population.'
                    : result.falseNegative > result.falsePositive
                      ? 'This operating point leaves more modeled positive cases to the ordinary pathway than it sends negative cases to review. Error costs, not symmetry, should drive evaluation.'
                      : 'The queue combines true and false positive results. Validate whether the workflow can review both quickly and consistently.'}
                </p>
              </div>
            </div>
          </LearningLabBody>
        )}
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
  tone: 'emerald' | 'amber' | 'rose' | 'neutral';
}) {
  const styles = {
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    neutral: 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60',
  };

  return (
    <div className={`rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div className="p-5 md:p-6">
      <div className={`rounded-md border p-4 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100' : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`} role={error ? 'alert' : 'status'}>
        {error ?? 'Loading screening workload data...'}
      </div>
    </div>
  );
}
