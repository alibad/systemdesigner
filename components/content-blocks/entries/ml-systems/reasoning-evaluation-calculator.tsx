'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Layers3,
  Scale,
  ShieldCheck,
  TriangleAlert,
  XCircle,
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
  '/api/content/ml-systems/reasoning-evaluation/data/benchmark-composition-lab.json';
const COMPOSITION_BLOCK_ID =
  'ml-systems/reasoning-evaluation-benchmark-composition-lab';
const PERTURBATION_BLOCK_ID =
  'ml-systems/reasoning-evaluation-perturbation-lab';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type EvaluationSlice = {
  id: string;
  label: string;
  detail: string;
  pilotPassRatePct: number;
  deploymentWeightPct: number;
};

type AllocationPolicy = {
  id: string;
  label: string;
  detail: string;
  shares: Record<string, number>;
};

type CompositionLabData = {
  kind: 'composition';
  blockId: string;
  title: string;
  description: string;
  note: string;
  defaults: {
    totalItems: number;
    policyId: string;
  };
  sampleRange: RangeDefinition;
  slices: EvaluationSlice[];
  allocationPolicies: AllocationPolicy[];
};

type ExpectedRelation = 'same' | 'different';

type PerturbationCase = {
  id: string;
  label: string;
  detail: string;
  expectedRelation: ExpectedRelation;
  original: {
    prompt: string;
    referenceAnswer: string;
    modelAnswer: string;
  };
  variant: {
    prompt: string;
    referenceAnswer: string;
    modelAnswer: string;
  };
  pairedEvidence: {
    passes: number;
    total: number;
  };
  diagnosis: string;
};

type PerturbationLabData = {
  kind: 'perturbation';
  blockId: string;
  title: string;
  description: string;
  note: string;
  headlineScorePct: number;
  defaultCaseId: string;
  cases: PerturbationCase[];
};

type LabData = CompositionLabData | PerturbationLabData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isRange(value: unknown): value is RangeDefinition {
  if (!isRecord(value)) return false;
  return [value.min, value.max, value.step].every((item) => typeof item === 'number');
}

function isCompositionData(value: unknown): value is CompositionLabData {
  if (!isRecord(value) || value.kind !== 'composition') return false;
  if (!isRecord(value.defaults) || !isRange(value.sampleRange)) return false;
  const defaults = value.defaults;
  if (
    value.blockId !== COMPOSITION_BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || typeof defaults.totalItems !== 'number'
    || typeof defaults.policyId !== 'string'
    || !Array.isArray(value.slices)
    || value.slices.length < 2
    || !Array.isArray(value.allocationPolicies)
    || value.allocationPolicies.length < 2
  ) {
    return false;
  }

  const slicesValid = value.slices.every((slice) => (
    isRecord(slice)
    && typeof slice.id === 'string'
    && typeof slice.label === 'string'
    && typeof slice.detail === 'string'
    && typeof slice.pilotPassRatePct === 'number'
    && slice.pilotPassRatePct >= 0
    && slice.pilotPassRatePct <= 100
    && typeof slice.deploymentWeightPct === 'number'
    && slice.deploymentWeightPct >= 0
    && slice.deploymentWeightPct <= 100
  ));
  if (!slicesValid) return false;

  const sliceIds = value.slices.map((slice) => slice.id);
  const deploymentWeight = value.slices.reduce(
    (sum, slice) => sum + slice.deploymentWeightPct,
    0,
  );
  const policiesValid = value.allocationPolicies.every((policy) => {
    if (
      !isRecord(policy)
      || typeof policy.id !== 'string'
      || typeof policy.label !== 'string'
      || typeof policy.detail !== 'string'
      || !isRecord(policy.shares)
    ) {
      return false;
    }
    const sharesById = policy.shares;
    const shares = sliceIds.map((id) => sharesById[id]);
    return (
      shares.every((share) => typeof share === 'number' && share >= 0 && share <= 100)
      && shares.reduce<number>((sum, share) => sum + Number(share), 0) === 100
    );
  });

  return (
    Math.abs(deploymentWeight - 100) < 0.001
    && new Set(sliceIds).size === sliceIds.length
    && policiesValid
    && value.allocationPolicies.some((policy) => policy.id === defaults.policyId)
  );
}

function isPerturbationData(value: unknown): value is PerturbationLabData {
  if (!isRecord(value) || value.kind !== 'perturbation') return false;
  if (value.blockId !== PERTURBATION_BLOCK_ID) return false;
  if (
    typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || typeof value.headlineScorePct !== 'number'
    || value.headlineScorePct < 0
    || value.headlineScorePct > 100
    || typeof value.defaultCaseId !== 'string'
    || !Array.isArray(value.cases)
    || value.cases.length < 2
  ) {
    return false;
  }

  const casesValid = value.cases.every((item) => (
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.label === 'string'
    && typeof item.detail === 'string'
    && (item.expectedRelation === 'same' || item.expectedRelation === 'different')
    && isRecord(item.original)
    && typeof item.original.prompt === 'string'
    && typeof item.original.referenceAnswer === 'string'
    && typeof item.original.modelAnswer === 'string'
    && isRecord(item.variant)
    && typeof item.variant.prompt === 'string'
    && typeof item.variant.referenceAnswer === 'string'
    && typeof item.variant.modelAnswer === 'string'
    && isRecord(item.pairedEvidence)
    && typeof item.pairedEvidence.passes === 'number'
    && typeof item.pairedEvidence.total === 'number'
    && item.pairedEvidence.total > 0
    && item.pairedEvidence.passes >= 0
    && item.pairedEvidence.passes <= item.pairedEvidence.total
    && typeof item.diagnosis === 'string'
  ));
  if (!casesValid) return false;

  const caseIds = value.cases.map((item) => item.id);
  return (
    new Set(caseIds).size === caseIds.length
    && caseIds.includes(value.defaultCaseId)
  );
}

function fallbackBlockId(dataFile: string) {
  return dataFile.includes('perturbation')
    ? PERTURBATION_BLOCK_ID
    : COMPOSITION_BLOCK_ID;
}

function allocateLargestRemainder(
  total: number,
  slices: EvaluationSlice[],
  shares: Record<string, number>,
) {
  const allocations = slices.map((slice, index) => {
    const exact = total * ((shares[slice.id] ?? 0) / 100);
    return {
      index,
      count: Math.floor(exact),
      fraction: exact - Math.floor(exact),
    };
  });
  let remainder = total - allocations.reduce((sum, item) => sum + item.count, 0);

  [...allocations]
    .sort((left, right) => right.fraction - left.fraction)
    .forEach((item) => {
      if (remainder > 0) {
        allocations[item.index].count += 1;
        remainder -= 1;
      }
    });

  return allocations.map((item) => item.count);
}

function wilsonInterval(successes: number, total: number) {
  if (total === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const proportion = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const center = (proportion + (z ** 2) / (2 * total)) / denominator;
  const spread = (
    z
    * Math.sqrt(
      (proportion * (1 - proportion)) / total
      + (z ** 2) / (4 * total ** 2),
    )
    / denominator
  );

  return {
    low: Math.max(0, center - spread),
    high: Math.min(1, center + spread),
  };
}

function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function BenchmarkCompositionLab({ data }: { data: CompositionLabData }) {
  const [totalItems, setTotalItems] = useState(data.defaults.totalItems);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);

  const policy = data.allocationPolicies.find((item) => item.id === policyId)
    ?? data.allocationPolicies[0];

  const result = useMemo(() => {
    const counts = allocateLargestRemainder(totalItems, data.slices, policy.shares);
    const rows = data.slices.map((slice, index) => {
      const count = counts[index];
      const passes = Math.round(count * slice.pilotPassRatePct / 100);
      const score = count > 0 ? passes / count : 0;
      const interval = wilsonInterval(passes, count);

      return {
        ...slice,
        count,
        passes,
        score,
        interval,
        intervalWidthPct: (interval.high - interval.low) * 100,
      };
    });
    const totalPasses = rows.reduce((sum, row) => sum + row.passes, 0);
    const deploymentWeightTotal = rows.reduce(
      (sum, row) => sum + row.deploymentWeightPct,
      0,
    );
    const deploymentWeightedScore = rows.reduce(
      (sum, row) => sum + row.score * row.deploymentWeightPct,
      0,
    ) / deploymentWeightTotal;
    const naiveScore = totalPasses / totalItems;
    const widestInterval = Math.max(...rows.map((row) => row.intervalWidthPct));
    const thinnestSlice = [...rows].sort((left, right) => left.count - right.count)[0];
    const weakestSlice = [...rows].sort((left, right) => left.score - right.score)[0];
    const compositionGapPct = Math.abs(naiveScore - deploymentWeightedScore) * 100;

    const diagnosis = thinnestSlice.count < 30
      ? {
          tone: 'rose' as const,
          title: `${thinnestSlice.label} has too few examples for a stable slice claim`,
          detail:
            'The aggregate still produces a precise-looking number, but this slice is represented by fewer than 30 illustrative items. Increase the budget or change the allocation before using its rate as a release gate.',
        }
      : compositionGapPct >= 4
        ? {
            tone: 'amber' as const,
            title: 'The headline moves with benchmark composition',
            detail:
              'The naive score and deployment-weighted score differ materially even though every slice keeps the same pilot pass rate. Name the target population and weights before comparing systems.',
          }
        : widestInterval >= 15
          ? {
              tone: 'amber' as const,
              title: 'The weakest-supported slice still has a wide interval',
              detail:
                'A larger total sample narrows finite-test-set uncertainty. It does not repair ambiguous items, contamination, grader error, or a benchmark that misses the intended construct.',
            }
          : {
              tone: 'emerald' as const,
              title: 'The illustrative suite supports a more qualified comparison',
              detail:
                'Every slice has visible representation and the widest interval is bounded. Keep slice scores, item counts, weighting, and uncertainty beside the aggregate.',
            };

    return {
      compositionGapPct,
      deploymentWeightedScore,
      diagnosis,
      naiveScore,
      rows,
      thinnestSlice,
      weakestSlice,
      widestInterval,
    };
  }, [data.slices, policy.shares, totalItems]);

  function reset() {
    setTotalItems(data.defaults.totalItems);
    setPolicyId(data.defaults.policyId);
  }

  return (
    <div data-content-block={data.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Benchmark composition lab"
          title={data.title}
          description={data.description}
          icon={BarChart3}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Allocation policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.allocationPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Layers3}
                      accent={item.id === 'failure-seeking' ? 'amber' : 'blue'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Total evaluation items"
                value={totalItems}
                output={totalItems.toLocaleString()}
                min={data.sampleRange.min}
                max={data.sampleRange.max}
                step={data.sampleRange.step}
                accent="violet"
                lowLabel="Fast signal"
                highLabel="Narrower intervals"
                onChange={setTotalItems}
              />

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {data.note}
              </p>
            </div>
          )}
        >
          <div className="min-h-[620px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Naive aggregate"
                value={formatPercent(result.naiveScore * 100)}
                detail="Every sampled item receives equal weight"
                icon={Gauge}
                tone={result.compositionGapPct >= 4 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Deployment weighted"
                value={formatPercent(result.deploymentWeightedScore * 100)}
                detail="Uses the fixed target-population weights"
                icon={Scale}
                tone="violet"
              />
              <LabMetric
                label="Widest 95% interval"
                value={formatPercent(result.widestInterval)}
                detail={`Across ${data.slices.length} named slices`}
                icon={ArrowLeftRight}
                tone={result.widestInterval >= 15 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Weakest slice"
                value={formatPercent(result.weakestSlice.score * 100)}
                detail={`${result.weakestSlice.passes}/${result.weakestSlice.count} pass`}
                icon={TriangleAlert}
                tone="rose"
              />
            </div>

            <section aria-label="Illustrative benchmark slices">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Slice evidence
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    The bar is the observed illustrative pass rate; the text reports a
                    Wilson interval for the finite sample.
                  </p>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {policy.label}
                </span>
              </div>

              <div className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {result.rows.map((row, index) => {
                  const barClass = [
                    'bg-blue-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-rose-500',
                  ][index % 4];

                  return (
                    <div
                      key={row.id}
                      className="bg-white p-4 dark:bg-neutral-950"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {row.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                            {row.detail}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {row.passes}/{row.count}
                        </p>
                      </div>
                      <div
                        className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full rounded-full ${barClass}`}
                          style={{ width: `${Math.max(2, row.score * 100)}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{formatPercent(row.score * 100)} observed</span>
                        <span>
                          95% interval {formatPercent(row.interval.low * 100)} to{' '}
                          {formatPercent(row.interval.high * 100)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div
              className={`rounded-md border p-5 ${
                result.diagnosis.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : result.diagnosis.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.diagnosis.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{result.diagnosis.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {result.diagnosis.detail}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PerturbationStressLab({ data }: { data: PerturbationLabData }) {
  const [caseId, setCaseId] = useState(data.defaultCaseId);
  const [prediction, setPrediction] = useState<ExpectedRelation | null>(null);

  const selectedCase = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
  const revealed = prediction !== null;
  const predictionCorrect = prediction === selectedCase.expectedRelation;
  const modelRelation: ExpectedRelation =
    selectedCase.original.modelAnswer.trim().toLowerCase()
      === selectedCase.variant.modelAnswer.trim().toLowerCase()
      ? 'same'
      : 'different';
  const modelPassed = modelRelation === selectedCase.expectedRelation;
  const pairPassRate = (
    selectedCase.pairedEvidence.passes
    / selectedCase.pairedEvidence.total
    * 100
  );
  const unexpectedPairs = (
    selectedCase.pairedEvidence.total
    - selectedCase.pairedEvidence.passes
  );

  function chooseCase(nextCaseId: string) {
    setCaseId(nextCaseId);
    setPrediction(null);
  }

  function reset() {
    setCaseId(data.defaultCaseId);
    setPrediction(null);
  }

  return (
    <div data-content-block={data.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Perturbation stress lab"
          title={data.title}
          description={data.description}
          icon={FlaskConical}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a controlled change
                </legend>
                <div className="mt-3 space-y-2">
                  {data.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === selectedCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FlaskConical}
                      accent={item.id === 'premise-reversal' ? 'rose' : 'amber'}
                      onClick={() => chooseCase(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Predict the correct relationship
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <LabChoice
                    selected={prediction === 'same'}
                    label="Same conclusion"
                    detail="The answer should be invariant."
                    icon={ShieldCheck}
                    accent="emerald"
                    onClick={() => setPrediction('same')}
                  />
                  <LabChoice
                    selected={prediction === 'different'}
                    label="Different conclusion"
                    detail="The changed meaning should change the answer."
                    icon={ArrowLeftRight}
                    accent="violet"
                    onClick={() => setPrediction('different')}
                  />
                </div>
              </fieldset>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {data.note}
              </p>
            </div>
          )}
        >
          <div className="min-h-[620px] min-w-0 space-y-6" aria-live="polite">
            <section aria-label="Original and perturbed reasoning items">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Compare the task meaning
              </p>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <article className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                    Original item
                  </p>
                  <p className="mt-3 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                    {selectedCase.original.prompt}
                  </p>
                  {revealed ? (
                    <dl className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500 dark:text-neutral-400">Reference</dt>
                        <dd className="font-semibold text-neutral-950 dark:text-white">
                          {selectedCase.original.referenceAnswer}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500 dark:text-neutral-400">Model output</dt>
                        <dd className="font-semibold text-neutral-950 dark:text-white">
                          {selectedCase.original.modelAnswer}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </article>

                <article className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                    Controlled variant
                  </p>
                  <p className="mt-3 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                    {selectedCase.variant.prompt}
                  </p>
                  {revealed ? (
                    <dl className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500 dark:text-neutral-400">Reference</dt>
                        <dd className="font-semibold text-neutral-950 dark:text-white">
                          {selectedCase.variant.referenceAnswer}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500 dark:text-neutral-400">Model output</dt>
                        <dd className="font-semibold text-neutral-950 dark:text-white">
                          {selectedCase.variant.modelAnswer}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </article>
              </div>
            </section>

            {!revealed ? (
              <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
                <ArrowLeftRight
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-neutral-500"
                />
                <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
                  Predict before inspecting the outputs
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Ask whether the transformation preserves the problem&apos;s meaning. A
                  robust evaluator specifies that invariant before looking at model behavior.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`rounded-md border p-5 ${
                    predictionCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {predictionCorrect ? (
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {predictionCorrect
                          ? 'Your expected invariant is correct'
                          : `The references should be ${selectedCase.expectedRelation}`}
                      </p>
                      <p className="mt-2 text-sm leading-6 opacity-85">
                        {modelPassed
                          ? 'This example follows the expected relationship. The paired dataset is still needed to tell whether that behavior is repeatable.'
                          : selectedCase.diagnosis}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <LabMetric
                    label="Expected relation"
                    value={selectedCase.expectedRelation === 'same' ? 'Same' : 'Different'}
                    detail="Defined from the reference semantics"
                    icon={ShieldCheck}
                    tone="emerald"
                  />
                  <LabMetric
                    label="Model relation"
                    value={modelRelation === 'same' ? 'Same' : 'Different'}
                    detail={modelPassed ? 'Passes this pair' : 'Fails this pair'}
                    icon={modelPassed ? CheckCircle2 : XCircle}
                    tone={modelPassed ? 'emerald' : 'rose'}
                  />
                  <LabMetric
                    label="Paired pass rate"
                    value={formatPercent(pairPassRate, 0)}
                    detail={`${selectedCase.pairedEvidence.passes}/${selectedCase.pairedEvidence.total} controlled pairs`}
                    icon={ArrowLeftRight}
                    tone={pairPassRate >= 90 ? 'emerald' : pairPassRate >= 75 ? 'amber' : 'rose'}
                  />
                  <LabMetric
                    label="Headline accuracy"
                    value={formatPercent(data.headlineScorePct, 0)}
                    detail={`${unexpectedPairs} pair failures remain hidden`}
                    icon={Gauge}
                    tone="blue"
                  />
                </div>
              </>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

export default function ReasoningEvaluationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the reasoning lab (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isCompositionData(value) && !isPerturbationData(value)) {
          throw new Error('Reasoning lab data does not match a supported contract.');
        }
        setData(value);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the reasoning lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        data-content-block={fallbackBlockId(dataFile)}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">The interactive reasoning lab could not be loaded.</p>
        <p className="mt-2 opacity-80">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        data-content-block={fallbackBlockId(dataFile)}
        className="not-prose my-7 min-h-[520px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading reasoning evaluation learning lab"
      />
    );
  }

  return data.kind === 'composition' ? (
    <BenchmarkCompositionLab data={data} />
  ) : (
    <PerturbationStressLab data={data} />
  );
}
