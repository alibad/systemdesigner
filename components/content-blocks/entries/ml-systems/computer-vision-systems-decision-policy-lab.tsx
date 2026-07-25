'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Eye,
  ListChecks,
  ScanSearch,
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
} from '@/components/content-blocks/learning/LearningLab';

type DecisionScenario = {
  id: string;
  label: string;
  detail: string;
  prevalencePercent: number;
  recallAt50: number;
  recallSlopePerPoint: number;
  falsePositiveRateAt50Percent: number;
  falsePositiveDecayPerPoint: number;
  falsePositiveCost: number;
  falseNegativeCost: number;
  defaultThreshold: number;
  defaultReviewCapacity: number;
  shiftRecallPenaltyPoints: number;
  shiftFalsePositiveMultiplier: number;
};

export type ComputerVisionDecisionPolicyLabData = {
  kind: 'decision-policy';
  blockId: string;
  title: string;
  description: string;
  population: number;
  minCriticalRecallPercent: number;
  maxQueueUtilizationPercent: number;
  shift: {
    label: string;
    detail: string;
  };
  scenarios: DecisionScenario[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function hasNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function hasString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string' && record[key].length > 0;
}

export function isComputerVisionDecisionPolicyLabData(
  value: unknown,
): value is ComputerVisionDecisionPolicyLabData {
  if (!isRecord(value) || value.kind !== 'decision-policy') return false;
  if (
    !hasString(value, 'blockId') ||
    !hasString(value, 'title') ||
    !hasString(value, 'description') ||
    !hasNumber(value, 'population') ||
    !hasNumber(value, 'minCriticalRecallPercent') ||
    !hasNumber(value, 'maxQueueUtilizationPercent') ||
    !isRecord(value.shift) ||
    !hasString(value.shift, 'label') ||
    !hasString(value.shift, 'detail')
  ) {
    return false;
  }

  return (
    Array.isArray(value.scenarios) &&
    value.scenarios.length > 0 &&
    value.scenarios.every(
      (item) =>
        isRecord(item) &&
        ['id', 'label', 'detail'].every((key) => hasString(item, key)) &&
        [
          'prevalencePercent',
          'recallAt50',
          'recallSlopePerPoint',
          'falsePositiveRateAt50Percent',
          'falsePositiveDecayPerPoint',
          'falsePositiveCost',
          'falseNegativeCost',
          'defaultThreshold',
          'defaultReviewCapacity',
          'shiftRecallPenaltyPoints',
          'shiftFalsePositiveMultiplier',
        ].every((key) => hasNumber(item, key)),
    )
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ComputerVisionDecisionPolicyLab({
  data,
}: {
  data?: ComputerVisionDecisionPolicyLabData;
  dataFile?: string;
}) {
  if (!data) {
    return (
      <div
        data-content-block="ml-systems/computer-vision-systems-decision-policy-lab"
        className="not-prose my-7 rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        Load this lab through the computer-vision systems dispatcher with its decision-policy data file.
      </div>
    );
  }

  return <DecisionPolicyLab data={data} />;
}

function DecisionPolicyLab({ data }: { data: ComputerVisionDecisionPolicyLabData }) {
  const firstScenario = data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(firstScenario.id);
  const [threshold, setThreshold] = useState(firstScenario.defaultThreshold);
  const [reviewCapacity, setReviewCapacity] = useState(firstScenario.defaultReviewCapacity);
  const [distributionShift, setDistributionShift] = useState(false);

  const model = useMemo(() => {
    const scenario =
      data.scenarios.find((item) => item.id === scenarioId) ?? firstScenario;
    const thresholdDelta = threshold - 50;
    const baseRecall = scenario.recallAt50 - thresholdDelta * scenario.recallSlopePerPoint;
    const recall = clamp(
      baseRecall - (distributionShift ? scenario.shiftRecallPenaltyPoints / 100 : 0),
      0.05,
      0.99,
    );
    const baseFalsePositiveRate =
      (scenario.falsePositiveRateAt50Percent / 100) *
      Math.exp(-scenario.falsePositiveDecayPerPoint * thresholdDelta);
    const falsePositiveRate = clamp(
      baseFalsePositiveRate *
        (distributionShift ? scenario.shiftFalsePositiveMultiplier : 1),
      0.001,
      0.6,
    );
    const positives = data.population * (scenario.prevalencePercent / 100);
    const negatives = data.population - positives;
    const truePositives = positives * recall;
    const falseNegatives = positives - truePositives;
    const falsePositives = negatives * falsePositiveRate;
    const trueNegatives = negatives - falsePositives;
    const alerts = truePositives + falsePositives;
    const precision = alerts === 0 ? 0 : truePositives / alerts;
    const queueUtilization = alerts / Math.max(1, reviewCapacity);
    const expectedErrorCost =
      falseNegatives * scenario.falseNegativeCost +
      falsePositives * scenario.falsePositiveCost;
    const recallPass = recall >= data.minCriticalRecallPercent / 100;
    const queuePass = queueUtilization <= data.maxQueueUtilizationPercent / 100;
    const ready = recallPass && queuePass;

    return {
      scenario,
      recall,
      falsePositiveRate,
      truePositives,
      falseNegatives,
      falsePositives,
      trueNegatives,
      alerts,
      precision,
      queueUtilization,
      expectedErrorCost,
      recallPass,
      queuePass,
      ready,
    };
  }, [
    data,
    distributionShift,
    firstScenario,
    reviewCapacity,
    scenarioId,
    threshold,
  ]);

  const chooseScenario = (scenario: DecisionScenario) => {
    setScenarioId(scenario.id);
    setThreshold(scenario.defaultThreshold);
    setReviewCapacity(scenario.defaultReviewCapacity);
  };

  const reset = () => {
    chooseScenario(firstScenario);
    setDistributionShift(false);
  };

  const interpretation = !model.recallPass
    ? 'Critical recall is below its contract. Raising the threshold further would reduce review load but miss more true events.'
    : !model.queuePass
      ? 'The review queue is overloaded. Add capacity, narrow the eligible population, or validate a threshold change before release.'
      : distributionShift
        ? 'The shifted slice still clears both gates, but it should remain a named release and monitoring slice.'
        : 'The threshold preserves critical recall without exceeding bounded review capacity.';

  const cells = [
    {
      label: 'Detected events',
      value: model.truePositives,
      detail: 'True positives sent to action or review',
      pass: true,
    },
    {
      label: 'Missed events',
      value: model.falseNegatives,
      detail: 'False negatives hidden below the threshold',
      pass: model.recallPass,
    },
    {
      label: 'False alerts',
      value: model.falsePositives,
      detail: 'Negative cases that consume review capacity',
      pass: model.queuePass,
    },
    {
      label: 'Correctly ignored',
      value: model.trueNegatives,
      detail: 'Negative cases kept out of the queue',
      pass: true,
    },
  ];

  return (
    <div data-content-block={data.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Threshold and review policy lab"
          title={data.title}
          description={data.description}
          icon={SlidersHorizontal}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the product decision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={model.scenario.id === scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Eye}
                      accent="violet"
                      onClick={() => chooseScenario(scenario)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Set the operating point
                </legend>
                <LabRange
                  label="Detection threshold"
                  value={threshold}
                  output={`${threshold}%`}
                  min={30}
                  max={85}
                  accent="violet"
                  lowLabel="More alerts"
                  highLabel="Fewer alerts"
                  onChange={setThreshold}
                />
                <LabRange
                  label={`Review capacity per ${data.population.toLocaleString()}`}
                  value={reviewCapacity}
                  output={reviewCapacity.toLocaleString()}
                  min={100}
                  max={2500}
                  step={50}
                  accent="amber"
                  lowLabel="Small queue"
                  highLabel="Large queue"
                  onChange={setReviewCapacity}
                />
              </fieldset>
              <button
                type="button"
                aria-pressed={distributionShift}
                onClick={() => setDistributionShift((current) => !current)}
                className={`flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  distributionShift
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                    : 'border-neutral-200 bg-white text-neutral-800 hover:border-rose-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-rose-800'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">{data.shift.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    {data.shift.detail}
                  </span>
                </span>
                <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
              </button>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Precision"
                value={formatPercent(model.precision)}
                detail="Share of alerts that are true events"
                icon={ScanSearch}
                tone="blue"
              />
              <LabMetric
                label="Critical recall"
                value={formatPercent(model.recall)}
                detail={`${data.minCriticalRecallPercent}% minimum contract`}
                icon={Eye}
                tone={model.recallPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Review load"
                value={Math.round(model.alerts).toLocaleString()}
                detail={`${Math.round(model.queueUtilization * 100)}% of configured capacity`}
                icon={ListChecks}
                tone={model.queuePass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Expected error cost"
                value={`$${Math.round(model.expectedErrorCost).toLocaleString()}`}
                detail="Scenario-weighted misses and false alerts"
                icon={ShieldCheck}
                tone="amber"
              />
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Decision outcomes per {data.population.toLocaleString()} frames or tracks
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    The score threshold changes every cell, not just the number of detections.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Threshold {threshold}%
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {cells.map((cell) => (
                  <div
                    key={cell.label}
                    className={`rounded-md border p-4 ${
                      cell.pass
                        ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {cell.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          {cell.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {Math.round(cell.value).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`mt-5 rounded-md border p-4 ${
                model.ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {model.ready ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {model.ready ? 'Decision policy passes' : 'Decision policy needs revision'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{interpretation}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
