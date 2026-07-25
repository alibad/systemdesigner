'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArchiveRestore,
  CheckCircle2,
  CirclePause,
  CloudCog,
  CloudOff,
  FileCheck2,
  Fingerprint,
  Gauge,
  History,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Signal,
  TimerReset,
  TriangleAlert,
  UploadCloud,
  Workflow,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Ring = {
  id: string;
  label: string;
  detail: string;
  fleetPercent: number;
  minimumSamples: number;
  maximumFailureRatePercent: number;
  maximumDriftDeltaPercent: number;
  minimumObservationMinutes: number;
  offlineLeaseHours: number;
};

type Artifact = {
  id: string;
  label: string;
  detail: string;
  signatureValid: boolean;
  digestPinned: boolean;
  runtimeCompatible: boolean;
  modelSchemaCompatible: boolean;
  metadataFresh: boolean;
};

type Connectivity = {
  id: string;
  label: string;
  detail: string;
  cloudReachable: boolean;
  offlineHours: number;
  queuedEvents: number;
  observationFactor: number;
};

type SyncPolicy = {
  id: string;
  label: string;
  detail: string;
  conflictSafe: boolean;
  deduplicatesEvents: boolean;
  expiresCommands: boolean;
};

type Failure = {
  id: string;
  label: string;
  detail: string;
  failureRatePercent: number;
  driftDeltaPercent: number;
  samples: number;
  observationMinutes: number;
  telemetryAvailable: boolean;
  fallbackHealthy: boolean;
};

type RolloutModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    ringId: string;
    artifactId: string;
    connectivityId: string;
    syncPolicyId: string;
    failureId: string;
  };
  rings: Ring[];
  artifacts: Artifact[];
  connectivity: Connectivity[];
  syncPolicies: SyncPolicy[];
  failures: Failure[];
};

type DecisionTone = 'emerald' | 'amber' | 'rose' | 'blue';

const BLOCK_ID = 'fundamentals/edge-intelligence-orchestration-rollout-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/edge-intelligence-orchestration/data/rollout-recovery-model.json';

function isRolloutModel(value: unknown): value is RolloutModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<RolloutModel>;

  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && model.modelNote
      && model.defaults?.ringId
      && model.defaults.artifactId
      && model.defaults.connectivityId
      && model.defaults.syncPolicyId
      && model.defaults.failureId
      && Array.isArray(model.rings)
      && model.rings.length === 4
      && model.rings.every((ring) => (
        typeof ring.minimumSamples === 'number'
        && typeof ring.maximumFailureRatePercent === 'number'
        && typeof ring.offlineLeaseHours === 'number'
      ))
      && Array.isArray(model.artifacts)
      && model.artifacts.length >= 3
      && Array.isArray(model.connectivity)
      && model.connectivity.length >= 3
      && Array.isArray(model.syncPolicies)
      && model.syncPolicies.length >= 2
      && Array.isArray(model.failures)
      && model.failures.length >= 4,
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string; detail: string }>;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:border-violet-400 dark:focus:ring-violet-950"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected?.detail}
      </span>
    </label>
  );
}

export default function EdgeIntelligenceOrchestrationRolloutRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RolloutModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ringId, setRingId] = useState('');
  const [artifactId, setArtifactId] = useState('');
  const [connectivityId, setConnectivityId] = useState('');
  const [syncPolicyId, setSyncPolicyId] = useState('');
  const [failureId, setFailureId] = useState('');

  function reset(model: RolloutModel) {
    setRingId(model.defaults.ringId);
    setArtifactId(model.defaults.artifactId);
    setConnectivityId(model.defaults.connectivityId);
    setSyncPolicyId(model.defaults.syncPolicyId);
    setFailureId(model.defaults.failureId);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRolloutModel(payload)) {
          throw new Error('The rollout model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load rollout data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const ring = data.rings.find((candidate) => candidate.id === ringId) ?? data.rings[0];
    const artifact =
      data.artifacts.find((candidate) => candidate.id === artifactId)
      ?? data.artifacts[0];
    const connectivity =
      data.connectivity.find((candidate) => candidate.id === connectivityId)
      ?? data.connectivity[0];
    const syncPolicy =
      data.syncPolicies.find((candidate) => candidate.id === syncPolicyId)
      ?? data.syncPolicies[0];
    const failure =
      data.failures.find((candidate) => candidate.id === failureId)
      ?? data.failures[0];

    const artifactClears =
      artifact.signatureValid
      && artifact.digestPinned
      && artifact.runtimeCompatible
      && artifact.modelSchemaCompatible
      && artifact.metadataFresh;
    const leaseClears = connectivity.offlineHours <= ring.offlineLeaseHours;
    const effectiveSamples = Math.floor(failure.samples * connectivity.observationFactor);
    const sampleClears = effectiveSamples >= ring.minimumSamples;
    const observationClears =
      failure.observationMinutes * connectivity.observationFactor
      >= ring.minimumObservationMinutes;
    const failureClears =
      failure.failureRatePercent <= ring.maximumFailureRatePercent;
    const driftClears =
      failure.driftDeltaPercent <= ring.maximumDriftDeltaPercent;
    const telemetryClears =
      failure.telemetryAvailable && sampleClears && observationClears;
    const syncClears =
      syncPolicy.conflictSafe
      && syncPolicy.deduplicatesEvents
      && syncPolicy.expiresCommands;
    const fallbackClears = failure.fallbackHealthy;
    const evidenceClears =
      telemetryClears && failureClears && driftClears;
    const promotionClears =
      artifactClears
      && connectivity.cloudReachable
      && leaseClears
      && syncClears
      && evidenceClears
      && fallbackClears;

    let title = 'Promote to the next ring';
    let action = 'Promote';
    let tone: DecisionTone = 'emerald';
    let explanation =
      'Artifact identity, compatibility, outcome evidence, sync semantics, and rollback readiness clear the selected ring policy.';

    if (!artifactClears) {
      title = 'Reject before installation';
      action = 'Quarantine artifact';
      tone = 'rose';
      explanation =
        'Authenticity is not compatibility, and a signature is not freshness. Keep the current known-good model and investigate the failed artifact gate.';
    } else if (!syncClears) {
      title = 'Pause at the reconciliation boundary';
      action = 'Repair sync contract';
      tone = 'rose';
      explanation =
        'Reconnect could duplicate observations, revive expired commands, or overwrite a field owned by another tier. Promotion would make recovery ambiguous.';
    } else if (!fallbackClears) {
      title = 'Stop: rollback path is not viable';
      action = 'Repair fallback';
      tone = 'rose';
      explanation =
        'The previous artifact cannot consume the current feature contract. A cached file is not a tested rollback path.';
    } else if (!connectivity.cloudReachable && leaseClears) {
      title = 'Hold the current model while offline';
      action = 'Buffer and reconnect';
      tone = 'blue';
      explanation =
        'The signed offline lease still permits local inference, but the edge cannot independently promote fleet intent. Buffer bounded observations and keep commands expiring.';
    } else if (!leaseClears) {
      title = 'Offline lease expired';
      action = 'Enter degraded policy';
      tone = 'amber';
      explanation =
        'Continue only the explicitly approved local fallback. Do not install or promote new intent until freshness can be re-established.';
    } else if (!failureClears || !driftClears) {
      title = 'Roll back the current ring';
      action = 'Rollback and contain';
      tone = 'rose';
      explanation =
        'Infrastructure health alone is insufficient. Crash rate or task drift crosses the ring budget, so contain the affected cohort and restore the tested fallback.';
    } else if (!telemetryClears) {
      title = 'Pause: evidence is insufficient';
      action = 'Restore observability';
      tone = 'amber';
      explanation =
        'Missing, low-volume, or too-short evidence cannot justify promotion. Absence of detected failures is not proof of health.';
    } else if (!promotionClears) {
      title = 'Pause promotion';
      action = 'Inspect failed gate';
      tone = 'amber';
      explanation =
        'One or more release gates remain unresolved. Keep the blast radius at the current ring.';
    }

    const gates = [
      {
        label: 'Signed artifact and freshness',
        clears: artifactClears,
        detail: !artifact.signatureValid
          ? 'Trusted signer verification failed.'
          : !artifact.digestPinned
            ? 'The release does not pin the verified payload digest.'
            : !artifact.runtimeCompatible || !artifact.modelSchemaCompatible
              ? 'Runtime, opset, or model input signature is incompatible.'
              : !artifact.metadataFresh
                ? 'Update metadata is expired; freeze or rollback cannot be ruled out.'
                : 'Signer, digest, freshness, runtime, and model signature clear.',
      },
      {
        label: 'Offline lease and authority',
        clears: leaseClears,
        detail: connectivity.cloudReachable
          ? 'Cloud rollout intent is current.'
          : `${connectivity.offlineHours} offline hours used from a ${ring.offlineLeaseHours}-hour lease.`,
      },
      {
        label: 'Reconciliation semantics',
        clears: syncClears,
        detail: syncClears
          ? 'Field owners, event IDs, and command expiry make reconnect deterministic.'
          : 'The selected rule can overwrite safety state, duplicate events, or replay stale commands.',
      },
      {
        label: 'Outcome evidence',
        clears: evidenceClears,
        detail: !failure.telemetryAvailable
          ? 'Required task outcome or model-version evidence is missing.'
          : !sampleClears || !observationClears
            ? `${effectiveSamples.toLocaleString()} effective samples and ${Math.floor(failure.observationMinutes * connectivity.observationFactor)} minutes do not clear this ring.`
            : !failureClears
              ? `${failure.failureRatePercent}% failures exceed the ${ring.maximumFailureRatePercent}% budget.`
              : !driftClears
                ? `${failure.driftDeltaPercent}% drift exceeds the ${ring.maximumDriftDeltaPercent}% budget.`
                : 'Sample volume, observation time, failures, and drift clear.',
      },
      {
        label: 'Tested fallback',
        clears: fallbackClears,
        detail: fallbackClears
          ? 'The previous model and feature contract remain runnable.'
          : 'Rollback would restore bytes that cannot consume the current input contract.',
      },
    ];

    return {
      ring,
      artifact,
      connectivity,
      syncPolicy,
      failure,
      effectiveSamples,
      title,
      action,
      tone,
      explanation,
      gates,
    };
  }, [artifactId, connectivityId, data, failureId, ringId, syncPolicyId]);

  const decisionStyles: Record<DecisionTone, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    blue: 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35',
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Rollout and recovery lab"
          title={data?.title ?? 'Promote a model without losing the fleet'}
          description={data?.description ?? 'Loading the fleet rollout model.'}
          icon={CloudCog}
          accent="violet"
          onReset={data ? () => reset(data) : undefined}
        />

        <LearningLabBody
          controls={data ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Promotion ring
                </p>
                <div className="mt-3 space-y-2">
                  {data.rings.map((ring) => (
                    <LabChoice
                      key={ring.id}
                      selected={ring.id === ringId}
                      label={`${ring.label} ${ring.fleetPercent ? `- ${ring.fleetPercent}%` : ''}`}
                      detail={ring.detail}
                      icon={Workflow}
                      accent="violet"
                      onClick={() => setRingId(ring.id)}
                    />
                  ))}
                </div>
              </div>

              <SelectControl
                label="Artifact state"
                value={artifactId}
                options={data.artifacts}
                onChange={setArtifactId}
              />
              <SelectControl
                label="Connectivity"
                value={connectivityId}
                options={data.connectivity}
                onChange={setConnectivityId}
              />
              <SelectControl
                label="Reconnect policy"
                value={syncPolicyId}
                options={data.syncPolicies}
                onChange={setSyncPolicyId}
              />
              <SelectControl
                label="Injected condition"
                value={failureId}
                options={data.failures}
                onChange={setFailureId}
              />
            </div>
          ) : undefined}
        >
          {error ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              <p className="font-semibold">Rollout model unavailable</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 rounded-md border border-rose-400 px-3 py-2 font-semibold"
              >
                Retry
              </button>
            </div>
          ) : !view ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-neutral-500">
              Loading rollout evidence...
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`rounded-md border p-5 ${decisionStyles[view.tone]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {view.tone === 'emerald' ? (
                      <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : view.tone === 'rose' ? (
                      <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400" />
                    ) : view.tone === 'blue' ? (
                      <CloudOff aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <CirclePause aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-400" />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        Release decision
                      </p>
                      <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                        {view.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                        {view.explanation}
                      </p>
                    </div>
                  </div>
                  <span className="hidden shrink-0 rounded-md border border-current px-3 py-2 text-xs font-semibold sm:block">
                    {view.action}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Blast-radius ladder
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      Each ring needs stronger evidence before intent can move outward.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {view.ring.label}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  {data?.rings.map((ring, index) => {
                    const selectedIndex = data.rings.findIndex((candidate) => candidate.id === view.ring.id);
                    const selected = ring.id === view.ring.id;
                    const completed = index < selectedIndex;
                    return (
                      <div
                        key={ring.id}
                        className={`relative overflow-hidden rounded-md border p-4 ${
                          selected
                            ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-950/35 dark:ring-violet-950'
                            : completed
                              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25'
                              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                            {index + 1}
                          </span>
                          {completed ? (
                            <CheckCircle2 aria-label="Evidence completed" className="h-5 w-5 text-emerald-600" />
                          ) : selected ? (
                            <Signal aria-label="Selected ring" className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          ) : (
                            <RadioTower aria-label="Pending ring" className="h-5 w-5 text-neutral-400" />
                          )}
                        </div>
                        <p className="mt-4 font-semibold text-neutral-950 dark:text-white">{ring.label}</p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {ring.fleetPercent ? `${ring.fleetPercent}% of eligible fleet` : 'Fixtures only'}
                        </p>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full ${selected ? 'bg-violet-500' : completed ? 'bg-emerald-500' : 'bg-neutral-400'}`}
                            style={{ width: `${Math.max(8, ring.fleetPercent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Effective evidence"
                  value={view.effectiveSamples.toLocaleString()}
                  detail={`${view.ring.minimumSamples.toLocaleString()} samples required`}
                  icon={Activity}
                  tone={view.effectiveSamples >= view.ring.minimumSamples ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Failure rate"
                  value={`${view.failure.failureRatePercent}%`}
                  detail={`${view.ring.maximumFailureRatePercent}% ring budget`}
                  icon={Gauge}
                  tone={view.failure.failureRatePercent <= view.ring.maximumFailureRatePercent ? 'cyan' : 'rose'}
                />
                <LabMetric
                  label="Drift delta"
                  value={`${view.failure.driftDeltaPercent}%`}
                  detail={`${view.ring.maximumDriftDeltaPercent}% ring budget`}
                  icon={History}
                  tone={view.failure.driftDeltaPercent <= view.ring.maximumDriftDeltaPercent ? 'blue' : 'rose'}
                />
                <LabMetric
                  label="Offline lease"
                  value={`${view.connectivity.offlineHours}h / ${view.ring.offlineLeaseHours}h`}
                  detail={`${view.connectivity.queuedEvents.toLocaleString()} buffered events`}
                  icon={TimerReset}
                  tone={view.connectivity.offlineHours <= view.ring.offlineLeaseHours ? 'violet' : 'rose'}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <h4 className="font-semibold text-neutral-950 dark:text-white">Promotion evidence</h4>
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {view.gates.map((gate) => (
                      <div key={gate.label} className="flex gap-3 px-4 py-3">
                        {gate.clears ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{gate.label}</p>
                          <p className="mt-0.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                            {gate.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Reconnect envelope
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="flex gap-3">
                      <Fingerprint aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">Desired state</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          Cloud policy is versioned, signed, and rejected after expiry.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <ArchiveRestore aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">Observed state</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          Device events carry stable IDs and append without replacing safety state.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <RotateCcw aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">Fallback state</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          The previous model, runtime, feature schema, and local policy are tested together.
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>

              <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {data?.modelNote}
              </p>
            </div>
          )}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
