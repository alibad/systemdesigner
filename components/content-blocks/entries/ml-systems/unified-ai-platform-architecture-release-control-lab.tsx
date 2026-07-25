'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  GitBranch,
  Gauge,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Split,
  X,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Candidate {
  id: string;
  label: string;
  detail: string;
  qualityDeltaPct: number;
  criticalSliceDeltaPct: number;
  errorRateDeltaPoints: number;
  p95LatencyDeltaMs: number;
  artifactSigned: boolean;
  lineageComplete: boolean;
  incidentRegressionPassed: boolean;
}

interface ReleaseStrategy {
  id: string;
  label: string;
  detail: string;
  userExposureFactor: number;
  rollbackMinutes: number;
  maximumTrafficPct: number;
}

interface ReleaseControlData {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    strategyId: string;
    trafficPct: number;
    rollbackTargetReady: boolean;
  };
  traffic: {
    baselineRequestsPerSecond: number;
    observationMinutes: number;
    min: number;
    max: number;
    step: number;
  };
  gates: {
    minimumQualityDeltaPct: number;
    minimumCriticalSliceDeltaPct: number;
    maximumErrorRateDeltaPoints: number;
    maximumP95LatencyDeltaMs: number;
  };
  candidates: Candidate[];
  strategies: ReleaseStrategy[];
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/unified-ai-platform-architecture/data/release-control-model.json';
const BLOCK_ID =
  'ml-systems/unified-ai-platform-architecture-release-control-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseControlData(value: unknown): value is ReleaseControlData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseControlData>;
  if (
    typeof data.title !== 'string'
    || typeof data.description !== 'string'
    || !data.defaults
    || !data.traffic
    || !data.gates
    || !Array.isArray(data.candidates)
    || data.candidates.length === 0
    || !Array.isArray(data.strategies)
    || data.strategies.length === 0
  ) {
    return false;
  }

  const defaultsValid = (
    typeof data.defaults.candidateId === 'string'
    && typeof data.defaults.strategyId === 'string'
    && isFiniteNumber(data.defaults.trafficPct)
    && typeof data.defaults.rollbackTargetReady === 'boolean'
  );
  const trafficValid = (
    isFiniteNumber(data.traffic.baselineRequestsPerSecond)
    && isFiniteNumber(data.traffic.observationMinutes)
    && isFiniteNumber(data.traffic.min)
    && isFiniteNumber(data.traffic.max)
    && isFiniteNumber(data.traffic.step)
  );
  const gatesValid = (
    isFiniteNumber(data.gates.minimumQualityDeltaPct)
    && isFiniteNumber(data.gates.minimumCriticalSliceDeltaPct)
    && isFiniteNumber(data.gates.maximumErrorRateDeltaPoints)
    && isFiniteNumber(data.gates.maximumP95LatencyDeltaMs)
  );
  const candidatesValid = data.candidates.every((candidate) => (
    typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && isFiniteNumber(candidate.qualityDeltaPct)
    && isFiniteNumber(candidate.criticalSliceDeltaPct)
    && isFiniteNumber(candidate.errorRateDeltaPoints)
    && isFiniteNumber(candidate.p95LatencyDeltaMs)
    && typeof candidate.artifactSigned === 'boolean'
    && typeof candidate.lineageComplete === 'boolean'
    && typeof candidate.incidentRegressionPassed === 'boolean'
  ));
  const strategiesValid = data.strategies.every((strategy) => (
    typeof strategy.id === 'string'
    && typeof strategy.label === 'string'
    && typeof strategy.detail === 'string'
    && isFiniteNumber(strategy.userExposureFactor)
    && isFiniteNumber(strategy.rollbackMinutes)
    && isFiniteNumber(strategy.maximumTrafficPct)
  ));

  return (
    defaultsValid
    && trafficValid
    && gatesValid
    && candidatesValid
    && strategiesValid
    && data.candidates.some((candidate) => candidate.id === data.defaults?.candidateId)
    && data.strategies.some((strategy) => strategy.id === data.defaults?.strategyId)
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function UnifiedAIPlatformArchitectureReleaseControlLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseControlData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [candidateId, setCandidateId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [trafficPct, setTrafficPct] = useState(1);
  const [rollbackTargetReady, setRollbackTargetReady] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isReleaseControlData(payload)) {
          throw new Error('The release-control model has an invalid data contract.');
        }
        setData(payload);
        setCandidateId(payload.defaults.candidateId);
        setStrategyId(payload.defaults.strategyId);
        setTrafficPct(payload.defaults.trafficPct);
        setRollbackTargetReady(payload.defaults.rollbackTargetReady);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load release evidence.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const candidate = data?.candidates.find((item) => item.id === candidateId)
    ?? data?.candidates[0];
  const strategy = data?.strategies.find((item) => item.id === strategyId)
    ?? data?.strategies[0];

  const model = useMemo(() => {
    if (!data || !candidate || !strategy) return null;

    const selectedTrafficPct = strategy.id === 'direct'
      ? 100
      : Math.min(trafficPct, strategy.maximumTrafficPct);
    const observedRequests = (
      data.traffic.baselineRequestsPerSecond
      * data.traffic.observationMinutes
      * 60
      * selectedTrafficPct
      / 100
    );
    const userExposedRequests = observedRequests * strategy.userExposureFactor;
    const regressionPressure = Math.max(
      0,
      -candidate.criticalSliceDeltaPct * 0.45,
      candidate.errorRateDeltaPoints * 9,
      candidate.p95LatencyDeltaMs / 4,
    );
    const projectedAffectedRequests = userExposedRequests
      * Math.min(0.08, regressionPressure / 1000);

    const evidence = [
      {
        id: 'quality',
        label: 'Overall quality',
        value: `${candidate.qualityDeltaPct >= 0 ? '+' : ''}${candidate.qualityDeltaPct.toFixed(1)}%`,
        threshold: `at least ${data.gates.minimumQualityDeltaPct.toFixed(1)}%`,
        pass: candidate.qualityDeltaPct >= data.gates.minimumQualityDeltaPct,
      },
      {
        id: 'slice',
        label: 'Critical slice',
        value: `${candidate.criticalSliceDeltaPct >= 0 ? '+' : ''}${candidate.criticalSliceDeltaPct.toFixed(1)}%`,
        threshold: `at least ${data.gates.minimumCriticalSliceDeltaPct.toFixed(1)}%`,
        pass:
          candidate.criticalSliceDeltaPct
          >= data.gates.minimumCriticalSliceDeltaPct,
      },
      {
        id: 'errors',
        label: 'Error-rate delta',
        value: `${candidate.errorRateDeltaPoints >= 0 ? '+' : ''}${candidate.errorRateDeltaPoints.toFixed(2)} pp`,
        threshold: `no more than +${data.gates.maximumErrorRateDeltaPoints.toFixed(2)} pp`,
        pass:
          candidate.errorRateDeltaPoints
          <= data.gates.maximumErrorRateDeltaPoints,
      },
      {
        id: 'latency',
        label: 'p95 latency delta',
        value: `${candidate.p95LatencyDeltaMs >= 0 ? '+' : ''}${candidate.p95LatencyDeltaMs} ms`,
        threshold: `no more than +${data.gates.maximumP95LatencyDeltaMs} ms`,
        pass:
          candidate.p95LatencyDeltaMs
          <= data.gates.maximumP95LatencyDeltaMs,
      },
      {
        id: 'artifact',
        label: 'Artifact identity',
        value: candidate.artifactSigned ? 'Signed' : 'Unsigned',
        threshold: 'signed immutable artifact',
        pass: candidate.artifactSigned,
      },
      {
        id: 'lineage',
        label: 'Lineage evidence',
        value: candidate.lineageComplete ? 'Complete' : 'Missing',
        threshold: 'code, data, run, and evaluator linked',
        pass: candidate.lineageComplete,
      },
      {
        id: 'incident',
        label: 'Incident regression',
        value: candidate.incidentRegressionPassed ? 'Passed' : 'Failed',
        threshold: 'protected regression remains green',
        pass: candidate.incidentRegressionPassed,
      },
      {
        id: 'rollback',
        label: 'Rollback target',
        value: rollbackTargetReady ? 'Ready' : 'Absent',
        threshold: 'known-good revision remains deployable',
        pass: rollbackTargetReady,
      },
    ];
    const blockers = evidence.filter((row) => !row.pass);
    const eligible = blockers.length === 0;
    const decision = !eligible
      ? 'Hold the release'
      : strategy.id === 'shadow'
        ? 'Collect shadow evidence'
        : strategy.id === 'canary'
          ? 'Run the bounded canary'
          : 'Evidence supports full promotion';

    return {
      blockers,
      decision,
      effectiveTrafficPct: selectedTrafficPct,
      eligible,
      evidence,
      observedRequests,
      projectedAffectedRequests,
      userExposedRequests,
    };
  }, [candidate, data, rollbackTargetReady, strategy, trafficPct]);

  function reset() {
    if (!data) return;
    setCandidateId(data.defaults.candidateId);
    setStrategyId(data.defaults.strategyId);
    setTrafficPct(data.defaults.trafficPct);
    setRollbackTargetReady(data.defaults.rollbackTargetReady);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence and rollout lab"
          title={data?.title ?? 'Bind the candidate, evidence, exposure, and rollback'}
          description={
            data?.description
            ?? 'Loading versioned candidate evidence and rollout controls...'
          }
          icon={GitBranch}
          accent="emerald"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !strategy || !model ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Candidate bundle
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === candidate.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'candidate-balanced'
                            ? BadgeCheck
                            : item.id === 'candidate-aggregate'
                              ? Gauge
                              : FileCheck2
                        }
                        accent={
                          item.id === 'candidate-balanced'
                            ? 'emerald'
                            : item.id === 'candidate-aggregate'
                              ? 'amber'
                              : 'rose'
                        }
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Exposure strategy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.strategies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === strategy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'shadow'
                            ? Activity
                            : item.id === 'canary'
                              ? Split
                              : Rocket
                        }
                        accent={
                          item.id === 'shadow'
                            ? 'blue'
                            : item.id === 'canary'
                              ? 'violet'
                              : 'amber'
                        }
                        onClick={() => setStrategyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                {strategy.id === 'direct' ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                    Direct promotion exposes 100% of traffic immediately. The traffic
                    control is intentionally fixed.
                  </div>
                ) : (
                  <LabRange
                    label={strategy.id === 'shadow' ? 'Mirrored traffic' : 'Canary traffic'}
                    value={Math.min(trafficPct, strategy.maximumTrafficPct)}
                    output={`${Math.min(trafficPct, strategy.maximumTrafficPct)}%`}
                    min={data.traffic.min}
                    max={strategy.maximumTrafficPct}
                    step={data.traffic.step}
                    lowLabel="Small sample"
                    highLabel={`${strategy.maximumTrafficPct}% policy cap`}
                    accent={strategy.id === 'shadow' ? 'blue' : 'violet'}
                    onChange={setTrafficPct}
                  />
                )}

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                  <input
                    type="checkbox"
                    checked={rollbackTargetReady}
                    onChange={(event) => setRollbackTargetReady(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                  />
                  <span>
                    <span className="block font-semibold">Known-good rollback target is ready</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      The platform can route back to an immutable compatible revision
                      without rebuilding it during the incident.
                    </span>
                  </span>
                </label>
              </div>
            )}
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Release decision"
                  value={model.decision}
                  detail={
                    model.eligible
                      ? 'Every declared evidence gate passes.'
                      : `${model.blockers.length} gate${model.blockers.length === 1 ? '' : 's'} block promotion.`
                  }
                  icon={model.eligible ? CheckCircle2 : CircleAlert}
                  tone={model.eligible ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Observed requests"
                  value={formatCompact(model.observedRequests)}
                  detail={`${data.traffic.observationMinutes}-minute observation at ${model.effectiveTrafficPct}% traffic`}
                  icon={Activity}
                  tone="blue"
                />
                <LabMetric
                  label="User exposure"
                  value={formatCompact(model.userExposedRequests)}
                  detail={
                    strategy.id === 'shadow'
                      ? 'Mirrored requests do not receive candidate responses'
                      : 'Requests receiving the candidate response'
                  }
                  icon={Split}
                  tone={strategy.id === 'shadow' ? 'cyan' : 'amber'}
                />
                <LabMetric
                  label="Rollback objective"
                  value={`${strategy.rollbackMinutes} min`}
                  detail="Illustrative time to restore the known-good route"
                  icon={RotateCcw}
                  tone="violet"
                />
              </div>

              <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    Evidence bound to {candidate.label}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    A gate is a versioned policy decision, not a dashboard someone
                    remembers to inspect.
                  </p>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {model.evidence.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(110px,0.6fr)_minmax(0,1fr)_28px] sm:items-center"
                    >
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {row.label}
                      </p>
                      <p className="text-sm tabular-nums text-neutral-700 dark:text-neutral-200">
                        {row.value}
                      </p>
                      <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                        {row.threshold}
                      </p>
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                          row.pass
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                        aria-label={row.pass ? 'Pass' : 'Fail'}
                      >
                        {row.pass ? (
                          <Check aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <X aria-hidden="true" className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className={`rounded-md border p-4 ${
                  model.eligible
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {model.eligible ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold">{model.decision}</h4>
                    {model.eligible ? (
                      <p className="mt-1 text-sm leading-6">
                        Keep the candidate digest, policy version, observation window,
                        approver, and rollback target in one release record. Expansion
                        still depends on live evidence from this exposure stage.
                      </p>
                    ) : (
                      <>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                          {model.blockers.map((blocker) => (
                            <li key={blocker.id}>
                              {blocker.label}: {blocker.value}; expected {blocker.threshold}.
                            </li>
                          ))}
                        </ul>
                        {model.projectedAffectedRequests > 0 ? (
                          <p className="mt-3 text-xs font-semibold uppercase">
                            Illustrative exposure under this regression pressure:
                            {' '}{formatCompact(model.projectedAffectedRequests)} requests
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </section>
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
  if (!error) {
    return (
      <div
        className="h-[36rem] animate-pulse bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900"
        aria-label="Loading release control lab"
        role="status"
      />
    );
  }

  return (
    <div className="p-5 md:p-6">
      <div
        className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Release evidence unavailable</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-neutral-950 dark:text-rose-100"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
