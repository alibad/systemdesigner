'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Clock3,
  Gauge,
  GitPullRequestArrow,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';
type Verdict = 'expand' | 'hold' | 'rollback';

interface Evidence {
  taskSuccesses: number;
  evaluatedRequests: number;
  policyFailures: number;
  p95LatencyMs: number;
  computeUnitsPer1000Requests: number;
}

interface Candidate extends Evidence {
  id: string;
  label: string;
  detail: string;
}

interface ReleaseModel {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    productionRateRps: number;
    canaryTrafficPct: number;
    observationMinutes: number;
  };
  gates: {
    minimumCanaryRequests: number;
    maximumTaskSuccessRegressionPct: number;
    maximumPolicyFailureRatePct: number;
    maximumP95LatencyIncreasePct: number;
    maximumComputePerSuccessIncreasePct: number;
  };
  baseline: Evidence;
  candidates: Candidate[];
}

const BLOCK_ID = 'genai/production-deployment-canary-release-lab';

function isReleaseModel(value: unknown): value is ReleaseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.gates
      && candidate.baseline
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0,
  );
}

const rate = (successes: number, total: number) => successes / total;
const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const signedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export default function ProductionDeploymentCanaryReleaseLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No canary evidence was supplied.');
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
        if (!isReleaseModel(payload)) throw new Error('The canary evidence model is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load canary evidence.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState status="error" detail={loadError} />;
  if (!data) return <LabState status="loading" detail="Loading the canary evidence..." />;

  return <CanaryReleaseLab data={data} />;
}

function CanaryReleaseLab({ data }: { data: ReleaseModel }) {
  const [candidateId, setCandidateId] = useState(data.defaults.candidateId);
  const [productionRateRps, setProductionRateRps] = useState(data.defaults.productionRateRps);
  const [canaryTrafficPct, setCanaryTrafficPct] = useState(data.defaults.canaryTrafficPct);
  const [observationMinutes, setObservationMinutes] = useState(
    data.defaults.observationMinutes,
  );

  const candidate = data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];

  const result = useMemo(() => {
    const baselineSuccessRate = rate(
      data.baseline.taskSuccesses,
      data.baseline.evaluatedRequests,
    );
    const candidateSuccessRate = rate(candidate.taskSuccesses, candidate.evaluatedRequests);
    const candidatePolicyRate = rate(candidate.policyFailures, candidate.evaluatedRequests);
    const taskSuccessDeltaPct = (candidateSuccessRate - baselineSuccessRate) * 100;
    const p95LatencyDeltaPct = (
      (candidate.p95LatencyMs - data.baseline.p95LatencyMs)
      / data.baseline.p95LatencyMs
    ) * 100;
    const baselineComputePerSuccess = (
      data.baseline.computeUnitsPer1000Requests
      / (baselineSuccessRate * 1000)
    );
    const candidateComputePerSuccess = (
      candidate.computeUnitsPer1000Requests
      / (candidateSuccessRate * 1000)
    );
    const computePerSuccessDeltaPct = (
      (candidateComputePerSuccess - baselineComputePerSuccess)
      / baselineComputePerSuccess
    ) * 100;
    const canaryRequests = Math.round(
      productionRateRps * (canaryTrafficPct / 100) * observationMinutes * 60,
    );
    const baselineRequests = Math.round(
      productionRateRps * (1 - canaryTrafficPct / 100) * observationMinutes * 60,
    );
    const projectedUnsuccessfulTasks = Math.round(
      canaryRequests * (1 - candidateSuccessRate),
    );
    const projectedPolicyFailures = Math.round(canaryRequests * candidatePolicyRate);
    const evidencePass = canaryRequests >= data.gates.minimumCanaryRequests;
    const qualityPass = (
      taskSuccessDeltaPct >= -data.gates.maximumTaskSuccessRegressionPct
    );
    const policyPass = (
      candidatePolicyRate * 100 <= data.gates.maximumPolicyFailureRatePct
    );
    const latencyPass = (
      p95LatencyDeltaPct <= data.gates.maximumP95LatencyIncreasePct
    );
    const efficiencyPass = (
      computePerSuccessDeltaPct <= data.gates.maximumComputePerSuccessIncreasePct
    );

    const blockers = [
      !qualityPass
        ? `Task success regresses ${Math.abs(taskSuccessDeltaPct).toFixed(1)} percentage points.`
        : null,
      !policyPass
        ? `Policy failures reach ${(candidatePolicyRate * 100).toFixed(1)}%, above the hard limit.`
        : null,
    ].filter((item): item is string => Boolean(item));

    const warnings = [
      !evidencePass
        ? `${(data.gates.minimumCanaryRequests - canaryRequests).toLocaleString()} more canary requests are needed.`
        : null,
      !latencyPass
        ? `P95 latency rises ${p95LatencyDeltaPct.toFixed(1)}%.`
        : null,
      !efficiencyPass
        ? `Compute per successful task rises ${computePerSuccessDeltaPct.toFixed(1)}%.`
        : null,
    ].filter((item): item is string => Boolean(item));

    let verdict: Verdict = 'expand';
    if (blockers.length > 0) verdict = 'rollback';
    else if (warnings.length > 0) verdict = 'hold';

    const nextTrafficPct = verdict === 'expand'
      ? Math.min(50, Math.max(canaryTrafficPct + 5, canaryTrafficPct * 2))
      : canaryTrafficPct;

    return {
      baselineRequests,
      baselineSuccessRate,
      blockers,
      canaryRequests,
      candidatePolicyRate,
      candidateSuccessRate,
      computePerSuccessDeltaPct,
      efficiencyPass,
      evidencePass,
      latencyPass,
      nextTrafficPct,
      p95LatencyDeltaPct,
      policyPass,
      projectedPolicyFailures,
      projectedUnsuccessfulTasks,
      qualityPass,
      taskSuccessDeltaPct,
      verdict,
      warnings,
    };
  }, [
    candidate,
    canaryTrafficPct,
    data.baseline,
    data.gates,
    observationMinutes,
    productionRateRps,
  ]);

  const reset = () => {
    setCandidateId(data.defaults.candidateId);
    setProductionRateRps(data.defaults.productionRateRps);
    setCanaryTrafficPct(data.defaults.canaryTrafficPct);
    setObservationMinutes(data.defaults.observationMinutes);
  };

  const verdictStyle: Record<Verdict, {
    title: string;
    detail: string;
    tone: Tone;
    icon: typeof ShieldCheck;
    className: string;
  }> = {
    expand: {
      title: result.nextTrafficPct > canaryTrafficPct
        ? `Expand cautiously to ${result.nextTrafficPct}%`
        : 'Canary passes; require a separate global promotion review',
      detail: 'The declared quality, policy, latency, efficiency, and evidence gates pass while the stable control remains available.',
      tone: 'emerald',
      icon: ShieldCheck,
      className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
    },
    hold: {
      title: 'Hold this traffic share',
      detail: 'No hard release blocker fired, but the evidence or an operational budget is incomplete.',
      tone: 'amber',
      icon: CircleAlert,
      className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    },
    rollback: {
      title: 'Roll back to the known-good release',
      detail: 'A hard quality or policy boundary failed. More exposure would increase user impact.',
      tone: 'rose',
      icon: RotateCcw,
      className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
    },
  };

  const outcome = verdictStyle[result.verdict];
  const OutcomeIcon = outcome.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Canary decision lab"
          title={data.title}
          description={data.description}
          icon={GitPullRequestArrow}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={candidate.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Sparkles}
                      accent={item.id === 'balanced-improvement' ? 'emerald' : 'amber'}
                      onClick={() => setCandidateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Production traffic"
                value={productionRateRps}
                output={`${productionRateRps} req/s`}
                min={20}
                max={1000}
                step={20}
                accent="blue"
                lowLabel="20 req/s"
                highLabel="1K req/s"
                onChange={setProductionRateRps}
              />

              <LabRange
                label="Canary share"
                value={canaryTrafficPct}
                output={`${canaryTrafficPct}%`}
                min={1}
                max={50}
                step={1}
                accent="violet"
                lowLabel="1% bounded"
                highLabel="50% bounded"
                onChange={setCanaryTrafficPct}
              />

              <LabRange
                label="Observation window"
                value={observationMinutes}
                output={`${observationMinutes} min`}
                min={5}
                max={120}
                step={5}
                accent="cyan"
                lowLabel="5 min"
                highLabel="2 hours"
                onChange={setObservationMinutes}
              />
            </div>
          )}
        >
          <div className="min-h-[650px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Task-success delta"
                value={`${result.taskSuccessDeltaPct >= 0 ? '+' : ''}${result.taskSuccessDeltaPct.toFixed(1)} pp`}
                detail={`Candidate ${percent(result.candidateSuccessRate)} vs baseline ${percent(result.baselineSuccessRate)}`}
                icon={Users}
                tone={result.qualityPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Policy failures"
                value={percent(result.candidatePolicyRate)}
                detail={`Hard limit ${data.gates.maximumPolicyFailureRatePct.toFixed(1)}%`}
                icon={ShieldAlert}
                tone={result.policyPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="P95 latency change"
                value={signedPercent(result.p95LatencyDeltaPct)}
                detail={`Limit +${data.gates.maximumP95LatencyIncreasePct}%`}
                icon={Gauge}
                tone={result.latencyPass ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Compute per success"
                value={signedPercent(result.computePerSuccessDeltaPct)}
                detail={`Limit +${data.gates.maximumComputePerSuccessIncreasePct}%`}
                icon={Activity}
                tone={result.efficiencyPass ? 'violet' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    User exposure during this window
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    Traffic share controls both evidence speed and the blast radius of a bad candidate.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                  <Clock3 aria-hidden="true" className="h-4 w-4" />
                  {observationMinutes} minutes
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                <div className="flex h-12 w-full">
                  <div
                    className="flex min-w-0 items-center justify-center bg-violet-500 px-2 text-xs font-semibold text-white"
                    style={{ width: `${canaryTrafficPct}%` }}
                  >
                    {canaryTrafficPct >= 12 ? `${canaryTrafficPct}% candidate` : null}
                  </div>
                  <div
                    className="flex min-w-0 items-center justify-center bg-neutral-300 px-2 text-xs font-semibold text-neutral-900 dark:bg-neutral-700 dark:text-white"
                    style={{ width: `${100 - canaryTrafficPct}%` }}
                  >
                    {canaryTrafficPct <= 88 ? `${100 - canaryTrafficPct}% baseline` : null}
                  </div>
                </div>
                <div className="grid gap-3 border-t border-neutral-200 p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-neutral-800">
                  <ExposureStat
                    label="Candidate requests"
                    value={result.canaryRequests.toLocaleString()}
                    detail="Receives the bounded canary share"
                  />
                  <ExposureStat
                    label="Baseline requests"
                    value={result.baselineRequests.toLocaleString()}
                    detail="Preserves a live control and rollback route"
                  />
                  <ExposureStat
                    label="Unsuccessful tasks"
                    value={result.projectedUnsuccessfulTasks.toLocaleString()}
                    detail="Projected from the observed candidate rate"
                  />
                  <ExposureStat
                    label="Policy failures"
                    value={result.projectedPolicyFailures.toLocaleString()}
                    detail="Projected from the observed candidate rate"
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <GateRow
                label="Evidence volume"
                passed={result.evidencePass}
                detail={`${result.canaryRequests.toLocaleString()} / ${data.gates.minimumCanaryRequests.toLocaleString()} requests`}
              />
              <GateRow
                label="Task success"
                passed={result.qualityPass}
                detail={`No worse than -${data.gates.maximumTaskSuccessRegressionPct.toFixed(1)} pp`}
              />
              <GateRow
                label="Policy boundary"
                passed={result.policyPass}
                detail={`At or below ${data.gates.maximumPolicyFailureRatePct.toFixed(1)}%`}
              />
              <GateRow
                label="Operational budgets"
                passed={result.latencyPass && result.efficiencyPass}
                detail="P95 latency and compute per successful task"
              />
            </section>

            <section className={`rounded-md border p-5 ${outcome.className}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-lg font-semibold">{outcome.title}</h4>
                  <p className="mt-1 text-sm leading-6">{outcome.detail}</p>
                  {result.blockers.length > 0 || result.warnings.length > 0 ? (
                    <ul className="mt-3 space-y-1 pl-5 text-sm leading-6">
                      {[...result.blockers, ...result.warnings].map((item) => (
                        <li key={item} className="list-disc">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm font-semibold">
                      Preserve the baseline route and reapply the same gates after expansion.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              All observations are synthetic teaching fixtures. Compute units are normalized,
              not currency. Replace every value and threshold with versioned product evidence
              before making a real release decision.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ExposureStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function GateRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        passed
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {passed ? (
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {label}: {passed ? 'Pass' : 'Stop'}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function LabState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-44 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      role={status === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        {status === 'error' ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
        ) : (
          <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 text-violet-600 dark:text-violet-300" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {status === 'error' ? 'Canary evidence unavailable' : 'Preparing the canary lab'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
        </div>
      </div>
    </div>
  );
}
