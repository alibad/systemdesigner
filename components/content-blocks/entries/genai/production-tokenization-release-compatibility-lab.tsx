'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileCheck2,
  Gauge,
  GitCompare,
  LoaderCircle,
  PackageCheck,
  Percent,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type CheckState = 'pass' | 'fail' | 'ignored';
type MetricTone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

interface ReleasePolicy {
  id: string;
  label: string;
  detail: string;
  minimumGoldenMatchPct: number;
  minimumOffsetMatchPct: number;
  minimumQualityDelta: number;
  maximumTokenDeltaPct: number;
  requireSpecialTokenMatch: boolean;
  requireTemplateMatch: boolean;
  requireRollback: boolean;
}

interface ReleaseCandidate {
  id: string;
  label: string;
  detail: string;
  goldenMatchPct: number;
  offsetMatchPct: number;
  specialTokenIdsMatch: boolean;
  templateMatches: boolean;
  tokenCountP95DeltaPct: number;
  downstreamQualityDelta: number;
  rollbackReady: boolean;
  failureTruth: string;
}

interface ReleaseCompatibilityModel {
  blockId: string;
  title: string;
  description: string;
  productionRequestsPerSecond: number;
  defaults: {
    candidateId: string;
    policyId: string;
    trafficPercent: number;
  };
  policies: ReleasePolicy[];
  candidates: ReleaseCandidate[];
}

interface GateCheck {
  id: string;
  label: string;
  observed: string;
  requirement: string;
  state: CheckState;
}

const BLOCK_ID = 'genai/production-tokenization-release-compatibility-lab';
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseCompatibilityModel(value: unknown): value is ReleaseCompatibilityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseCompatibilityModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && candidate.title
      && candidate.description
      && isFiniteNumber(candidate.productionRequestsPerSecond)
      && candidate.productionRequestsPerSecond > 0
      && candidate.defaults?.candidateId
      && candidate.defaults?.policyId
      && isFiniteNumber(candidate.defaults.trafficPercent)
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && isFiniteNumber(policy.minimumGoldenMatchPct)
        && isFiniteNumber(policy.minimumOffsetMatchPct)
        && isFiniteNumber(policy.minimumQualityDelta)
        && isFiniteNumber(policy.maximumTokenDeltaPct)
        && typeof policy.requireSpecialTokenMatch === 'boolean'
        && typeof policy.requireTemplateMatch === 'boolean'
        && typeof policy.requireRollback === 'boolean'
      ))
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0
      && candidate.candidates.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isFiniteNumber(item.goldenMatchPct)
        && isFiniteNumber(item.offsetMatchPct)
        && typeof item.specialTokenIdsMatch === 'boolean'
        && typeof item.templateMatches === 'boolean'
        && isFiniteNumber(item.tokenCountP95DeltaPct)
        && isFiniteNumber(item.downstreamQualityDelta)
        && typeof item.rollbackReady === 'boolean'
        && typeof item.failureTruth === 'string'
      )),
  );
}

export default function ProductionTokenizationReleaseCompatibilityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseCompatibilityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No tokenizer release model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseCompatibilityModel(payload)) {
          throw new Error('The tokenizer release model is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the release lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState status="error" detail={loadError} />;
  if (!data) return <LabState status="loading" detail="Loading the release evidence..." />;
  return <ReleaseCompatibilityLab data={data} />;
}

function ReleaseCompatibilityLab({ data }: { data: ReleaseCompatibilityModel }) {
  const initialCandidate = data.candidates.find(
    (candidate) => candidate.id === data.defaults.candidateId,
  ) ?? data.candidates[0];
  const initialPolicy = data.policies.find(
    (policy) => policy.id === data.defaults.policyId,
  ) ?? data.policies[0];
  const [candidateId, setCandidateId] = useState(initialCandidate.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [trafficPercent, setTrafficPercent] = useState(data.defaults.trafficPercent);

  const candidate = data.candidates.find((item) => item.id === candidateId)
    ?? data.candidates[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const checks: GateCheck[] = [
      {
        id: 'golden',
        label: 'Golden token IDs',
        observed: `${candidate.goldenMatchPct.toFixed(1)}% match`,
        requirement: policy.minimumGoldenMatchPct === 0
          ? 'Not checked'
          : `At least ${policy.minimumGoldenMatchPct}%`,
        state: policy.minimumGoldenMatchPct === 0
          ? 'ignored'
          : candidate.goldenMatchPct >= policy.minimumGoldenMatchPct ? 'pass' : 'fail',
      },
      {
        id: 'offsets',
        label: 'Source offsets',
        observed: `${candidate.offsetMatchPct.toFixed(1)}% match`,
        requirement: policy.minimumOffsetMatchPct === 0
          ? 'Not checked'
          : `At least ${policy.minimumOffsetMatchPct}%`,
        state: policy.minimumOffsetMatchPct === 0
          ? 'ignored'
          : candidate.offsetMatchPct >= policy.minimumOffsetMatchPct ? 'pass' : 'fail',
      },
      {
        id: 'special-tokens',
        label: 'Special-token IDs',
        observed: candidate.specialTokenIdsMatch ? 'Exact match' : 'Changed',
        requirement: policy.requireSpecialTokenMatch ? 'Exact match' : 'Not checked',
        state: !policy.requireSpecialTokenMatch
          ? 'ignored'
          : candidate.specialTokenIdsMatch ? 'pass' : 'fail',
      },
      {
        id: 'template',
        label: 'Prompt template',
        observed: candidate.templateMatches ? 'Exact match' : 'Changed',
        requirement: policy.requireTemplateMatch ? 'Exact match' : 'Not checked',
        state: !policy.requireTemplateMatch
          ? 'ignored'
          : candidate.templateMatches ? 'pass' : 'fail',
      },
      {
        id: 'token-distribution',
        label: 'Protected-slice p95',
        observed: `${formatDelta(candidate.tokenCountP95DeltaPct)} tokens`,
        requirement: `No more than +${policy.maximumTokenDeltaPct}%`,
        state: candidate.tokenCountP95DeltaPct <= policy.maximumTokenDeltaPct ? 'pass' : 'fail',
      },
      {
        id: 'quality',
        label: 'Downstream quality',
        observed: formatDelta(candidate.downstreamQualityDelta),
        requirement: `No worse than ${policy.minimumQualityDelta}`,
        state: candidate.downstreamQualityDelta >= policy.minimumQualityDelta ? 'pass' : 'fail',
      },
      {
        id: 'rollback',
        label: 'Complete rollback',
        observed: candidate.rollbackReady ? 'Loaded and tested' : 'Not ready',
        requirement: policy.requireRollback ? 'Required' : 'Not checked',
        state: !policy.requireRollback
          ? 'ignored'
          : candidate.rollbackReady ? 'pass' : 'fail',
      },
    ];

    const failed = checks.filter((check) => check.state === 'fail');
    const ignored = checks.filter((check) => check.state === 'ignored');
    const policyPasses = failed.length === 0;
    const exactContractBroken = (
      candidate.goldenMatchPct < 99.9
      || candidate.offsetMatchPct < 99.9
      || !candidate.specialTokenIdsMatch
      || !candidate.templateMatches
    );
    const unsafeApproval = policyPasses && exactContractBroken;
    const exposedRequestsPerSecond = (
      data.productionRequestsPerSecond * trafficPercent / 100
    );
    const incompatibleRequestsPerSecond = exactContractBroken ? exposedRequestsPerSecond : 0;
    const secondsToMillion = incompatibleRequestsPerSecond > 0
      ? 1_000_000 / incompatibleRequestsPerSecond
      : null;

    let verdict = 'Candidate is blocked before exposure';
    let explanation = `${failed.length} declared gate${failed.length === 1 ? '' : 's'} failed. Keep production traffic on the baseline bundle.`;
    let tone: MetricTone = 'rose';
    let action = 'Block';

    if (unsafeApproval) {
      verdict = 'This policy would approve an incompatible contract';
      explanation = `${ignored.length} checks are ignored. At ${trafficPercent}% traffic, ${Math.round(incompatibleRequestsPerSecond).toLocaleString()} requests/s can receive changed model inputs.`;
      tone = 'rose';
      action = 'Unsafe approval';
    } else if (policyPasses && trafficPercent === 0) {
      verdict = 'Exact gates pass; shadow evidence can begin';
      explanation = 'No user traffic is exposed. Compare runtime latency, protected slices, and bundle attribution before starting a canary.';
      tone = 'blue';
      action = 'Shadow';
    } else if (policyPasses && trafficPercent < 100) {
      verdict = 'Candidate can remain in bounded canary';
      explanation = `The selected gates pass. Keep the ${trafficPercent}% cohort attributable and stop expansion if runtime evidence breaches a threshold.`;
      tone = 'amber';
      action = 'Hold canary';
    } else if (policyPasses) {
      verdict = 'Candidate is eligible for full promotion';
      explanation = 'The selected evidence passes and all traffic is assigned. Preserve the baseline bundle until the rollback window closes.';
      tone = 'emerald';
      action = 'Promote';
    }

    return {
      action,
      checks,
      exactContractBroken,
      explanation,
      exposedRequestsPerSecond,
      failed,
      ignored,
      incompatibleRequestsPerSecond,
      policyPasses,
      secondsToMillion,
      tone,
      unsafeApproval,
      verdict,
    };
  }, [candidate, data.productionRequestsPerSecond, policy, trafficPercent]);

  const reset = () => {
    setCandidateId(initialCandidate.id);
    setPolicyId(initialPolicy.id);
    setTrafficPercent(data.defaults.trafficPercent);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Compatibility and rollout lab"
          title={data.title}
          description={data.description}
          icon={GitCompare}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate bundle
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === candidate.id}
                      label={item.label}
                      detail={item.detail}
                      icon={candidateIcon(item.id)}
                      accent={item.id === 'identical-repack' ? 'emerald' : item.id === 'id-remap' ? 'rose' : 'violet'}
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
                      icon={item.id === 'contract-first' ? ShieldCheck : ShieldAlert}
                      accent={item.id === 'contract-first' ? 'emerald' : 'rose'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Candidate traffic"
                value={trafficPercent}
                output={`${trafficPercent}%`}
                min={0}
                max={100}
                step={5}
                accent="amber"
                lowLabel="Shadow"
                highLabel="All traffic"
                onChange={setTrafficPercent}
              />
            </div>
          )}
        >
          <div className="min-h-[760px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Gate decision"
                value={result.action}
                detail={`${result.failed.length} failed; ${result.ignored.length} ignored`}
                icon={result.policyPasses ? CheckCircle2 : CircleX}
                tone={result.tone}
              />
              <LabMetric
                label="Candidate exposure"
                value={`${compact.format(result.exposedRequestsPerSecond)}/s`}
                detail={`${trafficPercent}% of ${compact.format(data.productionRequestsPerSecond)} req/s`}
                icon={Percent}
                tone="blue"
              />
              <LabMetric
                label="Changed-input exposure"
                value={`${compact.format(result.incompatibleRequestsPerSecond)}/s`}
                detail={result.exactContractBroken ? 'Exact contract differs' : 'Exact fixtures match'}
                icon={Activity}
                tone={result.exactContractBroken && trafficPercent > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Rollback bundle"
                value={candidate.rollbackReady ? 'Ready' : 'Missing'}
                detail="Model, tokenizer, template, policy, and routing"
                icon={RotateCcw}
                tone={candidate.rollbackReady ? 'emerald' : 'rose'}
              />
            </div>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Evidence gate
                  </h4>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    The policy decides which evidence is allowed to block traffic.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Observing {result.checks.length - result.ignored.length} of {result.checks.length}
                </span>
              </div>
              <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {result.checks.map((check) => (
                  <GateRow key={check.id} check={check} />
                ))}
              </div>
            </section>

            <section className="border-y border-neutral-200 py-5 dark:border-neutral-800">
              <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                Trace exposure from decision to user impact
              </h4>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <PathNode
                  icon={FileCheck2}
                  eyebrow="Evidence"
                  title={`${result.failed.length} failed, ${result.ignored.length} ignored`}
                  detail={policy.label}
                />
                <PathArrow />
                <PathNode
                  icon={Gauge}
                  eyebrow="Traffic"
                  title={`${trafficPercent}% candidate share`}
                  detail={`${Math.round(result.exposedRequestsPerSecond).toLocaleString()} candidate requests/s`}
                />
                <PathArrow />
                <PathNode
                  icon={result.exactContractBroken ? ShieldAlert : PackageCheck}
                  eyebrow="Consequence"
                  title={result.exactContractBroken ? 'Model input changes' : 'Contract preserved'}
                  detail={result.secondsToMillion
                    ? `One million changed requests in ${formatDuration(result.secondsToMillion)}`
                    : 'No changed-input exposure in this fixture'}
                />
              </div>
            </section>

            <section className={`border-l-4 pl-4 ${
              result.tone === 'rose'
                ? 'border-rose-500'
                : result.tone === 'amber'
                  ? 'border-amber-500'
                  : result.tone === 'blue'
                    ? 'border-blue-500'
                    : 'border-emerald-500'
            }`}>
              <div className="flex items-center gap-2">
                {result.tone === 'rose' ? (
                  <CircleAlert aria-hidden="true" className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Release verdict
                </span>
              </div>
              <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.verdict}
              </h4>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {result.explanation}
              </p>
              <p className="mt-3 text-sm font-medium leading-6 text-neutral-800 dark:text-neutral-100">
                Failure truth: {candidate.failureTruth}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function GateRow({ check }: { check: GateCheck }) {
  const Icon = check.state === 'pass'
    ? CheckCircle2
    : check.state === 'fail'
      ? CircleX
      : CircleAlert;
  const iconClass = check.state === 'pass'
    ? 'text-emerald-600 dark:text-emerald-400'
    : check.state === 'fail'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-neutral-400 dark:text-neutral-500';

  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.55fr)_minmax(130px,0.55fr)] sm:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <span className="text-sm font-semibold text-neutral-950 dark:text-white">
          {check.label}
        </span>
      </div>
      <span className="text-sm tabular-nums text-neutral-700 dark:text-neutral-200">
        {check.observed}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {check.requirement}
      </span>
    </div>
  );
}

function candidateIcon(id: string): LucideIcon {
  if (id === 'identical-repack') return PackageCheck;
  if (id === 'id-remap') return ShieldAlert;
  if (id === 'normalizer-change') return GitCompare;
  return FileCheck2;
}

function PathNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-h-32 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <>
      <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 text-neutral-400 md:block" />
    </>
  );
}

function formatDelta(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

function LabState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  const Icon = status === 'loading' ? LoaderCircle : CircleAlert;
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            className="flex min-h-56 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300"
            role={status === 'error' ? 'alert' : 'status'}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {detail}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
