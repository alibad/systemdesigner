'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  GitCompareArrows,
  Layers3,
  Rocket,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Candidate {
  id: string;
  label: string;
  detail: string;
  trainingProfile: string;
}

interface Retriever {
  id: string;
  label: string;
  detail: string;
  profile: string;
}

interface Policy {
  id: string;
  label: string;
  detail: string;
  minimumOracleRecallPct: number;
  minimumCitationCorrectnessPct: number;
  minimumDistractorResistancePct: number;
  maximumUnsupportedAnswerPct: number;
  minimumProfileOverlapPct: number;
}

interface Outcome {
  candidateId: string;
  retrieverId: string;
  oracleRecallPct: number;
  citationCorrectnessPct: number;
  distractorResistancePct: number;
  unsupportedAnswerPct: number;
  profileOverlapPct: number;
  note: string;
}

interface ReleaseData {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    retrieverId: string;
    policyId: string;
  };
  candidates: Candidate[];
  retrievers: Retriever[];
  policies: Policy[];
  outcomes: Outcome[];
}

interface Gate {
  id: string;
  label: string;
  value: number;
  threshold: string;
  passed: boolean;
  inverse?: boolean;
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/raft-fine-tuning/data/retrieval-release-model.json';
const BLOCK_ID = 'genai/raft-fine-tuning-retrieval-release-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && Array.isArray(data.candidates)
      && data.candidates.length >= 3
      && Array.isArray(data.retrievers)
      && data.retrievers.length >= 3
      && Array.isArray(data.policies)
      && data.policies.length >= 3
      && data.policies.every((policy) => (
        isFiniteNumber(policy.minimumOracleRecallPct)
          && isFiniteNumber(policy.minimumCitationCorrectnessPct)
          && isFiniteNumber(policy.minimumDistractorResistancePct)
          && isFiniteNumber(policy.maximumUnsupportedAnswerPct)
          && isFiniteNumber(policy.minimumProfileOverlapPct)
      ))
      && Array.isArray(data.outcomes)
      && data.outcomes.length >= 9
      && data.outcomes.every((outcome) => (
        typeof outcome.candidateId === 'string'
          && typeof outcome.retrieverId === 'string'
          && isFiniteNumber(outcome.oracleRecallPct)
          && isFiniteNumber(outcome.citationCorrectnessPct)
          && isFiniteNumber(outcome.distractorResistancePct)
          && isFiniteNumber(outcome.unsupportedAnswerPct)
          && isFiniteNumber(outcome.profileOverlapPct)
      )),
  );
}

export default function RaftFineTuningRetrievalReleaseLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [candidateId, setCandidateId] = useState('');
  const [retrieverId, setRetrieverId] = useState('');
  const [policyId, setPolicyId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseData(payload)) throw new Error('Retrieval release data is incomplete.');

        setData(payload);
        setCandidateId(payload.defaults.candidateId);
        setRetrieverId(payload.defaults.retrieverId);
        setPolicyId(payload.defaults.policyId);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const candidate = data?.candidates.find((item) => item.id === candidateId)
    ?? data?.candidates[0];
  const retriever = data?.retrievers.find((item) => item.id === retrieverId)
    ?? data?.retrievers[0];
  const policy = data?.policies.find((item) => item.id === policyId)
    ?? data?.policies[0];
  const outcome = data?.outcomes.find((item) => (
    item.candidateId === candidate?.id && item.retrieverId === retriever?.id
  ));

  const model = useMemo(() => {
    if (!candidate || !retriever || !policy || !outcome) return null;

    const gates: Gate[] = [
      {
        id: 'recall',
        label: 'Oracle recall',
        value: outcome.oracleRecallPct,
        threshold: `at least ${policy.minimumOracleRecallPct}%`,
        passed: outcome.oracleRecallPct >= policy.minimumOracleRecallPct,
      },
      {
        id: 'citation',
        label: 'Citation correctness',
        value: outcome.citationCorrectnessPct,
        threshold: `at least ${policy.minimumCitationCorrectnessPct}%`,
        passed: outcome.citationCorrectnessPct >= policy.minimumCitationCorrectnessPct,
      },
      {
        id: 'distractors',
        label: 'Distractor resistance',
        value: outcome.distractorResistancePct,
        threshold: `at least ${policy.minimumDistractorResistancePct}%`,
        passed: outcome.distractorResistancePct >= policy.minimumDistractorResistancePct,
      },
      {
        id: 'unsupported',
        label: 'Unsupported answers',
        value: outcome.unsupportedAnswerPct,
        threshold: `at most ${policy.maximumUnsupportedAnswerPct}%`,
        passed: outcome.unsupportedAnswerPct <= policy.maximumUnsupportedAnswerPct,
        inverse: true,
      },
      {
        id: 'overlap',
        label: 'Retrieval-profile overlap',
        value: outcome.profileOverlapPct,
        threshold: `at least ${policy.minimumProfileOverlapPct}%`,
        passed: outcome.profileOverlapPct >= policy.minimumProfileOverlapPct,
      },
    ];
    const passedCount = gates.filter((gate) => gate.passed).length;
    const ready = passedCount === gates.length;
    const firstFailure = gates.find((gate) => !gate.passed);

    return {
      firstFailure,
      gates,
      passedCount,
      profilesMatch: candidate.trainingProfile === retriever.profile,
      ready,
    };
  }, [candidate, outcome, policy, retriever]);

  function reset() {
    if (!data) return;
    setCandidateId(data.defaults.candidateId);
    setRetrieverId(data.defaults.retrieverId);
    setPolicyId(data.defaults.policyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Model-retriever release gate"
          title={data?.title ?? 'Release the model and retriever together'}
          description={data?.description ?? 'Loading held-out system evidence...'}
          icon={GitCompareArrows}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !retriever || !policy || !outcome || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Fine-tuning recipe
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === candidate.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'balanced-raft' ? ShieldCheck : item.id === 'all-oracle-raft' ? FileCheck2 : Layers3}
                        accent={item.id === 'balanced-raft' ? 'emerald' : item.id === 'all-oracle-raft' ? 'blue' : 'amber'}
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Production retriever
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.retrievers.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === retriever.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'matched-top5' ? Search : item.id === 'new-chunker' ? GitCompareArrows : Layers3}
                        accent={item.id === 'matched-top5' ? 'cyan' : item.id === 'new-chunker' ? 'violet' : 'rose'}
                        onClick={() => setRetrieverId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Exposure policy
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'production' ? Rocket : item.id === 'canary' ? ShieldCheck : FlaskConical}
                        accent={item.id === 'production' ? 'rose' : item.id === 'canary' ? 'amber' : 'blue'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Oracle recall"
                  value={`${outcome.oracleRecallPct}%`}
                  detail={`Floor ${policy.minimumOracleRecallPct}%`}
                  icon={Search}
                  tone={outcome.oracleRecallPct >= policy.minimumOracleRecallPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Citation correctness"
                  value={`${outcome.citationCorrectnessPct}%`}
                  detail={`Floor ${policy.minimumCitationCorrectnessPct}%`}
                  icon={FileCheck2}
                  tone={outcome.citationCorrectnessPct >= policy.minimumCitationCorrectnessPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Distractor resistance"
                  value={`${outcome.distractorResistancePct}%`}
                  detail={`Floor ${policy.minimumDistractorResistancePct}%`}
                  icon={ShieldCheck}
                  tone={outcome.distractorResistancePct >= policy.minimumDistractorResistancePct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Unsupported answers"
                  value={`${outcome.unsupportedAnswerPct}%`}
                  detail={`Ceiling ${policy.maximumUnsupportedAnswerPct}%`}
                  icon={AlertTriangle}
                  tone={outcome.unsupportedAnswerPct <= policy.maximumUnsupportedAnswerPct ? 'emerald' : 'rose'}
                />
              </div>

              <section aria-labelledby="raft-release-gates">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Held-out release evidence
                    </p>
                    <h4
                      id="raft-release-gates"
                      className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                    >
                      {model.passedCount} of {model.gates.length} gates pass
                    </h4>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    model.profilesMatch
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  }`}>
                    {model.profilesMatch ? 'Retrieval profile matched' : 'Retrieval profile changed'}
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                  {model.gates.map((gate) => (
                    <div
                      key={gate.id}
                      className="grid gap-2 border-b border-neutral-200 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center dark:border-neutral-800"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {gate.passed ? (
                          <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {gate.label}
                        </span>
                      </div>
                      <span className="pl-8 text-sm font-semibold tabular-nums text-neutral-950 sm:pl-0 dark:text-white">
                        {gate.value}%
                      </span>
                      <span className="pl-8 text-xs text-neutral-500 sm:pl-0 sm:text-right dark:text-neutral-400">
                        {gate.threshold}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`rounded-md border p-5 ${
                model.ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}>
                <div className="flex items-start gap-3">
                  {model.ready ? (
                    <Rocket aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase opacity-75">
                      Decision for {policy.label}
                    </p>
                    <h4 className="mt-1 text-lg font-semibold">
                      {model.ready ? 'Eligible under this policy' : 'Hold the release'}
                    </h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">{outcome.note}</p>
                    {!model.ready && model.firstFailure ? (
                      <p className="mt-2 text-sm font-semibold">
                        First blocker: {model.firstFailure.label} is {model.firstFailure.value}% and must be {model.firstFailure.threshold}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Results are fixed illustrative evaluation records for this lesson. Production thresholds, uncertainty, sample counts, and risk slices must be governed for the actual product.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
      <p>{error ?? 'Loading the model-retriever evidence...'}</p>
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-neutral-300 px-3 py-2 font-semibold text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
