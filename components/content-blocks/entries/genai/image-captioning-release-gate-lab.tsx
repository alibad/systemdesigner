'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  CircleAlert,
  CircleMinus,
  CircleX,
  Clock3,
  Gauge,
  HeartHandshake,
  ListChecks,
  Radar,
  ScanSearch,
  ShieldCheck,
  Siren,
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

type Requirements = {
  minGroundedClaimPrecision: number;
  maxCriticalHallucinationPpm: number;
  minHumanUsefulness: number;
  maxP95LatencyMs: number;
  minSliceCoveragePercent: number;
  maxSensitiveInferencePpm: number;
  minQueueHeadroomPercent: number;
  requiresHumanReview: boolean;
};

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  requestRps: number;
  maxInitialExposurePercent: number;
  requirements: Requirements;
};

type BuildMetrics = {
  groundedClaimPrecision: number;
  criticalHallucinationPpm: number;
  humanUsefulness: number;
  p95LatencyMs: number;
  sliceCoveragePercent: number;
  sensitiveInferencePpm: number;
  queueHeadroomPercent: number;
  humanReviewReady: boolean;
  telemetryComplete: boolean;
};

type CaptionBuild = {
  id: string;
  label: string;
  detail: string;
  metrics: BuildMetrics;
};

type ReleaseData = {
  title: string;
  description: string;
  defaults: {
    buildId: string;
    policyId: string;
    exposurePercent: number;
  };
  policies: ReleasePolicy[];
  builds: CaptionBuild[];
};

type Gate = {
  id: string;
  label: string;
  detail: string;
  status: 'pass' | 'fail' | 'not-required';
  icon: typeof Gauge;
};

const BLOCK_ID = 'genai/image-captioning-release-gate-lab';

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.buildId
      && candidate.defaults.policyId
      && typeof candidate.defaults.exposurePercent === 'number'
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 2
      && Array.isArray(candidate.builds)
      && candidate.builds.length >= 2,
  );
}

export default function ImageCaptioningReleaseGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No release-gate scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseData(payload)) throw new Error('Release-gate data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <ReleaseGateLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function ReleaseGateLab({ data }: { data: ReleaseData }) {
  const initialBuild = data.builds.find((item) => item.id === data.defaults.buildId)
    ?? data.builds[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [buildId, setBuildId] = useState(initialBuild.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [exposurePercent, setExposurePercent] = useState(data.defaults.exposurePercent);

  const build = data.builds.find((item) => item.id === buildId) ?? data.builds[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const metrics = build.metrics;
    const requirements = policy.requirements;
    const gates: Gate[] = [
      {
        id: 'grounding',
        label: 'Grounded claims',
        detail: `${metrics.groundedClaimPrecision}% vs ${requirements.minGroundedClaimPrecision}% minimum`,
        status: metrics.groundedClaimPrecision >= requirements.minGroundedClaimPrecision ? 'pass' : 'fail',
        icon: ScanSearch,
      },
      {
        id: 'hallucination',
        label: 'Critical hallucination',
        detail: `${metrics.criticalHallucinationPpm} ppm vs ${requirements.maxCriticalHallucinationPpm} ppm maximum`,
        status: metrics.criticalHallucinationPpm <= requirements.maxCriticalHallucinationPpm ? 'pass' : 'fail',
        icon: Siren,
      },
      {
        id: 'usefulness',
        label: 'Human usefulness',
        detail: `${metrics.humanUsefulness.toFixed(1)} / 5 vs ${requirements.minHumanUsefulness.toFixed(1)} minimum`,
        status: metrics.humanUsefulness >= requirements.minHumanUsefulness ? 'pass' : 'fail',
        icon: HeartHandshake,
      },
      {
        id: 'latency',
        label: 'Route latency',
        detail: `${metrics.p95LatencyMs} ms vs ${requirements.maxP95LatencyMs} ms maximum`,
        status: metrics.p95LatencyMs <= requirements.maxP95LatencyMs ? 'pass' : 'fail',
        icon: Clock3,
      },
      {
        id: 'slices',
        label: 'Evaluation slices',
        detail: `${metrics.sliceCoveragePercent}% vs ${requirements.minSliceCoveragePercent}% required`,
        status: metrics.sliceCoveragePercent >= requirements.minSliceCoveragePercent ? 'pass' : 'fail',
        icon: Users,
      },
      {
        id: 'sensitive',
        label: 'Sensitive inference',
        detail: `${metrics.sensitiveInferencePpm} ppm vs ${requirements.maxSensitiveInferencePpm} ppm maximum`,
        status: metrics.sensitiveInferencePpm <= requirements.maxSensitiveInferencePpm ? 'pass' : 'fail',
        icon: ShieldCheck,
      },
      {
        id: 'headroom',
        label: 'Queue headroom',
        detail: `${metrics.queueHeadroomPercent}% vs ${requirements.minQueueHeadroomPercent}% minimum`,
        status: metrics.queueHeadroomPercent >= requirements.minQueueHeadroomPercent ? 'pass' : 'fail',
        icon: Activity,
      },
      {
        id: 'telemetry',
        label: 'Decision telemetry',
        detail: metrics.telemetryComplete
          ? 'Every required reason code and governed slice is observable'
          : 'A release decision cannot be reconstructed',
        status: metrics.telemetryComplete ? 'pass' : 'fail',
        icon: Radar,
      },
      {
        id: 'review',
        label: 'Human review path',
        detail: requirements.requiresHumanReview
          ? build.metrics.humanReviewReady ? 'Specialist review and escalation are ready' : 'Required specialist workflow is missing'
          : 'This route does not require review for every released caption',
        status: requirements.requiresHumanReview
          ? build.metrics.humanReviewReady ? 'pass' : 'fail'
          : 'not-required',
        icon: ListChecks,
      },
      {
        id: 'exposure',
        label: 'Initial exposure',
        detail: `${exposurePercent}% vs ${policy.maxInitialExposurePercent}% approved maximum`,
        status: exposurePercent <= policy.maxInitialExposurePercent ? 'pass' : 'fail',
        icon: Gauge,
      },
    ];

    const failed = gates.filter((gate) => gate.status === 'fail');
    const canaryCaptionsPerHour = Math.round(
      policy.requestRps * 3600 * (exposurePercent / 100),
    );
    const expectedCriticalPerHour = canaryCaptionsPerHour
      * (metrics.criticalHallucinationPpm / 1_000_000);
    const decision = failed.length === 0 ? 'Eligible for canary' : 'Hold release';

    return { canaryCaptionsPerHour, decision, expectedCriticalPerHour, failed, gates };
  }, [build, exposurePercent, policy]);

  function reset() {
    setBuildId(initialBuild.id);
    setPolicyId(initialPolicy.id);
    setExposurePercent(data.defaults.exposurePercent);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Production release lab"
        title={data.title}
        description={data.description}
        icon={ListChecks}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect a candidate build
              </legend>
              <div className="mt-3 space-y-2">
                {data.builds.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === build.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Gauge}
                    accent="violet"
                    onClick={() => setBuildId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Apply a product contract
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.requirements.requiresHumanReview ? Users : ShieldCheck}
                    accent={item.id === 'accessibility' ? 'blue' : 'emerald'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Canary exposure"
              value={exposurePercent}
              output={`${exposurePercent}%`}
              min={1}
              max={25}
              step={1}
              lowLabel="Smaller blast radius"
              highLabel="More evidence and impact"
              accent="amber"
              onChange={setExposurePercent}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
          <LabMetric
            label="Release decision"
            value={result.decision}
            detail={result.failed.length === 0 ? 'Every required gate passes' : `${result.failed.length} required gate${result.failed.length === 1 ? '' : 's'} failed`}
            icon={result.failed.length === 0 ? BadgeCheck : CircleX}
            tone={result.failed.length === 0 ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Canary volume"
            value={`${result.canaryCaptionsPerHour.toLocaleString()}/h`}
            detail={`${policy.requestRps} route requests/s at ${exposurePercent}% exposure`}
            icon={Activity}
            tone="blue"
          />
          <LabMetric
            label="Modeled critical output"
            value={`${result.expectedCriticalPerHour.toFixed(2)}/h`}
            detail="Illustrative rate from the frozen evaluation set"
            icon={Siren}
            tone={result.expectedCriticalPerHour === 0 ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Serving envelope"
            value={`${build.metrics.p95LatencyMs} ms`}
            detail={`${build.metrics.queueHeadroomPercent}% queue headroom`}
            icon={Clock3}
            tone={build.metrics.p95LatencyMs <= policy.requirements.maxP95LatencyMs ? 'cyan' : 'amber'}
          />
        </div>

        <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Active contract
              </p>
              <p className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                {policy.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {policy.detail}
              </p>
            </div>
            <span className="shrink-0 rounded-sm border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
              Max initial exposure {policy.maxInitialExposurePercent}%
            </span>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Independent release gates
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                One failed required gate holds the build
              </p>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Illustrative thresholds</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.gates.map((gate) => (
              <GateCard key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <section className={`mt-5 rounded-md border p-4 ${
          result.failed.length === 0
            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
        }`}>
          <div className="flex items-start gap-3">
            {result.failed.length === 0 ? (
              <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-neutral-950 dark:text-white">
                {result.failed.length === 0
                  ? 'This build may enter the selected canary, with stop conditions active.'
                  : 'Do not tune thresholds after seeing the result.'}
              </p>
              {result.failed.length === 0 ? (
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  Eligibility is not proof of safety. Monitor claim reasons, governed slices, queue pressure, review outcomes, and rollback readiness throughout exposure.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.failed.map((gate) => (
                    <li key={gate.id}>{gate.label}: {gate.detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </LearningLabBody>
    </LearningLab>
  );
}

function GateCard({ gate }: { gate: Gate }) {
  const Icon = gate.icon;
  const StateIcon = gate.status === 'pass'
    ? BadgeCheck
    : gate.status === 'fail' ? CircleX : CircleMinus;
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    fail: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    'not-required': 'border-neutral-300 bg-neutral-50 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  };
  const statusLabel = gate.status === 'not-required' ? 'Not required' : gate.status;

  return (
    <article className={`min-h-32 rounded-md border p-4 ${styles[gate.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase">
          <StateIcon aria-hidden="true" className="h-4 w-4" />
          {statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold">{gate.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{gate.detail}</p>
    </article>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Production release lab"
        title={error ? 'The release model could not load' : 'Loading release evidence'}
        description={error ?? 'Preparing builds, route contracts, and governed gates.'}
        icon={error ? CircleAlert : ListChecks}
        accent={error ? 'rose' : 'amber'}
      />
      <LearningLabBody>
        <div className="flex min-h-32 items-center justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400" role="status">
              <ListChecks aria-hidden="true" className="h-4 w-4" />
              Loading gates...
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
