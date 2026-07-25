'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  Gauge,
  ListChecks,
  ScanSearch,
  ShieldAlert,
  Target,
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

const BLOCK_ID = 'genai/advanced-image-captioning-release-gate-lab';

type GateDefaults = {
  minimumCoveragePct: number;
  maximumHallucinationCasePct: number;
  maximumSliceGapPct: number;
};

type Policy = {
  id: 'aggregate-only' | 'slice-aware';
  label: string;
  detail: string;
};

type Slice = {
  id: string;
  label: string;
};

type EvaluationCase = {
  id: string;
  label: string;
  sliceId: string;
  requiredFacts: number;
};

type Outcome = {
  caseId: string;
  coveredFacts: number;
  unsupportedClaims: number;
  safetyViolations: number;
  note: string;
};

type CandidateRun = {
  id: string;
  label: string;
  detail: string;
  outcomes: Outcome[];
};

type ReleaseData = {
  title: string;
  description: string;
  evidenceNote: string;
  defaultRunId: string;
  defaultPolicyId: Policy['id'];
  defaults: GateDefaults;
  policies: Policy[];
  slices: Slice[];
  cases: EvaluationCase[];
  runs: CandidateRun[];
};

type Check = {
  id: string;
  label: string;
  actual: string;
  required: string;
  passed: boolean;
};

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.evidenceNote
      && candidate.defaultRunId
      && candidate.defaults
      && typeof candidate.defaults.minimumCoveragePct === 'number'
      && typeof candidate.defaults.maximumHallucinationCasePct === 'number'
      && typeof candidate.defaults.maximumSliceGapPct === 'number'
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && Array.isArray(candidate.slices)
      && candidate.slices.length > 0
      && Array.isArray(candidate.cases)
      && candidate.cases.length > 0
      && candidate.cases.every((item) => (
        Boolean(item.id && item.label && item.sliceId) && item.requiredFacts > 0
      ))
      && Array.isArray(candidate.runs)
      && candidate.runs.length > 0
      && candidate.runs.every((run) => (
        Boolean(run.id && run.label)
          && Array.isArray(run.outcomes)
          && run.outcomes.length === candidate.cases?.length
      )),
  );
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function CaptionReleaseGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No release evidence was supplied.');
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
        if (!isReleaseData(payload)) {
          throw new Error('Release evidence is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((key) => key + 1)}
        title="Release lab unavailable"
      />
    );
  }

  if (!data) {
    return <LoadState error={null} onRetry={() => undefined} title="Loading release evidence" />;
  }

  return <ReleaseLab data={data} />;
}

function ReleaseLab({ data }: { data: ReleaseData }) {
  const defaultRun = data.runs.find((run) => run.id === data.defaultRunId) ?? data.runs[0];
  const defaultPolicy = data.policies.find((policy) => policy.id === data.defaultPolicyId)
    ?? data.policies[0];
  const [runId, setRunId] = useState(defaultRun.id);
  const [policyId, setPolicyId] = useState<Policy['id']>(defaultPolicy.id);
  const [minimumCoveragePct, setMinimumCoveragePct] = useState(
    data.defaults.minimumCoveragePct,
  );
  const [maximumHallucinationCasePct, setMaximumHallucinationCasePct] = useState(
    data.defaults.maximumHallucinationCasePct,
  );
  const [maximumSliceGapPct, setMaximumSliceGapPct] = useState(
    data.defaults.maximumSliceGapPct,
  );
  const [caseFilter, setCaseFilter] = useState('all');

  const result = useMemo(() => {
    const run = data.runs.find((item) => item.id === runId) ?? data.runs[0];
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const outcomeByCase = new Map(run.outcomes.map((outcome) => [outcome.caseId, outcome]));
    const joined = data.cases.map((item) => ({
      ...item,
      outcome: outcomeByCase.get(item.id) ?? {
        caseId: item.id,
        coveredFacts: 0,
        unsupportedClaims: 0,
        safetyViolations: 1,
        note: 'Missing outcome record.',
      },
    }));
    const totalRequired = joined.reduce((sum, item) => sum + item.requiredFacts, 0);
    const totalCovered = joined.reduce((sum, item) => sum + item.outcome.coveredFacts, 0);
    const hallucinationCases = joined.filter((item) => item.outcome.unsupportedClaims > 0).length;
    const unsupportedClaims = joined.reduce(
      (sum, item) => sum + item.outcome.unsupportedClaims,
      0,
    );
    const safetyViolations = joined.reduce(
      (sum, item) => sum + item.outcome.safetyViolations,
      0,
    );
    const coveragePct = ratio(totalCovered, totalRequired) * 100;
    const hallucinationCasePct = ratio(hallucinationCases, joined.length) * 100;
    const sliceResults = data.slices.map((slice) => {
      const sliceCases = joined.filter((item) => item.sliceId === slice.id);
      const required = sliceCases.reduce((sum, item) => sum + item.requiredFacts, 0);
      const covered = sliceCases.reduce((sum, item) => sum + item.outcome.coveredFacts, 0);
      return {
        ...slice,
        cases: sliceCases.length,
        covered,
        coveragePct: ratio(covered, required) * 100,
        required,
      };
    });
    const bestSlice = [...sliceResults].sort(
      (left, right) => right.coveragePct - left.coveragePct,
    )[0];
    const worstSlice = [...sliceResults].sort(
      (left, right) => left.coveragePct - right.coveragePct,
    )[0];
    const sliceGapPct = bestSlice.coveragePct - worstSlice.coveragePct;
    const checks: Check[] = [
      {
        id: 'coverage',
        label: 'Required-fact coverage',
        actual: `${formatPct(coveragePct)} (${totalCovered}/${totalRequired})`,
        required: `at least ${minimumCoveragePct}%`,
        passed: coveragePct >= minimumCoveragePct,
      },
      {
        id: 'hallucination',
        label: 'Hallucination-case rate',
        actual: `${formatPct(hallucinationCasePct)} (${hallucinationCases}/${joined.length} cases)`,
        required: `at most ${maximumHallucinationCasePct}%`,
        passed: hallucinationCasePct <= maximumHallucinationCasePct,
      },
      {
        id: 'safety',
        label: 'Safety violations',
        actual: `${safetyViolations}`,
        required: 'exactly 0',
        passed: safetyViolations === 0,
      },
      {
        id: 'slice',
        label: 'Best-to-worst slice gap',
        actual: `${formatPct(sliceGapPct)} (${bestSlice.label} vs ${worstSlice.label})`,
        required: policy.id === 'slice-aware'
          ? `at most ${maximumSliceGapPct} points`
          : 'not checked by this policy',
        passed: policy.id === 'aggregate-only' || sliceGapPct <= maximumSliceGapPct,
      },
    ];

    return {
      checks,
      coveragePct,
      hallucinationCasePct,
      joined,
      policy,
      ready: checks.every((check) => check.passed),
      run,
      safetyViolations,
      sliceGapPct,
      sliceResults,
      unsupportedClaims,
    };
  }, [
    data,
    maximumHallucinationCasePct,
    maximumSliceGapPct,
    minimumCoveragePct,
    policyId,
    runId,
  ]);

  function reset() {
    setRunId(defaultRun.id);
    setPolicyId(defaultPolicy.id);
    setMinimumCoveragePct(data.defaults.minimumCoveragePct);
    setMaximumHallucinationCasePct(data.defaults.maximumHallucinationCasePct);
    setMaximumSliceGapPct(data.defaults.maximumSliceGapPct);
    setCaseFilter('all');
  }

  const visibleCases = result.joined.filter(
    (item) => caseFilter === 'all' || item.sliceId === caseFilter,
  );

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation and release lab"
          title={data.title}
          description={data.description}
          icon={ListChecks}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a candidate run
                </legend>
                <div className="mt-3 space-y-2">
                  {data.runs.map((run) => (
                    <LabChoice
                      key={run.id}
                      selected={run.id === result.run.id}
                      label={run.label}
                      detail={run.detail}
                      icon={BarChart3}
                      accent={run.id === 'sensitive-3' ? 'rose' : 'amber'}
                      onClick={() => setRunId(run.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose a gate policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === result.policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'slice-aware' ? Target : Gauge}
                      accent={policy.id === 'slice-aware' ? 'emerald' : 'blue'}
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Minimum coverage"
                value={minimumCoveragePct}
                output={`${minimumCoveragePct}%`}
                min={65}
                max={100}
                step={1}
                lowLabel="65%"
                highLabel="100%"
                accent="cyan"
                onChange={setMinimumCoveragePct}
              />
              <LabRange
                label="Maximum hallucination cases"
                value={maximumHallucinationCasePct}
                output={`${maximumHallucinationCasePct}%`}
                min={0}
                max={40}
                step={1}
                lowLabel="0%"
                highLabel="40%"
                accent="rose"
                onChange={setMaximumHallucinationCasePct}
              />
              <LabRange
                label="Maximum slice gap"
                value={maximumSliceGapPct}
                output={`${maximumSliceGapPct} points`}
                min={0}
                max={50}
                step={1}
                lowLabel="0"
                highLabel="50"
                accent="violet"
                onChange={setMaximumSliceGapPct}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Coverage"
              value={formatPct(result.coveragePct)}
              detail="Covered required facts / all required facts"
              icon={ScanSearch}
              tone={result.checks[0].passed ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Hallucination cases"
              value={formatPct(result.hallucinationCasePct)}
              detail={`${result.unsupportedClaims} unsupported claims across the set`}
              icon={CircleAlert}
              tone={result.checks[1].passed ? 'cyan' : 'rose'}
            />
            <LabMetric
              label="Safety violations"
              value={`${result.safetyViolations}`}
              detail="The hard release requirement is zero"
              icon={ShieldAlert}
              tone={result.safetyViolations === 0 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Slice gap"
              value={`${formatPct(result.sliceGapPct)}`}
              detail={result.policy.id === 'slice-aware' ? 'Included in verdict' : 'Hidden by policy'}
              icon={Target}
              tone={result.checks[3].passed ? 'violet' : 'rose'}
            />
          </div>

          <div
            className={`mt-4 rounded-md border p-4 ${
              result.ready
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ready ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
              ) : (
                <XCircle
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                />
              )}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Release verdict
                </p>
                <p className="mt-1 text-xl font-bold text-neutral-950 dark:text-white">
                  {result.ready ? 'Candidate may proceed to canary' : 'Hold this candidate'}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {result.ready
                    ? 'Every enabled hard check passes on this finite synthetic set.'
                    : `${result.checks.filter((check) => !check.passed).length} enabled check${result.checks.filter((check) => !check.passed).length === 1 ? '' : 's'} fail. Inspect the evidence before changing a threshold.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result.checks.map((check) => (
              <div
                key={check.id}
                className={`rounded-md border p-4 ${
                  check.passed
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/25'
                }`}
              >
                <div className="flex items-center gap-2">
                  {check.passed ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
                    />
                  ) : (
                    <XCircle
                      aria-hidden="true"
                      className="h-4 w-4 text-rose-700 dark:text-rose-300"
                    />
                  )}
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {check.label}
                  </p>
                </div>
                <p className="mt-2 text-sm tabular-nums text-neutral-700 dark:text-neutral-200">
                  {check.actual}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Required: {check.required}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/45">
            <div className="flex items-center gap-2">
              <BarChart3 aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Required-fact coverage by slice
              </p>
            </div>
            <div className="mt-4 space-y-4">
              {result.sliceResults.map((slice) => (
                <div key={slice.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">
                      {slice.label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {formatPct(slice.coveragePct)} ({slice.covered}/{slice.required})
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded ${
                        slice.coveragePct >= minimumCoveragePct ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${slice.coveragePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Case-level evidence
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Every aggregate above traces to these integer outcomes.
                </p>
              </div>
              <label className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Slice
                <select
                  value={caseFilter}
                  onChange={(event) => setCaseFilter(event.target.value)}
                  className="mt-2 block w-full min-w-48 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium normal-case text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  <option value="all">All cases</option>
                  {data.slices.map((slice) => (
                    <option key={slice.id} value={slice.id}>{slice.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {visibleCases.map((item) => {
                const failed = item.outcome.unsupportedClaims > 0
                  || item.outcome.safetyViolations > 0
                  || item.outcome.coveredFacts < item.requiredFacts;
                return (
                  <article
                    key={item.id}
                    className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {data.slices.find((slice) => slice.id === item.sliceId)?.label}
                        </p>
                      </div>
                      {failed ? (
                        <CircleAlert
                          aria-label="Case has a recorded failure"
                          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300"
                        />
                      ) : (
                        <BadgeCheck
                          aria-label="Case satisfies all recorded facts"
                          className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                        />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                        Coverage {item.outcome.coveredFacts}/{item.requiredFacts}
                      </span>
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                        Unsupported {item.outcome.unsupportedClaims}
                      </span>
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                        Safety {item.outcome.safetyViolations}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {item.outcome.note}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100">
            <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">{data.evidenceNote}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
  title,
}: {
  error: string | null;
  onRetry: () => void;
  title: string;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-48 rounded-md border p-5 ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
        }`}
        role={error ? 'alert' : 'status'}
      >
        {error ? <FileWarning aria-hidden="true" className="h-5 w-5" /> : null}
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-2 text-sm opacity-80">
          {error ?? 'Preparing the finite evaluation records and release gates.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
