'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  RefreshCw,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Severity = 'moderate' | 'high' | 'critical';
type PolicyId = 'aggregate' | 'severity-aware' | 'incident-ready';

interface EvidenceSlice {
  id: string;
  label: string;
  severity: Severity;
  tested: number;
  successes: number;
}

interface Candidate {
  id: string;
  label: string;
  detail: string;
  utilityPct: number;
  benignTested: number;
  benignFalsePositives: number;
  incidentRegressionsPassed: number;
  incidentRegressionsTotal: number;
  staticSlices: EvidenceSlice[];
  adaptiveSlices: EvidenceSlice[];
}

interface GatePolicy {
  id: PolicyId;
  label: string;
  detail: string;
}

interface Exposure {
  id: string;
  label: string;
  detail: string;
  limitFactor: number;
}

interface ReleaseGateModel {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    policyId: PolicyId;
    exposureId: string;
    includeAdaptive: boolean;
  };
  severityWeights: Record<Severity, number>;
  limits: {
    maximumAggregateAsrPct: number;
    maximumAsrPctBySeverity: Record<Severity, number>;
    maximumFalsePositivePct: number;
    minimumUtilityPct: number;
  };
  policies: GatePolicy[];
  exposures: Exposure[];
  candidates: Candidate[];
}

const BLOCK_ID = 'genai/adversarial-testing-release-gate-lab';
const DEFAULT_DATA_FILE =
  '/api/content/genai/adversarial-testing/data/release-gate-model.json';

function isReleaseGateModel(value: unknown): value is ReleaseGateModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ReleaseGateModel>;
  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && model.defaults?.candidateId
      && model.defaults.policyId
      && model.defaults.exposureId
      && model.severityWeights
      && model.limits
      && Array.isArray(model.policies)
      && model.policies.length === 3
      && Array.isArray(model.exposures)
      && model.exposures.length >= 2
      && Array.isArray(model.candidates)
      && model.candidates.length >= 3
      && model.candidates.every((candidate) => (
        typeof candidate.id === 'string'
        && typeof candidate.utilityPct === 'number'
        && typeof candidate.benignTested === 'number'
        && typeof candidate.benignFalsePositives === 'number'
        && Array.isArray(candidate.staticSlices)
        && candidate.staticSlices.length >= 3
        && Array.isArray(candidate.adaptiveSlices)
        && candidate.adaptiveSlices.length > 0
      )),
  );
}

function attackSuccessRate(slice: EvidenceSlice) {
  return slice.tested > 0 ? slice.successes / slice.tested * 100 : 100;
}

export default function AdversarialTestingReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ReleaseGateModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateModel(payload)) {
          throw new Error('The release-gate evidence is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Adversarial release gate"
            title="Turn attack evidence into a shipping decision"
            description="Loading the lesson-owned release evidence..."
            icon={ShieldCheck}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ReleaseGateLab model={model} />
      )}
    </div>
  );
}

function ReleaseGateLab({ model }: { model: ReleaseGateModel }) {
  const [candidateId, setCandidateId] = useState(model.defaults.candidateId);
  const [policyId, setPolicyId] = useState<PolicyId>(model.defaults.policyId);
  const [exposureId, setExposureId] = useState(model.defaults.exposureId);
  const [includeAdaptive, setIncludeAdaptive] = useState(model.defaults.includeAdaptive);
  const candidate = model.candidates.find((item) => item.id === candidateId)
    ?? model.candidates[0];
  const policy = model.policies.find((item) => item.id === policyId)
    ?? model.policies[0];
  const exposure = model.exposures.find((item) => item.id === exposureId)
    ?? model.exposures[0];

  const result = useMemo(() => {
    const slices = [
      ...candidate.staticSlices.map((slice) => ({ ...slice, suite: 'static' as const })),
      ...(includeAdaptive
        ? candidate.adaptiveSlices.map((slice) => ({ ...slice, suite: 'adaptive' as const }))
        : []),
    ];
    const rows = slices.map((slice) => {
      const ratePct = attackSuccessRate(slice);
      const limitPct = model.limits.maximumAsrPctBySeverity[slice.severity]
        * exposure.limitFactor;
      return { ...slice, ratePct, limitPct, pass: ratePct <= limitPct };
    });
    const totalTested = rows.reduce((sum, row) => sum + row.tested, 0);
    const totalSuccesses = rows.reduce((sum, row) => sum + row.successes, 0);
    const aggregateAsrPct = totalTested > 0 ? totalSuccesses / totalTested * 100 : 100;
    const weightedAttempts = rows.reduce(
      (sum, row) => sum + row.tested * model.severityWeights[row.severity],
      0,
    );
    const weightedSuccesses = rows.reduce(
      (sum, row) => sum + row.successes * model.severityWeights[row.severity],
      0,
    );
    const weightedAsrPct = weightedAttempts > 0
      ? weightedSuccesses / weightedAttempts * 100
      : 100;
    const falsePositivePct = candidate.benignTested > 0
      ? candidate.benignFalsePositives / candidate.benignTested * 100
      : 100;
    const utilityPass = candidate.utilityPct >= model.limits.minimumUtilityPct;
    const falsePositivePass = falsePositivePct <= model.limits.maximumFalsePositivePct;
    const regressionsPass =
      candidate.incidentRegressionsPassed === candidate.incidentRegressionsTotal;
    const sliceFailures = rows.filter((row) => !row.pass);
    const aggregateLimit = model.limits.maximumAggregateAsrPct * exposure.limitFactor;
    const aggregatePass = aggregateAsrPct <= aggregateLimit;
    const blockers: string[] = [];

    if (policy.id === 'aggregate') {
      if (!aggregatePass) {
        blockers.push(
          `aggregate attack success ${aggregateAsrPct.toFixed(2)}% exceeds ${aggregateLimit.toFixed(2)}%`,
        );
      }
    } else {
      for (const row of sliceFailures) {
        blockers.push(
          `${row.label} ${row.ratePct.toFixed(2)}% exceeds its ${row.limitPct.toFixed(2)}% ${row.severity} limit`,
        );
      }
      if (!utilityPass) {
        blockers.push(
          `utility ${candidate.utilityPct.toFixed(1)}% is below ${model.limits.minimumUtilityPct}%`,
        );
      }
      if (!falsePositivePass) {
        blockers.push(
          `benign false positives ${falsePositivePct.toFixed(1)}% exceed ${model.limits.maximumFalsePositivePct}%`,
        );
      }
    }

    if (policy.id === 'incident-ready') {
      if (!includeAdaptive) blockers.push('adaptive evidence is not included');
      if (!regressionsPass) {
        blockers.push(
          `${candidate.incidentRegressionsPassed} of ${candidate.incidentRegressionsTotal} incident regressions pass`,
        );
      }
    }

    const hiddenWarnings: string[] = [];
    if (policy.id === 'aggregate') {
      if (sliceFailures.length > 0) {
        hiddenWarnings.push(
          `${sliceFailures.length} severity slice ${sliceFailures.length === 1 ? 'fails' : 'fail'} behind the aggregate`,
        );
      }
      if (!utilityPass) hiddenWarnings.push('utility is below the declared floor');
      if (!falsePositivePass) hiddenWarnings.push('benign overblocking exceeds the declared limit');
      if (!regressionsPass) hiddenWarnings.push('a protected incident regression fails');
    }

    const eligible = blockers.length === 0;
    const decision = eligible
      ? policy.id === 'aggregate' && hiddenWarnings.length > 0
        ? 'Weak policy says pass'
        : exposure.id === 'general'
          ? 'Eligible for general availability'
          : exposure.id === 'canary'
            ? 'Eligible for a bounded canary'
            : 'Eligible for internal testing'
      : exposure.id === 'internal'
        ? 'Keep inside the exercise'
        : 'Hold this release';

    return {
      aggregateAsrPct,
      blockers,
      decision,
      eligible,
      falsePositivePass,
      falsePositivePct,
      hiddenWarnings,
      regressionsPass,
      rows,
      sliceFailures,
      utilityPass,
      weightedAsrPct,
    };
  }, [candidate, exposure, includeAdaptive, model, policy]);

  function reset() {
    setCandidateId(model.defaults.candidateId);
    setPolicyId(model.defaults.policyId);
    setExposureId(model.defaults.exposureId);
    setIncludeAdaptive(model.defaults.includeAdaptive);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Adversarial release gate"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Candidate defense
              </legend>
              <div className="mt-3 grid gap-2">
                {model.candidates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === candidate.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'bounded-runtime-v5' ? ShieldCheck : item.id === 'deny-heavy-v2' ? Ban : SlidersHorizontal}
                    accent={item.id === 'bounded-runtime-v5' ? 'emerald' : item.id === 'deny-heavy-v2' ? 'amber' : 'violet'}
                    onClick={() => setCandidateId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Gate policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'aggregate' ? Gauge : item.id === 'severity-aware' ? Scale : BadgeCheck}
                    accent={item.id === 'aggregate' ? 'amber' : item.id === 'incident-ready' ? 'emerald' : 'blue'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Release exposure
              </legend>
              <div className="mt-3 grid gap-2">
                {model.exposures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === exposure.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'internal' ? FlaskConical : item.id === 'canary' ? TestTube2 : Users}
                    accent={item.id === 'general' ? 'rose' : item.id === 'canary' ? 'blue' : 'cyan'}
                    onClick={() => setExposureId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <input
                type="checkbox"
                checked={includeAdaptive}
                onChange={(event) => setIncludeAdaptive(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-violet-600"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                  Include adaptive attack suite
                </span>
                <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Retest after the attacker observes the candidate defense.
                </span>
              </span>
            </label>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <DecisionOutcome result={result} policy={policy} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Aggregate ASR"
              value={`${result.aggregateAsrPct.toFixed(2)}%`}
              detail="Successful attacks / attempts"
              icon={Gauge}
              tone={result.eligible && policy.id === 'aggregate' ? 'amber' : 'neutral'}
            />
            <LabMetric
              label="Severity-weighted ASR"
              value={`${result.weightedAsrPct.toFixed(2)}%`}
              detail="Critical outcomes carry more weight"
              icon={Scale}
              tone={result.sliceFailures.length > 0 ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Benign false positives"
              value={`${result.falsePositivePct.toFixed(1)}%`}
              detail={`${candidate.benignFalsePositives} of ${candidate.benignTested} benign cases`}
              icon={Users}
              tone={result.falsePositivePass ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Utility pass rate"
              value={`${candidate.utilityPct.toFixed(0)}%`}
              detail={`Floor: ${model.limits.minimumUtilityPct}%`}
              icon={Sparkles}
              tone={result.utilityPass ? 'emerald' : 'rose'}
            />
          </div>

          {result.hiddenWarnings.length > 0 ? (
            <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
              <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">What the aggregate hides</p>
                  <ul className="mt-2 space-y-1.5 text-sm leading-6">
                    {result.hiddenWarnings.map((warning) => (
                      <li key={warning} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Attack-family evidence
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Preserve severity and denominator
                </h4>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                ASR = successful attacks / attempts
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {result.rows.map((row) => (
                <EvidenceRow key={`${row.suite}-${row.id}`} row={row} />
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Regression corpus
              </p>
              <div className="mt-3 flex items-center gap-3">
                {result.regressionsPass
                  ? <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="h-6 w-6 shrink-0 text-rose-600 dark:text-rose-300" />}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">
                    {candidate.incidentRegressionsPassed} of {candidate.incidentRegressionsTotal} pass
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    Confirmed incidents stay independently blocking under the incident-ready policy.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence posture
              </p>
              <div className="mt-3 flex items-center gap-3">
                {includeAdaptive
                  ? <BadgeCheck aria-hidden="true" className="h-6 w-6 shrink-0 text-violet-600 dark:text-violet-300" />
                  : <TestTube2 aria-hidden="true" className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-300" />}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">
                    {includeAdaptive ? 'Static and adaptive suites' : 'Static suite only'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {includeAdaptive
                      ? 'The evidence includes attacks changed after observing the defense.'
                      : 'A static pass does not show whether the mitigation survives adaptation.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionOutcome({
  result,
  policy,
}: {
  result: {
    blockers: string[];
    decision: string;
    eligible: boolean;
    hiddenWarnings: string[];
  };
  policy: GatePolicy;
}) {
  const weakPass = result.eligible && result.hiddenWarnings.length > 0;
  const tone = !result.eligible ? 'rose' : weakPass ? 'amber' : 'emerald';
  const styles = tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
    : tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
  const Icon = tone === 'emerald' ? CheckCircle2 : tone === 'amber' ? CircleAlert : Ban;

  return (
    <div className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">{policy.label}</p>
          <h4 className="mt-1 text-xl font-semibold">{result.decision}</h4>
          {result.blockers.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm leading-6 opacity-85">
              {result.blockers.slice(0, 4).map((blocker) => (
                <li key={blocker} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 opacity-85">
              {weakPass
                ? 'This policy passes the aggregate while hiding blocking evidence. Change the policy before changing the conclusion.'
                : 'Every evidence condition enforced by this policy passes at the selected exposure.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceRow({
  row,
}: {
  row: EvidenceSlice & {
    suite: 'static' | 'adaptive';
    ratePct: number;
    limitPct: number;
    pass: boolean;
  };
}) {
  const barWidth = Math.min(100, row.limitPct > 0 ? row.ratePct / row.limitPct * 72 : 100);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{row.label}</p>
            <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] uppercase text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
              {row.suite}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${
              row.severity === 'critical'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                : row.severity === 'high'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
            }`}>
              {row.severity}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {row.successes} successes / {row.tested} attempts
          </p>
        </div>
        <div className={`flex shrink-0 items-center gap-2 text-sm font-semibold ${
          row.pass
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300'
        }`}>
          {row.pass
            ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
          {row.ratePct.toFixed(2)}% / {row.limitPct.toFixed(2)}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${row.pass ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
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
    <div className="p-5 md:p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          {error
            ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            : <TestTube2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-violet-600 dark:text-violet-300" />}
          <div>
            <p className="font-semibold text-neutral-950 dark:text-white">
              {error ? 'Release evidence unavailable' : 'Loading adversarial evidence'}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Preparing attack slices, utility evidence, and release policies.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-white"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
