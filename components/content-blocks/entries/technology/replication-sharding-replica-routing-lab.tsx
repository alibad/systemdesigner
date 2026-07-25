'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cloud,
  Database,
  Globe2,
  LoaderCircle,
  Route,
  ServerCrash,
  ShieldCheck,
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

const BLOCK_ID = 'technology/replication-sharding-replica-routing-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/replication-sharding/data/replica-routing-model.json';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type CommitMode = 'regional' | 'async-remote' | 'sync-remote';
type PolicyId = 'primary-only' | 'nearest-replica' | 'session-token';

type Placement = {
  id: string;
  label: string;
  detail: string;
  commitMode: CommitMode;
  hasRemoteReplica: boolean;
  writeLatencyMs: number;
  failoverSeconds: number;
  recoveryNote: string;
};

type ReadPolicy = {
  id: PolicyId;
  label: string;
  detail: string;
};

type RequestContract = {
  id: string;
  label: string;
  detail: string;
  maxStalenessMs: number;
  requiresOwnWrite: boolean;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  primaryAvailable: boolean;
  lagMultiplier: number;
};

type ReplicaRoutingModel = {
  kind: 'replication-sharding-replica-routing';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  clientRegion: string;
  primaryRegion: string;
  remoteRegion: string;
  primaryReadLatencyMs: number;
  regionalReplicaReadLatencyMs: number;
  remoteReplicaReadLatencyMs: number;
  sessionWaitBudgetMs: number;
  defaults: {
    placementId: string;
    policyId: PolicyId;
    requestId: string;
    incidentId: string;
    replicaLagMs: number;
  };
  bounds: {
    replicaLagMs: Bound;
  };
  placements: Placement[];
  policies: ReadPolicy[];
  requests: RequestContract[];
  incidents: Incident[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isCommitMode(value: unknown): value is CommitMode {
  return value === 'regional'
    || value === 'async-remote'
    || value === 'sync-remote';
}

function isPolicyId(value: unknown): value is PolicyId {
  return value === 'primary-only'
    || value === 'nearest-replica'
    || value === 'session-token';
}

function isPlacement(value: unknown): value is Placement {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isCommitMode(value.commitMode)
    && typeof value.hasRemoteReplica === 'boolean'
    && isFiniteNumber(value.writeLatencyMs)
    && isFiniteNumber(value.failoverSeconds)
    && typeof value.recoveryNote === 'string';
}

function isPolicy(value: unknown): value is ReadPolicy {
  if (!isRecord(value)) return false;
  return isPolicyId(value.id)
    && typeof value.label === 'string'
    && typeof value.detail === 'string';
}

function isRequest(value: unknown): value is RequestContract {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.maxStalenessMs)
    && value.maxStalenessMs >= 0
    && typeof value.requiresOwnWrite === 'boolean';
}

function isIncident(value: unknown): value is Incident {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.primaryAvailable === 'boolean'
    && isFiniteNumber(value.lagMultiplier)
    && value.lagMultiplier >= 1;
}

function isReplicaRoutingModel(value: unknown): value is ReplicaRoutingModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.bounds)) {
    return false;
  }
  const defaults = value.defaults;
  const bounds = value.bounds;

  return value.kind === 'replication-sharding-replica-routing'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.clientRegion === 'string'
    && typeof value.primaryRegion === 'string'
    && typeof value.remoteRegion === 'string'
    && isFiniteNumber(value.primaryReadLatencyMs)
    && isFiniteNumber(value.regionalReplicaReadLatencyMs)
    && isFiniteNumber(value.remoteReplicaReadLatencyMs)
    && isFiniteNumber(value.sessionWaitBudgetMs)
    && typeof defaults.placementId === 'string'
    && isPolicyId(defaults.policyId)
    && typeof defaults.requestId === 'string'
    && typeof defaults.incidentId === 'string'
    && isFiniteNumber(defaults.replicaLagMs)
    && isBound(bounds.replicaLagMs)
    && Array.isArray(value.placements)
    && value.placements.length === 3
    && value.placements.every(isPlacement)
    && value.placements.some(
      (placement) => placement.id === defaults.placementId,
    )
    && Array.isArray(value.policies)
    && value.policies.length === 3
    && value.policies.every(isPolicy)
    && value.policies.some((policy) => policy.id === defaults.policyId)
    && Array.isArray(value.requests)
    && value.requests.length === 3
    && value.requests.every(isRequest)
    && value.requests.some((request) => request.id === defaults.requestId)
    && Array.isArray(value.incidents)
    && value.incidents.length === 3
    && value.incidents.every(isIncident)
    && value.incidents.some((incident) => incident.id === defaults.incidentId)
    && typeof value.notice === 'string';
}

export default function ReplicationShardingReplicaRoutingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ReplicaRoutingModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReplicaRoutingModel(payload)) {
          throw new Error('The replica-routing model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the replica-routing model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ReplicaRoutingWorkbench model={model} />;
}

function ReplicaRoutingWorkbench({ model }: { model: ReplicaRoutingModel }) {
  const [placementId, setPlacementId] = useState(model.defaults.placementId);
  const [policyId, setPolicyId] = useState<PolicyId>(model.defaults.policyId);
  const [requestId, setRequestId] = useState(model.defaults.requestId);
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [replicaLagMs, setReplicaLagMs] = useState(model.defaults.replicaLagMs);

  const placement =
    model.placements.find((item) => item.id === placementId) ?? model.placements[0];
  const policy =
    model.policies.find((item) => item.id === policyId) ?? model.policies[0];
  const request =
    model.requests.find((item) => item.id === requestId) ?? model.requests[0];
  const incident =
    model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];

  const result = useMemo(() => {
    const remoteSurvives = placement.hasRemoteReplica;
    const nearbyReplicaAvailable = incident.primaryAvailable || remoteSurvives;
    const nearbyTarget = placement.hasRemoteReplica
      ? `${model.remoteRegion} replica`
      : `${model.primaryRegion} replica`;
    const nearbyLatency = placement.hasRemoteReplica
      ? model.remoteReplicaReadLatencyMs
      : model.regionalReplicaReadLatencyMs;
    const committedRemoteCopy = placement.commitMode === 'sync-remote'
      && !incident.primaryAvailable;
    const effectiveLagMs = committedRemoteCopy
      ? 0
      : Math.round(replicaLagMs * incident.lagMultiplier);

    let readAvailable = true;
    let readTarget = `${model.primaryRegion} primary`;
    let readLatencyMs = model.primaryReadLatencyMs;
    let observedLagMs = 0;
    let routeReason = 'The router sends the read to the write authority.';

    if (policy.id === 'primary-only') {
      if (!incident.primaryAvailable) {
        readAvailable = false;
        readTarget = 'Blocked during promotion';
        readLatencyMs = 0;
        routeReason = 'The primary-only policy has no target until failover completes.';
      }
    } else if (policy.id === 'nearest-replica') {
      if (!nearbyReplicaAvailable) {
        readAvailable = false;
        readTarget = 'No surviving replica';
        readLatencyMs = 0;
        routeReason = 'The placement has no replica outside the failed region.';
      } else {
        readTarget = nearbyTarget;
        readLatencyMs = nearbyLatency;
        observedLagMs = effectiveLagMs;
        routeReason = 'The router minimizes network distance without checking a session position.';
      }
    } else if (!nearbyReplicaAvailable) {
      readAvailable = false;
      readTarget = 'No surviving replica';
      readLatencyMs = 0;
      routeReason = 'A session token cannot create a replica outside the failed region.';
    } else if (!request.requiresOwnWrite) {
      readTarget = nearbyTarget;
      readLatencyMs = nearbyLatency;
      observedLagMs = effectiveLagMs;
      routeReason = 'This request has no prior write position to enforce, so the nearest replica can answer.';
    } else if (effectiveLagMs <= model.sessionWaitBudgetMs) {
      readTarget = `${nearbyTarget} after catch-up`;
      readLatencyMs = nearbyLatency + effectiveLagMs;
      observedLagMs = 0;
      routeReason = `The router waits up to ${model.sessionWaitBudgetMs} ms for the replica to apply the session position.`;
    } else if (incident.primaryAvailable) {
      readTarget = `${model.primaryRegion} primary fallback`;
      readLatencyMs = model.primaryReadLatencyMs;
      observedLagMs = 0;
      routeReason = 'The nearest replica is behind the session token, so the router falls back to the primary.';
    } else {
      readAvailable = false;
      readTarget = 'Waiting for replay';
      readLatencyMs = 0;
      observedLagMs = effectiveLagMs;
      routeReason = 'The surviving async replica has not reached the session position and the primary is gone.';
    }

    const freshnessPasses = readAvailable
      && (
        request.requiresOwnWrite
          ? observedLagMs === 0
          : observedLagMs <= request.maxStalenessMs
      );

    const rpo = placement.commitMode === 'sync-remote'
      ? '0 committed writes'
      : placement.commitMode === 'async-remote'
        ? `${effectiveLagMs} ms window`
        : 'No remote copy';
    const recovery = incident.primaryAvailable
      ? 'No failover'
      : placement.hasRemoteReplica
        ? `${placement.failoverSeconds} s promotion`
        : 'Restore or rebuild';
    const writesAvailable = incident.primaryAvailable;

    return {
      effectiveLagMs,
      freshnessPasses,
      observedLagMs,
      readAvailable,
      readLatencyMs,
      readTarget,
      recovery,
      routeReason,
      rpo,
      writesAvailable,
    };
  }, [
    incident,
    model.primaryReadLatencyMs,
    model.primaryRegion,
    model.regionalReplicaReadLatencyMs,
    model.remoteRegion,
    model.remoteReplicaReadLatencyMs,
    model.sessionWaitBudgetMs,
    placement,
    policy.id,
    replicaLagMs,
    request,
  ]);

  function reset() {
    setPlacementId(model.defaults.placementId);
    setPolicyId(model.defaults.policyId);
    setRequestId(model.defaults.requestId);
    setIncidentId(model.defaults.incidentId);
    setReplicaLagMs(model.defaults.replicaLagMs);
  }

  const healthy = result.readAvailable && result.freshnessPasses;
  const outcomeTitle = !result.readAvailable
    ? 'The selected read contract is unavailable'
    : result.freshnessPasses
      ? 'The route satisfies this request contract'
      : 'The read succeeds but violates the freshness contract';
  const outcomeExplanation = !result.readAvailable
    ? `${result.routeReason} Availability must be decided per operation, not inferred from replica count.`
    : result.freshnessPasses
      ? result.routeReason
      : `${result.routeReason} The observed ${result.observedLagMs} ms lag exceeds what this request allows.`;
  const OutcomeIcon = healthy ? CheckCircle2 : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replica routing and recovery lab"
          title={model.title}
          description={model.description}
          icon={Globe2}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Place the replicas">
                {model.placements.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === placement.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.hasRemoteReplica ? Globe2 : Database}
                    accent={item.commitMode === 'sync-remote' ? 'emerald' : 'violet'}
                    onClick={() => setPlacementId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose the request contract">
                {model.requests.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === request.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.requiresOwnWrite ? ShieldCheck : Clock3}
                    accent={item.requiresOwnWrite ? 'blue' : 'cyan'}
                    onClick={() => setRequestId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Route reads">
                {model.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Route}
                    accent="blue"
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Base replica apply lag"
                value={replicaLagMs}
                output={`${replicaLagMs} ms`}
                min={model.bounds.replicaLagMs.min}
                max={model.bounds.replicaLagMs.max}
                step={model.bounds.replicaLagMs.step}
                accent="amber"
                lowLabel="Caught up"
                highLabel="Backlog"
                onChange={setReplicaLagMs}
              />

              <ChoiceGroup label="4. Inject a condition">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.primaryAvailable ? Cloud : ServerCrash}
                    accent={item.id === 'healthy' ? 'emerald' : 'rose'}
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Read target"
                value={result.readTarget}
                detail={result.readAvailable ? 'Route selected now' : 'No eligible target now'}
                icon={Route}
                tone={result.readAvailable ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Read latency"
                value={result.readAvailable ? `${result.readLatencyMs} ms` : 'Unavailable'}
                detail={`${model.clientRegion} client estimate`}
                icon={Clock3}
                tone={result.readAvailable ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Freshness"
                value={result.freshnessPasses ? 'Contract met' : 'Contract missed'}
                detail={`${result.observedLagMs} ms observed staleness`}
                icon={ShieldCheck}
                tone={result.freshnessPasses ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Region-loss recovery"
                value={result.recovery}
                detail={`RPO: ${result.rpo}`}
                icon={ServerCrash}
                tone={incident.primaryAvailable ? 'neutral' : placement.hasRemoteReplica ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Request path
              </h4>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Writes still go to the primary while it is healthy. The selected policy
                controls where this read is allowed to go.
              </p>

              <div className="mt-5 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                <RouteNode
                  eyebrow="Client"
                  title={model.clientRegion}
                  detail={request.label}
                  icon={Cloud}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-400 md:rotate-0"
                />
                <RouteNode
                  eyebrow="Router"
                  title={policy.label}
                  detail={result.readAvailable ? 'Target eligible' : 'Request blocked'}
                  icon={Route}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-5 w-5 shrink-0 rotate-90 text-neutral-400 md:rotate-0"
                />
                <RouteNode
                  eyebrow="Read target"
                  title={result.readTarget}
                  detail={result.readAvailable ? `${result.observedLagMs} ms staleness` : 'No response'}
                  icon={result.readAvailable ? Database : ServerCrash}
                  danger={!result.readAvailable}
                />
              </div>
            </section>

            <section
              className={`rounded-md border p-4 ${
                healthy
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold">{outcomeTitle}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {outcomeExplanation}
                  </p>
                  <p className="mt-2 text-xs leading-5 opacity-75">
                    Write path: {result.writesAvailable
                      ? `${model.primaryRegion} primary, about ${placement.writeLatencyMs} ms commit latency`
                      : `paused; ${placement.recoveryNote}`}
                  </p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function RouteNode({
  danger = false,
  detail,
  eyebrow,
  icon: Icon,
  title,
}: {
  danger?: boolean;
  detail: string;
  eyebrow: string;
  icon: typeof Cloud;
  title: string;
}) {
  return (
    <div
      className={`flex min-h-28 min-w-0 flex-1 items-start gap-3 rounded-md border p-4 ${
        danger
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
      }`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase opacity-65">{eyebrow}</p>
        <p className="mt-1 break-words text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
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
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replica routing and recovery lab"
          title="Where should a read go when replicas lag or fail?"
          description="Loading placement choices, request contracts, routing policies, and incidents."
          icon={Globe2}
          accent="violet"
        />
        <div className="flex min-h-48 items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center">
              <TriangleAlert
                aria-hidden="true"
                className="mx-auto h-6 w-6 text-rose-500"
              />
              <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-200">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
              Loading routing model
            </div>
          )}
        </div>
      </LearningLab>
    </div>
  );
}
