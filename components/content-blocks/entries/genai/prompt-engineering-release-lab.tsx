'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  CircleAlert,
  CircleCheck,
  Clock3,
  Gauge,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type EvaluationSlice = {
  id: string;
  label: string;
  detail: string;
  weight: number;
  critical: boolean;
};

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  requiredSliceFloor: number;
};

type PromptCandidate = {
  id: string;
  label: string;
  detail: string;
  inputTokens: number;
  p95LatencyMs: number;
  scores: Record<string, number>;
  change: string;
};

type PromptReleaseData = {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    policyId: string;
    qualityFloor: number;
  };
  slices: EvaluationSlice[];
  policies: ReleasePolicy[];
  candidates: PromptCandidate[];
};

const BLOCK_ID = 'genai/prompt-engineering-release-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPromptReleaseData(value: unknown): value is PromptReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PromptReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.candidateId
      && candidate.defaults.policyId
      && isFiniteNumber(candidate.defaults.qualityFloor)
      && Array.isArray(candidate.slices)
      && candidate.slices.length > 0
      && candidate.slices.every((slice) => (
        slice.id && slice.label && isFiniteNumber(slice.weight)
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        policy.id && policy.label && isFiniteNumber(policy.requiredSliceFloor)
      ))
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0
      && candidate.candidates.every((item) => (
        item.id
          && item.label
          && isFiniteNumber(item.inputTokens)
          && isFiniteNumber(item.p95LatencyMs)
          && item.scores
          && Object.values(item.scores).every(isFiniteNumber)
      )),
  );
}

export default function PromptEngineeringReleaseLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PromptReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No prompt-release evidence was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPromptReleaseData(payload)) throw new Error('Prompt-release data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load prompt-release evidence.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <ReleaseWorkbench data={data} /> : <LoadState />}
    </div>
  );
}

function ReleaseWorkbench({ data }: { data: PromptReleaseData }) {
  const initialCandidate = data.candidates.find((item) => item.id === data.defaults.candidateId)
    ?? data.candidates[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [candidateId, setCandidateId] = useState(initialCandidate.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [qualityFloor, setQualityFloor] = useState(data.defaults.qualityFloor);

  const candidate = data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const rows = data.slices.map((slice) => ({
      ...slice,
      score: candidate.scores[slice.id] ?? 0,
    }));
    const weightedScore = rows.reduce((sum, row) => sum + row.score * row.weight, 0);
    const failedRequired = policy.requiredSliceFloor > 0
      ? rows.filter((row) => row.critical && row.score < policy.requiredSliceFloor)
      : [];
    const weakest = rows.reduce((lowest, row) => (row.score < lowest.score ? row : lowest), rows[0]);
    const averagePassed = weightedScore >= qualityFloor;
    const release = averagePassed && failedRequired.length === 0;
    return { averagePassed, failedRequired, release, rows, weakest, weightedScore };
  }, [candidate, data.slices, policy.requiredSliceFloor, qualityFloor]);

  const reset = () => {
    setCandidateId(initialCandidate.id);
    setPolicyId(initialPolicy.id);
    setQualityFloor(data.defaults.qualityFloor);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt release replay"
        title={data.title}
        description={data.description}
        icon={ScanSearch}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Prompt candidate
              </legend>
              <div className="mt-3 grid gap-2">
                {data.candidates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === candidate.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Sparkles}
                    accent={item.id === 'bounded-v3' ? 'emerald' : item.id === 'few-shot-v2' ? 'violet' : 'blue'}
                    onClick={() => setCandidateId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Release policy
              </legend>
              <div className="mt-3 grid gap-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.requiredSliceFloor > 0 ? ShieldCheck : BarChart3}
                    accent={item.requiredSliceFloor >= 92 ? 'rose' : item.requiredSliceFloor > 0 ? 'emerald' : 'amber'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="3. Weighted quality floor"
              value={qualityFloor}
              output={`${qualityFloor}`}
              min={70}
              max={95}
              step={1}
              accent="emerald"
              lowLabel="Broad canary"
              highLabel="Strict gate"
              onChange={setQualityFloor}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Weighted quality"
              value={result.weightedScore.toFixed(1)}
              detail={`Required average: ${qualityFloor}`}
              icon={Gauge}
              tone={result.averagePassed ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Weakest slice"
              value={`${result.weakest.score}`}
              detail={result.weakest.label}
              icon={ShieldX}
              tone={result.weakest.critical && result.weakest.score < 85 ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Prompt input"
              value={`${candidate.inputTokens} tokens`}
              detail="Input budget before request-specific evidence."
              icon={Sparkles}
              tone="violet"
            />
            <LabMetric
              label="Modeled p95"
              value={`${candidate.p95LatencyMs} ms`}
              detail="Complete-path replay measurement."
              icon={Clock3}
              tone="blue"
            />
          </div>

          <section aria-labelledby="slice-evidence-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evaluation evidence
            </p>
            <h4 id="slice-evidence-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              Inspect every required behavior slice
            </h4>
            <div className="mt-4 space-y-3">
              {result.rows.map((row) => {
                const isGated = row.critical && policy.requiredSliceFloor > 0;
                const floor = policy.requiredSliceFloor;
                const passed = !isGated || row.score >= floor;
                return (
                  <div
                    key={row.id}
                    className={`rounded-md border p-4 ${
                      passed
                        ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{row.label}</p>
                          {row.critical ? (
                            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                              Required slice
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{row.detail}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                        {!isGated ? (
                          <BarChart3 aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : passed ? (
                          <CircleCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <CircleAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        )}
                        {isGated ? `${row.score} / ${floor}` : `${row.score} observed`}
                      </div>
                    </div>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                      role="img"
                      aria-label={isGated
                        ? `${row.label} scored ${row.score} with a required floor of ${floor}`
                        : `${row.label} scored ${row.score} and is included in the weighted average`}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                          !isGated ? 'bg-blue-500' : passed ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Traffic weight: {Math.round(row.weight * 100)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60" aria-labelledby="candidate-change-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate diff</p>
            <h4 id="candidate-change-title" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
              {candidate.label}
            </h4>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{candidate.change}</p>
          </section>

          <DecisionPanel result={result} policy={policy} qualityFloor={qualityFloor} />
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionPanel({
  policy,
  qualityFloor,
  result,
}: {
  policy: ReleasePolicy;
  qualityFloor: number;
  result: {
    averagePassed: boolean;
    failedRequired: Array<{ id: string; label: string; score: number }>;
    release: boolean;
    weightedScore: number;
  };
}) {
  const panel = result.release
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50';
  return (
    <div className={`rounded-md border p-4 ${panel}`}>
      <div className="flex items-start gap-3">
        {result.release ? (
          <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <ShieldX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {result.release ? 'Eligible for a limited canary' : 'Release blocked'}
          </p>
          {result.release ? (
            <p className="mt-1 text-sm leading-6 opacity-85">
              The candidate clears the {qualityFloor} weighted floor and the {policy.label.toLowerCase()} policy. A canary still needs monitoring and rollback controls.
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
              {!result.averagePassed ? (
                <li>Weighted quality {result.weightedScore.toFixed(1)} is below the {qualityFloor} release floor.</li>
              ) : null}
              {result.failedRequired.map((slice) => (
                <li key={slice.id}>{slice.label} scored {slice.score}, below the required slice floor of {policy.requiredSliceFloor}.</li>
              ))}
            </ul>
          )}
          {result.averagePassed && result.failedRequired.length > 0 ? (
            <p className="mt-3 border-l-2 border-current pl-3 text-xs leading-5 font-semibold">
              An average-only policy would ship this candidate and hide the required-slice regression.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt release replay"
        title="Loading release evidence"
        description="Preparing candidate scores, risk slices, and release policies."
        icon={LoaderCircle}
        accent="emerald"
      />
      <LearningLabBody>
        <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading evidence
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt release replay"
        title="Release evidence is unavailable"
        description="The lab could not load its lesson-owned evaluation data."
        icon={CircleAlert}
        accent="rose"
      />
      <LearningLabBody>
        <p className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50">
          {detail}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
