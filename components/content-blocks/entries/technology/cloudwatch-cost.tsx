'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Hash,
  Layers3,
  LoaderCircle,
  RadioTower,
  ShieldQuestion,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

export default function CloudWatchLessonLab({ dataFile }: { dataFile?: string }) {
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setError(null);

    if (!dataFile) {
      setError('This CloudWatch lab needs a lesson-owned data file.');
      return () => controller.abort();
    }

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isMetricIdentityModel(data) && !isAlarmEvaluationModel(data)) {
          throw new Error('The CloudWatch lab model is incomplete.');
        }
        setPayload(data);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the CloudWatch lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (isMetricIdentityModel(payload)) {
    return <CloudWatchMetricIdentityLab model={payload} />;
  }

  if (isAlarmEvaluationModel(payload)) {
    return <CloudWatchAlarmEvaluationLab model={payload} />;
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="CloudWatch learning lab"
        title={error ? 'Lab data unavailable' : 'Loading the decision model'}
        description={
          error
            ? 'The lesson remains readable, but this interaction needs its JSON model.'
            : 'Preparing the CloudWatch controls and consequences.'
        }
        icon={Activity}
        accent="blue"
      />
      <LearningLabBody>
        <div
          className="flex min-h-64 items-center justify-center"
          role={error ? 'alert' : 'status'}
        >
          <div className="max-w-md text-center">
            {error ? (
              <CircleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-500"
              />
            ) : (
              <LoaderCircle
                aria-hidden="true"
                className="mx-auto h-7 w-7 animate-spin text-blue-500 motion-reduce:animate-none"
              />
            )}
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              {error ? 'CloudWatch model unavailable' : 'Loading CloudWatch model'}
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {error ?? 'Loading lesson-owned telemetry data.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

type DimensionRisk = 'bounded' | 'review' | 'high';

type MetricDimension = {
  id: string;
  label: string;
  valueCount: number;
  example: string;
  detail: string;
  risk: DimensionRisk;
};

type PublicationInterval = {
  seconds: number;
  label: string;
  detail: string;
};

type MetricIdentityModel = {
  kind: 'metric-identity';
  title: string;
  description: string;
  metric: {
    namespace: string;
    name: string;
    unit: string;
  };
  dimensions: MetricDimension[];
  publicationIntervals: PublicationInterval[];
  defaults: {
    dimensionIds: string[];
    publicationIntervalSeconds: number;
  };
  reviewBands: {
    focusedMaximum: number;
    reviewMaximum: number;
    note: string;
  };
};

const METRIC_BLOCK_ID = 'technology/cloudwatch-metric-identity-lab';

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMetricDimension(value: unknown): value is MetricDimension {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MetricDimension>;
  return Boolean(
    candidate.id
      && candidate.label
      && isPositiveInteger(candidate.valueCount)
      && candidate.example
      && candidate.detail
      && candidate.risk
      && ['bounded', 'review', 'high'].includes(candidate.risk),
  );
}

function isPublicationInterval(value: unknown): value is PublicationInterval {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PublicationInterval>;
  return Boolean(
    isPositiveInteger(candidate.seconds)
      && candidate.label
      && candidate.detail,
  );
}

function isMetricIdentityModel(value: unknown): value is MetricIdentityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MetricIdentityModel>;
  const dimensionIds = new Set(
    Array.isArray(candidate.dimensions)
      ? candidate.dimensions
          .filter(isMetricDimension)
          .map((dimension) => dimension.id)
      : [],
  );
  const intervalSeconds = new Set(
    Array.isArray(candidate.publicationIntervals)
      ? candidate.publicationIntervals
          .filter(isPublicationInterval)
          .map((interval) => interval.seconds)
      : [],
  );

  return Boolean(
    candidate.kind === 'metric-identity'
      && candidate.title
      && candidate.description
      && candidate.metric?.namespace
      && candidate.metric.name
      && candidate.metric.unit
      && Array.isArray(candidate.dimensions)
      && candidate.dimensions.length >= 4
      && candidate.dimensions.every(isMetricDimension)
      && Array.isArray(candidate.publicationIntervals)
      && candidate.publicationIntervals.length >= 2
      && candidate.publicationIntervals.every(isPublicationInterval)
      && candidate.defaults
      && Array.isArray(candidate.defaults.dimensionIds)
      && candidate.defaults.dimensionIds.every((id) => dimensionIds.has(id))
      && isPositiveInteger(candidate.defaults.publicationIntervalSeconds)
      && intervalSeconds.has(candidate.defaults.publicationIntervalSeconds)
      && candidate.reviewBands
      && isPositiveInteger(candidate.reviewBands.focusedMaximum)
      && isPositiveInteger(candidate.reviewBands.reviewMaximum)
      && candidate.reviewBands.focusedMaximum
        < candidate.reviewBands.reviewMaximum
      && candidate.reviewBands.note,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function dimensionTone(risk: DimensionRisk, checked: boolean) {
  if (!checked) {
    return 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600';
  }
  if (risk === 'high') {
    return 'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
  }
  if (risk === 'review') {
    return 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  }
  return 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
}

function CloudWatchMetricIdentityLab({
  model,
}: {
  model: MetricIdentityModel;
}) {
  const [selectedDimensionIds, setSelectedDimensionIds] = useState<string[]>(
    model.defaults.dimensionIds,
  );
  const [publicationIntervalSeconds, setPublicationIntervalSeconds] = useState(
    model.defaults.publicationIntervalSeconds,
  );

  const selectedDimensions = useMemo(
    () =>
      model.dimensions.filter((dimension) =>
        selectedDimensionIds.includes(dimension.id),
      ),
    [model.dimensions, selectedDimensionIds],
  );

  const result = useMemo(() => {
    const seriesCount = selectedDimensions.reduce(
      (count, dimension) => count * dimension.valueCount,
      1,
    );
    const dataPointsPerDay =
      seriesCount * (86_400 / publicationIntervalSeconds);
    const highRiskDimensions = selectedDimensions.filter(
      (dimension) => dimension.risk === 'high',
    );
    const reviewDimensions = selectedDimensions.filter(
      (dimension) => dimension.risk === 'review',
    );
    const band =
      seriesCount <= model.reviewBands.focusedMaximum
        ? {
            label: 'Focused',
            detail: 'The modeled identity set stays inside the lesson review band.',
            tone: 'emerald' as const,
          }
        : seriesCount <= model.reviewBands.reviewMaximum
          ? {
              label: 'Review',
              detail: 'Confirm every dimension is required for an operational decision.',
              tone: 'amber' as const,
            }
          : {
              label: 'Explosive',
              detail: 'Move high-cardinality detail to logs or traces before release.',
              tone: 'rose' as const,
            };

    return {
      band,
      dataPointsPerDay,
      highRiskDimensions,
      reviewDimensions,
      seriesCount,
    };
  }, [
    model.reviewBands.focusedMaximum,
    model.reviewBands.reviewMaximum,
    publicationIntervalSeconds,
    selectedDimensions,
  ]);

  const selectedInterval =
    model.publicationIntervals.find(
      (interval) => interval.seconds === publicationIntervalSeconds,
    ) ?? model.publicationIntervals[0];

  function toggleDimension(id: string) {
    setSelectedDimensionIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  }

  function reset() {
    setSelectedDimensionIds(model.defaults.dimensionIds);
    setPublicationIntervalSeconds(model.defaults.publicationIntervalSeconds);
  }

  const formula =
    selectedDimensions.length === 0
      ? 'No dimensions: 1 shared time series'
      : `${selectedDimensions
          .map((dimension) => dimension.valueCount)
          .join(' x ')} = ${formatNumber(result.seriesCount)} time series`;
  const scaleWidth = Math.min(
    100,
    Math.max(
      3,
      (Math.log10(result.seriesCount + 1)
        / Math.log10(model.reviewBands.reviewMaximum * 10 + 1))
        * 100,
    ),
  );

  return (
    <div data-content-block={METRIC_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Metric identity lab"
          title={model.title}
          description={model.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Metric dimensions
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.dimensions.map((dimension) => {
                    const checked = selectedDimensionIds.includes(dimension.id);
                    const detailId = `cloudwatch-dimension-${dimension.id}`;

                    return (
                      <label
                        key={dimension.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${dimensionTone(
                          dimension.risk,
                          checked,
                        )}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-describedby={detailId}
                          onChange={() => toggleDimension(dimension.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-cyan-600"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                            <span>{dimension.label}</span>
                            <span className="tabular-nums opacity-70">
                              {formatNumber(dimension.valueCount)} values
                            </span>
                          </span>
                          <span
                            id={detailId}
                            className="mt-1 block text-xs leading-5 opacity-80"
                          >
                            {dimension.detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Publication interval
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {model.publicationIntervals.map((interval) => {
                    const selected =
                      interval.seconds === publicationIntervalSeconds;
                    return (
                      <button
                        key={interval.seconds}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setPublicationIntervalSeconds(interval.seconds)
                        }
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          selected
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        {interval.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {selectedInterval.detail}
                </p>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Distinct time series"
                value={formatNumber(result.seriesCount)}
                detail="One metric name across every selected dimension combination"
                icon={Hash}
                tone={result.band.tone}
              />
              <LabMetric
                label="Data points per day"
                value={formatNumber(result.dataPointsPerDay)}
                detail="Modeled series multiplied by the selected publication rate"
                icon={RadioTower}
                tone="cyan"
              />
              <LabMetric
                label="Publication interval"
                value={selectedInterval.label}
                detail="Resolution should match a concrete response need"
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label="Design review"
                value={result.band.label}
                detail={result.band.detail}
                icon={Activity}
                tone={result.band.tone}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Metric identity
              </p>
              <h4 className="mt-2 break-words text-base font-semibold text-neutral-950 dark:text-white">
                {model.metric.namespace} / {model.metric.name}
              </h4>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                Unit: {model.metric.unit}
              </p>

              <div className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Combination growth</span>
                  <span>{formula}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full transition-[width] motion-reduce:transition-none ${
                      result.band.tone === 'emerald'
                        ? 'bg-emerald-500'
                        : result.band.tone === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${scaleWidth}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedDimensions.length > 0 ? (
                  selectedDimensions.map((dimension) => (
                    <span
                      key={dimension.id}
                      className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      {dimension.label}={dimension.example}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    All samples share one undimensioned metric identity.
                  </span>
                )}
              </div>
            </div>

            {result.highRiskDimensions.length > 0 ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
                <div className="flex items-start gap-3">
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                  <div>
                    <p className="font-semibold">
                      High-cardinality detail is in the metric identity
                    </p>
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      Move{' '}
                      {result.highRiskDimensions
                        .map((dimension) => dimension.label)
                        .join(', ')}{' '}
                      to structured logs or traces. Keep a bounded field in the metric
                      only when operators must aggregate or alarm on it.
                    </p>
                  </div>
                </div>
              </div>
            ) : result.reviewDimensions.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
                <p className="font-semibold">Resource churn needs a review</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  Instance identity can help diagnosis, but autoscaling and replacement
                  create new values. Confirm that a service-level dimension would not
                  answer the alarm or dashboard question more directly.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50">
                <p className="font-semibold">The selected dimensions stay bounded</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  Each field maps to a controlled operational category. Recheck the
                  value counts as services, operations, and Regions evolve.
                </p>
              </div>
            )}

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.reviewBands.note}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

type AlarmState = 'OK' | 'ALARM';
type MissingTreatmentId =
  | 'missing'
  | 'notBreaching'
  | 'breaching'
  | 'ignore';

type AlarmScenario = {
  id: string;
  label: string;
  detail: string;
  previousState: AlarmState;
  points: Array<number | null>;
};

type MissingTreatment = {
  id: MissingTreatmentId;
  label: string;
  detail: string;
  operatorMeaning: string;
};

type Bound = {
  min: number;
  max: number;
  step: number;
};

type AlarmEvaluationModel = {
  kind: 'alarm-evaluation';
  title: string;
  description: string;
  metric: {
    label: string;
    unit: string;
    threshold: number;
    periodSeconds: number;
    comparison: string;
  };
  scenarios: AlarmScenario[];
  missingTreatments: MissingTreatment[];
  defaults: {
    scenarioId: string;
    evaluationPeriods: number;
    datapointsToAlarm: number;
    missingTreatmentId: MissingTreatmentId;
  };
  bounds: {
    evaluationPeriods: Bound;
  };
  modelNote: string;
};

type ModeledOutcome = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';

const ALARM_BLOCK_ID = 'technology/cloudwatch-alarm-evaluation-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return Boolean(
    isPositiveInteger(candidate.min)
      && isPositiveInteger(candidate.max)
      && isPositiveInteger(candidate.step)
      && candidate.min <= candidate.max,
  );
}

function isAlarmScenario(value: unknown): value is AlarmScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AlarmScenario>;
  const points = candidate.points;
  const allMissing = Array.isArray(points)
    && points.every((point) => point === null);
  const allPresent = Array.isArray(points)
    && points.every(isFiniteNumber);

  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.previousState
      && ['OK', 'ALARM'].includes(candidate.previousState)
      && Array.isArray(points)
      && points.length >= 3
      && (allMissing || allPresent),
  );
}

function isMissingTreatment(value: unknown): value is MissingTreatment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MissingTreatment>;
  return Boolean(
    candidate.id
      && ['missing', 'notBreaching', 'breaching', 'ignore'].includes(candidate.id)
      && candidate.label
      && candidate.detail
      && candidate.operatorMeaning,
  );
}

function isAlarmEvaluationModel(
  value: unknown,
): value is AlarmEvaluationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AlarmEvaluationModel>;
  const scenarioIds = new Set(
    Array.isArray(candidate.scenarios)
      ? candidate.scenarios
          .filter(isAlarmScenario)
          .map((scenario) => scenario.id)
      : [],
  );
  const treatmentIds = new Set(
    Array.isArray(candidate.missingTreatments)
      ? candidate.missingTreatments
          .filter(isMissingTreatment)
          .map((treatment) => treatment.id)
      : [],
  );

  return Boolean(
    candidate.kind === 'alarm-evaluation'
      && candidate.title
      && candidate.description
      && candidate.metric?.label
      && candidate.metric.unit
      && isFiniteNumber(candidate.metric.threshold)
      && isPositiveInteger(candidate.metric.periodSeconds)
      && candidate.metric.comparison
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isAlarmScenario)
      && Array.isArray(candidate.missingTreatments)
      && candidate.missingTreatments.length === 4
      && candidate.missingTreatments.every(isMissingTreatment)
      && candidate.defaults
      && scenarioIds.has(candidate.defaults.scenarioId)
      && isPositiveInteger(candidate.defaults.evaluationPeriods)
      && isPositiveInteger(candidate.defaults.datapointsToAlarm)
      && candidate.defaults.datapointsToAlarm
        <= candidate.defaults.evaluationPeriods
      && treatmentIds.has(candidate.defaults.missingTreatmentId)
      && candidate.bounds
      && isBound(candidate.bounds.evaluationPeriods)
      && candidate.defaults.evaluationPeriods
        <= candidate.bounds.evaluationPeriods.max
      && candidate.modelNote,
  );
}

function stateTone(outcome: ModeledOutcome) {
  if (outcome === 'ALARM') return 'rose' as const;
  if (outcome === 'OK') return 'emerald' as const;
  return 'amber' as const;
}

function choiceIcon(id: string) {
  if (id === 'brief-spike') return RadioTower;
  if (id === 'clustered-failures') return CircleAlert;
  if (id === 'sustained-failure') return BellRing;
  return ShieldQuestion;
}

function CloudWatchAlarmEvaluationLab({
  model,
}: {
  model: AlarmEvaluationModel;
}) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [evaluationPeriods, setEvaluationPeriods] = useState(
    model.defaults.evaluationPeriods,
  );
  const [datapointsToAlarm, setDatapointsToAlarm] = useState(
    model.defaults.datapointsToAlarm,
  );
  const [missingTreatmentId, setMissingTreatmentId] =
    useState<MissingTreatmentId>(model.defaults.missingTreatmentId);

  const scenario =
    model.scenarios.find((candidate) => candidate.id === scenarioId)
    ?? model.scenarios[0];
  const missingTreatment =
    model.missingTreatments.find(
      (candidate) => candidate.id === missingTreatmentId,
    ) ?? model.missingTreatments[0];

  const result = useMemo(() => {
    const selectedPoints = scenario.points.slice(-evaluationPeriods);
    const allMissing = selectedPoints.every((point) => point === null);
    const breachingCount = selectedPoints.filter(
      (point) => point !== null && point >= model.metric.threshold,
    ).length;
    let outcome: ModeledOutcome;
    let explanation: string;

    if (!allMissing) {
      outcome = breachingCount >= datapointsToAlarm ? 'ALARM' : 'OK';
      explanation =
        outcome === 'ALARM'
          ? `${breachingCount} of the newest ${evaluationPeriods} periods breach, meeting the ${datapointsToAlarm}-of-${evaluationPeriods} rule.`
          : `${breachingCount} of the newest ${evaluationPeriods} periods breach, below the ${datapointsToAlarm}-of-${evaluationPeriods} rule.`;
    } else if (missingTreatment.id === 'breaching') {
      outcome = 'ALARM';
      explanation = `Every selected period is missing and is modeled as breaching, so the ${datapointsToAlarm}-of-${evaluationPeriods} rule is met.`;
    } else if (missingTreatment.id === 'notBreaching') {
      outcome = 'OK';
      explanation =
        'Every selected period is missing and is modeled as not breaching.';
    } else if (missingTreatment.id === 'ignore') {
      outcome = scenario.previousState;
      explanation = `Every selected period is missing, so the previous ${scenario.previousState} state is retained.`;
    } else {
      outcome = 'INSUFFICIENT_DATA';
      explanation =
        'Every selected period is missing, so the model cannot evaluate the threshold.';
    }

    return {
      allMissing,
      breachingCount,
      explanation,
      outcome,
    };
  }, [
    datapointsToAlarm,
    evaluationPeriods,
    missingTreatment.id,
    model.metric.threshold,
    scenario.points,
    scenario.previousState,
  ]);

  function setEvaluationWindow(value: number) {
    setEvaluationPeriods(value);
    setDatapointsToAlarm((current) => Math.min(current, value));
  }

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setEvaluationPeriods(model.defaults.evaluationPeriods);
    setDatapointsToAlarm(model.defaults.datapointsToAlarm);
    setMissingTreatmentId(model.defaults.missingTreatmentId);
  }

  const lookbackMinutes =
    (evaluationPeriods * model.metric.periodSeconds) / 60;
  const selectedStartIndex = scenario.points.length - evaluationPeriods;
  const outcomeTone = stateTone(result.outcome);

  return (
    <div data-content-block={ALARM_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Alarm evaluation lab"
          title={model.title}
          description={model.description}
          icon={BellRing}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Telemetry trace
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenarioId}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={choiceIcon(candidate.id)}
                      accent={
                        candidate.id === 'brief-spike'
                          ? 'blue'
                          : candidate.id === 'silent-producer'
                            ? 'amber'
                            : 'rose'
                      }
                      onClick={() => setScenarioId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Evaluation periods (N)"
                value={evaluationPeriods}
                output={`${evaluationPeriods}`}
                {...model.bounds.evaluationPeriods}
                accent="blue"
                lowLabel="Short window"
                highLabel="More history"
                onChange={setEvaluationWindow}
              />

              <LabRange
                label="Datapoints to alarm (M)"
                value={datapointsToAlarm}
                output={`${datapointsToAlarm} of ${evaluationPeriods}`}
                min={1}
                max={evaluationPeriods}
                step={1}
                accent="rose"
                lowLabel="Sensitive"
                highLabel="More evidence"
                onChange={setDatapointsToAlarm}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  All-missing treatment
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.missingTreatments.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === missingTreatmentId}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={
                        candidate.id === 'breaching'
                          ? CircleAlert
                          : candidate.id === 'notBreaching'
                            ? CheckCircle2
                            : ShieldQuestion
                      }
                      accent={
                        candidate.id === 'breaching'
                          ? 'rose'
                          : candidate.id === 'notBreaching'
                            ? 'emerald'
                            : 'amber'
                      }
                      onClick={() => setMissingTreatmentId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled state"
                value={result.outcome}
                detail={result.explanation}
                icon={
                  result.outcome === 'ALARM'
                    ? CircleAlert
                    : result.outcome === 'OK'
                      ? CheckCircle2
                      : ShieldQuestion
                }
                tone={outcomeTone}
              />
              <LabMetric
                label="Alarm rule"
                value={`${datapointsToAlarm} of ${evaluationPeriods}`}
                detail="M breaching periods required among N evaluated periods"
                icon={BellRing}
                tone="rose"
              />
              <LabMetric
                label="Observed breaches"
                value={
                  result.allMissing
                    ? 'No data'
                    : `${result.breachingCount} of ${evaluationPeriods}`
                }
                detail={`${model.metric.comparison} ${model.metric.threshold}${model.metric.unit} is breaching`}
                icon={RadioTower}
                tone={result.allMissing ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Configured lookback"
                value={`${lookbackMinutes} min`}
                detail={`${model.metric.periodSeconds}-second periods in this teaching trace`}
                icon={Clock3}
                tone="neutral"
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {model.metric.label}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Threshold {model.metric.comparison}{' '}
                    {model.metric.threshold}
                    {model.metric.unit}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Oldest on the left, newest on the right
                </p>
              </div>

              <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {scenario.points.map((point, index) => {
                  const included = index >= selectedStartIndex;
                  const breaching =
                    point !== null && point >= model.metric.threshold;
                  return (
                    <li
                      key={`${scenario.id}-${index}`}
                      className={`min-w-0 rounded-md border p-3 text-center ${
                        !included
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-400 opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-600'
                          : point === null
                            ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                            : breaching
                              ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase opacity-70">
                        Period {index + 1}
                      </p>
                      <p className="mt-2 break-words text-lg font-semibold tabular-nums">
                        {point === null ? 'Missing' : `${point}${model.metric.unit}`}
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {!included
                          ? 'Outside N'
                          : point === null
                            ? 'No sample'
                            : breaching
                              ? 'Breaching'
                              : 'Healthy'}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div
              className={`rounded-md border p-5 ${
                result.outcome === 'ALARM'
                  ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                  : result.outcome === 'OK'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                    : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.outcome === 'ALARM' ? (
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                ) : result.outcome === 'OK' ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                ) : (
                  <ShieldQuestion
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Operator consequence
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{result.outcome}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {result.explanation}{' '}
                    {result.allMissing ? missingTreatment.operatorMeaning : null}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.modelNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
