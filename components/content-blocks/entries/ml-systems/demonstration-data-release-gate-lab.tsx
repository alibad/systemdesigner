'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Database,
  FileCheck2,
  LoaderCircle,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/demonstration-data/data/release-gate-scenarios.json';
const BLOCK_ID = 'ml-systems/demonstration-data-release-gate-lab';

type CandidateRelease = {
  id: string;
  label: string;
  detail: string;
  examples: number;
  provenancePercent: number;
  duplicatePercent: number;
  reviewerAgreementPercent: number;
  safetyPassPercent: number;
  criticalSlicePassPercent: number;
  evaluationLiftPercent: number;
  privacyIncidents: number;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  minimumProvenancePercent: number;
  maximumDuplicatePercent: number;
  minimumReviewerAgreementPercent: number;
  minimumSafetyPassPercent: number;
  minimumCriticalSlicePassPercent: number;
  minimumEvaluationLiftPercent: number;
};

type Remediation = {
  id: string;
  label: string;
  detail: string;
  provenanceGain: number;
  duplicateMultiplier: number;
  agreementGain: number;
  safetyGain: number;
  criticalSliceGain: number;
  evaluationLiftGain: number;
  retainedExamplePercent: number;
};

type LabData = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    releaseId: string;
    policyId: string;
    remediationId: string;
  };
  releases: CandidateRelease[];
  policies: Policy[];
  remediations: Remediation[];
};

type Gate = {
  id: string;
  label: string;
  value: string;
  threshold: string;
  passed: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    data.title
      && data.description
      && data.notice
      && data.defaults?.releaseId
      && data.defaults.policyId
      && data.defaults.remediationId
      && Array.isArray(data.releases)
      && data.releases.length >= 3
      && data.releases.every((release) => (
        release.id
          && release.label
          && isFiniteNumber(release.examples)
          && isFiniteNumber(release.provenancePercent)
          && isFiniteNumber(release.privacyIncidents)
      ))
      && Array.isArray(data.policies)
      && data.policies.length >= 3
      && data.policies.every((policy) => (
        policy.id
          && policy.label
          && isFiniteNumber(policy.minimumProvenancePercent)
          && isFiniteNumber(policy.maximumDuplicatePercent)
      ))
      && Array.isArray(data.remediations)
      && data.remediations.length >= 3
      && data.remediations.every((remediation) => (
        remediation.id
          && remediation.label
          && isFiniteNumber(remediation.duplicateMultiplier)
          && isFiniteNumber(remediation.retainedExamplePercent)
      )),
  );
}

function cap(value: number) {
  return Math.min(100, Math.max(0, value));
}

function percent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export default function DemonstrationDataReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [releaseId, setReleaseId] = useState('balanced-v1');
  const [policyId, setPolicyId] = useState('production');
  const [remediationId, setRemediationId] = useState('none');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Release-gate data is incomplete.');
        setData(payload);
        setReleaseId(payload.defaults.releaseId);
        setPolicyId(payload.defaults.policyId);
        setRemediationId(payload.defaults.remediationId);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load release-gate data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const release = data?.releases.find((item) => item.id === releaseId) ?? data?.releases[0];
  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];
  const remediation = data?.remediations.find((item) => item.id === remediationId) ?? data?.remediations[0];

  const result = useMemo(() => {
    if (!release || !policy || !remediation) return null;

    const metrics = {
      examples: Math.round(release.examples * (remediation.retainedExamplePercent / 100)),
      provenancePercent: cap(release.provenancePercent + remediation.provenanceGain),
      duplicatePercent: cap(release.duplicatePercent * remediation.duplicateMultiplier),
      reviewerAgreementPercent: cap(release.reviewerAgreementPercent + remediation.agreementGain),
      safetyPassPercent: cap(release.safetyPassPercent + remediation.safetyGain),
      criticalSlicePassPercent: cap(release.criticalSlicePassPercent + remediation.criticalSliceGain),
      evaluationLiftPercent: release.evaluationLiftPercent + remediation.evaluationLiftGain,
      privacyIncidents: release.privacyIncidents,
    };

    const gates: Gate[] = [
      {
        id: 'provenance',
        label: 'Verified provenance',
        value: percent(metrics.provenancePercent),
        threshold: `at least ${policy.minimumProvenancePercent}%`,
        passed: metrics.provenancePercent >= policy.minimumProvenancePercent,
      },
      {
        id: 'duplicates',
        label: 'Near-duplicate rate',
        value: percent(metrics.duplicatePercent),
        threshold: `at most ${policy.maximumDuplicatePercent}%`,
        passed: metrics.duplicatePercent <= policy.maximumDuplicatePercent,
      },
      {
        id: 'agreement',
        label: 'Reviewer agreement',
        value: percent(metrics.reviewerAgreementPercent),
        threshold: `at least ${policy.minimumReviewerAgreementPercent}%`,
        passed: metrics.reviewerAgreementPercent >= policy.minimumReviewerAgreementPercent,
      },
      {
        id: 'safety',
        label: 'Safety-policy pass rate',
        value: percent(metrics.safetyPassPercent),
        threshold: `at least ${policy.minimumSafetyPassPercent}%`,
        passed: metrics.safetyPassPercent >= policy.minimumSafetyPassPercent,
      },
      {
        id: 'slices',
        label: 'Critical-slice pass rate',
        value: percent(metrics.criticalSlicePassPercent),
        threshold: `at least ${policy.minimumCriticalSlicePassPercent}%`,
        passed: metrics.criticalSlicePassPercent >= policy.minimumCriticalSlicePassPercent,
      },
      {
        id: 'lift',
        label: 'Held-out evaluation lift',
        value: percent(metrics.evaluationLiftPercent),
        threshold: `at least ${policy.minimumEvaluationLiftPercent}%`,
        passed: metrics.evaluationLiftPercent >= policy.minimumEvaluationLiftPercent,
      },
      {
        id: 'privacy',
        label: 'Unresolved privacy incidents',
        value: metrics.privacyIncidents.toString(),
        threshold: 'exactly 0',
        passed: metrics.privacyIncidents === 0,
      },
    ];
    const passedCount = gates.filter((gate) => gate.passed).length;
    const ready = passedCount === gates.length;
    const firstFailure = gates.find((gate) => !gate.passed);
    const recommendation = ready
      ? 'All modeled gates pass. Freeze the data manifest, model configuration, evaluations, and rollback target as one release bundle.'
      : firstFailure
        ? `${firstFailure.label} is the first blocking gate. A larger dataset does not override this failed release contract.`
        : 'Keep the current production dataset until every release gate has evidence.';

    return { gates, metrics, passedCount, ready, recommendation };
  }, [policy, release, remediation]);

  function reset() {
    if (!data) return;
    setReleaseId(data.defaults.releaseId);
    setPolicyId(data.defaults.policyId);
    setRemediationId(data.defaults.remediationId);
  }

  if (!data || !release || !policy || !remediation || !result) {
    return <LoadState error={error} />;
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Dataset release gate"
          title={data.title}
          description={data.description}
          icon={FileCheck2}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate release
                </legend>
                <div className="mt-3 space-y-2">
                  {data.releases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === release.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.privacyIncidents > 0 ? ShieldAlert : Database}
                      accent={item.privacyIncidents > 0 ? 'rose' : item.criticalSlicePassPercent >= 85 ? 'emerald' : 'amber'}
                      onClick={() => setReleaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Promotion policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'regulated' ? ShieldCheck : item.id === 'production' ? Scale : Sparkles}
                      accent={item.id === 'regulated' ? 'rose' : item.id === 'production' ? 'blue' : 'violet'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Apply one remediation
                </legend>
                <div className="mt-3 space-y-2">
                  {data.remediations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === remediation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'deduplicate' ? Copy : item.id === 'targeted-review' ? Users : Target}
                      accent={item.id === 'none' ? 'amber' : item.id === 'deduplicate' ? 'cyan' : 'emerald'}
                      onClick={() => setRemediationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Promotion decision
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {release.label} against the {policy.label.toLowerCase()}
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100'
              }`}>
                {result.ready ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
                {result.ready ? 'Promote after sign-off' : 'Block promotion'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Retained examples"
                value={result.metrics.examples.toLocaleString()}
                detail={remediation.id === 'none' ? 'No remediation loss' : `${remediation.retainedExamplePercent}% retained after remediation`}
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Gates passed"
                value={`${result.passedCount} / ${result.gates.length}`}
                detail="Every gate is blocking; there is no average pass"
                icon={FileCheck2}
                tone={result.ready ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Eval lift"
                value={percent(result.metrics.evaluationLiftPercent)}
                detail="Useful only when safety, privacy, and slices also pass"
                icon={Target}
                tone={result.metrics.evaluationLiftPercent >= policy.minimumEvaluationLiftPercent ? 'violet' : 'amber'}
              />
            </div>

            <section aria-labelledby="release-gates-title" className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <h4 id="release-gates-title" className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Evidence by blocking gate
                </h4>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {result.gates.map((gate) => (
                  <div key={gate.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {gate.passed ? (
                        <CheckCircle2 aria-label="Passed" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle aria-label="Failed" className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{gate.label}</span>
                    </div>
                    <span className="pl-8 text-sm font-semibold tabular-nums text-neutral-950 sm:pl-0 dark:text-white">{gate.value}</span>
                    <span className="pl-8 text-xs text-neutral-500 sm:w-32 sm:pl-0 sm:text-right dark:text-neutral-400">{gate.threshold}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className={`rounded-md border p-4 ${
              result.ready
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
            }`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Release owner decision</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.recommendation}</p>
            </div>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-400" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Release gate unavailable' : 'Loading release evidence'}
          </p>
          {error ? <p className="mt-1">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
