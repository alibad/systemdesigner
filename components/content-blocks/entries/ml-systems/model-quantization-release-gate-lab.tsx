'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Box,
  Cpu,
  Gauge,
  GitCompareArrows,
  MemoryStick,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Timer,
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

const BLOCK_ID = 'ml-systems/model-quantization-deployment-release-lab';

type Benchmark = {
  p95Ms: number;
  peakMemoryMb: number;
  operatorCoveragePercent: number;
  aggregateScore: number;
  sliceScores: Record<string, number>;
};

type TargetProfile = {
  id: string;
  label: string;
  detail: string;
  trafficRps: number;
  maxP95Ms: number;
  maxPeakMemoryMb: number;
  minOperatorCoveragePercent: number;
  maxAggregateDrop: number;
  maxSliceDrop: number;
  baseline: Benchmark;
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  benchmarks: Record<string, Benchmark>;
};

type ReleaseData = {
  kind: 'deployment-release';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  note: string;
  baselineLabel: string;
  detectionWindowSeconds: number;
  defaults: {
    profileId: string;
    candidateId: string;
    canaryPercent: number;
    rollbackReady: boolean;
  };
  profiles: TargetProfile[];
  candidates: Candidate[];
};

type Gate = {
  id: string;
  label: string;
  detail: string;
  pass: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScoreMap(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.keys(value).length >= 2 &&
    Object.values(value).every(
      (score) => isFiniteNumber(score) && score >= 0 && score <= 1,
    )
  );
}

function isBenchmark(value: unknown): value is Benchmark {
  return (
    isRecord(value) &&
    isFiniteNumber(value.p95Ms) &&
    value.p95Ms > 0 &&
    isFiniteNumber(value.peakMemoryMb) &&
    value.peakMemoryMb > 0 &&
    isFiniteNumber(value.operatorCoveragePercent) &&
    value.operatorCoveragePercent > 0 &&
    value.operatorCoveragePercent <= 100 &&
    isFiniteNumber(value.aggregateScore) &&
    value.aggregateScore >= 0 &&
    value.aggregateScore <= 1 &&
    isScoreMap(value.sliceScores)
  );
}

function isReleaseData(value: unknown): value is ReleaseData {
  if (
    !isRecord(value) ||
    value.kind !== 'deployment-release' ||
    value.blockId !== BLOCK_ID ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.note !== 'string' ||
    typeof value.baselineLabel !== 'string' ||
    !isFiniteNumber(value.detectionWindowSeconds) ||
    value.detectionWindowSeconds <= 0 ||
    !isRecord(value.defaults) ||
    typeof value.defaults.profileId !== 'string' ||
    typeof value.defaults.candidateId !== 'string' ||
    !isFiniteNumber(value.defaults.canaryPercent) ||
    typeof value.defaults.rollbackReady !== 'boolean' ||
    !Array.isArray(value.profiles) ||
    value.profiles.length < 2 ||
    !Array.isArray(value.candidates) ||
    value.candidates.length < 2
  ) {
    return false;
  }

  const defaults = value.defaults;
  const profilesValid = value.profiles.every(
    (profile) =>
      isRecord(profile) &&
      typeof profile.id === 'string' &&
      typeof profile.label === 'string' &&
      typeof profile.detail === 'string' &&
      isFiniteNumber(profile.trafficRps) &&
      profile.trafficRps > 0 &&
      isFiniteNumber(profile.maxP95Ms) &&
      profile.maxP95Ms > 0 &&
      isFiniteNumber(profile.maxPeakMemoryMb) &&
      profile.maxPeakMemoryMb > 0 &&
      isFiniteNumber(profile.minOperatorCoveragePercent) &&
      isFiniteNumber(profile.maxAggregateDrop) &&
      isFiniteNumber(profile.maxSliceDrop) &&
      isBenchmark(profile.baseline),
  );
  if (!profilesValid) return false;

  const profileIds = value.profiles.map((profile) => profile.id);
  const candidatesValid = value.candidates.every((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      typeof candidate.label !== 'string' ||
      typeof candidate.detail !== 'string' ||
      !isRecord(candidate.benchmarks)
    ) {
      return false;
    }
    const benchmarks = candidate.benchmarks;
    return profileIds.every((profileId) => isBenchmark(benchmarks[profileId]));
  });

  return (
    candidatesValid &&
    value.profiles.some((profile) => profile.id === defaults.profileId) &&
    value.candidates.some((candidate) => candidate.id === defaults.candidateId)
  );
}

function formatScore(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number) {
  const points = value * 100;
  return `${points >= 0 ? '+' : ''}${points.toFixed(1)} pp`;
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/model-quantization/data/deployment-release-model.json';

export default function ModelQuantizationReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the deployment evidence (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseData(payload)) {
          throw new Error('The deployment evidence contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the release lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Release-gate lab unavailable</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading quantization release gate"
        role="status"
      />
    );
  }

  return <ReleaseGate data={data} />;
}

function ReleaseGate({ data }: { data: ReleaseData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [candidateId, setCandidateId] = useState(data.defaults.candidateId);
  const [canaryPercent, setCanaryPercent] = useState(data.defaults.canaryPercent);
  const [rollbackReady, setRollbackReady] = useState(data.defaults.rollbackReady);

  const profile =
    data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const candidate =
    data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];
  const benchmark = candidate.benchmarks[profile.id];

  const result = useMemo(() => {
    const baseline = profile.baseline;
    const sliceRows = Object.entries(baseline.sliceScores).map(
      ([label, baselineScore]) => {
        const candidateScore = benchmark.sliceScores[label];
        const delta = candidateScore - baselineScore;
        return {
          label,
          baselineScore,
          candidateScore,
          delta,
          pass: -delta <= profile.maxSliceDrop,
        };
      },
    );
    const worstSlice = [...sliceRows].sort((left, right) => left.delta - right.delta)[0];
    const aggregateDelta = benchmark.aggregateScore - baseline.aggregateScore;
    const gates: Gate[] = [
      {
        id: 'latency',
        label: 'Target p95 latency',
        detail: `${benchmark.p95Ms.toFixed(1)} ms measured; budget ${profile.maxP95Ms.toFixed(1)} ms`,
        pass: benchmark.p95Ms <= profile.maxP95Ms,
      },
      {
        id: 'memory',
        label: 'Peak process memory',
        detail: `${benchmark.peakMemoryMb.toLocaleString()} MB measured; budget ${profile.maxPeakMemoryMb.toLocaleString()} MB`,
        pass: benchmark.peakMemoryMb <= profile.maxPeakMemoryMb,
      },
      {
        id: 'coverage',
        label: 'Intentional operator paths',
        detail: `${benchmark.operatorCoveragePercent.toFixed(0)}% covered; required ${profile.minOperatorCoveragePercent.toFixed(0)}%`,
        pass:
          benchmark.operatorCoveragePercent >= profile.minOperatorCoveragePercent,
      },
      {
        id: 'aggregate',
        label: 'Aggregate quality',
        detail: `${formatDelta(aggregateDelta)} versus baseline; maximum drop ${(profile.maxAggregateDrop * 100).toFixed(1)} pp`,
        pass: -aggregateDelta <= profile.maxAggregateDrop,
      },
      {
        id: 'slice',
        label: 'Worst required slice',
        detail: `${worstSlice.label}: ${formatDelta(worstSlice.delta)}; maximum drop ${(profile.maxSliceDrop * 100).toFixed(1)} pp`,
        pass: worstSlice.pass,
      },
      {
        id: 'rollback',
        label: 'Compatible rollback',
        detail: rollbackReady
          ? 'Higher-precision artifact is loaded and the traffic switch is rehearsed.'
          : 'No compatible, exercised rollback is available.',
        pass: rollbackReady,
      },
    ];
    const failedGates = gates.filter((gate) => !gate.pass);
    const exposureRequests = Math.round(
      profile.trafficRps *
        (canaryPercent / 100) *
        data.detectionWindowSeconds,
    );

    return {
      aggregateDelta,
      exposureRequests,
      failedGates,
      gates,
      sliceRows,
      verdict: failedGates.length === 0 ? 'Release canary' : 'Hold release',
    };
  }, [benchmark, canaryPercent, data.detectionWindowSeconds, profile, rollbackReady]);

  const reset = () => {
    setProfileId(data.defaults.profileId);
    setCandidateId(data.defaults.candidateId);
    setCanaryPercent(data.defaults.canaryPercent);
    setRollbackReady(data.defaults.rollbackReady);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Deployment evidence lab"
          title={data.title}
          description={data.description}
          icon={Rocket}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Target profile
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'mobile-edge' ? MemoryStick : Cpu}
                      accent="blue"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate artifact
                </legend>
                <div className="mt-3 space-y-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === candidate.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Box}
                      accent={item.id === 'int8-ptq' ? 'amber' : 'violet'}
                      onClick={() => setCandidateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Canary traffic"
                value={canaryPercent}
                output={`${canaryPercent}%`}
                min={1}
                max={25}
                step={1}
                lowLabel="Small exposure"
                highLabel="Faster evidence"
                accent="emerald"
                onChange={setCanaryPercent}
              />

              <button
                type="button"
                aria-pressed={rollbackReady}
                onClick={() => setRollbackReady((current) => !current)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  rollbackReady
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                }`}
              >
                <RotateCcw aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">
                    {rollbackReady ? 'Rollback ready' : 'Rollback not ready'}
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Compatible higher-precision artifact is loaded and the traffic switch
                    has been rehearsed.
                  </span>
                </span>
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                result.failedGates.length === 0
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {result.failedGates.length === 0 ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Release decision
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.failedGates.length === 0
                      ? `All six gates pass. Begin at ${canaryPercent}% and keep the rollback trigger armed.`
                      : `${result.failedGates.length} of 6 gates fail. Canary size cannot waive missing evidence or a breached budget.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Candidate p95"
                value={`${benchmark.p95Ms.toFixed(1)} ms`}
                detail={`${profile.baseline.p95Ms.toFixed(1)} ms higher-precision baseline`}
                icon={Timer}
                tone={benchmark.p95Ms <= profile.maxP95Ms ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Peak memory"
                value={`${benchmark.peakMemoryMb.toLocaleString()} MB`}
                detail={`${profile.baseline.peakMemoryMb.toLocaleString()} MB higher-precision baseline`}
                icon={MemoryStick}
                tone={
                  benchmark.peakMemoryMb <= profile.maxPeakMemoryMb
                    ? 'cyan'
                    : 'rose'
                }
              />
              <LabMetric
                label="Operator coverage"
                value={`${benchmark.operatorCoveragePercent.toFixed(0)}%`}
                detail="Target graph with an intentional supported path"
                icon={GitCompareArrows}
                tone={
                  benchmark.operatorCoveragePercent >=
                  profile.minOperatorCoveragePercent
                    ? 'blue'
                    : 'rose'
                }
              />
              <LabMetric
                label="Five-minute exposure"
                value={result.exposureRequests.toLocaleString()}
                detail={`Possible canary requests at ${profile.trafficRps.toLocaleString()} req/s`}
                icon={Gauge}
                tone="amber"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2">
                  <BadgeCheck
                    aria-hidden="true"
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                  />
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    Six independent release gates
                  </h4>
                </div>
                <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                  {result.gates.map((gate) => (
                    <div
                      key={gate.id}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-xs font-bold ${
                          gate.pass
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                        }`}
                        aria-label={gate.pass ? 'Pass' : 'Fail'}
                      >
                        {gate.pass ? 'P' : 'F'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {gate.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          {gate.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <QualitySlices
                baselineLabel={data.baselineLabel}
                rows={result.sliceRows}
              />
            </div>

            <ReleasePath
              pass={result.failedGates.length === 0}
              canaryPercent={canaryPercent}
              rollbackReady={rollbackReady}
            />

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.note}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function QualitySlices({
  baselineLabel,
  rows,
}: {
  baselineLabel: string;
  rows: Array<{
    label: string;
    baselineScore: number;
    candidateScore: number;
    delta: number;
    pass: boolean;
  }>;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h4 className="font-semibold text-neutral-950 dark:text-white">
        Quality by required slice
      </h4>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        Candidate change versus {baselineLabel.toLowerCase()}.
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {row.label}
              </span>
              <span
                className={`font-mono text-xs font-semibold ${
                  row.pass
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {formatDelta(row.delta)}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[72px_minmax(0,1fr)_48px] items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
              <span>Baseline</span>
              <div className="h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full bg-neutral-500 dark:bg-neutral-400"
                  style={{ width: `${row.baselineScore * 100}%` }}
                />
              </div>
              <span className="text-right">{formatScore(row.baselineScore)}</span>
              <span>Candidate</span>
              <div className="h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full ${
                    row.pass
                      ? 'bg-emerald-500 dark:bg-emerald-400'
                      : 'bg-rose-500 dark:bg-rose-400'
                  }`}
                  style={{ width: `${row.candidateScore * 100}%` }}
                />
              </div>
              <span className="text-right">{formatScore(row.candidateScore)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReleasePath({
  pass,
  canaryPercent,
  rollbackReady,
}: {
  pass: boolean;
  canaryPercent: number;
  rollbackReady: boolean;
}) {
  const stages = [
    { label: 'Shadow', detail: 'Compare outputs' },
    { label: `${canaryPercent}% canary`, detail: 'Target traffic' },
    {
      label: pass ? 'Promote' : 'Blocked',
      detail: pass ? 'Gates remain armed' : 'Fix failed evidence',
    },
    {
      label: 'Rollback',
      detail: rollbackReady ? 'Ready path' : 'Unavailable',
    },
  ];

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <GitCompareArrows
          aria-hidden="true"
          className="h-5 w-5 text-violet-600 dark:text-violet-300"
        />
        <h4 className="font-semibold text-neutral-950 dark:text-white">
          Bounded rollout path
        </h4>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {stages.map((stage, index) => (
          <div className="relative" key={stage.label}>
            <div
              className={`h-full rounded-md border p-3 ${
                stage.label === 'Blocked'
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                  : stage.label === 'Rollback' && !rollbackReady
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30'
              }`}
            >
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Step {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {stage.label}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {stage.detail}
              </p>
            </div>
            {index < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 bg-violet-300 md:block dark:bg-violet-700"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
