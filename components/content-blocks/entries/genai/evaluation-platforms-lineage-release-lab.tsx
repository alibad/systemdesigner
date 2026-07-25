'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GitBranch,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Stage = {
  id: string;
  label: string;
  detail: string;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  minimumOverallDeltaPct: number;
  minimumCriticalSlicePct: number;
  minimumReviewerAgreementPct: number;
  maximumEvidenceAgeDays: number;
  requiredStages: string[];
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  overallDeltaPct: number;
  criticalSlicePct: number;
  reviewerAgreementPct: number;
  evidenceAgeDays: number;
  lineage: Record<string, boolean>;
};

type LineageData = {
  defaultPolicyId: string;
  defaultCandidateId: string;
  stages: Stage[];
  policies: Policy[];
  candidates: Candidate[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/evaluation-platforms/data/lineage-release-scenarios.json';

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return Boolean(value)
    && typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every((item) => typeof item === 'boolean');
}

function isLineageData(value: unknown): value is LineageData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LineageData>;
  return typeof candidate.defaultPolicyId === 'string'
    && typeof candidate.defaultCandidateId === 'string'
    && Array.isArray(candidate.stages)
    && candidate.stages.length > 0
    && Array.isArray(candidate.policies)
    && candidate.policies.length > 0
    && candidate.policies.every((policy) => Array.isArray(policy.requiredStages))
    && Array.isArray(candidate.candidates)
    && candidate.candidates.length > 0
    && candidate.candidates.every((item) => isBooleanRecord(item.lineage));
}

const percent = (value: number) => `${value.toFixed(1)}%`;

export default function EvaluationPlatformsLineageReleaseLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LineageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [policyId, setPolicyId] = useState('');
  const [candidateId, setCandidateId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isLineageData(payload)) throw new Error('Lineage data is incomplete.');

        if (active) {
          setData(payload);
          setPolicyId(payload.defaultPolicyId);
          setCandidateId(payload.defaultCandidateId);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lineage data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];
  const candidate = data?.candidates.find((item) => item.id === candidateId)
    ?? data?.candidates[0];

  const model = useMemo(() => {
    if (!data || !policy || !candidate) return null;

    const missingRequiredStages = policy.requiredStages.filter((stageId) => !candidate.lineage[stageId]);
    const missingAnyStages = data.stages.filter((stage) => !candidate.lineage[stage.id]);
    const overallPass = candidate.overallDeltaPct >= policy.minimumOverallDeltaPct;
    const criticalPass = candidate.criticalSlicePct >= policy.minimumCriticalSlicePct;
    const reviewerPass = candidate.reviewerAgreementPct >= policy.minimumReviewerAgreementPct;
    const freshnessPass = candidate.evidenceAgeDays <= policy.maximumEvidenceAgeDays;
    const lineagePass = missingRequiredStages.length === 0;
    const releasePass = overallPass && criticalPass && reviewerPass && freshnessPass && lineagePass;

    const unmanagedRisks = [
      candidate.criticalSlicePct < 90 && policy.minimumCriticalSlicePct < 90
        ? 'the policy ignores the critical-slice regression' : null,
      candidate.reviewerAgreementPct < 80 && policy.minimumReviewerAgreementPct < 80
        ? 'the policy ignores unresolved reviewer disagreement' : null,
      candidate.evidenceAgeDays > 14 && policy.maximumEvidenceAgeDays > 14
        ? 'the policy accepts stale evidence' : null,
      missingAnyStages.length > 0 && missingRequiredStages.length === 0
        ? `the policy does not require ${missingAnyStages.map((stage) => stage.label.toLowerCase()).join(' or ')}` : null,
    ].filter((item): item is string => Boolean(item));

    const failedGates = [
      !overallPass ? `aggregate change must be at least ${percent(policy.minimumOverallDeltaPct)}` : null,
      !criticalPass ? `critical slice must be at least ${percent(policy.minimumCriticalSlicePct)}` : null,
      !reviewerPass ? `reviewer agreement must be at least ${percent(policy.minimumReviewerAgreementPct)}` : null,
      !freshnessPass ? `evidence must be no more than ${policy.maximumEvidenceAgeDays} days old` : null,
      ...missingRequiredStages.map((stageId) => {
        const stage = data.stages.find((item) => item.id === stageId);
        return `restore ${stage?.label.toLowerCase() ?? stageId}`;
      }),
    ].filter((item): item is string => Boolean(item));

    const decision = releasePass
      ? unmanagedRisks.length > 0
        ? 'Policy passes, but the evidence contract is unsafe'
        : 'Eligible for a monitored canary'
      : 'Hold the release and repair the evidence chain';

    return {
      criticalPass,
      decision,
      failedGates,
      freshnessPass,
      lineagePass,
      missingRequiredStages,
      overallPass,
      releasePass,
      reviewerPass,
      unmanagedRisks,
    };
  }, [candidate, data, policy]);

  function reset() {
    if (!data) return;
    setPolicyId(data.defaultPolicyId);
    setCandidateId(data.defaultCandidateId);
  }

  return (
    <div data-content-block="genai/evaluation-platforms-lineage-release-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence lineage and release policy lab"
          title="Decide whether a result is reproducible enough to ship"
          description="Choose a candidate and a gate policy. The lineage path shows which artifacts exist, which ones the policy requires, and whether a high score is trustworthy enough for bounded release."
          icon={GitBranch}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !policy || !candidate || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Candidate evidence
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === candidate.id}
                        label={item.label}
                        detail={item.detail}
                        icon={FileSearch}
                        accent={item.id === 'clean-improvement' ? 'emerald' : 'amber'}
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Release policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={ShieldCheck}
                        accent={item.id === 'evidence-complete' ? 'violet' : 'blue'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[650px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Aggregate change"
                  value={`${candidate.overallDeltaPct >= 0 ? '+' : ''}${percent(candidate.overallDeltaPct)}`}
                  detail={`Policy floor ${percent(policy.minimumOverallDeltaPct)}`}
                  icon={Scale}
                  tone={model.overallPass ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Critical slice"
                  value={percent(candidate.criticalSlicePct)}
                  detail={`Policy floor ${percent(policy.minimumCriticalSlicePct)}`}
                  icon={ShieldCheck}
                  tone={model.criticalPass ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Reviewer agreement"
                  value={percent(candidate.reviewerAgreementPct)}
                  detail={`Policy floor ${percent(policy.minimumReviewerAgreementPct)}`}
                  icon={Users}
                  tone={model.reviewerPass ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Evidence age"
                  value={`${candidate.evidenceAgeDays} days`}
                  detail={`Policy maximum ${policy.maximumEvidenceAgeDays} days`}
                  icon={CalendarClock}
                  tone={model.freshnessPass ? 'blue' : 'rose'}
                />
              </div>

              <section className="mt-5" aria-label="Evaluation evidence lineage">
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                  Reproducibility chain
                </h4>
                <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                  {data.stages.map((stage) => {
                    const present = candidate.lineage[stage.id];
                    const required = policy.requiredStages.includes(stage.id);
                    return (
                      <LineageStage
                        key={stage.id}
                        stage={stage}
                        present={present}
                        required={required}
                      />
                    );
                  })}
                </div>
              </section>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.releasePass && model.unmanagedRisks.length === 0
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : model.releasePass
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.releasePass && model.unmanagedRisks.length === 0 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : model.releasePass ? (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                    {model.failedGates.length > 0 ? (
                      <>
                        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Failed gate requirements</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                          {model.failedGates.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    ) : null}
                    {model.unmanagedRisks.length > 0 ? (
                      <>
                        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Risks hidden by this policy</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                          {model.unmanagedRisks.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    ) : null}
                    {model.releasePass && model.unmanagedRisks.length === 0 ? (
                      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        Preserve this evidence manifest, expose the candidate to a bounded canary, and keep the rollback trigger tied to the same critical slice.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Release gate checks">
                <Gate label="Aggregate threshold" pass={model.overallPass} />
                <Gate label="Critical-slice floor" pass={model.criticalPass} />
                <Gate label="Reviewer calibration" pass={model.reviewerPass} />
                <Gate label="Evidence freshness" pass={model.freshnessPass} />
                <Gate label="Required lineage" pass={model.lineagePass} />
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LineageStage({ stage, present, required }: { stage: Stage; present: boolean; required: boolean }) {
  const state = !present && required
    ? 'Missing and required'
    : !present
      ? 'Missing, not gated'
      : required
        ? 'Recorded and required'
        : 'Recorded';
  const style = !present && required
    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
    : !present
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      : required
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
        : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900';

  return (
    <div className={`min-w-0 rounded-md border p-3 ${style}`}>
      <div className="flex items-start gap-2">
        {present ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{stage.label}</p>
          <p className="mt-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300">{state}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{stage.detail}</p>
    </div>
  );
}

function Gate({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-md border p-3 ${pass
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
      : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}
    >
      {pass ? (
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
      ) : (
        <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
      )}
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}: {pass ? 'pass' : 'fail'}</p>
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
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Lineage data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading lineage scenarios...</p>}
      </div>
    </LearningLabBody>
  );
}
