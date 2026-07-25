'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Beaker,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Ruler,
  ShieldAlert,
  Sigma,
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
  '/api/content/ml-systems/scientific-ml/data/surrogate-design-cases.json';
const BLOCK_ID = 'ml-systems/scientific-ml-surrogate-design-lab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  fit: number;
  residualControl: number;
  boundaryControl: number;
  transfer: number;
  costMultiplier: number;
};

type Limits = {
  dataError: number;
  residual: number;
  boundaryError: number;
  extrapolationRisk: number;
};

type ScientificCase = {
  id: string;
  label: string;
  context: string;
  decision: string;
  baseDataError: number;
  baseResidual: number;
  baseBoundaryError: number;
  baseExtrapolationRisk: number;
  baseTrainingMinutes: number;
  limits: Limits;
};

type LabData = {
  title: string;
  description: string;
  defaultCase: string;
  defaultStrategy: string;
  defaultCoverage: number;
  defaultConstraintEmphasis: number;
  strategies: Strategy[];
  cases: ScientificCase[];
};

type EvidenceRowProps = {
  label: string;
  value: number;
  limit: number;
  detail: string;
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultCase === 'string' &&
      typeof data.defaultStrategy === 'string' &&
      typeof data.defaultCoverage === 'number' &&
      typeof data.defaultConstraintEmphasis === 'number' &&
      Array.isArray(data.strategies) &&
      data.strategies.length >= 3 &&
      data.strategies.every(
        (strategy) =>
          typeof strategy.id === 'string' &&
          typeof strategy.fit === 'number' &&
          typeof strategy.residualControl === 'number',
      ) &&
      Array.isArray(data.cases) &&
      data.cases.length > 0 &&
      data.cases.every(
        (item) =>
          typeof item.id === 'string' &&
          typeof item.baseDataError === 'number' &&
          typeof item.limits === 'object',
      ),
  );
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function EvidenceRow({ label, value, limit, detail }: EvidenceRowProps) {
  const scaleMaximum = Math.max(40, limit * 2.6, value * 1.12);
  const valueWidth = clamp((value / scaleMaximum) * 100);
  const limitPosition = clamp((limit / scaleMaximum) * 100);
  const passes = value <= limit;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${
            passes
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          {passes ? (
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {value.toFixed(1)}% / limit {limit}%
        </span>
      </div>
      <div
        className="relative mt-3 h-3 rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={`${label}: ${value.toFixed(1)} percent, limit ${limit} percent`}
        aria-valuenow={Number(value.toFixed(1))}
        aria-valuemin={0}
        aria-valuemax={Math.round(scaleMaximum)}
      >
        <div
          className={`h-3 rounded-full transition-[width] motion-reduce:transition-none ${
            passes ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${valueWidth}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-1 h-5 w-0.5 bg-neutral-950 dark:bg-white"
          style={{ left: `${limitPosition}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

export default function ScientificMlSurrogateDesignLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState('thermal-plate');
  const [strategyId, setStrategyId] = useState('soft-constraints');
  const [coverage, setCoverage] = useState(68);
  const [constraintEmphasis, setConstraintEmphasis] = useState(62);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load surrogate cases (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The surrogate cases have an invalid contract.');
        setData(value);
        setCaseId(value.defaultCase);
        setStrategyId(value.defaultStrategy);
        setCoverage(value.defaultCoverage);
        setConstraintEmphasis(value.defaultConstraintEmphasis);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scientificCase = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
    const strategy =
      data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
    const coverageRatio = coverage / 100;
    const emphasisRatio = constraintEmphasis / 100;

    const dataError =
      scientificCase.baseDataError * (1.2 - 0.72 * coverageRatio) / strategy.fit;
    const residual =
      scientificCase.baseResidual * (1 - strategy.residualControl * emphasisRatio);
    const boundaryError =
      scientificCase.baseBoundaryError * (1 - strategy.boundaryControl * emphasisRatio);
    const extrapolationRisk =
      scientificCase.baseExtrapolationRisk *
      (1 - strategy.transfer * coverageRatio * (0.55 + 0.45 * emphasisRatio));
    const trainingMinutes = Math.round(
      scientificCase.baseTrainingMinutes *
        strategy.costMultiplier *
        (0.55 + 0.45 * coverageRatio) *
        (1 + emphasisRatio / 3),
    );
    const evidence = [
      dataError <= scientificCase.limits.dataError,
      residual <= scientificCase.limits.residual,
      boundaryError <= scientificCase.limits.boundaryError,
      extrapolationRisk <= scientificCase.limits.extrapolationRisk,
    ];
    const passed = evidence.filter(Boolean).length;

    return {
      scientificCase,
      strategy,
      dataError,
      residual,
      boundaryError,
      extrapolationRisk,
      trainingMinutes,
      passed,
      ready: passed === evidence.length,
    };
  }, [caseId, constraintEmphasis, coverage, data, strategyId]);

  const reset = () => {
    if (!data) return;
    setCaseId(data.defaultCase);
    setStrategyId(data.defaultStrategy);
    setCoverage(data.defaultCoverage);
    setConstraintEmphasis(data.defaultConstraintEmphasis);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading surrogate design lab"
      />
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Surrogate design studio"
          title={data.title}
          description={data.description}
          icon={Beaker}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the scientific case
                </legend>
                <div className="mt-3 space-y-2">
                  {data.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === result.scientificCase.id}
                      label={item.label}
                      detail={item.context}
                      accent="blue"
                      onClick={() => setCaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose structural enforcement
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((strategy) => (
                    <LabChoice
                      key={strategy.id}
                      selected={strategy.id === result.strategy.id}
                      label={strategy.label}
                      detail={strategy.detail}
                      accent="violet"
                      onClick={() => setStrategyId(strategy.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Observation coverage"
                value={coverage}
                output={`${coverage}%`}
                min={20}
                max={100}
                step={2}
                accent="blue"
                lowLabel="Sparse regime"
                highLabel="Broad regime"
                onChange={setCoverage}
              />

              <LabRange
                label="Constraint emphasis"
                value={constraintEmphasis}
                output={`${constraintEmphasis}%`}
                min={0}
                max={100}
                step={2}
                accent="violet"
                lowLabel="Fit dominates"
                highLabel="Constraint dominates"
                onChange={setConstraintEmphasis}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Decision under study
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.scientificCase.decision}
                </h4>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  result.ready
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                }`}
              >
                {result.ready ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                )}
                {result.passed} of 4 gates pass
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <EvidenceRow
                label="In-regime data error"
                value={result.dataError}
                limit={result.scientificCase.limits.dataError}
                detail="Held-out observations inside the represented operating envelope."
              />
              <EvidenceRow
                label="Equation residual"
                value={result.residual}
                limit={result.scientificCase.limits.residual}
                detail="A normalized governing-relation check reported separately from fit."
              />
              <EvidenceRow
                label="Boundary error"
                value={result.boundaryError}
                limit={result.scientificCase.limits.boundaryError}
                detail="A boundary or initial-condition check with its own release limit."
              />
              <EvidenceRow
                label="Extrapolation risk"
                value={result.extrapolationRisk}
                limit={result.scientificCase.limits.extrapolationRisk}
                detail="Illustrative unsupported-regime risk; validate with protected evidence."
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Evidence coverage"
                value={`${coverage}%`}
                detail="How much of the intended regime is represented"
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Constraint emphasis"
                value={`${constraintEmphasis}%`}
                detail="An objective choice, not a validity score"
                icon={Sigma}
                tone="violet"
              />
              <LabMetric
                label="Training estimate"
                value={`${result.trainingMinutes} min`}
                detail="Illustrative relative cost for this workbench"
                icon={Clock3}
                tone="amber"
              />
            </div>

            <div
              className={`mt-5 rounded-md border p-5 ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {result.ready ? (
                  <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">
                    {result.ready ? 'Candidate meets this illustrative envelope' : 'The scalar loss would hide a failed gate'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.ready
                      ? 'Move to independent regime validation and uncertainty gating; these modeled scores are not deployment evidence.'
                      : 'Change coverage, structural enforcement, or the scientific model. Do not compensate for one failed channel by over-weighting another.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              <div className="flex items-start gap-2">
                <Ruler aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This lab is an explanatory sensitivity model. Its formulas and limits are not physical measurements and must be replaced with domain-specific evidence.
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
