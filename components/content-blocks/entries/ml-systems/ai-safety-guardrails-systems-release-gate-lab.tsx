'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Gauge,
  Scale,
  ShieldAlert,
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
  '/api/content/ml-systems/ai-safety-guardrails-systems/data/safety-release-gates.json';
const BLOCK_ID = 'ml-systems/ai-safety-guardrails-systems-release-gate-lab';

type OperatingPoint = {
  id: string;
  label: string;
  detail: string;
  recallPercent: number;
  falsePositiveRatePercent: number;
};

type EvaluationScenario = {
  id: string;
  label: string;
  detail: string;
  totalCases: number;
  unsafeCases: number;
  minimumRecallPercent: number;
  maximumFalsePositiveRatePercent: number;
  defaultOperatingPointId: string;
  defaultReviewCapacity: number;
  operatingPoints: OperatingPoint[];
};

type ReleaseGateData = {
  title: string;
  description: string;
  reviewCapacity: {
    min: number;
    max: number;
    step: number;
  };
  defaults: {
    scenarioId: string;
  };
  scenarios: EvaluationScenario[];
};

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseGateData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.reviewCapacity
      && typeof data.reviewCapacity.min === 'number'
      && typeof data.reviewCapacity.max === 'number'
      && typeof data.reviewCapacity.step === 'number'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.totalCases === 'number'
        && typeof scenario.unsafeCases === 'number'
        && scenario.totalCases > scenario.unsafeCases
        && typeof scenario.minimumRecallPercent === 'number'
        && typeof scenario.maximumFalsePositiveRatePercent === 'number'
        && typeof scenario.defaultOperatingPointId === 'string'
        && typeof scenario.defaultReviewCapacity === 'number'
        && Array.isArray(scenario.operatingPoints)
        && scenario.operatingPoints.length === 3
        && scenario.operatingPoints.every((point) => (
          typeof point.id === 'string'
          && typeof point.label === 'string'
          && typeof point.detail === 'string'
          && typeof point.recallPercent === 'number'
          && typeof point.falsePositiveRatePercent === 'number'
        ))
      )),
  );
}

export default function AISafetyGuardrailsSystemsReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [operatingPointId, setOperatingPointId] = useState('');
  const [reviewCapacity, setReviewCapacity] = useState(100);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load release-gate data (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateData(payload)) {
          throw new Error('Release-gate data does not match the expected contract.');
        }
        const scenario = payload.scenarios.find(
          (item) => item.id === payload.defaults.scenarioId,
        ) ?? payload.scenarios[0];
        setData(payload);
        setScenarioId(scenario.id);
        setOperatingPointId(scenario.defaultOperatingPointId);
        setReviewCapacity(scenario.defaultReviewCapacity);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load release data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const operatingPoint = scenario?.operatingPoints.find(
    (item) => item.id === operatingPointId,
  ) ?? scenario?.operatingPoints[0];

  const result = useMemo(() => {
    if (!scenario || !operatingPoint) return null;

    const safeCases = scenario.totalCases - scenario.unsafeCases;
    const truePositive = Math.round(
      scenario.unsafeCases * operatingPoint.recallPercent / 100,
    );
    const falseNegative = scenario.unsafeCases - truePositive;
    const falsePositive = Math.round(
      safeCases * operatingPoint.falsePositiveRatePercent / 100,
    );
    const trueNegative = safeCases - falsePositive;
    const reviewLoad = truePositive + falsePositive;
    const reviewOverflow = Math.max(0, reviewLoad - reviewCapacity);
    const precision = reviewLoad === 0 ? 0 : truePositive / reviewLoad;

    const gates = [
      {
        id: 'recall',
        label: 'Unsafe-case recall',
        actual: `${operatingPoint.recallPercent}%`,
        target: `at least ${scenario.minimumRecallPercent}%`,
        passed: operatingPoint.recallPercent >= scenario.minimumRecallPercent,
      },
      {
        id: 'false-positive-rate',
        label: 'Safe interruption rate',
        actual: `${operatingPoint.falsePositiveRatePercent}%`,
        target: `at most ${scenario.maximumFalsePositiveRatePercent}%`,
        passed:
          operatingPoint.falsePositiveRatePercent
          <= scenario.maximumFalsePositiveRatePercent,
      },
      {
        id: 'capacity',
        label: 'Review capacity',
        actual: `${reviewLoad.toLocaleString()} alerts`,
        target: `at most ${reviewCapacity.toLocaleString()}`,
        passed: reviewLoad <= reviewCapacity,
      },
    ];
    const failedGates = gates.filter((gate) => !gate.passed);
    const passed = failedGates.length === 0;

    return {
      failedGates,
      falseNegative,
      falsePositive,
      gates,
      passed,
      precision,
      reviewLoad,
      reviewOverflow,
      safeCases,
      trueNegative,
      truePositive,
    };
  }, [operatingPoint, reviewCapacity, scenario]);

  function chooseScenario(nextScenario: EvaluationScenario) {
    setScenarioId(nextScenario.id);
    setOperatingPointId(nextScenario.defaultOperatingPointId);
    setReviewCapacity(nextScenario.defaultReviewCapacity);
  }

  function reset() {
    if (!data) return;
    const defaultScenario = data.scenarios.find(
      (item) => item.id === data.defaults.scenarioId,
    ) ?? data.scenarios[0];
    chooseScenario(defaultScenario);
  }

  if (!data || !scenario || !operatingPoint || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 min-h-96 rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading safety release-gate lab'}
      >
        {error}
      </div>
    );
  }

  const VerdictIcon = result.passed ? BadgeCheck : ShieldAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Safety evidence lab"
          title={data.title}
          description={data.description}
          icon={ClipboardCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the deployment
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Scale}
                      accent="amber"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Select measured evidence
                </legend>
                <div className="mt-3 space-y-2">
                  {scenario.operatingPoints.map((point) => (
                    <LabChoice
                      key={point.id}
                      selected={point.id === operatingPoint.id}
                      label={point.label}
                      detail={point.detail}
                      icon={Gauge}
                      accent="violet"
                      onClick={() => setOperatingPointId(point.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Review capacity per batch"
                value={reviewCapacity}
                output={reviewCapacity.toLocaleString()}
                min={data.reviewCapacity.min}
                max={data.reviewCapacity.max}
                step={data.reviewCapacity.step}
                accent="cyan"
                lowLabel="Small queue"
                highLabel="Large queue"
                onChange={setReviewCapacity}
              />
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                result.passed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <VerdictIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Release verdict
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.passed ? 'Eligible for a bounded canary' : 'Hold the release'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.passed
                      ? 'All declared gates pass for this synthetic evidence bundle. The result earns limited exposure, not universal safety.'
                      : `${result.failedGates.map((gate) => gate.label).join(', ')} ${result.failedGates.length === 1 ? 'does' : 'do'} not meet the declared contract.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="True positives"
                value={result.truePositive.toLocaleString()}
                detail="Unsafe cases flagged"
                icon={CircleCheck}
                tone="emerald"
              />
              <LabMetric
                label="False negatives"
                value={result.falseNegative.toLocaleString()}
                detail="Unsafe cases missed"
                icon={CircleX}
                tone={result.falseNegative > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="False positives"
                value={result.falsePositive.toLocaleString()}
                detail="Safe cases interrupted"
                icon={AlertTriangle}
                tone="amber"
              />
              <LabMetric
                label="True negatives"
                value={result.trueNegative.toLocaleString()}
                detail="Safe cases passed"
                icon={BadgeCheck}
                tone="blue"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Independent gates
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      A strong result cannot compensate for a failed critical boundary.
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {result.gates.filter((gate) => gate.passed).length}/{result.gates.length} pass
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {result.gates.map((gate) => {
                    const GateIcon = gate.passed ? CircleCheck : CircleX;
                    return (
                      <div
                        key={gate.id}
                        className={`grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                          gate.passed
                            ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950'
                            : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <GateIcon
                            aria-hidden="true"
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              gate.passed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {gate.label}
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                              Target: {gate.target}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {gate.actual}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Queue consequence
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <LabMetric
                    label="Review load"
                    value={result.reviewLoad.toLocaleString()}
                    detail={`${Math.round(result.precision * 100)}% of alerts are unsafe cases`}
                    icon={Users}
                    tone={result.reviewOverflow > 0 ? 'rose' : 'cyan'}
                  />
                  <LabMetric
                    label="Capacity state"
                    value={result.reviewOverflow > 0 ? `${result.reviewOverflow.toLocaleString()} over` : 'Fits'}
                    detail={`Configured capacity: ${reviewCapacity.toLocaleString()}`}
                    icon={result.reviewOverflow > 0 ? AlertTriangle : BadgeCheck}
                    tone={result.reviewOverflow > 0 ? 'rose' : 'emerald'}
                  />
                </div>
                <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Fixture: {scenario.unsafeCases.toLocaleString()} unsafe and {result.safeCases.toLocaleString()} safe cases. These are teaching values, not benchmark claims.
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
