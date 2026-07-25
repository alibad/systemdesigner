'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  FileWarning,
  Scale,
  ShieldAlert,
  Shuffle,
  Users,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CalibrationGate = {
  minimumDecisionCoveragePct: number;
  minimumAgreementPct: number;
  maximumSevereMisses: number;
  maximumPositionFlipPct: number;
};

type Rubric = {
  id: string;
  label: string;
  detail: string;
  decisionRule: string;
};

type RubricOutcome = {
  rubricId: string;
  panelMatches: number;
  panelDisagreements: number;
  abstentions: number;
  severeMisses: number;
  positionFlips: number;
};

type CalibrationSlice = {
  id: string;
  label: string;
  detail: string;
  sampleCount: number;
  positionChecks: number;
  outcomes: RubricOutcome[];
};

type CalibrationData = {
  title: string;
  description: string;
  defaultSliceId: string;
  defaultRubricId: string;
  gate: CalibrationGate;
  rubrics: Rubric[];
  slices: CalibrationSlice[];
};

type GateCheck = {
  id: string;
  label: string;
  actual: string;
  required: string;
  passed: boolean;
};

function isCalibrationData(value: unknown): value is CalibrationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CalibrationData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultSliceId
      && candidate.defaultRubricId
      && candidate.gate
      && typeof candidate.gate.minimumAgreementPct === 'number'
      && Array.isArray(candidate.rubrics)
      && candidate.rubrics.length > 0
      && candidate.rubrics.every((rubric) => (
        Boolean(rubric.id && rubric.label && rubric.decisionRule)
      ))
      && Array.isArray(candidate.slices)
      && candidate.slices.length > 0
      && candidate.slices.every((slice) => (
        slice.sampleCount > 0
          && slice.positionChecks > 0
          && Array.isArray(slice.outcomes)
          && slice.outcomes.length > 0
      )),
  );
}

export default function LlmJudgeRubricCalibrationLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No calibration evidence was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCalibrationData(payload)) {
          throw new Error('Calibration data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load calibration evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        title="Calibration lab unavailable"
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  if (!data) {
    return <LoadState error={null} title="Loading calibration evidence" onRetry={() => undefined} />;
  }

  return <CalibrationLab data={data} />;
}

function CalibrationLab({ data }: { data: CalibrationData }) {
  const defaultSlice = data.slices.find((slice) => slice.id === data.defaultSliceId)
    ?? data.slices[0];
  const defaultRubric = data.rubrics.find((rubric) => rubric.id === data.defaultRubricId)
    ?? data.rubrics[0];
  const [sliceId, setSliceId] = useState(defaultSlice.id);
  const [rubricId, setRubricId] = useState(defaultRubric.id);

  const slice = data.slices.find((item) => item.id === sliceId) ?? data.slices[0];
  const rubric = data.rubrics.find((item) => item.id === rubricId) ?? data.rubrics[0];
  const outcome = slice.outcomes.find((item) => item.rubricId === rubric.id)
    ?? slice.outcomes[0];

  const result = useMemo(() => {
    const decided = Math.max(0, slice.sampleCount - outcome.abstentions);
    const decisionCoveragePct = percent(decided, slice.sampleCount);
    const agreementPct = percent(outcome.panelMatches, decided);
    const positionFlipPct = percent(outcome.positionFlips, slice.positionChecks);
    const counted = outcome.panelMatches + outcome.panelDisagreements + outcome.abstentions;
    const checks: GateCheck[] = [
      {
        id: 'coverage',
        label: 'Decision coverage',
        actual: `${formatPct(decisionCoveragePct)} (${decided}/${slice.sampleCount})`,
        required: `at least ${data.gate.minimumDecisionCoveragePct}%`,
        passed: decisionCoveragePct >= data.gate.minimumDecisionCoveragePct,
      },
      {
        id: 'agreement',
        label: 'Panel-reference agreement',
        actual: `${formatPct(agreementPct)} (${outcome.panelMatches}/${decided})`,
        required: `at least ${data.gate.minimumAgreementPct}%`,
        passed: agreementPct >= data.gate.minimumAgreementPct,
      },
      {
        id: 'severe',
        label: 'Severe misses',
        actual: `${outcome.severeMisses}`,
        required: `at most ${data.gate.maximumSevereMisses}`,
        passed: outcome.severeMisses <= data.gate.maximumSevereMisses,
      },
      {
        id: 'position',
        label: 'Order-flip rate',
        actual: `${formatPct(positionFlipPct)} (${outcome.positionFlips}/${slice.positionChecks})`,
        required: `at most ${data.gate.maximumPositionFlipPct}%`,
        passed: positionFlipPct <= data.gate.maximumPositionFlipPct,
      },
    ];

    return {
      agreementPct,
      calibrated: counted === slice.sampleCount && checks.every((check) => check.passed),
      checks,
      counted,
      decided,
      decisionCoveragePct,
      positionFlipPct,
    };
  }, [data.gate, outcome, slice]);

  function reset() {
    setSliceId(defaultSlice.id);
    setRubricId(defaultRubric.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Rubric calibration lab"
        title={data.title}
        description={data.description}
        icon={BookOpenCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose a task slice
              </legend>
              <div className="mt-3 space-y-2">
                {data.slices.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={slice.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Users}
                    accent="blue"
                    onClick={() => setSliceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose a rubric contract
              </legend>
              <div className="mt-3 space-y-2">
                {data.rubrics.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={rubric.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'anchored-abstain' ? CircleSlash2 : Scale}
                    accent={item.id === 'vague' ? 'amber' : 'violet'}
                    onClick={() => setRubricId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Decision coverage"
            value={formatPct(result.decisionCoveragePct)}
            detail={`${result.decided} decided / ${slice.sampleCount} total`}
            icon={BadgeCheck}
            tone={result.decisionCoveragePct >= data.gate.minimumDecisionCoveragePct ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Panel agreement"
            value={formatPct(result.agreementPct)}
            detail={`${outcome.panelMatches} matches / ${result.decided} decided`}
            icon={Users}
            tone={result.agreementPct >= data.gate.minimumAgreementPct ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Severe misses"
            value={`${outcome.severeMisses}`}
            detail={`Maximum allowed: ${data.gate.maximumSevereMisses}`}
            icon={FileWarning}
            tone={outcome.severeMisses <= data.gate.maximumSevereMisses ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Order flips"
            value={formatPct(result.positionFlipPct)}
            detail={`${outcome.positionFlips} flips / ${slice.positionChecks} swaps`}
            icon={Shuffle}
            tone={result.positionFlipPct <= data.gate.maximumPositionFlipPct ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-950 dark:bg-violet-950 dark:text-violet-100">
                {rubric.label}
              </span>
              <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                Synthetic calibration evidence
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold text-neutral-950 dark:text-white">
              {rubric.decisionRule}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {rubric.detail}
            </p>

            <div
              className="mt-5 flex h-5 overflow-hidden rounded-sm border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
              aria-label={`${outcome.panelMatches} panel matches, ${outcome.panelDisagreements} disagreements, and ${outcome.abstentions} abstentions`}
            >
              <span
                className="bg-emerald-500"
                style={{ width: `${percent(outcome.panelMatches, slice.sampleCount)}%` }}
                title={`${outcome.panelMatches} panel matches`}
              />
              <span
                className="bg-rose-500"
                style={{ width: `${percent(outcome.panelDisagreements, slice.sampleCount)}%` }}
                title={`${outcome.panelDisagreements} disagreements`}
              />
              <span
                className="bg-amber-400"
                style={{ width: `${percent(outcome.abstentions, slice.sampleCount)}%` }}
                title={`${outcome.abstentions} abstentions`}
              />
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <EvidenceCount
                label="Panel matches"
                value={`${outcome.panelMatches}`}
                markerClass="bg-emerald-500"
              />
              <EvidenceCount
                label="Disagreements"
                value={`${outcome.panelDisagreements}`}
                markerClass="bg-rose-500"
              />
              <EvidenceCount
                label="Abstentions"
                value={`${outcome.abstentions}`}
                markerClass="bg-amber-400"
              />
            </dl>

            <div className="mt-5 rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">Visible arithmetic</p>
              <p className="mt-2">
                Decision coverage = ({slice.sampleCount} - {outcome.abstentions}) / {slice.sampleCount}
                {' = '}
                {formatPct(result.decisionCoveragePct)}.
              </p>
              <p className="mt-1">
                Agreement among decided cases = {outcome.panelMatches} / {result.decided}
                {' = '}
                {formatPct(result.agreementPct)}.
              </p>
            </div>
          </section>

          <section className="min-w-0">
            <div
              aria-live="polite"
              className={`rounded-md border p-5 ${
                result.calibrated
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.calibrated ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Calibration decision</p>
                  <p className="mt-2 text-xl font-semibold">
                    {result.calibrated ? 'Calibrated for this slice' : 'Hold and revise the evaluator'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.calibrated
                      ? 'Every predeclared check passes on this synthetic slice. Other required slices still need independent evidence.'
                      : `${result.checks.filter((check) => !check.passed).length} checks fail. Do not hide the result inside an overall average.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {result.checks.map((check) => (
                <div
                  key={check.id}
                  className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    check.passed
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-50'
                      : 'border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {check.passed ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{check.label}</span>
                  </div>
                  <div className="text-left text-xs sm:text-right">
                    <span className="font-semibold">{check.actual}</span>
                    <span className="ml-2 opacity-70">{check.required}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
              <Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                Panel agreement measures correspondence with a declared human reference process.
                It does not prove that either side is universally correct.
              </p>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidenceCount({
  label,
  value,
  markerClass,
}: {
  label: string;
  value: string;
  markerClass: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <dt className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${markerClass}`} />
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</dd>
    </div>
  );
}

function LoadState({
  error,
  title,
  onRetry,
}: {
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={`not-prose my-7 rounded-lg border p-6 ${
        error
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
      role={error ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        {error ? (
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
        )}
        <div>
          <p className="font-semibold">{title}</p>
          {error ? <p className="mt-2 text-sm opacity-80">{error}</p> : null}
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}
