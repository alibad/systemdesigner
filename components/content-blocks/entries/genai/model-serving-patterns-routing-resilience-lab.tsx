'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  GitBranch,
  Layers3,
  LoaderCircle,
  Route,
  Server,
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
} from '../../learning/LearningLab';

interface RoutingIncident {
  id: string;
  label: string;
  detail: string;
  arrivalRps: number;
  serviceMs: number;
  baseResidencyHitPct: number;
  catalogSkewPct: number;
  workerLoss: number;
  modelLoadSeconds: number;
  fallbackCapacityRps: number;
}

interface RoutingPolicy {
  id: 'round-robin' | 'least-loaded' | 'locality-aware';
  label: string;
  detail: string;
  residencyBonusPct: number;
  balanceFactor: number;
}

interface ScalingSignal {
  id: 'gpu-utilization' | 'active-concurrency' | 'queue-age';
  label: string;
  detail: string;
  reactionSeconds: number;
}

interface RoutingResilienceData {
  title: string;
  description: string;
  defaultIncidentId: string;
  defaultRoutingId: RoutingPolicy['id'];
  defaultSignalId: ScalingSignal['id'];
  defaultWarmReplicas: number;
  incidents: RoutingIncident[];
  routingPolicies: RoutingPolicy[];
  scalingSignals: ScalingSignal[];
}

const BLOCK_ID = 'genai/model-serving-patterns-routing-resilience-lab';

function isRoutingResilienceData(value: unknown): value is RoutingResilienceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoutingResilienceData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaultIncidentId === 'string'
      && typeof candidate.defaultRoutingId === 'string'
      && typeof candidate.defaultSignalId === 'string'
      && typeof candidate.defaultWarmReplicas === 'number'
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && typeof incident.arrivalRps === 'number'
        && typeof incident.serviceMs === 'number'
        && typeof incident.baseResidencyHitPct === 'number'
        && typeof incident.catalogSkewPct === 'number'
        && typeof incident.workerLoss === 'number'
        && typeof incident.modelLoadSeconds === 'number'
        && typeof incident.fallbackCapacityRps === 'number'
      ))
      && Array.isArray(candidate.routingPolicies)
      && candidate.routingPolicies.length > 0
      && candidate.routingPolicies.every((policy) => (
        ['round-robin', 'least-loaded', 'locality-aware'].includes(policy.id)
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && typeof policy.residencyBonusPct === 'number'
        && typeof policy.balanceFactor === 'number'
      ))
      && Array.isArray(candidate.scalingSignals)
      && candidate.scalingSignals.length > 0
      && candidate.scalingSignals.every((signal) => (
        ['gpu-utilization', 'active-concurrency', 'queue-age'].includes(signal.id)
        && typeof signal.label === 'string'
        && typeof signal.detail === 'string'
        && typeof signal.reactionSeconds === 'number'
      )),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRps(value: number) {
  return `${Math.round(value).toLocaleString()} rps`;
}

export default function ModelServingPatternsRoutingResilienceLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RoutingResilienceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No routing and resilience data file was supplied.');
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
        if (!isRoutingResilienceData(payload)) {
          throw new Error('Routing and resilience data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabFailure detail={error} />;
  if (!data) return <LabLoading />;
  return <RoutingResilienceLab data={data} />;
}

function RoutingResilienceLab({ data }: { data: RoutingResilienceData }) {
  const initialIncident = data.incidents.find((item) => item.id === data.defaultIncidentId)
    ?? data.incidents[0];
  const initialRouting = data.routingPolicies.find((item) => item.id === data.defaultRoutingId)
    ?? data.routingPolicies[0];
  const initialSignal = data.scalingSignals.find((item) => item.id === data.defaultSignalId)
    ?? data.scalingSignals[0];
  const [incidentId, setIncidentId] = useState(initialIncident.id);
  const [routingId, setRoutingId] = useState<RoutingPolicy['id']>(initialRouting.id);
  const [signalId, setSignalId] = useState<ScalingSignal['id']>(initialSignal.id);
  const [warmReplicas, setWarmReplicas] = useState(data.defaultWarmReplicas);
  const [fallbackEnabled, setFallbackEnabled] = useState(true);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const routing = data.routingPolicies.find((item) => item.id === routingId)
    ?? data.routingPolicies[0];
  const signal = data.scalingSignals.find((item) => item.id === signalId)
    ?? data.scalingSignals[0];

  const model = useMemo(() => {
    const survivingWarmReplicas = Math.max(0, warmReplicas - incident.workerLoss);
    const perReplicaCapacityRps = 1000 / incident.serviceMs * 0.72;
    const primaryCapacityRps = survivingWarmReplicas * perReplicaCapacityRps * routing.balanceFactor;
    const utilization = incident.arrivalRps / Math.max(primaryCapacityRps, 0.001);
    const skewPenalty = incident.catalogSkewPct * (
      routing.id === 'round-robin' ? 1 : routing.id === 'least-loaded' ? 0.55 : 0.20
    );
    const residencyHitPct = clamp(
      incident.baseResidencyHitPct + routing.residencyBonusPct - skewPenalty,
      5,
      98,
    );
    const residencyMissRps = incident.arrivalRps * (100 - residencyHitPct) / 100;
    const primaryServedRps = Math.min(incident.arrivalRps, primaryCapacityRps);
    const primaryShortfallRps = Math.max(0, incident.arrivalRps - primaryServedRps);
    const fallbackRps = fallbackEnabled
      ? Math.min(primaryShortfallRps, incident.fallbackCapacityRps)
      : 0;
    const rejectedRps = Math.max(0, primaryShortfallRps - fallbackRps);
    const servedRps = primaryServedRps + fallbackRps;
    const servedPct = 100 * servedRps / incident.arrivalRps;
    const desiredReplicas = Math.max(
      1,
      Math.ceil(incident.arrivalRps / Math.max(perReplicaCapacityRps * routing.balanceFactor, 0.001)),
    );
    const missingReplicas = Math.max(0, desiredReplicas - survivingWarmReplicas);
    const recoverySeconds = missingReplicas > 0
      ? signal.reactionSeconds + incident.modelLoadSeconds
      : 0;
    const backlogDuringRecovery = primaryShortfallRps * recoverySeconds;
    const warmP99Ms = incident.serviceMs
      * (1 + Math.max(0, utilization - 0.68) * 2.6)
      + incident.catalogSkewPct;
    const state = rejectedRps === 0 && utilization <= 1 && residencyHitPct >= 65
      ? 'healthy'
      : servedPct >= 96
        ? 'degraded'
        : 'critical';

    return {
      backlogDuringRecovery,
      desiredReplicas,
      fallbackRps,
      missingReplicas,
      primaryCapacityRps,
      primaryServedRps,
      recoverySeconds,
      rejectedRps,
      residencyHitPct,
      residencyMissRps,
      servedPct,
      state,
      survivingWarmReplicas,
      utilization,
      warmP99Ms,
    };
  }, [fallbackEnabled, incident, routing, signal.reactionSeconds, warmReplicas]);

  function reset() {
    setIncidentId(initialIncident.id);
    setRoutingId(initialRouting.id);
    setSignalId(initialSignal.id);
    setWarmReplicas(data.defaultWarmReplicas);
    setFallbackEnabled(true);
  }

  const status = model.state === 'healthy'
    ? {
      title: 'Warm capacity absorbs the event',
      detail: 'The route keeps enough work on resident, balanced workers and does not depend on emergency fallback.',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
      icon: CheckCircle2,
    }
    : model.state === 'degraded'
      ? {
        title: 'Availability is preserved with a changed path',
        detail: 'Fallback covers most of the warm-pool shortfall. Track its quality and cost separately while the primary fleet recovers.',
        classes: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
        icon: ShieldCheck,
      }
      : {
        title: 'The fleet cannot cover the incident',
        detail: 'Requests are rejected or accumulate while new workers load. Increase the warm floor, improve locality without creating a hotspot, or shorten the scaling delay.',
        classes: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
        icon: TriangleAlert,
      };
  const StatusIcon = status.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure and recovery lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Traffic event
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'steady-traffic' ? Activity : item.id === 'long-tail-catalog' ? Database : TriangleAlert}
                      accent={item.id === 'steady-traffic' ? 'emerald' : item.id === 'long-tail-catalog' ? 'violet' : 'rose'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Routing policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.routingPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === routing.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'round-robin' ? GitBranch : item.id === 'least-loaded' ? Gauge : Database}
                      accent={item.id === 'locality-aware' ? 'violet' : 'blue'}
                      onClick={() => setRoutingId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Autoscaling signal
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scalingSignals.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === signal.id}
                      label={item.label}
                      detail={`${item.detail} ${item.reactionSeconds}s modeled reaction.`}
                      icon={item.id === 'gpu-utilization' ? Gauge : item.id === 'active-concurrency' ? Layers3 : Clock3}
                      accent={item.id === 'queue-age' ? 'emerald' : item.id === 'active-concurrency' ? 'blue' : 'amber'}
                      onClick={() => setSignalId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <LabRange
                  label="Configured warm floor"
                  value={warmReplicas}
                  output={`${warmReplicas} replicas`}
                  min={1}
                  max={12}
                  step={1}
                  lowLabel="Lower idle cost"
                  highLabel="More failure headroom"
                  accent="violet"
                  onChange={setWarmReplicas}
                />

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                  <input
                    type="checkbox"
                    checked={fallbackEnabled}
                    onChange={(event) => setFallbackEnabled(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-violet-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Allow compatible fallback</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Preserve bounded availability with a separately measured lower-cost model.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Resident-model hit"
                value={`${Math.round(model.residencyHitPct)}%`}
                detail={`${formatRps(model.residencyMissRps)} trigger a cold model path`}
                icon={Database}
                tone={model.residencyHitPct >= 65 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Warm capacity now"
                value={formatRps(model.primaryCapacityRps)}
                detail={`${model.survivingWarmReplicas} of ${warmReplicas} configured replicas survive`}
                icon={Server}
                tone={model.primaryCapacityRps >= incident.arrivalRps ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Recovery to target"
                value={model.recoverySeconds === 0 ? 'Ready now' : `${model.recoverySeconds}s`}
                detail={`${model.missingReplicas} replica${model.missingReplicas === 1 ? '' : 's'} missing; signal plus model load`}
                icon={Clock3}
                tone={model.recoverySeconds === 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Traffic served"
                value={`${model.servedPct.toFixed(1)}%`}
                detail={`${formatRps(model.rejectedRps)} rejected after fallback`}
                icon={ShieldCheck}
                tone={model.servedPct >= 99.5 ? 'emerald' : model.servedPct >= 96 ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Request placement
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {routing.label} under {incident.label.toLowerCase()}
                  </h4>
                </div>
                <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatRps(incident.arrivalRps)} entering
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <PathCard
                  label="Resident workers"
                  value={`${Math.round(model.residencyHitPct)}% locality`}
                  detail={`${formatRps(model.primaryServedRps)} served by the surviving warm pool.`}
                  icon={Server}
                  tone="violet"
                />
                <PathCard
                  label="Cold model path"
                  value={`${incident.modelLoadSeconds}s load`}
                  detail={`${formatRps(model.residencyMissRps)} do not find their model resident on the first route.`}
                  icon={Database}
                  tone="amber"
                />
                <PathCard
                  label="Fallback or reject"
                  value={`${formatRps(model.fallbackRps)} fallback`}
                  detail={`${formatRps(model.rejectedRps)} remain outside all declared capacity.`}
                  icon={ShieldCheck}
                  tone={model.rejectedRps > 0 ? 'rose' : 'emerald'}
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Capacity recovery runway
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {model.survivingWarmReplicas} ready now, {model.desiredReplicas} required
                  </h4>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Warm p99 model: {Math.round(model.warmP99Ms)} ms
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <TimelineStep
                  number="1"
                  label="Detect pressure"
                  value={`${signal.reactionSeconds}s`}
                  detail={signal.label}
                  active={model.missingReplicas > 0}
                />
                <TimelineStep
                  number="2"
                  label="Load model"
                  value={`${incident.modelLoadSeconds}s`}
                  detail="Artifact, runtime, warm-up"
                  active={model.missingReplicas > 0}
                />
                <TimelineStep
                  number="3"
                  label="Pass readiness"
                  value={model.recoverySeconds === 0 ? 'Already ready' : `${model.recoverySeconds}s total`}
                  detail={`${Math.round(model.backlogDuringRecovery).toLocaleString()} requests exposed during recovery`}
                  active={model.missingReplicas > 0}
                />
              </div>
            </section>

            <section className={`rounded-md border p-4 ${status.classes}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{status.title}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{status.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Server;
  tone: 'violet' | 'amber' | 'rose' | 'emerald';
}) {
  const tones = {
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  };
  return (
    <div className={`min-w-0 rounded-md border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-3 break-words text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function TimelineStep({
  number,
  label,
  value,
  detail,
  active,
}: {
  number: string;
  label: string;
  value: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div className={`relative min-w-0 rounded-md border p-4 ${
      active
        ? 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40'
        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
    }`}>
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
        active
          ? 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950'
          : 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950'
      }`}>
        {number}
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading routing model...
      </div>
    </div>
  );
}

function LabFailure({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Routing lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
