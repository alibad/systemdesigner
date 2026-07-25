'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  CirclePause,
  Clock3,
  Gauge,
  Languages,
  LoaderCircle,
  MessageSquareWarning,
  RotateCcw,
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

type RolloutStage = {
  id: string;
  label: string;
  detail: string;
  trafficPercent: number;
  minimumSample: number;
};

type EvidencePackage = {
  id: string;
  label: string;
  detail: string;
  dailyEligibleEventsAtFullTraffic: number;
  acceptedCharacterLiftPercent: number;
  p95LatencyDeltaMs: number;
  staleDiscardPercent: number;
  unsafeSuggestionsPerMillion: number;
  complaintDeltaPer100k: number;
  worstSliceLiftPercent: number;
};

type RolloutControlData = {
  title: string;
  description: string;
  defaults: {
    stageId: string;
    evidenceId: string;
    observationDays: number;
  };
  thresholds: {
    minimumAcceptedCharacterLiftPercent: number;
    maximumP95LatencyDeltaMs: number;
    maximumStaleDiscardPercent: number;
    maximumUnsafeSuggestionsPerMillion: number;
    maximumComplaintDeltaPer100k: number;
    minimumWorstSliceLiftPercent: number;
  };
  stages: RolloutStage[];
  evidence: EvidencePackage[];
};

type Gate = {
  id: string;
  label: string;
  observed: string;
  limit: string;
  passes: boolean;
  icon: typeof Gauge;
};

const BLOCK_ID = 'genai/smart-text-completion-rollout-control-lab';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRolloutControlData(value: unknown): value is RolloutControlData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RolloutControlData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.thresholds
      && finite(candidate.thresholds.minimumAcceptedCharacterLiftPercent)
      && Array.isArray(candidate.stages)
      && candidate.stages.length > 0
      && candidate.stages.every((stage) => finite(stage.trafficPercent) && finite(stage.minimumSample))
      && Array.isArray(candidate.evidence)
      && candidate.evidence.length > 0
      && candidate.evidence.every((item) => (
        typeof item.id === 'string'
        && finite(item.dailyEligibleEventsAtFullTraffic)
        && finite(item.acceptedCharacterLiftPercent)
      )),
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function SmartTextCompletionRolloutControlLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RolloutControlData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No rollout-control model was supplied.');
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
        if (!isRolloutControlData(payload)) {
          throw new Error('Rollout-control data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load rollout data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? (
        <LoadState error={loadError} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <RolloutControlLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function RolloutControlLab({ data }: { data: RolloutControlData }) {
  const initialStage = data.stages.find((item) => item.id === data.defaults.stageId)
    ?? data.stages[0];
  const initialEvidence = data.evidence.find((item) => item.id === data.defaults.evidenceId)
    ?? data.evidence[0];
  const [stageId, setStageId] = useState(initialStage.id);
  const [evidenceId, setEvidenceId] = useState(initialEvidence.id);
  const [observationDays, setObservationDays] = useState(data.defaults.observationDays);

  const stage = data.stages.find((item) => item.id === stageId) ?? data.stages[0];
  const evidence = data.evidence.find((item) => item.id === evidenceId) ?? data.evidence[0];

  const result = useMemo(() => {
    const sampleSize = Math.round(
      evidence.dailyEligibleEventsAtFullTraffic * stage.trafficPercent / 100 * observationDays,
    );
    const uncertaintyMargin = 120 / Math.sqrt(Math.max(sampleSize, 1));
    const liftLowerBound = evidence.acceptedCharacterLiftPercent - uncertaintyMargin;
    const thresholds = data.thresholds;
    const gates: Gate[] = [
      {
        id: 'sample',
        label: 'Evidence volume',
        observed: formatNumber(sampleSize),
        limit: `At least ${formatNumber(stage.minimumSample)}`,
        passes: sampleSize >= stage.minimumSample,
        icon: Users,
      },
      {
        id: 'utility',
        label: 'Accepted-character lift',
        observed: `${liftLowerBound.toFixed(1)}% lower bound`,
        limit: `At least ${thresholds.minimumAcceptedCharacterLiftPercent}%`,
        passes: liftLowerBound >= thresholds.minimumAcceptedCharacterLiftPercent,
        icon: BarChart3,
      },
      {
        id: 'latency',
        label: 'P95 latency delta',
        observed: `+${evidence.p95LatencyDeltaMs} ms`,
        limit: `At most +${thresholds.maximumP95LatencyDeltaMs} ms`,
        passes: evidence.p95LatencyDeltaMs <= thresholds.maximumP95LatencyDeltaMs,
        icon: Clock3,
      },
      {
        id: 'freshness',
        label: 'Stale-response discards',
        observed: `${evidence.staleDiscardPercent}%`,
        limit: `At most ${thresholds.maximumStaleDiscardPercent}%`,
        passes: evidence.staleDiscardPercent <= thresholds.maximumStaleDiscardPercent,
        icon: RotateCcw,
      },
      {
        id: 'safety',
        label: 'Unsafe suggestions',
        observed: `${evidence.unsafeSuggestionsPerMillion} per million`,
        limit: `At most ${thresholds.maximumUnsafeSuggestionsPerMillion}`,
        passes: evidence.unsafeSuggestionsPerMillion <= thresholds.maximumUnsafeSuggestionsPerMillion,
        icon: ShieldCheck,
      },
      {
        id: 'complaints',
        label: 'Complaint delta',
        observed: `+${evidence.complaintDeltaPer100k} per 100k`,
        limit: `At most +${thresholds.maximumComplaintDeltaPer100k}`,
        passes: evidence.complaintDeltaPer100k <= thresholds.maximumComplaintDeltaPer100k,
        icon: MessageSquareWarning,
      },
      {
        id: 'slice',
        label: 'Worst supported slice',
        observed: `${evidence.worstSliceLiftPercent >= 0 ? '+' : ''}${evidence.worstSliceLiftPercent}% lift`,
        limit: `At least ${thresholds.minimumWorstSliceLiftPercent}%`,
        passes: evidence.worstSliceLiftPercent >= thresholds.minimumWorstSliceLiftPercent,
        icon: Languages,
      },
    ];

    const failed = gates.filter((gate) => !gate.passes);
    const severeFailure = failed.some((gate) => gate.id === 'safety' || gate.id === 'complaints');
    const action = severeFailure ? 'rollback' : failed.length > 0 ? 'hold' : 'expand';
    const stageIndex = data.stages.findIndex((item) => item.id === stage.id);
    const nextStage = data.stages[stageIndex + 1];

    let title = nextStage ? `Expand to ${nextStage.label}` : 'Approve the full-release review';
    let detail = nextStage
      ? 'The usefulness floor and every operational guardrail pass at this exposure.'
      : 'This evidence can enter the final production review; it does not remove the need for owners and rollback readiness.';
    if (action === 'rollback') {
      title = 'Rollback and contain the cohort';
      detail = 'A safety or complaint guardrail failed. Stop exposure, preserve evidence, and route the bundle to incident review.';
    } else if (action === 'hold') {
      title = 'Hold this rollout stage';
      detail = failed.some((gate) => gate.id === 'sample')
        ? 'The observation window is too small for this stage. Keep exposure stable until the evidence floor is met.'
        : 'At least one quality, latency, freshness, or slice guardrail failed. Diagnose it before increasing exposure.';
    }

    return {
      action,
      detail,
      failed,
      gates,
      liftLowerBound,
      nextStage,
      sampleSize,
      title,
      uncertaintyMargin,
    };
  }, [data.stages, data.thresholds, evidence, observationDays, stage]);

  function reset() {
    setStageId(initialStage.id);
    setEvidenceId(initialEvidence.id);
    setObservationDays(data.defaults.observationDays);
  }

  const actionTone = result.action === 'expand' ? 'emerald' : result.action === 'hold' ? 'amber' : 'rose';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Rollout control room"
        title={data.title}
        description={data.description}
        icon={Activity}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose current exposure
              </legend>
              <div className="mt-3 space-y-2">
                {data.stages.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === stage.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Users}
                    accent="emerald"
                    onClick={() => setStageId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Inject experiment evidence
              </legend>
              <div className="mt-3 space-y-2">
                {data.evidence.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === evidence.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'healthy' ? CheckCircle2 : Siren}
                    accent={item.id === 'healthy' ? 'cyan' : 'rose'}
                    onClick={() => setEvidenceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Observation window"
              value={observationDays}
              output={`${observationDays} day${observationDays === 1 ? '' : 's'}`}
              min={1}
              max={14}
              step={1}
              accent="blue"
              lowLabel="Fast signal"
              highLabel="More evidence"
              onChange={setObservationDays}
            />
          </div>
        )}
      >
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Exposure"
              value={`${stage.trafficPercent}%`}
              detail={stage.label}
              icon={Users}
              tone="blue"
            />
            <LabMetric
              label="Observed events"
              value={formatNumber(result.sampleSize)}
              detail={`${formatNumber(stage.minimumSample)} required`}
              icon={BarChart3}
              tone={result.sampleSize >= stage.minimumSample ? 'cyan' : 'amber'}
            />
            <LabMetric
              label="Lift lower bound"
              value={`${result.liftLowerBound.toFixed(1)}%`}
              detail={`Observed ${evidence.acceptedCharacterLiftPercent}%`}
              icon={Gauge}
              tone={result.liftLowerBound >= data.thresholds.minimumAcceptedCharacterLiftPercent ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Failed gates"
              value={`${result.failed.length}`}
              detail={result.failed.length === 0 ? 'All clear' : result.failed.map((gate) => gate.label).join(', ')}
              icon={result.failed.length === 0 ? CheckCircle2 : CircleAlert}
              tone={actionTone}
            />
          </div>

          <section aria-label="Rollout runway" className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Rollout runway</h4>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Stable cohorts expand only after the current stage clears every gate.
                </p>
              </div>
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {observationDays}-day window
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {data.stages.map((item, index) => {
                const active = item.id === stage.id;
                const stageIndex = data.stages.findIndex((candidate) => candidate.id === stage.id);
                const complete = index < stageIndex;
                return (
                  <div key={item.id} className="relative min-w-0">
                    <div
                      className={`h-full rounded-md border p-4 ${
                        active
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100'
                          : complete
                            ? 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-100'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase opacity-70">Stage {index + 1}</p>
                      <p className="mt-1 font-semibold">{item.label}</p>
                      <p className="mt-2 text-xs leading-5 opacity-75">{formatNumber(item.minimumSample)} event floor</p>
                    </div>
                    {index < data.stages.length - 1 ? (
                      <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-neutral-400 md:block" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-label="Rollout gates">
            <div>
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Independent evidence gates</h4>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                A positive overall average cannot cancel a failed safety, latency, or slice boundary.
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {result.gates.map((gate) => {
                const Icon = gate.icon;
                return (
                  <div
                    key={gate.id}
                    className={`rounded-md border p-4 ${
                      gate.passes
                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          gate.passes
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200'
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">{gate.label}</h5>
                          <span className={`text-xs font-semibold ${gate.passes ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            {gate.passes ? 'Pass' : 'Fail'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{gate.observed}</p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Gate: {gate.limit}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            aria-live="polite"
            className={`rounded-md border p-5 ${
              result.action === 'expand'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                : result.action === 'hold'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.action === 'expand' ? (
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
              ) : result.action === 'hold' ? (
                <CirclePause className="mt-0.5 h-6 w-6 shrink-0" />
              ) : (
                <Siren className="mt-0.5 h-6 w-6 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Recommended action</p>
                <h4 className="mt-1 text-lg font-semibold">{result.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                <p className="mt-3 text-xs opacity-70">
                  Teaching estimate: the lift margin is {result.uncertaintyMargin.toFixed(2)} percentage points and shrinks with the square root of observed events.
                </p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <section className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        ) : (
          <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-500 motion-reduce:animate-none" />
        )}
        <div>
          <h3 className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Rollout control room unavailable' : 'Loading rollout control room'}
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error ?? 'Loading rollout stages, guardrails, and evidence packages.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
