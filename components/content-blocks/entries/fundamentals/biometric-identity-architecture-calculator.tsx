'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  ScanFace,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Evaluation = {
  id: string;
  label: string;
  detail: string;
  genuineTrials: number;
  impostorTrials: number;
};

type GroupRate = {
  id: string;
  label: string;
  fmr: number;
  fnmr: number;
};

type OperatingPoint = {
  id: string;
  label: string;
  thresholdLabel: string;
  detail: string;
  groups: GroupRate[];
};

type ThresholdModel = {
  title: string;
  description: string;
  benchmark: {
    fmrMaximum: number;
    fnmrTarget: number;
    fmrLabel: string;
    fnmrLabel: string;
  };
  defaults: {
    operatingPointId: string;
    evaluationId: string;
  };
  evaluations: Evaluation[];
  operatingPoints: OperatingPoint[];
};

type GroupOutcome = GroupRate & {
  falseMatches: number;
  falseNonMatches: number;
  meetsFmr: boolean;
  meetsFnmr: boolean;
};

const BLOCK_ID = 'fundamentals/biometric-identity-architecture-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/biometric-identity-architecture/data/threshold-validation-model.json';

function isThresholdModel(value: unknown): value is ThresholdModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ThresholdModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.benchmark?.fmrMaximum === 'number'
      && typeof candidate.benchmark.fnmrTarget === 'number'
      && candidate.benchmark.fmrLabel
      && candidate.benchmark.fnmrLabel
      && candidate.defaults?.operatingPointId
      && candidate.defaults.evaluationId
      && Array.isArray(candidate.evaluations)
      && candidate.evaluations.length >= 2
      && candidate.evaluations.every((evaluation) => (
        typeof evaluation.id === 'string'
        && typeof evaluation.label === 'string'
        && typeof evaluation.detail === 'string'
        && typeof evaluation.genuineTrials === 'number'
        && evaluation.genuineTrials > 0
        && typeof evaluation.impostorTrials === 'number'
        && evaluation.impostorTrials > 0
      ))
      && Array.isArray(candidate.operatingPoints)
      && candidate.operatingPoints.length >= 3
      && candidate.operatingPoints.every((point) => (
        typeof point.id === 'string'
        && typeof point.label === 'string'
        && typeof point.thresholdLabel === 'string'
        && typeof point.detail === 'string'
        && Array.isArray(point.groups)
        && point.groups.length >= 2
        && point.groups.every((group) => (
          typeof group.id === 'string'
          && typeof group.label === 'string'
          && typeof group.fmr === 'number'
          && group.fmr >= 0
          && typeof group.fnmr === 'number'
          && group.fnmr >= 0
        ))
      )),
  );
}

export default function BiometricIdentityArchitectureCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ThresholdModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isThresholdModel(payload)) {
          throw new Error('The threshold validation model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the threshold validation model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Threshold validation lab"
            title="Load the measured operating points"
            description="The illustrative group rates and evaluation sizes are loading."
            icon={Fingerprint}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ThresholdLab model={model} />
      )}
    </div>
  );
}

function ThresholdLab({ model }: { model: ThresholdModel }) {
  const [operatingPointId, setOperatingPointId] = useState(
    model.defaults.operatingPointId,
  );
  const [evaluationId, setEvaluationId] = useState(model.defaults.evaluationId);

  const point = model.operatingPoints.find((item) => item.id === operatingPointId)
    ?? model.operatingPoints[0];
  const evaluation = model.evaluations.find((item) => item.id === evaluationId)
    ?? model.evaluations[0];

  const result = useMemo(() => {
    const genuineTrialsPerGroup = evaluation.genuineTrials / point.groups.length;
    const impostorTrialsPerGroup = evaluation.impostorTrials / point.groups.length;
    const groups: GroupOutcome[] = point.groups.map((group) => ({
      ...group,
      falseMatches: impostorTrialsPerGroup * group.fmr,
      falseNonMatches: genuineTrialsPerGroup * group.fnmr,
      meetsFmr: group.fmr <= model.benchmark.fmrMaximum,
      meetsFnmr: group.fnmr < model.benchmark.fnmrTarget,
    }));
    const totalFalseMatches = groups.reduce((total, group) => total + group.falseMatches, 0);
    const totalFalseNonMatches = groups.reduce(
      (total, group) => total + group.falseNonMatches,
      0,
    );
    const fmrPassingGroups = groups.filter((group) => group.meetsFmr).length;
    const fnmrPassingGroups = groups.filter((group) => group.meetsFnmr).length;
    const qualified = fmrPassingGroups === groups.length && fnmrPassingGroups === groups.length;
    const worstFmr = Math.max(...groups.map((group) => group.fmr));
    const worstFnmr = Math.max(...groups.map((group) => group.fnmr));

    return {
      groups,
      totalFalseMatches,
      totalFalseNonMatches,
      fmrPassingGroups,
      fnmrPassingGroups,
      qualified,
      worstFmr,
      worstFnmr,
      genuineTrialsPerGroup,
      impostorTrialsPerGroup,
    };
  }, [evaluation, model.benchmark.fmrMaximum, model.benchmark.fnmrTarget, point.groups]);

  function reset() {
    setOperatingPointId(model.defaults.operatingPointId);
    setEvaluationId(model.defaults.evaluationId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Threshold validation lab"
        title={model.title}
        description={model.description}
        icon={Fingerprint}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Fixed operating point
              </legend>
              <div className="mt-3 grid gap-2">
                {model.operatingPoints.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === point.id}
                    label={item.label}
                    detail={`${item.thresholdLabel}. ${item.detail}`}
                    icon={ScanFace}
                    accent="cyan"
                    onClick={() => setOperatingPointId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Evaluation size
              </legend>
              <div className="mt-3 grid gap-2">
                {model.evaluations.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === evaluation.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Users}
                    accent="blue"
                    onClick={() => setEvaluationId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              result.qualified
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.qualified ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">
                  Illustrative qualification result
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {result.qualified
                    ? 'Every represented group meets both benchmarks'
                    : 'At least one represented group misses the operating point'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {result.qualified
                    ? 'This threshold qualifies only for the modeled test conditions. Production drift, new sensors, software changes, and additional populations still require evaluation.'
                    : 'Do not average the groups into a passing aggregate. Change the system, threshold, capture conditions, or deployment decision, then test every affected group again.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Expected false matches"
              value={formatExpected(result.totalFalseMatches)}
              detail={`${formatInteger(evaluation.impostorTrials)} zero-effort impostor trials`}
              icon={ShieldCheck}
              tone={result.fmrPassingGroups === result.groups.length ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Expected false non-matches"
              value={formatExpected(result.totalFalseNonMatches)}
              detail={`${formatInteger(evaluation.genuineTrials)} genuine trials`}
              icon={ScanFace}
              tone={result.fnmrPassingGroups === result.groups.length ? 'blue' : 'amber'}
            />
            <LabMetric
              label="Groups meeting both"
              value={`${result.groups.filter((group) => group.meetsFmr && group.meetsFnmr).length}/${result.groups.length}`}
              detail="One fixed threshold, evaluated separately"
              icon={Users}
              tone={result.qualified ? 'emerald' : 'rose'}
            />
          </div>

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Group evidence
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  A passing average cannot hide a failing group
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatInteger(result.genuineTrialsPerGroup)} genuine +{' '}
                {formatInteger(result.impostorTrialsPerGroup)} impostor trials per group
              </p>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {result.groups.map((group) => (
                <article
                  key={group.id}
                  className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {group.label}
                    </h5>
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        group.meetsFmr && group.meetsFnmr
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                      }`}
                    >
                      {group.meetsFmr && group.meetsFnmr ? 'Meets both' : 'Action required'}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <RateResult
                      label="False match rate"
                      rate={group.fmr}
                      expected={group.falseMatches}
                      passing={group.meetsFmr}
                      benchmark={model.benchmark.fmrLabel}
                      inverse
                    />
                    <RateResult
                      label="False non-match rate"
                      rate={group.fnmr}
                      expected={group.falseNonMatches}
                      passing={group.meetsFnmr}
                      benchmark={model.benchmark.fnmrLabel}
                    />
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            <div className="flex items-start gap-3">
              <Calculator
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300"
              />
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">
                  Arithmetic used by this lab
                </p>
                <p className="mt-1 leading-6">
                  Expected false matches = impostor trials x FMR. Expected false
                  non-matches = genuine trials x FNMR. These are expected values from
                  hypothetical measured rates, not promises about a product or future traffic.
                </p>
              </div>
            </div>
          </div>

          <p className="sr-only">
            Worst false match rate is {formatRate(result.worstFmr, true)}. Worst false
            non-match rate is {formatRate(result.worstFnmr, false)}.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function RateResult({
  label,
  rate,
  expected,
  passing,
  benchmark,
  inverse = false,
}: {
  label: string;
  rate: number;
  expected: number;
  passing: boolean;
  benchmark: string;
  inverse?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        passing
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
          : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25'
      }`}
    >
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
        {formatRate(rate, inverse)}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {formatExpected(expected)} expected. {passing ? 'Meets' : 'Misses'} {benchmark}.
      </dd>
    </div>
  );
}

function formatRate(rate: number, inverse: boolean) {
  if (inverse && rate > 0) return `1 in ${Math.round(1 / rate).toLocaleString()}`;
  return `${(rate * 100).toFixed(rate < 0.001 ? 4 : 1)}%`;
}

function formatExpected(value: number) {
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 10) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatInteger(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Threshold model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-36 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading threshold validation model...
        </div>
      )}
    </div>
  );
}
