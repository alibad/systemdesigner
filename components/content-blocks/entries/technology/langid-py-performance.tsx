'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  Filter,
  Gauge,
  Languages,
  ListFilter,
  LoaderCircle,
  Route,
  ScanSearch,
  ShieldCheck,
  TextCursorInput,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CandidateProfile = {
  id: string;
  label: string;
  detail: string;
  candidates: string[];
  candidateCount: number;
  predictedLanguage: string;
  normalizedScore: number;
  truthIncluded: boolean;
  verdict: 'correct' | 'forced-error';
  explanation: string;
};

type CandidateScopeData = {
  labKind: 'candidate-scope';
  title: string;
  description: string;
  sampleText: string;
  referenceLanguage: string;
  sourceNote: string;
  defaults: { profileId: string };
  profiles: CandidateProfile[];
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  acceptsTopResult: boolean;
  minCharacters: number;
  deferMixed: boolean;
  requireInScope: boolean;
};

type DetectionRecord = {
  id: string;
  preview: string;
  characters: number;
  predictedLanguage: string;
  referenceLanguage: string;
  normalizedScore: number;
  mixedLanguage: boolean;
  inScope: boolean;
};

type DecisionPolicyData = {
  labKind: 'decision-policy';
  title: string;
  description: string;
  fixtureNote: string;
  defaults: { policyId: string; threshold: number };
  policies: Policy[];
  records: DetectionRecord[];
};

type LabData = CandidateScopeData | DecisionPolicyData;

type RecordDecision = {
  record: DetectionRecord;
  accepted: boolean;
  reasons: string[];
  falseAccept: boolean;
};

const OUTER_BLOCK_ID = 'technology/langid-py-performance';

function isCandidateProfile(value: unknown): value is CandidateProfile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CandidateProfile>;

  return Boolean(
    item.id
      && item.label
      && item.detail
      && Array.isArray(item.candidates)
      && item.candidates.length > 0
      && item.candidates.every((candidate) => typeof candidate === 'string')
      && typeof item.candidateCount === 'number'
      && item.candidateCount >= item.candidates.length
      && item.predictedLanguage
      && typeof item.normalizedScore === 'number'
      && item.normalizedScore >= 0
      && item.normalizedScore <= 1
      && typeof item.truthIncluded === 'boolean'
      && (item.verdict === 'correct' || item.verdict === 'forced-error')
      && item.explanation,
  );
}

function isPolicy(value: unknown): value is Policy {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Policy>;

  return Boolean(
    item.id
      && item.label
      && item.detail
      && typeof item.acceptsTopResult === 'boolean'
      && typeof item.minCharacters === 'number'
      && item.minCharacters >= 0
      && typeof item.deferMixed === 'boolean'
      && typeof item.requireInScope === 'boolean',
  );
}

function isDetectionRecord(value: unknown): value is DetectionRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DetectionRecord>;

  return Boolean(
    item.id
      && item.preview
      && typeof item.characters === 'number'
      && item.characters > 0
      && item.predictedLanguage
      && item.referenceLanguage
      && typeof item.normalizedScore === 'number'
      && item.normalizedScore >= 0
      && item.normalizedScore <= 1
      && typeof item.mixedLanguage === 'boolean'
      && typeof item.inScope === 'boolean',
  );
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LabData>;

  if (candidate.labKind === 'candidate-scope') {
    const data = candidate as Partial<CandidateScopeData>;
    return Boolean(
      data.title
        && data.description
        && data.sampleText
        && data.referenceLanguage
        && data.sourceNote
        && data.defaults?.profileId
        && Array.isArray(data.profiles)
        && data.profiles.length >= 2
        && data.profiles.every(isCandidateProfile),
    );
  }

  if (candidate.labKind === 'decision-policy') {
    const data = candidate as Partial<DecisionPolicyData>;
    return Boolean(
      data.title
        && data.description
        && data.fixtureNote
        && data.defaults?.policyId
        && typeof data.defaults.threshold === 'number'
        && data.defaults.threshold >= 0
        && data.defaults.threshold <= 1
        && Array.isArray(data.policies)
        && data.policies.length >= 2
        && data.policies.every(isPolicy)
        && Array.isArray(data.records)
        && data.records.length >= 3
        && data.records.every(isDetectionRecord),
    );
  }

  return false;
}

export default function LangidPyPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No language-identification scenario data was supplied.');
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
        if (!isLabData(payload)) throw new Error('The language-identification lab data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  if (data.labKind === 'candidate-scope') return <CandidateScopeLab data={data} />;
  return <DecisionPolicyLab data={data} />;
}

function CandidateScopeLab({ data }: { data: CandidateScopeData }) {
  const initialProfile = data.profiles.find((profile) => profile.id === data.defaults.profileId)
    ?? data.profiles[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const isCorrect = profile.verdict === 'correct';

  return (
    <div data-content-block="technology/langid-py-candidate-scope-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Candidate-set lab"
          title={data.title}
          description={data.description}
          icon={Languages}
          accent="cyan"
          onReset={() => setProfileId(initialProfile.id)}
        />
        <LearningLabBody
          controls={(
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Candidate language policy
              </legend>
              <div className="mt-3 grid gap-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ListFilter}
                    accent={item.truthIncluded ? 'cyan' : 'rose'}
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Documented input
              </p>
              <blockquote className="mt-2 border-l-2 border-cyan-500 pl-4 text-base font-medium leading-7 text-neutral-950 dark:text-white">
                {data.sampleText}
              </blockquote>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Reference language: {data.referenceLanguage.toUpperCase()}. {data.sourceNote}
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Candidates"
                value={`${profile.candidateCount}`}
                detail={profile.candidateCount === profile.candidates.length
                  ? profile.candidates.join(', ')
                  : `${profile.candidates.join(', ')} and ${profile.candidateCount - profile.candidates.length} more`}
                icon={Filter}
                tone="blue"
              />
              <LabMetric
                label="Documented output"
                value={profile.predictedLanguage.toUpperCase()}
                detail="Top label after candidate filtering"
                icon={ScanSearch}
                tone={isCorrect ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Normalized score"
                value={`${(profile.normalizedScore * 100).toFixed(1)}%`}
                detail="Relative to the active candidate set"
                icon={Gauge}
                tone={profile.truthIncluded ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Truth eligible"
                value={profile.truthIncluded ? 'Yes' : 'No'}
                detail={profile.truthIncluded ? 'English may win' : 'English cannot be returned'}
                icon={profile.truthIncluded ? BadgeCheck : Ban}
                tone={profile.truthIncluded ? 'emerald' : 'rose'}
              />
            </div>

            <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Active label space
                </p>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {profile.candidates.map((candidate) => (
                  <span
                    key={candidate}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${candidate === data.referenceLanguage
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}
                  >
                    {candidate.toUpperCase()}
                  </span>
                ))}
                {profile.candidateCount > profile.candidates.length ? (
                  <span className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    +{profile.candidateCount - profile.candidates.length} languages
                  </span>
                ) : null}
              </div>
            </section>

            <OutcomePanel
              positive={isCorrect}
              title={isCorrect ? 'The reference language remains reachable' : 'The candidate policy forces a wrong answer'}
              description={profile.explanation}
            />
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function DecisionPolicyLab({ data }: { data: DecisionPolicyData }) {
  const initialPolicy = data.policies.find((policy) => policy.id === data.defaults.policyId)
    ?? data.policies[0];
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [threshold, setThreshold] = useState(data.defaults.threshold);
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
  const decisions = useMemo(
    () => data.records.map((record) => decide(record, policy, threshold)),
    [data.records, policy, threshold],
  );
  const accepted = decisions.filter((decision) => decision.accepted).length;
  const falseAccepts = decisions.filter((decision) => decision.falseAccept).length;
  const deferred = decisions.length - accepted;

  function reset() {
    setPolicyId(initialPolicy.id);
    setThreshold(data.defaults.threshold);
  }

  return (
    <div data-content-block="technology/langid-py-decision-policy-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Decision-policy lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Release policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Route}
                      accent={item.id === 'guarded' ? 'emerald' : 'violet'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              {!policy.acceptsTopResult ? (
                <LabRange
                  label="Normalized-score floor"
                  value={threshold}
                  output={threshold.toFixed(2)}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  accent="violet"
                  lowLabel="More automation"
                  highLabel="More review"
                  onChange={setThreshold}
                />
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  This policy ignores score, input length, mixed-language signals, and scope.
                </div>
              )}
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Auto-routed"
                value={`${accepted}/${decisions.length}`}
                detail="Predictions sent downstream"
                icon={Route}
                tone="blue"
              />
              <LabMetric
                label="Deferred"
                value={`${deferred}`}
                detail="Records held for fallback or review"
                icon={FileQuestion}
                tone="amber"
              />
              <LabMetric
                label="Wrong routes"
                value={`${falseAccepts}`}
                detail="Accepted labels that disagree with reference"
                icon={TriangleAlert}
                tone={falseAccepts === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Score floor"
                value={policy.acceptsTopResult ? 'Off' : threshold.toFixed(2)}
                detail={policy.acceptsTopResult ? 'Every top label passes' : 'One gate in the policy'}
                icon={Gauge}
                tone="violet"
              />
            </div>

            <div className="grid gap-3">
              {decisions.map((decision) => (
                <DecisionRow key={decision.record.id} decision={decision} />
              ))}
            </div>

            <OutcomePanel
              positive={falseAccepts === 0}
              title={falseAccepts === 0
                ? 'This fixture avoids automatic misrouting'
                : `${falseAccepts} incorrect ${falseAccepts === 1 ? 'label is' : 'labels are'} released`}
              description={falseAccepts === 0
                ? 'The policy trades some automation for an explicit fallback path. Review the deferred records instead of pretending the model always knows.'
                : 'A normalized score alone cannot repair an excluded language, mixed input, or a confident model error. Add eligibility gates and monitor labeled outcomes.'}
            />

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.fixtureNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function decide(record: DetectionRecord, policy: Policy, threshold: number): RecordDecision {
  const reasons: string[] = [];

  if (!policy.acceptsTopResult && record.normalizedScore < threshold) {
    reasons.push(`score ${record.normalizedScore.toFixed(2)} is below ${threshold.toFixed(2)}`);
  }
  if (policy.minCharacters > 0 && record.characters < policy.minCharacters) {
    reasons.push(`${record.characters} characters is below the ${policy.minCharacters}-character gate`);
  }
  if (policy.deferMixed && record.mixedLanguage) reasons.push('mixed-language input needs a different contract');
  if (policy.requireInScope && !record.inScope) reasons.push('reference language is outside the supported product scope');

  const accepted = policy.acceptsTopResult || reasons.length === 0;
  return {
    record,
    accepted,
    reasons,
    falseAccept: accepted && record.predictedLanguage !== record.referenceLanguage,
  };
}

function DecisionRow({ decision }: { decision: RecordDecision }) {
  const { record } = decision;
  const tone = decision.falseAccept
    ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
    : decision.accepted
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
      : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30';

  return (
    <article className={`min-w-0 rounded-md border p-4 ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TextCursorInput aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
            <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {record.preview}
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            Predicted {record.predictedLanguage.toUpperCase()} at {record.normalizedScore.toFixed(2)}
            {' · '}reference {record.referenceLanguage.toUpperCase()}
            {' · '}{record.characters} characters
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-current px-2.5 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-100">
          {decision.falseAccept
            ? <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
            : decision.accepted
              ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              : <FileQuestion aria-hidden="true" className="h-3.5 w-3.5" />}
          {decision.falseAccept ? 'Wrong route' : decision.accepted ? 'Auto-route' : 'Defer'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        {decision.falseAccept
          ? 'The top prediction passes this policy but disagrees with the labeled outcome.'
          : decision.accepted
            ? 'The record satisfies every active gate.'
            : decision.reasons.join('; ')}
      </p>
    </article>
  );
}

function OutcomePanel({
  positive,
  title,
  description,
}: {
  positive: boolean;
  title: string;
  description: string;
}) {
  return (
    <section className={`rounded-md border p-5 ${positive
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
      : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}
    >
      <div className="flex items-start gap-3">
        {positive
          ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
          : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
        <div>
          <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{title}</h4>
          <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={OUTER_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Language-identification lab"
          title="Loading decision scenarios"
          description="The lab validates its candidate sets, detection fixtures, and policy controls before rendering."
          icon={Languages}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-600 motion-reduce:animate-none dark:text-cyan-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Loading language-identification scenarios...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
