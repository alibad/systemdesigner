'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Scale,
  Target,
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
  '/api/content/ml-systems/ab-testing/data/sample-size-planner.json';
const BLOCK_ID = 'ml-systems/ab-testing-sample-size-allocation-lab';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type ExperimentScenario = {
  id: string;
  label: string;
  detail: string;
  metricLabel: string;
  baselineRatePct: number;
  eligibleUnitsPerDay: number;
};

type PowerOption = {
  id: string;
  label: string;
  detail: string;
  zBeta: number;
};

type PlannerData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    powerId: string;
    minimumDetectableEffectPctPoints: number;
    treatmentAllocationPct: number;
  };
  effectRange: RangeDefinition;
  allocationRange: RangeDefinition;
  scenarios: ExperimentScenario[];
  powerOptions: PowerOption[];
};

function isRange(value: unknown): value is RangeDefinition {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeDefinition>;
  return [range.min, range.max, range.step].every((item) => typeof item === 'number');
}

function isPlannerData(value: unknown): value is PlannerData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PlannerData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && isRange(data.effectRange)
      && isRange(data.allocationRange)
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.baselineRatePct === 'number'
        && typeof scenario.eligibleUnitsPerDay === 'number'
      ))
      && Array.isArray(data.powerOptions)
      && data.powerOptions.length > 0
      && data.powerOptions.every((option) => (
        typeof option.id === 'string' && typeof option.zBeta === 'number'
      )),
  );
}

function requiredUnits(
  baselineRate: number,
  absoluteEffect: number,
  treatmentShare: number,
  zBeta: number,
) {
  const candidateRate = Math.min(0.999, baselineRate + absoluteEffect);
  const controlShare = 1 - treatmentShare;
  const variance = (
    baselineRate * (1 - baselineRate) / controlShare
    + candidateRate * (1 - candidateRate) / treatmentShare
  );
  return Math.ceil(((1.96 + zBeta) ** 2 * variance) / absoluteEffect ** 2);
}

function formatDuration(days: number) {
  if (days < 1) return `${Math.ceil(days * 24)} hours`;
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
}

export default function AbTestingSampleSizeAllocationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PlannerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [powerId, setPowerId] = useState('');
  const [minimumEffect, setMinimumEffect] = useState(0.6);
  const [treatmentAllocation, setTreatmentAllocation] = useState(50);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPlannerData(payload)) throw new Error('Sample-size planning data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setPowerId(payload.defaults.powerId);
        setMinimumEffect(payload.defaults.minimumDetectableEffectPctPoints);
        setTreatmentAllocation(payload.defaults.treatmentAllocationPct);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load planner data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const power = data?.powerOptions.find((item) => item.id === powerId)
    ?? data?.powerOptions[0];

  const result = useMemo(() => {
    if (!scenario || !power) return null;

    const baselineRate = scenario.baselineRatePct / 100;
    const absoluteEffect = minimumEffect / 100;
    const treatmentShare = treatmentAllocation / 100;
    const totalUnits = requiredUnits(
      baselineRate,
      absoluteEffect,
      treatmentShare,
      power.zBeta,
    );
    const balancedUnits = requiredUnits(baselineRate, absoluteEffect, 0.5, power.zBeta);
    const treatmentUnits = Math.ceil(totalUnits * treatmentShare);
    const controlUnits = totalUnits - treatmentUnits;
    const evidenceDays = totalUnits / scenario.eligibleUnitsPerDay;
    const plannedDays = Math.max(7, Math.ceil(evidenceDays));
    const allocationPenaltyPct = Math.max(0, (totalUnits / balancedUnits - 1) * 100);

    const diagnosis = treatmentAllocation <= 15
      ? {
          title: 'The treatment arm is the evidence bottleneck',
          detail: 'This split limits candidate risk, but each treatment observation is expensive in calendar time. Start here only when the exposure risk justifies the added evidence cost.',
          tone: 'amber' as const,
        }
      : evidenceDays > 28
        ? {
            title: 'The planned effect is expensive to resolve',
            detail: 'The fixed-horizon test needs more than four weeks of eligible traffic. Revisit the minimum worthwhile effect, measurement sensitivity, or experiment population before launch.',
            tone: 'rose' as const,
          }
        : evidenceDays > 14
          ? {
              title: 'Plan for a long-running experiment',
              detail: 'The evidence target is feasible, but novelty, seasonality, version changes, and overlapping experiments need explicit controls over this duration.',
              tone: 'amber' as const,
            }
          : {
              title: 'A fixed-horizon test is operationally feasible',
              detail: 'The modeled evidence fits inside two weeks. Keep at least one representative weekly cycle and freeze the stopping rule before exposure begins.',
              tone: 'emerald' as const,
            };

    return {
      allocationPenaltyPct,
      balancedUnits,
      controlUnits,
      diagnosis,
      evidenceDays,
      plannedDays,
      totalUnits,
      treatmentUnits,
    };
  }, [minimumEffect, power, scenario, treatmentAllocation]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setPowerId(data.defaults.powerId);
    setMinimumEffect(data.defaults.minimumDetectableEffectPctPoints);
    setTreatmentAllocation(data.defaults.treatmentAllocationPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Experiment sizing lab"
          title={data?.title ?? 'Plan power, allocation, and runtime together'}
          description={data?.description ?? 'Loading the experiment evidence model...'}
          icon={FlaskConical}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !power || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product outcome
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Target}
                        accent={item.id === 'checkout-conversion' ? 'amber' : item.id === 'support-resolution' ? 'cyan' : 'violet'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Minimum detectable effect"
                  value={minimumEffect}
                  output={`+${minimumEffect.toFixed(1)} pp`}
                  min={data.effectRange.min}
                  max={data.effectRange.max}
                  step={data.effectRange.step}
                  accent="blue"
                  lowLabel="Subtle effect"
                  highLabel="Large effect"
                  onChange={setMinimumEffect}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Detection power
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {data.powerOptions.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === power.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Gauge}
                        accent={item.id === 'high' ? 'emerald' : 'blue'}
                        onClick={() => setPowerId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="4. Treatment allocation"
                  value={treatmentAllocation}
                  output={`${treatmentAllocation}%`}
                  min={data.allocationRange.min}
                  max={data.allocationRange.max}
                  step={data.allocationRange.step}
                  accent="amber"
                  lowLabel="Limit exposure"
                  highLabel="Efficient evidence"
                  onChange={setTreatmentAllocation}
                />
              </div>
            )}
          >
            <div className="min-h-[620px] min-w-0 space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Required units"
                  value={result.totalUnits.toLocaleString()}
                  detail={`Independent ${scenario.metricLabel} opportunities`}
                  icon={Users}
                  tone="violet"
                />
                <LabMetric
                  label="Evidence collection"
                  value={formatDuration(result.evidenceDays)}
                  detail={`${scenario.eligibleUnitsPerDay.toLocaleString()} eligible units per day`}
                  icon={CalendarDays}
                  tone={result.evidenceDays > 28 ? 'rose' : result.evidenceDays > 14 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Planned runtime"
                  value={`${result.plannedDays} days`}
                  detail="At least one weekly cycle in this illustrative plan"
                  icon={Target}
                  tone="blue"
                />
                <LabMetric
                  label="Allocation penalty"
                  value={`+${result.allocationPenaltyPct.toFixed(0)}%`}
                  detail="Extra units versus a 50/50 split"
                  icon={Scale}
                  tone={result.allocationPenaltyPct > 30 ? 'rose' : result.allocationPenaltyPct > 10 ? 'amber' : 'emerald'}
                />
              </div>

              <section aria-label="Experiment allocation model">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence distribution
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  The smaller arm determines how quickly the comparison sharpens
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  At a {scenario.baselineRatePct.toFixed(1)}% baseline, the plan targets a +{minimumEffect.toFixed(1)} percentage-point effect with {power.label.toLowerCase()}.
                </p>

                <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="flex min-h-28 w-full flex-col sm:flex-row">
                    <div
                      className="flex min-w-0 flex-col justify-center bg-blue-50 p-4 text-blue-950 dark:bg-blue-950/45 dark:text-blue-100"
                      style={{ flex: 100 - treatmentAllocation }}
                    >
                      <span className="text-xs font-semibold uppercase opacity-70">Control</span>
                      <strong className="mt-1 text-xl tabular-nums">{result.controlUnits.toLocaleString()}</strong>
                      <span className="mt-1 text-xs opacity-75">{100 - treatmentAllocation}% of eligible units</span>
                    </div>
                    <div
                      className="flex min-w-0 flex-col justify-center border-t border-violet-200 bg-violet-50 p-4 text-violet-950 sm:border-l sm:border-t-0 dark:border-violet-900 dark:bg-violet-950/45 dark:text-violet-100"
                      style={{ flex: treatmentAllocation }}
                    >
                      <span className="text-xs font-semibold uppercase opacity-70">Treatment</span>
                      <strong className="mt-1 text-xl tabular-nums">{result.treatmentUnits.toLocaleString()}</strong>
                      <span className="mt-1 text-xs opacity-75">{treatmentAllocation}% of eligible units</span>
                    </div>
                  </div>
                </div>

                {treatmentAllocation < 50 ? (
                  <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    A balanced plan would need about {result.balancedUnits.toLocaleString()} total units. The unbalanced split buys lower candidate exposure by spending more calendar evidence.
                  </p>
                ) : null}
              </section>

              <section
                className={`rounded-md border p-5 ${
                  result.diagnosis.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : result.diagnosis.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.diagnosis.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold">{result.diagnosis.title}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.diagnosis.detail}</p>
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                This is a fixed-horizon normal approximation for two independent binary rates at a two-sided 5% significance level. Clustered units, repeated observations, noncompliance, or sequential monitoring require a design-specific calculation.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div className="min-h-72 p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : (
        <div
          className="h-64 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900"
          aria-label="Loading experiment sizing lab"
        />
      )}
    </div>
  );
}
