'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Coins,
  Gauge,
  Play,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Workload = {
  id: string;
  label: string;
  detail: string;
  candidateCallsPerCase: number;
  scorerCallsPerCase: number;
  candidateTokensPerCase: number;
  scorerTokensPerCase: number;
  candidateCostPerMillionTokens: number;
  scorerCostPerMillionTokens: number;
  executionSecondsPerCase: number;
  reviewMinutesPerCase: number;
};

type CapacityData = {
  defaults: {
    workloadId: string;
    casesPerRelease: number;
    releasesPerDay: number;
    humanReviewPct: number;
    reviewers: number;
    runnerConcurrency: number;
  };
  reviewHoursPerReviewer: number;
  workloads: Workload[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/evaluation-platforms/data/platform-capacity.json';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const defaults = candidate.defaults;
  return Boolean(defaults)
    && typeof defaults?.workloadId === 'string'
    && typeof defaults.casesPerRelease === 'number'
    && typeof defaults.releasesPerDay === 'number'
    && typeof defaults.humanReviewPct === 'number'
    && typeof defaults.reviewers === 'number'
    && typeof defaults.runnerConcurrency === 'number'
    && typeof candidate.reviewHoursPerReviewer === 'number'
    && Array.isArray(candidate.workloads)
    && candidate.workloads.length > 0
    && candidate.workloads.every((workload) => (
      typeof workload.id === 'string'
      && typeof workload.label === 'string'
      && typeof workload.candidateCallsPerCase === 'number'
      && typeof workload.scorerCallsPerCase === 'number'
      && typeof workload.executionSecondsPerCase === 'number'
      && typeof workload.reviewMinutesPerCase === 'number'
    ));
}

const count = (value: number) => Math.round(value).toLocaleString();
const hours = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)} h`;
const money = (value: number) => `$${value.toLocaleString(undefined, {
  maximumFractionDigits: value < 100 ? 2 : 0,
})}`;

export default function EvaluationPlatformsCapacityReviewLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workloadId, setWorkloadId] = useState('');
  const [casesPerRelease, setCasesPerRelease] = useState(1200);
  const [releasesPerDay, setReleasesPerDay] = useState(4);
  const [humanReviewPct, setHumanReviewPct] = useState(8);
  const [reviewers, setReviewers] = useState(3);
  const [runnerConcurrency, setRunnerConcurrency] = useState(40);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isCapacityData(payload)) throw new Error('Capacity data is incomplete.');

        if (active) {
          setData(payload);
          setWorkloadId(payload.defaults.workloadId);
          setCasesPerRelease(payload.defaults.casesPerRelease);
          setReleasesPerDay(payload.defaults.releasesPerDay);
          setHumanReviewPct(payload.defaults.humanReviewPct);
          setReviewers(payload.defaults.reviewers);
          setRunnerConcurrency(payload.defaults.runnerConcurrency);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load capacity data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const workload = data?.workloads.find((item) => item.id === workloadId)
    ?? data?.workloads[0];

  const model = useMemo(() => {
    if (!data || !workload) return null;

    const dailyCases = casesPerRelease * releasesPerDay;
    const candidateCalls = dailyCases * workload.candidateCallsPerCase;
    const scorerCalls = dailyCases * workload.scorerCallsPerCase;
    const candidateTokens = dailyCases * workload.candidateTokensPerCase;
    const scorerTokens = dailyCases * workload.scorerTokensPerCase;
    const dailyCost = candidateTokens / 1_000_000 * workload.candidateCostPerMillionTokens
      + scorerTokens / 1_000_000 * workload.scorerCostPerMillionTokens;
    const runnerHoursPerDay = dailyCases * workload.executionSecondsPerCase
      / runnerConcurrency / 3600;
    const runnerCapacityCases = runnerConcurrency * 86_400 / workload.executionSecondsPerCase;
    const runnerLoadPct = dailyCases / runnerCapacityCases * 100;
    const reviewCasesPerDay = Math.ceil(dailyCases * humanReviewPct / 100);
    const reviewerCapacityCases = Math.floor(
      reviewers * data.reviewHoursPerReviewer * 60 / workload.reviewMinutesPerCase,
    );
    const reviewerLoadPct = reviewCasesPerDay / reviewerCapacityCases * 100;
    const backlogCases = Math.max(0, reviewCasesPerDay - reviewerCapacityCases);
    const reviewThroughputPerHour = reviewers * 60 / workload.reviewMinutesPerCase;
    const queueDelayHours = backlogCases / reviewThroughputPerHour;
    const runHoursPerRelease = casesPerRelease * workload.executionSecondsPerCase
      / runnerConcurrency / 3600;
    const reviewHoursPerRelease = casesPerRelease * humanReviewPct / 100
      * workload.reviewMinutesPerCase / reviewers / 60;
    const gateLeadHours = runHoursPerRelease + reviewHoursPerRelease + queueDelayHours;
    const healthy = runnerLoadPct <= 100 && reviewerLoadPct <= 100 && gateLeadHours <= 8;
    const status = runnerLoadPct > 100
      ? `Runner capacity falls behind by ${count(dailyCases - runnerCapacityCases)} cases per day.`
      : reviewerLoadPct > 100
        ? `The human queue grows by ${count(backlogCases)} cases per day.`
        : gateLeadHours > 8
          ? 'The pipeline clears, but release feedback takes longer than one workday.'
          : 'The daily workload clears with review capacity and same-day gate feedback.';

    return {
      backlogCases,
      candidateCalls,
      dailyCases,
      dailyCost,
      gateLeadHours,
      healthy,
      reviewCasesPerDay,
      reviewerCapacityCases,
      reviewerLoadPct,
      runnerHoursPerDay,
      runnerLoadPct,
      scorerCalls,
      status,
    };
  }, [casesPerRelease, data, humanReviewPct, releasesPerDay, reviewers, runnerConcurrency, workload]);

  function reset() {
    if (!data) return;
    setWorkloadId(data.defaults.workloadId);
    setCasesPerRelease(data.defaults.casesPerRelease);
    setReleasesPerDay(data.defaults.releasesPerDay);
    setHumanReviewPct(data.defaults.humanReviewPct);
    setReviewers(data.defaults.reviewers);
    setRunnerConcurrency(data.defaults.runnerConcurrency);
  }

  return (
    <div data-content-block="genai/evaluation-platforms-capacity-review-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation operations planner"
          title="Balance experiment throughput with human judgment"
          description="Change the workload, release cadence, runner concurrency, and review sample. The execution path exposes cost, queue pressure, and how long engineers wait for a release decision."
          icon={Activity}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !workload || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Workload shape
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.workloads.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === workload.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Play}
                        accent={item.id === 'tool-agent' ? 'violet' : 'cyan'}
                        onClick={() => setWorkloadId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Cases per release"
                  value={casesPerRelease}
                  output={count(casesPerRelease)}
                  min={100}
                  max={10_000}
                  step={100}
                  accent="blue"
                  lowLabel="Smoke suite"
                  highLabel="Large portfolio"
                  onChange={setCasesPerRelease}
                />
                <LabRange
                  label="3. Releases per day"
                  value={releasesPerDay}
                  output={count(releasesPerDay)}
                  min={1}
                  max={20}
                  step={1}
                  accent="violet"
                  lowLabel="Occasional"
                  highLabel="Continuous"
                  onChange={setReleasesPerDay}
                />
                <LabRange
                  label="4. Human review sample"
                  value={humanReviewPct}
                  output={`${humanReviewPct}%`}
                  min={1}
                  max={30}
                  step={1}
                  accent="amber"
                  lowLabel="Sparse"
                  highLabel="Deep review"
                  onChange={setHumanReviewPct}
                />
                <LabRange
                  label="5. Reviewers"
                  value={reviewers}
                  output={count(reviewers)}
                  min={1}
                  max={12}
                  step={1}
                  accent="emerald"
                  lowLabel="One owner"
                  highLabel="Review pool"
                  onChange={setReviewers}
                />
                <LabRange
                  label="6. Runner concurrency"
                  value={runnerConcurrency}
                  output={count(runnerConcurrency)}
                  min={5}
                  max={200}
                  step={5}
                  accent="cyan"
                  lowLabel="Serial pressure"
                  highLabel="Parallel execution"
                  onChange={setRunnerConcurrency}
                />
              </div>
            )}
          >
            <div className="min-h-[660px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Daily platform cost"
                  value={money(model.dailyCost)}
                  detail={`${money(model.dailyCost * 30)} per 30-day month at this mix`}
                  icon={Coins}
                  tone="blue"
                />
                <LabMetric
                  label="Runner time"
                  value={hours(model.runnerHoursPerDay)}
                  detail={`${model.runnerLoadPct.toFixed(0)}% of modeled daily capacity`}
                  icon={Gauge}
                  tone={model.runnerLoadPct <= 100 ? 'cyan' : 'rose'}
                />
                <LabMetric
                  label="Review load"
                  value={`${model.reviewerLoadPct.toFixed(0)}%`}
                  detail={`${count(model.reviewCasesPerDay)} assigned / ${count(model.reviewerCapacityCases)} capacity`}
                  icon={Users}
                  tone={model.reviewerLoadPct <= 100 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Gate feedback"
                  value={hours(model.gateLeadHours)}
                  detail="Approximate run, review, and queue time per release"
                  icon={Clock}
                  tone={model.gateLeadHours <= 8 ? 'emerald' : 'amber'}
                />
              </div>

              <section className="mt-5" aria-label="Evaluation platform execution path">
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                  Daily evidence path
                </h4>
                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  <PathStage label="Dataset" value={`${count(model.dailyCases)} cases`} detail="Versioned release portfolio" />
                  <PathStage label="Candidate runner" value={`${count(model.candidateCalls)} calls`} detail={`${runnerConcurrency} concurrent workers`} />
                  <PathStage label="Automated scorers" value={`${count(model.scorerCalls)} calls`} detail="Code checks and model judges" />
                  <PathStage label="Human queue" value={`${count(model.reviewCasesPerDay)} cases`} detail={`${humanReviewPct}% sampled`} warn={model.reviewerLoadPct > 100} />
                  <PathStage label="Release gate" value={hours(model.gateLeadHours)} detail="Decision feedback time" warn={model.gateLeadHours > 8} />
                </div>
              </section>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.healthy
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.healthy ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">
                      {model.healthy ? 'Capacity is balanced for this teaching model' : 'A platform stage is under pressure'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.status}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      Cost estimates are scenario inputs, not vendor prices. Production plans also need retry rates, provider limits, storage, egress, and reviewer availability by timezone.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function PathStage({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div className={`relative min-w-0 rounded-md border p-3 ${warn
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'}`}
    >
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-base font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[360px] place-items-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Capacity data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading capacity model...</p>}
      </div>
    </LearningLabBody>
  );
}
