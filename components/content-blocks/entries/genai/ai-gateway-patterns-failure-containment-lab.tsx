'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Gauge,
  GitPullRequestArrow,
  Radio,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  SquareStack,
  TimerOff,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Verdict = 'expand' | 'hold' | 'rollback';

type Evidence = {
  qualityScore: number;
  taskSuccessRatePct: number;
  policyViolationRatePct: number;
  costPer1000RequestsUsd: number;
};

type Release = Evidence & {
  id: string;
  label: string;
  detail: string;
  evaluatedRequests: number;
  averageOutputTokens: number;
};

type Fault = {
  id: string;
  label: string;
  detail: string;
  failureRatePct: number;
  transientShare: number;
  streamDisconnectRatePct: number;
  clientReplayRatePct: number;
};

type RecoveryPolicy = {
  id: string;
  label: string;
  detail: string;
  maxAttempts: number;
  retryShare: number;
  circuitThresholdPct: number;
  circuitContainmentPct: number;
  propagatesCancellation: boolean;
  deduplicatesClientIntent: boolean;
  fallbackEnabled: boolean;
  fallbackQualityScore: number;
  fallbackSuccessRatePct: number;
  fallbackCostPer1000RequestsUsd: number;
  cacheLabel: string;
  cacheSafe: boolean;
};

type ContainmentModel = {
  title: string;
  description: string;
  defaults: {
    releaseId: string;
    faultId: string;
    policyId: string;
    trafficRps: number;
    canaryTrafficPct: number;
  };
  observationMinutes: number;
  gates: {
    minimumEvaluatedRequests: number;
    minimumCanaryRequests: number;
    maximumQualityRegressionPoints: number;
    maximumPolicyViolationRatePct: number;
    maximumAttemptAmplification: number;
    minimumDeliveredQualityScore: number;
  };
  baseline: Evidence;
  releases: Release[];
  faults: Fault[];
  policies: RecoveryPolicy[];
};

const BLOCK_ID = 'genai/ai-gateway-patterns-failure-containment-lab';

function isContainmentModel(value: unknown): value is ContainmentModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContainmentModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.gates
      && candidate.baseline
      && typeof candidate.observationMinutes === 'number'
      && Array.isArray(candidate.releases)
      && candidate.releases.length > 0
      && Array.isArray(candidate.faults)
      && candidate.faults.length > 0
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0,
  );
}

const percent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;
const money = (value: number) => `$${value.toFixed(2)}`;

export default function AiGatewayPatternsFailureContainmentLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ContainmentModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No failure-containment model was supplied.');
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
        if (!isContainmentModel(payload)) {
          throw new Error('The failure-containment model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load containment data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState status="error" detail={error} />
      ) : data ? (
        <FailureContainmentLab data={data} />
      ) : (
        <LoadState status="loading" detail="Loading failure and rollout evidence..." />
      )}
    </div>
  );
}

function FailureContainmentLab({ data }: { data: ContainmentModel }) {
  const [releaseId, setReleaseId] = useState(data.defaults.releaseId);
  const [faultId, setFaultId] = useState(data.defaults.faultId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [trafficRps, setTrafficRps] = useState(data.defaults.trafficRps);
  const [canaryTrafficPct, setCanaryTrafficPct] = useState(
    data.defaults.canaryTrafficPct,
  );

  const release = data.releases.find((item) => item.id === releaseId) ?? data.releases[0];
  const fault = data.faults.find((item) => item.id === faultId) ?? data.faults[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const productionRequests = trafficRps * 60 * data.observationMinutes;
    const canaryRequests = productionRequests * (canaryTrafficPct / 100);
    const duplicateClientRequests = (
      canaryRequests
      * (fault.clientReplayRatePct / 100)
      * (policy.deduplicatesClientIntent ? 0 : 1)
    );
    const admittedRequests = canaryRequests + duplicateClientRequests;
    const failureRate = fault.failureRatePct / 100;
    const circuitOpen = fault.failureRatePct >= policy.circuitThresholdPct;
    const primaryShare = circuitOpen
      ? Math.max(0, 1 - policy.circuitContainmentPct / 100)
      : 1;
    const primaryAttempts = admittedRequests * primaryShare;
    const ejectedRequests = admittedRequests - primaryAttempts;
    const primaryFailures = primaryAttempts * failureRate;
    const primarySuccesses = primaryAttempts - primaryFailures;

    let unresolvedFailures = primaryFailures;
    let retryAttempts = 0;
    let retrySuccesses = 0;
    for (let attempt = 1; attempt < policy.maxAttempts; attempt += 1) {
      const roundAttempts = (
        unresolvedFailures
        * fault.transientShare
        * policy.retryShare
      );
      const roundSuccesses = roundAttempts * (1 - failureRate);
      retryAttempts += roundAttempts;
      retrySuccesses += roundSuccesses;
      unresolvedFailures = Math.max(0, unresolvedFailures - roundSuccesses);
    }

    const fallbackRequests = policy.fallbackEnabled
      ? ejectedRequests + unresolvedFailures
      : 0;
    const fallbackSuccesses = (
      fallbackRequests
      * (policy.fallbackSuccessRatePct / 100)
    );
    const completedResponses = primarySuccesses + retrySuccesses + fallbackSuccesses;
    const deliveredRequests = Math.min(canaryRequests, completedResponses);
    const deliveryRatePct = deliveredRequests / Math.max(canaryRequests, 1) * 100;
    const failedUserRequests = Math.max(0, canaryRequests - deliveredRequests);
    const totalAttempts = primaryAttempts + retryAttempts + fallbackRequests;
    const attemptAmplification = totalAttempts / Math.max(canaryRequests, 1);
    const projectedCostUsd = (
      (primaryAttempts + retryAttempts) / 1000 * release.costPer1000RequestsUsd
      + fallbackRequests / 1000 * policy.fallbackCostPer1000RequestsUsd
    );
    const disconnectedStreams = canaryRequests * (fault.streamDisconnectRatePct / 100);
    const uncanceledOutputTokens = policy.propagatesCancellation
      ? 0
      : disconnectedStreams * release.averageOutputTokens * 0.6;
    const unsafeCacheResponses = policy.cacheSafe ? 0 : canaryRequests * 0.01;
    const deliveredQualityScore = completedResponses > 0
      ? (
        (primarySuccesses + retrySuccesses) * release.qualityScore
        + fallbackSuccesses * policy.fallbackQualityScore
      ) / completedResponses
      : 0;

    const qualityDelta = release.qualityScore - data.baseline.qualityScore;
    const evaluationEvidencePass = (
      release.evaluatedRequests >= data.gates.minimumEvaluatedRequests
    );
    const canaryEvidencePass = canaryRequests >= data.gates.minimumCanaryRequests;
    const qualityGatePass = (
      qualityDelta >= -data.gates.maximumQualityRegressionPoints
    );
    const policyGatePass = (
      release.policyViolationRatePct <= data.gates.maximumPolicyViolationRatePct
    );
    const amplificationPass = (
      attemptAmplification <= data.gates.maximumAttemptAmplification
    );
    const deliveredQualityPass = (
      deliveredQualityScore >= data.gates.minimumDeliveredQualityScore
    );

    const blockers = [
      !qualityGatePass
        ? `Offline quality regresses ${Math.abs(qualityDelta).toFixed(1)} points.`
        : null,
      !policyGatePass
        ? `Policy violations reach ${percent(release.policyViolationRatePct, 2)}.`
        : null,
      !policy.cacheSafe
        ? 'The response cache is keyed too broadly for tenant isolation.'
        : null,
    ].filter((item): item is string => Boolean(item));

    const warnings = [
      !evaluationEvidencePass
        ? `${(data.gates.minimumEvaluatedRequests - release.evaluatedRequests).toLocaleString()} more offline evaluations are required.`
        : null,
      !canaryEvidencePass
        ? `${Math.ceil(data.gates.minimumCanaryRequests - canaryRequests).toLocaleString()} more canary requests are required.`
        : null,
      circuitOpen ? 'The route circuit is open; freeze expansion while probes recover.' : null,
      !amplificationPass
        ? `Attempt amplification is ${attemptAmplification.toFixed(2)}x.`
        : null,
      !deliveredQualityPass
        ? `Fallback mix lowers delivered quality to ${deliveredQualityScore.toFixed(1)}.`
        : null,
      uncanceledOutputTokens > 0
        ? `${Math.round(uncanceledOutputTokens).toLocaleString()} output tokens may continue after clients leave.`
        : null,
    ].filter((item): item is string => Boolean(item));

    let verdict: Verdict = 'expand';
    if (blockers.length > 0) verdict = 'rollback';
    else if (warnings.length > 0) verdict = 'hold';

    return {
      admittedRequests,
      amplificationPass,
      attemptAmplification,
      blockers,
      canaryEvidencePass,
      canaryRequests,
      circuitOpen,
      completedResponses,
      deliveredQualityPass,
      deliveredQualityScore,
      deliveryRatePct,
      disconnectedStreams,
      duplicateClientRequests,
      ejectedRequests,
      evaluationEvidencePass,
      failedUserRequests,
      fallbackRequests,
      policyGatePass,
      primaryAttempts,
      projectedCostUsd,
      qualityDelta,
      qualityGatePass,
      retryAttempts,
      totalAttempts,
      uncanceledOutputTokens,
      unsafeCacheResponses,
      verdict,
      warnings,
    };
  }, [
    canaryTrafficPct,
    data.baseline.qualityScore,
    data.gates,
    data.observationMinutes,
    fault,
    policy,
    release,
    trafficRps,
  ]);

  const reset = () => {
    setReleaseId(data.defaults.releaseId);
    setFaultId(data.defaults.faultId);
    setPolicyId(data.defaults.policyId);
    setTrafficRps(data.defaults.trafficRps);
    setCanaryTrafficPct(data.defaults.canaryTrafficPct);
  };

  const verdict = verdictCopy(result.verdict);
  const VerdictIcon = verdict.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Failure containment lab"
        title={data.title}
        description={data.description}
        icon={GitPullRequestArrow}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <ControlSelect
              label="1. Routing release"
              items={data.releases}
              selectedId={release.id}
              onSelect={setReleaseId}
            />
            <ControlSelect
              label="2. Provider condition"
              items={data.faults}
              selectedId={fault.id}
              onSelect={setFaultId}
            />
            <ControlSelect
              label="3. Recovery boundary"
              items={data.policies}
              selectedId={policy.id}
              onSelect={setPolicyId}
            />
            <LabRange
              label="Production traffic"
              value={trafficRps}
              output={`${trafficRps} req/s`}
              min={20}
              max={500}
              step={20}
              accent="blue"
              lowLabel="20 req/s"
              highLabel="500 req/s"
              onChange={setTrafficRps}
            />
            <LabRange
              label="Canary traffic"
              value={canaryTrafficPct}
              output={`${canaryTrafficPct}%`}
              min={1}
              max={50}
              step={1}
              accent="amber"
              lowLabel="1% bounded"
              highLabel="50% exposed"
              onChange={setCanaryTrafficPct}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${verdict.className}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{verdict.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.blockers[0] ?? result.warnings[0] ?? verdict.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Attempt amplification"
              value={`${result.attemptAmplification.toFixed(2)}x`}
              detail={`Gate: at most ${data.gates.maximumAttemptAmplification.toFixed(2)}x`}
              icon={Repeat2}
              tone={result.amplificationPass ? 'emerald' : 'rose'}
            />
            <LabMetric
              label={`${data.observationMinutes}-minute spend`}
              value={money(result.projectedCostUsd)}
              detail="Primary, retry, and fallback attempts."
              icon={CircleDollarSign}
              tone="amber"
            />
            <LabMetric
              label="Delivered quality"
              value={`${result.deliveredQualityScore.toFixed(1)}/100`}
              detail={`${result.deliveryRatePct.toFixed(1)}% delivery rate`}
              icon={Zap}
              tone={result.deliveredQualityPass ? 'violet' : 'rose'}
            />
            <LabMetric
              label="Uncanceled output"
              value={Math.round(result.uncanceledOutputTokens).toLocaleString()}
              detail={policy.propagatesCancellation
                ? 'Cancellation reaches the adapter.'
                : 'Estimated tokens after disconnect.'}
              icon={TimerOff}
              tone={result.uncanceledOutputTokens === 0 ? 'emerald' : 'rose'}
            />
          </div>

          <section aria-label="Attempt and fallback flow">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Request-to-attempt flow
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  One client request can create several billable provider attempts.
                </p>
              </div>
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                {Math.round(result.canaryRequests).toLocaleString()} canary requests
              </span>
            </div>
            <div className="mt-3 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <FlowStage
                label="Client intents"
                value={Math.round(result.canaryRequests).toLocaleString()}
                detail={result.duplicateClientRequests > 0
                  ? `+${Math.round(result.duplicateClientRequests).toLocaleString()} duplicate submissions admitted`
                  : 'Duplicate submissions collapse to one request ID'}
                icon={Radio}
                tone="blue"
              />
              <FlowConnector />
              <FlowStage
                label="Provider attempts"
                value={Math.round(result.totalAttempts).toLocaleString()}
                detail={`${Math.round(result.retryAttempts).toLocaleString()} retries`}
                icon={Repeat2}
                tone={result.amplificationPass ? 'emerald' : 'rose'}
              />
              <FlowConnector />
              <FlowStage
                label={result.circuitOpen ? 'Circuit open' : 'Circuit closed'}
                value={Math.round(result.ejectedRequests).toLocaleString()}
                detail={result.circuitOpen
                  ? 'requests ejected from the primary route'
                  : 'requests ejected'}
                icon={result.circuitOpen ? Ban : Gauge}
                tone={result.circuitOpen ? 'amber' : 'neutral'}
              />
              <FlowConnector />
              <FlowStage
                label="Fallback attempts"
                value={Math.round(result.fallbackRequests).toLocaleString()}
                detail={policy.fallbackEnabled
                  ? `Quality ${policy.fallbackQualityScore}/100`
                  : 'Fallback disabled'}
                icon={SquareStack}
                tone={policy.fallbackEnabled ? 'violet' : 'neutral'}
              />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Route circuit
                  </p>
                  <p className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    {percent(fault.failureRatePct)} observed failure
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${
                  result.circuitOpen
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                }`}>
                  {result.circuitOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full ${result.circuitOpen ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{
                    width: `${Math.min(
                      100,
                      fault.failureRatePct / Math.max(policy.circuitThresholdPct, 1) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>0% failures</span>
                <span>Open at {percent(policy.circuitThresholdPct, 0)}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.circuitOpen
                  ? `${percent(policy.circuitContainmentPct, 0)} of new traffic is kept away from this provider-model-region route while limited probes recover it.`
                  : 'The route remains available. Failures still consume the request deadline and attempt budget.'}
              </p>
            </div>

            <div className={`rounded-md border p-4 ${
              policy.cacheSafe
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
            }`}>
              <div className="flex items-center gap-2">
                {policy.cacheSafe ? (
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                )}
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  Response cache
                </p>
              </div>
              <p className="mt-2 font-semibold text-neutral-950 dark:text-white">
                {policy.cacheLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {policy.cacheSafe
                  ? 'The key preserves tenant, model, adapter, tool, and policy context. Canceled streams are not stored.'
                  : `${Math.round(result.unsafeCacheResponses).toLocaleString()} canary responses are modeled as exposed to an unsafe shared-key lookup.`}
              </p>
            </div>
          </section>

          <section aria-label="Release gate results">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evaluation-driven release gates
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Gate
                label="Offline evidence"
                detail={`${release.evaluatedRequests.toLocaleString()} / ${data.gates.minimumEvaluatedRequests.toLocaleString()} evaluated requests`}
                passed={result.evaluationEvidencePass}
              />
              <Gate
                label="Canary evidence"
                detail={`${Math.round(result.canaryRequests).toLocaleString()} / ${data.gates.minimumCanaryRequests.toLocaleString()} observed requests`}
                passed={result.canaryEvidencePass}
              />
              <Gate
                label="Quality regression"
                detail={`${result.qualityDelta >= 0 ? '+' : ''}${result.qualityDelta.toFixed(1)} points vs control`}
                passed={result.qualityGatePass}
              />
              <Gate
                label="Policy violations"
                detail={`${percent(release.policyViolationRatePct, 2)} vs ${percent(data.gates.maximumPolicyViolationRatePct, 2)} maximum`}
                passed={result.policyGatePass}
              />
            </div>
          </section>

          <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              Failure impact remains inside the {canaryTrafficPct}% cohort
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              The stable routing policy still serves {100 - canaryTrafficPct}% of traffic. This
              canary projects {Math.round(result.failedUserRequests).toLocaleString()} delivery
              failures and {Math.round(result.completedResponses).toLocaleString()} completed
              responses during the observation window.
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ControlSelect({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function FlowStage({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Radio;
  tone: 'neutral' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const styles = {
    neutral: 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
    blue: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30',
    violet: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30',
  };

  return (
    <div className={`min-h-32 min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold uppercase">{label}</p>
      </div>
      <p className="mt-3 break-words text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="hidden items-center justify-center text-neutral-400 md:flex dark:text-neutral-600">
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </div>
  );
}

function Gate({
  label,
  detail,
  passed,
}: {
  label: string;
  detail: string;
  passed: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 ${
      passed
        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
    }`}>
      {passed ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">
          {detail}
        </p>
      </div>
    </div>
  );
}

function verdictCopy(verdict: Verdict) {
  if (verdict === 'rollback') {
    return {
      title: 'Roll back the candidate policy',
      detail: 'A hard release gate failed. The stable control remains the serving policy.',
      icon: RotateCcw,
      className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    };
  }
  if (verdict === 'hold') {
    return {
      title: 'Hold traffic and contain the fault',
      detail: 'Keep the canary bounded while evidence or route health recovers.',
      icon: TriangleAlert,
      className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
    };
  }
  return {
    title: 'Canary passes; expand one bounded step',
    detail: 'Quality, policy, evidence, cost pressure, and route health remain inside the declared gates.',
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
  };
}

function LoadState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  return (
    <div
      className={`not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border p-6 ${
        status === 'error'
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      <div className="max-w-md text-center">
        {status === 'error' ? (
          <TriangleAlert aria-hidden="true" className="mx-auto h-6 w-6" />
        ) : (
          <Activity aria-hidden="true" className="mx-auto h-6 w-6 animate-pulse motion-reduce:animate-none" />
        )}
        <p className="mt-3 text-sm font-semibold">
          {status === 'error' ? 'Containment model unavailable' : 'Preparing the containment lab'}
        </p>
        <p className="mt-1 text-sm opacity-75">{detail}</p>
      </div>
    </div>
  );
}
