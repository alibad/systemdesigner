'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  Clock3,
  Cpu,
  Fingerprint,
  Gauge,
  GitBranch,
  KeyRound,
  Network,
  RadioTower,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FailureKind =
  | 'healthy'
  | 'link-loss'
  | 'memory-pressure'
  | 'stale-herald'
  | 'controller-spoof';

type RequestProfile = {
  id: string;
  label: string;
  detail: string;
  pairs: number;
  targetFidelity: number;
  deadlineMs: number;
};

type RouteProfile = {
  id: string;
  label: string;
  detail: string;
  hops: number;
  baseFidelity: number;
  expectedPairMs: number;
  memoryLifetimeMs: number;
  capacityPairs: number;
  classicalRttMs: number;
  trustDomains: number;
};

type SchedulingPolicy = {
  id: string;
  label: string;
  detail: string;
  capacityFactor: number;
  latencyFactor: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  kind: FailureKind;
  rateMultiplier: number;
  fidelityPenalty: number;
  rttMultiplier: number;
  memoryMultiplier: number;
};

type SecurityMode = {
  id: string;
  label: string;
  detail: string;
  authenticatesCommands: boolean;
  checksFreshness: boolean;
};

type OrchestrationModel = {
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    requestId: string;
    routeId: string;
    schedulingId: string;
    failureId: string;
    securityId: string;
  };
  requests: RequestProfile[];
  routes: RouteProfile[];
  schedulingPolicies: SchedulingPolicy[];
  failures: FailureScenario[];
  securityModes: SecurityMode[];
};

type GateState = 'healthy' | 'active' | 'warning' | 'danger';

const BLOCK_ID = 'fundamentals/distributed-quantum-systems-orchestration-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/distributed-quantum-systems/data/orchestration-failure-model.json';

function isOrchestrationModel(value: unknown): value is OrchestrationModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<OrchestrationModel>;

  return Boolean(
    model.title
      && model.description
      && model.modelNote
      && model.defaults?.requestId
      && model.defaults.routeId
      && model.defaults.schedulingId
      && model.defaults.failureId
      && model.defaults.securityId
      && Array.isArray(model.requests)
      && model.requests.length >= 3
      && model.requests.every((request) => (
        typeof request.pairs === 'number'
        && typeof request.targetFidelity === 'number'
        && typeof request.deadlineMs === 'number'
      ))
      && Array.isArray(model.routes)
      && model.routes.length >= 3
      && model.routes.every((route) => (
        typeof route.hops === 'number'
        && typeof route.baseFidelity === 'number'
        && typeof route.expectedPairMs === 'number'
        && typeof route.memoryLifetimeMs === 'number'
        && typeof route.capacityPairs === 'number'
        && typeof route.classicalRttMs === 'number'
      ))
      && Array.isArray(model.schedulingPolicies)
      && model.schedulingPolicies.length >= 2
      && Array.isArray(model.failures)
      && model.failures.length >= 4
      && Array.isArray(model.securityModes)
      && model.securityModes.length >= 2,
  );
}

function visibility(fidelity: number) {
  return Math.max(0, Math.min(1, (4 * fidelity - 1) / 3));
}

function fidelityFromVisibility(value: number) {
  return (1 + 3 * Math.max(0, Math.min(1, value))) / 4;
}

function choiceIcon(id: string) {
  if (id.includes('spoof') || id.includes('unsigned')) return ShieldAlert;
  if (id.includes('memory')) return TimerOff;
  if (id.includes('loss')) return RadioTower;
  if (id.includes('stale')) return BellRing;
  if (id.includes('authenticated')) return ShieldCheck;
  if (id.includes('reserved')) return KeyRound;
  return Route;
}

export default function DistributedQuantumSystemsOrchestrationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<OrchestrationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [requestId, setRequestId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [schedulingId, setSchedulingId] = useState('');
  const [failureId, setFailureId] = useState('');
  const [securityId, setSecurityId] = useState('');

  function reset(model: OrchestrationModel) {
    setRequestId(model.defaults.requestId);
    setRouteId(model.defaults.routeId);
    setSchedulingId(model.defaults.schedulingId);
    setFailureId(model.defaults.failureId);
    setSecurityId(model.defaults.securityId);
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
        if (!isOrchestrationModel(payload)) {
          throw new Error('The orchestration model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load orchestration data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const request =
      data.requests.find((candidate) => candidate.id === requestId)
      ?? data.requests[0];
    const route =
      data.routes.find((candidate) => candidate.id === routeId)
      ?? data.routes[0];
    const scheduling =
      data.schedulingPolicies.find((candidate) => candidate.id === schedulingId)
      ?? data.schedulingPolicies[0];
    const failure =
      data.failures.find((candidate) => candidate.id === failureId)
      ?? data.failures[0];
    const security =
      data.securityModes.find((candidate) => candidate.id === securityId)
      ?? data.securityModes[0];
    const spoofBlocked =
      failure.kind === 'controller-spoof'
      && security.authenticatesCommands
      && security.checksFreshness;
    const controlIntegrity = failure.kind !== 'controller-spoof' || spoofBlocked;
    const staleHeraldRejected =
      failure.kind === 'stale-herald'
      && security.authenticatesCommands
      && security.checksFreshness;
    const availablePairs = Math.max(
      1,
      Math.floor(route.capacityPairs * scheduling.capacityFactor),
    );
    const productionWaves = Math.ceil(request.pairs / availablePairs);
    const pairGenerationMs =
      route.expectedPairMs
      / Math.max(0.01, failure.rateMultiplier)
      * scheduling.latencyFactor;
    const classicalRttMs = route.classicalRttMs * failure.rttMultiplier;
    const completionMs = pairGenerationMs * productionWaves + classicalRttMs;
    const memoryLifetimeMs = route.memoryLifetimeMs * failure.memoryMultiplier;
    const oldestPairAgeMs = pairGenerationMs + classicalRttMs;
    const memorySurvival = Math.exp(-oldestPairAgeMs / memoryLifetimeMs);
    const deliveredFidelity = fidelityFromVisibility(
      visibility(Math.max(0.25, route.baseFidelity - failure.fidelityPenalty))
      * memorySurvival,
    );
    const capacityClears = availablePairs >= request.pairs;
    const fidelityClears = deliveredFidelity >= request.targetFidelity;
    const deadlineClears = completionMs <= request.deadlineMs;
    const memoryClears = oldestPairAgeMs <= memoryLifetimeMs;
    const heraldClears = !staleHeraldRejected;
    const accepted =
      controlIntegrity
      && capacityClears
      && fidelityClears
      && deadlineClears
      && memoryClears
      && heraldClears;

    const blockers = [
      !controlIntegrity
        ? 'The controller command cannot be authenticated and bound to a fresh reservation.'
        : null,
      !capacityClears
        ? `Only ${availablePairs} pair slots are available for a ${request.pairs}-pair request.`
        : null,
      !fidelityClears
        ? `Modeled fidelity ${(deliveredFidelity * 100).toFixed(1)}% is below the ${(request.targetFidelity * 100).toFixed(0)}% contract.`
        : null,
      !deadlineClears
        ? `Completion ${completionMs.toFixed(0)} ms exceeds the ${request.deadlineMs} ms deadline.`
        : null,
      !memoryClears
        ? `The oldest pair waits ${oldestPairAgeMs.toFixed(0)} ms in a ${memoryLifetimeMs.toFixed(0)} ms memory window.`
        : null,
      staleHeraldRejected
        ? 'Freshness checks reject the delayed herald; the network must retry instead of binding it to the current request.'
        : null,
    ].filter((item): item is string => Boolean(item));

    let status = 'Request admitted with bounded evidence';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict =
      'The route, reservation, memory window, fidelity estimate, and authenticated pair lifecycle satisfy this illustrative contract.';

    if (!controlIntegrity) {
      status = 'Control-plane integrity is lost';
      tone = 'rose';
      verdict =
        'A forged command can misbind pair identifiers, reorder operations, or consume another reservation. Quantum mechanics does not authenticate the classical controller.';
    } else if (staleHeraldRejected) {
      status = 'Stale herald rejected safely';
      tone = 'amber';
      verdict =
        'The current request is not completed with old evidence. Retry and surface the availability loss separately from a security breach.';
    } else if (!accepted) {
      status = 'Admission contract is not met';
      tone = 'rose';
      verdict =
        'Reject or renegotiate before consuming scarce memories. Best-effort execution would hide which fidelity, rate, deadline, or identity promise failed.';
    } else if (failure.kind !== 'healthy') {
      status = 'Degraded request still clears the contract';
      tone = 'amber';
      verdict =
        'The modeled request remains feasible, but the failure reduces headroom. Alert on the cause before retries create contention elsewhere.';
    }

    return {
      request,
      route,
      scheduling,
      failure,
      security,
      availablePairs,
      completionMs,
      memoryLifetimeMs,
      oldestPairAgeMs,
      deliveredFidelity,
      controlIntegrity,
      staleHeraldRejected,
      accepted,
      blockers,
      status,
      tone,
      verdict,
    };
  }, [data, failureId, requestId, routeId, schedulingId, securityId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Routing and control-plane lab"
          title="Admit the request only when the whole lifecycle is credible"
          description="Choose an application contract, route, scheduler, failure, and control-channel policy. The trace keeps classical orchestration separate from the quantum operations it coordinates."
          icon={Network}
          accent="cyan"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <ChoiceGroup
                  label="Application contract"
                  items={data.requests}
                  selected={view.request.id}
                  accent="violet"
                  onChange={setRequestId}
                />
                <ChoiceGroup
                  label="Candidate route"
                  items={data.routes}
                  selected={view.route.id}
                  accent="cyan"
                  onChange={setRouteId}
                />
                <ChoiceGroup
                  label="Scheduling policy"
                  items={data.schedulingPolicies}
                  selected={view.scheduling.id}
                  accent="blue"
                  onChange={setSchedulingId}
                />
                <ChoiceGroup
                  label="Failure to inject"
                  items={data.failures}
                  selected={view.failure.id}
                  accent={view.failure.kind === 'healthy' ? 'emerald' : 'rose'}
                  onChange={setFailureId}
                />
                <ChoiceGroup
                  label="Classical control security"
                  items={data.securityModes}
                  selected={view.security.id}
                  accent={view.security.authenticatesCommands && view.security.checksFreshness ? 'emerald' : 'amber'}
                  onChange={setSecurityId}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Admission"
                  value={view.accepted ? 'Accept' : 'Reject'}
                  detail={`${view.blockers.length} active ${view.blockers.length === 1 ? 'blocker' : 'blockers'}.`}
                  icon={view.accepted ? CheckCircle2 : TriangleAlert}
                  tone={view.accepted ? 'emerald' : view.staleHeraldRejected ? 'amber' : 'rose'}
                />
                <LabMetric
                  label="Completion"
                  value={`${view.completionMs.toFixed(0)} ms`}
                  detail={`${view.request.deadlineMs} ms application deadline.`}
                  icon={Clock3}
                  tone={view.completionMs <= view.request.deadlineMs ? 'blue' : 'rose'}
                />
                <LabMetric
                  label="Delivered fidelity"
                  value={`${(view.deliveredFidelity * 100).toFixed(1)}%`}
                  detail={`${(view.request.targetFidelity * 100).toFixed(0)}% requested.`}
                  icon={Gauge}
                  tone={view.deliveredFidelity >= view.request.targetFidelity ? 'violet' : 'rose'}
                />
                <LabMetric
                  label="Reserved capacity"
                  value={`${view.availablePairs} pairs`}
                  detail={`${view.request.pairs} requested; ${view.route.capacityPairs} route slots.`}
                  icon={Cpu}
                  tone={view.availablePairs >= view.request.pairs ? 'cyan' : 'amber'}
                />
              </div>

              <section className="mt-5 rounded-md border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/25">
                <PlaneHeading
                  icon={Fingerprint}
                  eyebrow="Classical control plane"
                  title="Decide, reserve, signal, authenticate, and expire"
                  detail="These are ordinary messages. They need identity, authorization, freshness, correlation IDs, and replay protection."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <TraceStep number="1" title="Admit" detail={`${view.request.pairs} pairs at ${(view.request.targetFidelity * 100).toFixed(0)}% fidelity`} state={view.blockers.length === 0 ? 'healthy' : 'warning'} />
                  <TraceStep number="2" title="Reserve" detail={`${view.availablePairs} slots on ${view.route.hops} quantum ${view.route.hops === 1 ? 'link' : 'links'}`} state={view.availablePairs >= view.request.pairs ? 'healthy' : 'danger'} />
                  <TraceStep number="3" title="Trigger" detail={`${view.scheduling.label} starts generation`} state="active" />
                  <TraceStep number="4" title="Validate herald" detail={view.controlIntegrity ? view.staleHeraldRejected ? 'Authentic but stale evidence rejected' : 'Identity and freshness accepted' : 'Command source is not trustworthy'} state={view.controlIntegrity ? view.staleHeraldRejected ? 'warning' : 'healthy' : 'danger'} />
                  <TraceStep number="5" title="Release or expire" detail={view.accepted ? 'Pair IDs handed to the application' : 'Reservation rolled back or renegotiated'} state={view.accepted ? 'healthy' : 'warning'} />
                </div>
              </section>

              <section className="mt-4 rounded-md border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/25">
                <PlaneHeading
                  icon={Waves}
                  eyebrow="Quantum entanglement plane"
                  title="Generate, store, swap, and consume"
                  detail="The data-plane resource is a short-lived correlated state. Successful use consumes it; a router cannot inspect and copy it like a packet."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <TraceStep number="1" title="Generate links" detail={`${view.failure.label}; expected route pair time ${view.route.expectedPairMs} ms`} state={view.failure.kind === 'link-loss' ? 'danger' : 'active'} />
                  <TraceStep number="2" title="Hold in memory" detail={`${view.oldestPairAgeMs.toFixed(0)} ms age / ${view.memoryLifetimeMs.toFixed(0)} ms window`} state={view.oldestPairAgeMs <= view.memoryLifetimeMs ? 'healthy' : 'danger'} />
                  <TraceStep number="3" title="Swap at repeaters" detail={`${Math.max(0, view.route.hops - 1)} swap ${view.route.hops - 1 === 1 ? 'stage' : 'stages'} extend the pair`} state={view.deliveredFidelity >= view.request.targetFidelity ? 'healthy' : 'warning'} />
                  <TraceStep number="4" title="Consume pair" detail={view.accepted ? 'Application receives a correlated pair ID' : 'No pair should cross the failed admission gate'} state={view.accepted ? 'healthy' : 'warning'} />
                </div>
              </section>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Evidence an operator needs
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Observe the lifecycle, not only a final success counter.
                    </p>
                  </div>
                  <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    {view.route.trustDomains} administrative {view.route.trustDomains === 1 ? 'domain' : 'domains'}
                  </span>
                </div>
                <ul className="mt-4 grid gap-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-cyan-600 sm:grid-cols-2 dark:text-neutral-200 dark:marker:text-cyan-400">
                  <li>request, reservation, pair, attempt, and swap correlation IDs</li>
                  <li>authenticated controller identity and command freshness</li>
                  <li>generation attempts, herald outcomes, and detector health</li>
                  <li>memory occupancy, pair age, fidelity estimate, and expiry reason</li>
                  <li>route decision, capacity rejected, and preemption events</li>
                  <li>application consumption or explicit pair disposal</li>
                </ul>
              </section>

              <section className={`mt-5 rounded-md border p-4 ${
                view.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                  : view.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              }`}>
                <div className="flex items-start gap-3">
                  {view.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${
                      view.tone === 'rose'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{view.status}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{view.verdict}</p>
                    {view.blockers.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 pl-5 text-xs leading-5 text-neutral-700 marker:text-current dark:text-neutral-200">
                        {view.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                      </ul>
                    ) : null}
                    <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{data.modelNote}</p>
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

function ChoiceGroup({
  label,
  items,
  selected,
  accent,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selected: string;
  accent: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={selected === item.id}
            label={item.label}
            detail={item.detail}
            icon={choiceIcon(item.id)}
            accent={accent}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function PlaneHeading({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Network;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current bg-white/80 dark:bg-neutral-950/60">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{eyebrow}</p>
        <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
      </div>
    </div>
  );
}

function TraceStep({
  number,
  title,
  detail,
  state,
}: {
  number: string;
  title: string;
  detail: string;
  state: GateState;
}) {
  const styles: Record<GateState, string> = {
    healthy: 'border-emerald-300 bg-white dark:border-emerald-900 dark:bg-neutral-950',
    active: 'border-blue-300 bg-white dark:border-blue-900 dark:bg-neutral-950',
    warning: 'border-amber-300 bg-white dark:border-amber-900 dark:bg-neutral-950',
    danger: 'border-rose-300 bg-white dark:border-rose-900 dark:bg-neutral-950',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[state]}`}>
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
        {number}
      </span>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
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
  if (error) {
    return (
      <div className="min-h-[480px] p-6">
        <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
          <p className="mt-3 font-semibold">Orchestration data could not be loaded</p>
          <p className="mt-1 leading-6">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[480px] items-center justify-center p-6" role="status">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" />
        <p className="mt-3">Loading orchestration model...</p>
      </div>
    </div>
  );
}
