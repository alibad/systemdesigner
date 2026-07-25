'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  Crosshair,
  Gauge,
  ListChecks,
  ScanSearch,
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
  '/api/content/ml-systems/model-evaluation/data/threshold-cost-model.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  prevalencePercent: number;
  falsePositiveCost: number;
  falseNegativeCost: number;
  defaultThreshold: number;
  defaultReviewCapacity: number;
};

type LabData = {
  title: string;
  description: string;
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function ModelEvaluationThresholdCostLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('fraud');
  const [threshold, setThreshold] = useState(58);
  const [reviewCapacity, setReviewCapacity] = useState(500);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load threshold model (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('Threshold data does not match the expected contract.');
        setData(value);
        const first = value.scenarios[0];
        setScenarioId(first.id);
        setThreshold(first.defaultThreshold);
        setReviewCapacity(first.defaultReviewCapacity);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load threshold data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const population = 10_000;
    const positives = population * (scenario.prevalencePercent / 100);
    const negatives = population - positives;
    const normalizedThreshold = threshold / 100;
    const recall = clamp(1.04 - normalizedThreshold * 0.74, 0.25, 0.98);
    const falsePositiveRate = clamp(0.36 * (1 - normalizedThreshold) ** 2 + 0.004, 0.004, 0.3);
    const truePositives = positives * recall;
    const falseNegatives = positives - truePositives;
    const falsePositives = negatives * falsePositiveRate;
    const alerts = truePositives + falsePositives;
    const precision = alerts === 0 ? 0 : truePositives / alerts;
    const expectedCost =
      falseNegatives * scenario.falseNegativeCost + falsePositives * scenario.falsePositiveCost;
    const overload = Math.max(0, alerts - reviewCapacity);
    const capacityRatio = alerts / Math.max(1, reviewCapacity);
    const status = overload > 0 ? 'Queue overloaded' : recall < 0.58 ? 'Miss risk' : 'Contract balanced';
    const explanation =
      overload > 0
        ? `${Math.ceil(overload).toLocaleString()} predicted alerts exceed review capacity. Raising the threshold protects the queue but also creates more false negatives.`
        : recall < 0.58
          ? 'The queue fits, but the threshold suppresses too many true cases. The metric contract should make that miss cost explicit.'
          : 'The modeled queue fits and recall remains above the planning floor. Validate these assumptions on an untouched production-like holdout.';
    return {
      scenario,
      recall,
      falsePositiveRate,
      precision,
      alerts,
      falseNegatives,
      expectedCost,
      overload,
      capacityRatio,
      status,
      explanation,
    };
  }, [data, reviewCapacity, scenarioId, threshold]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setThreshold(scenario.defaultThreshold);
    setReviewCapacity(scenario.defaultReviewCapacity);
  };

  const reset = () => {
    const scenario = data?.scenarios[0];
    if (!scenario) return;
    chooseScenario(scenario);
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
        aria-label="Loading evaluation threshold lab"
      />
    );
  }

  const warning = result.overload > 0 || result.recall < 0.58;

  return (
    <div data-content-block="ml-systems/model-evaluation-threshold-cost-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Metric contract lab"
          title={data.title}
          description={data.description}
          icon={Crosshair}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the production decision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={ScanSearch}
                      accent="cyan"
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
                  label="Decision threshold"
                  value={threshold}
                  output={`${threshold}%`}
                  min={10}
                  max={90}
                  accent="violet"
                  lowLabel="More alerts"
                  highLabel="Fewer alerts"
                  onChange={setThreshold}
                />
                <LabRange
                  label="Review capacity per 10k"
                  value={reviewCapacity}
                  output={reviewCapacity.toLocaleString()}
                  min={100}
                  max={3000}
                  step={50}
                  accent="amber"
                  lowLabel="Small queue"
                  highLabel="Large queue"
                  onChange={setReviewCapacity}
                />
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Modeled operating point
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.scenario.label}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  warning
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                }`}
              >
                {warning ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : <ListChecks aria-hidden="true" className="h-4 w-4" />}
                {result.status}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Precision" value={`${(result.precision * 100).toFixed(1)}%`} detail="Share of alerts that are true cases" icon={Crosshair} tone="blue" />
              <LabMetric label="Recall" value={`${(result.recall * 100).toFixed(1)}%`} detail={`${Math.round(result.falseNegatives)} modeled misses per 10k decisions`} icon={Gauge} tone={result.recall < 0.58 ? 'rose' : 'emerald'} />
              <LabMetric label="Review load" value={Math.round(result.alerts).toLocaleString()} detail={`${Math.round(result.capacityRatio * 100)}% of configured capacity`} icon={ListChecks} tone={result.overload > 0 ? 'rose' : 'cyan'} />
              <LabMetric label="False-positive rate" value={`${(result.falsePositiveRate * 100).toFixed(1)}%`} detail="Measured on modeled negative cases" icon={ScanSearch} tone="violet" />
              <LabMetric label="Expected error cost" value={`$${Math.round(result.expectedCost).toLocaleString()}`} detail="False positives and false negatives use different costs" icon={BadgeDollarSign} tone="amber" />
            </div>
            <div className={`mt-6 rounded-md border p-4 ${warning ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'}`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Contract interpretation</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
