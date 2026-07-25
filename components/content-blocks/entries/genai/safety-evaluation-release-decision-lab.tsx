'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  Gauge,
  RefreshCw,
  Scale,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Severity = 'moderate' | 'high' | 'critical';
type PolicyId = 'aggregate' | 'slice-point' | 'severity-evidence';

interface EvidenceSlice {
  id: string;
  label: string;
  affectedSlice?: string;
  severity: Severity;
  tested: number;
  violations: number;
}

interface IncidentRegression extends EvidenceSlice {
  lesson: string;
}

interface Candidate {
  id: string;
  label: string;
  detail: string;
  utilityPassPct: number;
  utilityFloorPct: number;
  evaluatorAgreementPct: number;
  slices: EvidenceSlice[];
  incidentRegression: IncidentRegression;
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
  sampleFactor: number;
}

interface ReleaseDecisionData {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    policyId: PolicyId;
    exposureId: string;
    includeIncidentSuite: boolean;
  };
  limits: {
    maximumViolationPctBySeverity: Record<Severity, number>;
    minimumCasesBySeverity: Record<Severity, number>;
    minimumEvaluatorAgreementPct: number;
    maximumAggregateViolationPct: number;
  };
  policies: GatePolicy[];
  exposures: Exposure[];
  candidates: Candidate[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/safety-evaluation/data/release-decision-model.json';
const BLOCK_ID = 'genai/safety-evaluation-release-decision-lab';
const Z_95 = 1.96;

function isReleaseDecisionData(value: unknown): value is ReleaseDecisionData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseDecisionData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && data.limits
      && Array.isArray(data.policies)
      && data.policies.length > 0
      && Array.isArray(data.exposures)
      && data.exposures.length > 0
      && Array.isArray(data.candidates)
      && data.candidates.length > 0
      && data.candidates.every((candidate) => (
        typeof candidate.id === 'string'
        && typeof candidate.utilityPassPct === 'number'
        && typeof candidate.evaluatorAgreementPct === 'number'
        && Array.isArray(candidate.slices)
        && candidate.slices.length > 0
        && candidate.slices.every((slice) => (
          typeof slice.tested === 'number'
          && typeof slice.violations === 'number'
        ))
        && candidate.incidentRegression
        && typeof candidate.incidentRegression.tested === 'number'
      )),
  );
}

function observedRatePct(evidence: EvidenceSlice) {
  return evidence.violations / evidence.tested * 100;
}

function wilsonUpperPct(evidence: EvidenceSlice) {
  const proportion = evidence.violations / evidence.tested;
  const zSquared = Z_95 * Z_95;
  const denominator = 1 + zSquared / evidence.tested;
  const center = (
    proportion + zSquared / (2 * evidence.tested)
  ) / denominator;
  const spread = Z_95 * Math.sqrt(
    proportion * (1 - proportion) / evidence.tested
      + zSquared / (4 * evidence.tested * evidence.tested),
  ) / denominator;
  return (center + spread) * 100;
}

export default function SafetyEvaluationReleaseDecisionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseDecisionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [candidateId, setCandidateId] = useState('');
  const [policyId, setPolicyId] = useState<PolicyId>('severity-evidence');
  const [exposureId, setExposureId] = useState('');
  const [includeIncidentSuite, setIncludeIncidentSuite] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseDecisionData(payload)) {
          throw new Error('Release decision data is incomplete.');
        }

        setData(payload);
        setCandidateId(payload.defaults.candidateId);
        setPolicyId(payload.defaults.policyId);
        setExposureId(payload.defaults.exposureId);
        setIncludeIncidentSuite(payload.defaults.includeIncidentSuite);
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
  const policy = data?.policies.find((item) => item.id === policyId)
    ?? data?.policies[0];
  const exposure = data?.exposures.find((item) => item.id === exposureId)
    ?? data?.exposures[0];

  const model = useMemo(() => {
    if (!data || !candidate || !policy || !exposure) return null;

    const evidenceRows: Array<EvidenceSlice & { source: 'suite' | 'incident' }> = [
      ...candidate.slices.map((slice) => ({ ...slice, source: 'suite' as const })),
      ...(includeIncidentSuite
        ? [{ ...candidate.incidentRegression, source: 'incident' as const }]
        : []),
    ];
    const rows = evidenceRows.map((evidence) => {
      const limitPct =
        data.limits.maximumViolationPctBySeverity[evidence.severity]
        * exposure.limitFactor;
      const minimumCases = Math.ceil(
        data.limits.minimumCasesBySeverity[evidence.severity]
        * exposure.sampleFactor,
      );
      const ratePct = observedRatePct(evidence);
      const upperPct = wilsonUpperPct(evidence);
      return {
        ...evidence,
        limitPct,
        minimumCases,
        pointPass: ratePct <= limitPct,
        ratePct,
        samplePass: evidence.tested >= minimumCases,
        uncertaintyPass: upperPct <= limitPct,
        upperPct,
      };
    });

    const totalTested = candidate.slices.reduce((sum, row) => sum + row.tested, 0);
    const totalViolations = candidate.slices.reduce(
      (sum, row) => sum + row.violations,
      0,
    );
    const aggregateEvidence: EvidenceSlice = {
      id: 'aggregate',
      label: 'All standard-suite cases',
      severity: 'moderate',
      tested: totalTested,
      violations: totalViolations,
    };
    const aggregateRatePct = observedRatePct(aggregateEvidence);
    const aggregateUpperPct = wilsonUpperPct(aggregateEvidence);
    const aggregateLimit =
      data.limits.maximumAggregateViolationPct * exposure.limitFactor;
    const utilityPass = candidate.utilityPassPct >= candidate.utilityFloorPct;
    const evaluatorPass =
      candidate.evaluatorAgreementPct >= data.limits.minimumEvaluatorAgreementPct;
    const blockers: string[] = [];

    if (!utilityPass) {
      blockers.push(
        `utility ${candidate.utilityPassPct.toFixed(1)}% is below the ${candidate.utilityFloorPct}% floor`,
      );
    }

    if (policy.id === 'aggregate') {
      if (aggregateUpperPct > aggregateLimit) {
        blockers.push(
          `aggregate upper bound ${aggregateUpperPct.toFixed(2)}% exceeds ${aggregateLimit.toFixed(2)}%`,
        );
      }
    } else if (policy.id === 'slice-point') {
      for (const row of rows) {
        if (!row.pointPass) {
          blockers.push(
            `${row.affectedSlice ?? row.label} observed ${row.ratePct.toFixed(2)}% versus ${row.limitPct.toFixed(2)}%`,
          );
        }
        if (!row.samplePass) {
          blockers.push(
            `${row.affectedSlice ?? row.label} has ${row.tested} of ${row.minimumCases} required cases`,
          );
        }
      }
    } else {
      if (!evaluatorPass) {
        blockers.push(
          `evaluator agreement ${candidate.evaluatorAgreementPct}% is below ${data.limits.minimumEvaluatorAgreementPct}%`,
        );
      }
      if (!includeIncidentSuite) {
        blockers.push(
          `${candidate.incidentRegression.id} is absent from the release evidence`,
        );
      }
      for (const row of rows) {
        if (!row.uncertaintyPass) {
          blockers.push(
            `${row.affectedSlice ?? row.label} 95% upper bound ${row.upperPct.toFixed(2)}% exceeds ${row.limitPct.toFixed(2)}%`,
          );
        }
        if (!row.samplePass) {
          blockers.push(
            `${row.affectedSlice ?? row.label} has ${row.tested} of ${row.minimumCases} required cases`,
          );
        }
      }
    }

    const aggregateLooksHealthy = aggregateUpperPct <= aggregateLimit;
    const hiddenSliceFailures = rows.filter(
      (row) => row.source === 'suite' && !row.uncertaintyPass,
    );
    const eligible = blockers.length === 0;
    const decision = eligible
      ? exposure.id === 'general'
        ? 'Eligible for general availability'
        : exposure.id === 'canary'
          ? 'Eligible for a bounded canary'
          : 'Eligible for internal testing'
      : exposure.id === 'internal'
        ? 'Keep inside the internal pilot'
        : 'Hold this release';

    return {
      aggregateLooksHealthy,
      aggregateRatePct,
      aggregateUpperPct,
      blockers,
      decision,
      eligible,
      evaluatorPass,
      hiddenSliceFailures,
      rows,
      utilityPass,
    };
  }, [candidate, data, exposure, includeIncidentSuite, policy]);

  function reset() {
    if (!data) return;
    setCandidateId(data.defaults.candidateId);
    setPolicyId(data.defaults.policyId);
    setExposureId(data.defaults.exposureId);
    setIncludeIncidentSuite(data.defaults.includeIncidentSuite);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Safety release gate"
          title={data?.title ?? 'Make the release decision from explicit evidence'}
          description={data?.description ?? 'Loading versioned release evidence...'}
          icon={ShieldCheck}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !policy || !exposure || !model ? (
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
                        icon={item.id === 'medical-v4' ? ShieldCheck : item.id === 'support-v7' ? Gauge : Scale}
                        accent={item.id === 'medical-v4' ? 'emerald' : item.id === 'support-v7' ? 'blue' : 'amber'}
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Gate policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'severity-evidence' ? ShieldCheck : item.id === 'slice-point' ? TestTube2 : Gauge}
                        accent={item.id === 'severity-evidence' ? 'rose' : item.id === 'slice-point' ? 'violet' : 'cyan'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Exposure boundary
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {data.exposures.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === exposure.id}
                        label={item.label}
                        detail={item.detail}
                        icon={TargetIcon(item.id)}
                        accent={item.id === 'internal' ? 'blue' : item.id === 'canary' ? 'amber' : 'rose'}
                        onClick={() => setExposureId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                  <input
                    type="checkbox"
                    checked={includeIncidentSuite}
                    onChange={(event) => setIncludeIncidentSuite(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-rose-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      Run incident-derived regressions
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Include {candidate.incidentRegression.id}: {candidate.incidentRegression.label}.
                    </span>
                  </span>
                </label>
              </div>
            )}
          >
            <div className="min-h-[760px] min-w-0">
              <div
                className={`rounded-md border p-5 ${
                  model.eligible
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {model.eligible ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <FileWarning aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                      {policy.label} decision
                    </p>
                    <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                      {model.decision}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {model.eligible
                        ? `${candidate.label} satisfies this policy for the ${exposure.label.toLowerCase()} boundary. Preserve the exact versions and monitor the same slices after exposure.`
                        : model.blockers.slice(0, 3).join('; ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Aggregate observed"
                  value={`${model.aggregateRatePct.toFixed(2)}%`}
                  detail={`95% upper bound ${model.aggregateUpperPct.toFixed(2)}%`}
                  icon={Gauge}
                  tone={model.aggregateLooksHealthy ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Slice blockers"
                  value={model.hiddenSliceFailures.length.toString()}
                  detail="Standard-suite slices whose upper bound breaches its severity limit"
                  icon={AlertTriangle}
                  tone={model.hiddenSliceFailures.length === 0 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Evaluator agreement"
                  value={`${candidate.evaluatorAgreementPct}%`}
                  detail={`Required: ${data.limits.minimumEvaluatorAgreementPct}%`}
                  icon={TestTube2}
                  tone={model.evaluatorPass ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Benign utility"
                  value={`${candidate.utilityPassPct}%`}
                  detail={`Candidate floor: ${candidate.utilityFloorPct}%`}
                  icon={Scale}
                  tone={model.utilityPass ? 'emerald' : 'rose'}
                />
              </div>

              <section className="mt-7" aria-labelledby="release-evidence-title">
                <div>
                  <h4
                    id="release-evidence-title"
                    className="text-base font-semibold text-neutral-950 dark:text-white"
                  >
                    Evidence remains separate by harm and slice
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    The observed rate describes this sample. The 95% upper bound asks how bad the underlying rate could plausibly be with the available evidence.
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {model.rows.map((row) => {
                    const rowPass = policy.id === 'aggregate'
                      ? true
                      : policy.id === 'slice-point'
                        ? row.pointPass && row.samplePass
                        : row.uncertaintyPass && row.samplePass;
                    return (
                      <article
                        key={`${row.source}-${row.id}`}
                        className={`rounded-md border p-4 ${
                          rowPass
                            ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                            : 'border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20'
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-semibold text-neutral-950 dark:text-white">
                                {row.label}
                              </h5>
                              <SeverityBadge severity={row.severity} />
                              {row.source === 'incident' ? (
                                <span className="rounded-sm border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                                  Incident regression
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                              {row.affectedSlice ?? candidate.incidentRegression.lesson}
                            </p>
                          </div>
                          <div className="grid shrink-0 grid-cols-3 gap-3 text-right text-xs">
                            <div>
                              <span className="block text-neutral-500 dark:text-neutral-400">Evidence</span>
                              <strong className="mt-0.5 block tabular-nums text-neutral-950 dark:text-white">
                                {row.violations} / {row.tested}
                              </strong>
                            </div>
                            <div>
                              <span className="block text-neutral-500 dark:text-neutral-400">Observed</span>
                              <strong className="mt-0.5 block tabular-nums text-neutral-950 dark:text-white">
                                {row.ratePct.toFixed(2)}%
                              </strong>
                            </div>
                            <div>
                              <span className="block text-neutral-500 dark:text-neutral-400">95% upper</span>
                              <strong className={`mt-0.5 block tabular-nums ${row.uncertaintyPass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                                {row.upperPct.toFixed(2)}%
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                          <div
                            className={row.uncertaintyPass ? 'h-full bg-emerald-500' : 'h-full bg-rose-500'}
                            style={{
                              width: `${Math.min(100, row.upperPct / Math.max(row.limitPct, 0.01) * 60)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>
                            Limit for {exposure.label.toLowerCase()}: {row.limitPct.toFixed(2)}%
                          </span>
                          <span>
                            Cases: {row.tested.toLocaleString()} / {row.minimumCases.toLocaleString()} required
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>What this policy can miss:</strong>{' '}
                {policy.id === 'aggregate'
                  ? model.hiddenSliceFailures.length > 0
                    ? `${model.hiddenSliceFailures.map((row) => row.affectedSlice).join(', ')} breach severity-aware uncertainty limits even though the aggregate looks healthy.`
                    : 'This candidate has no hidden standard-slice breach, but the policy still ignores evaluator calibration and incident coverage.'
                  : policy.id === 'slice-point'
                    ? 'Point estimates can sit below a threshold while a small sample leaves the upper bound above it. The absence of observed failures is not the same as a precise estimate.'
                    : includeIncidentSuite
                      ? `${candidate.incidentRegression.id} is visible as first-class release evidence rather than disappearing into the aggregate.`
                      : `The gate blocks because ${candidate.incidentRegression.id} was not rerun. A fixed bug without a protected regression can silently return.`}
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function TargetIcon(id: string) {
  if (id === 'general') return ShieldCheck;
  if (id === 'canary') return Gauge;
  return TestTube2;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    moderate: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
    high: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    critical: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  };

  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold uppercase ${styles[severity]}`}>
      {severity}
    </span>
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
    <LearningLabBody>
      <div className="grid min-h-[560px] place-items-center px-4 text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              Release evidence could not load
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Loading release evidence...
          </p>
        )}
      </div>
    </LearningLabBody>
  );
}
