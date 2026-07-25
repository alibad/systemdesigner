'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Archive,
  Ban,
  CheckCircle2,
  Database,
  Gauge,
  KeyRound,
  Network,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type TelemetryProfile = {
  id: string;
  label: string;
  detail: string;
  eventsPerTargetMinute: number;
  bytesPerEvent: number;
};

type ScopePolicy = {
  id: string;
  label: string;
  detail: string;
  blocksOutOfScope: boolean;
};

type EngagementEnvelopeData = {
  kind: 'engagement-envelope';
  title: string;
  description: string;
  defaults: {
    targets: number;
    exerciseDays: number;
    collectors: number;
    profileId: string;
    scopePolicyId: string;
  };
  constants: {
    activeHoursPerDay: number;
    peakMultiplier: number;
    collectorCapacityEps: number;
  };
  bounds: {
    targets: Bounds;
    exerciseDays: Bounds;
    collectors: Bounds;
  };
  profiles: TelemetryProfile[];
  scopePolicies: ScopePolicy[];
};

type FailureEffect =
  | 'collector-loss'
  | 'policy-unavailable'
  | 'credential-exposure'
  | 'evidence-store-outage';

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  effect: FailureEffect;
  durationSeconds: number;
  lostCollectors: number;
};

type ResponsePolicy = {
  id: string;
  label: string;
  detail: string;
  failClosed: boolean;
  stopExposedSessions: boolean;
};

type ControlPlaneFailureData = {
  kind: 'control-plane-failures';
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    responsePolicyId: string;
    collectors: number;
    bufferMinutes: number;
    revokeMinutes: number;
  };
  constants: {
    baseEventRateEps: number;
    collectorCapacityEps: number;
    maxRevocationMinutes: number;
  };
  bounds: {
    collectors: Bounds;
    bufferMinutes: Bounds;
    revokeMinutes: Bounds;
  };
  scenarios: FailureScenario[];
  responsePolicies: ResponsePolicy[];
};

type LabData = EngagementEnvelopeData | ControlPlaneFailureData;
type ResultTone = 'emerald' | 'amber' | 'rose';

const ENGAGEMENT_BLOCK_ID = 'technology/red-team-infrastructure-engagement-envelope-lab';
const FAILURE_BLOCK_ID = 'technology/red-team-infrastructure-control-plane-failure-lab';

const failureIcons: Record<FailureEffect, LucideIcon> = {
  'collector-loss': Network,
  'policy-unavailable': Ban,
  'credential-exposure': KeyRound,
  'evidence-store-outage': Database,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isBounds(value: unknown): value is Bounds {
  if (!isRecord(value)) return false;
  return typeof value.min === 'number'
    && typeof value.max === 'number'
    && typeof value.step === 'number';
}

function isTelemetryProfile(value: unknown): value is TelemetryProfile {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.eventsPerTargetMinute === 'number'
    && typeof value.bytesPerEvent === 'number';
}

function isScopePolicy(value: unknown): value is ScopePolicy {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.blocksOutOfScope === 'boolean';
}

function isEngagementEnvelopeData(value: unknown): value is EngagementEnvelopeData {
  if (!isRecord(value) || value.kind !== 'engagement-envelope') return false;
  const defaults = value.defaults;
  const constants = value.constants;
  const bounds = value.bounds;

  return typeof value.title === 'string'
    && typeof value.description === 'string'
    && isRecord(defaults)
    && typeof defaults.targets === 'number'
    && typeof defaults.exerciseDays === 'number'
    && typeof defaults.collectors === 'number'
    && typeof defaults.profileId === 'string'
    && typeof defaults.scopePolicyId === 'string'
    && isRecord(constants)
    && typeof constants.activeHoursPerDay === 'number'
    && typeof constants.peakMultiplier === 'number'
    && typeof constants.collectorCapacityEps === 'number'
    && isRecord(bounds)
    && isBounds(bounds.targets)
    && isBounds(bounds.exerciseDays)
    && isBounds(bounds.collectors)
    && Array.isArray(value.profiles)
    && value.profiles.length >= 2
    && value.profiles.every(isTelemetryProfile)
    && Array.isArray(value.scopePolicies)
    && value.scopePolicies.length >= 2
    && value.scopePolicies.every(isScopePolicy);
}

function isFailureScenario(value: unknown): value is FailureScenario {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && [
      'collector-loss',
      'policy-unavailable',
      'credential-exposure',
      'evidence-store-outage',
    ].includes(String(value.effect))
    && typeof value.durationSeconds === 'number'
    && typeof value.lostCollectors === 'number';
}

function isResponsePolicy(value: unknown): value is ResponsePolicy {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.failClosed === 'boolean'
    && typeof value.stopExposedSessions === 'boolean';
}

function isControlPlaneFailureData(value: unknown): value is ControlPlaneFailureData {
  if (!isRecord(value) || value.kind !== 'control-plane-failures') return false;
  const defaults = value.defaults;
  const constants = value.constants;
  const bounds = value.bounds;

  return typeof value.title === 'string'
    && typeof value.description === 'string'
    && isRecord(defaults)
    && typeof defaults.scenarioId === 'string'
    && typeof defaults.responsePolicyId === 'string'
    && typeof defaults.collectors === 'number'
    && typeof defaults.bufferMinutes === 'number'
    && typeof defaults.revokeMinutes === 'number'
    && isRecord(constants)
    && typeof constants.baseEventRateEps === 'number'
    && typeof constants.collectorCapacityEps === 'number'
    && typeof constants.maxRevocationMinutes === 'number'
    && isRecord(bounds)
    && isBounds(bounds.collectors)
    && isBounds(bounds.bufferMinutes)
    && isBounds(bounds.revokeMinutes)
    && Array.isArray(value.scenarios)
    && value.scenarios.length >= 3
    && value.scenarios.every(isFailureScenario)
    && Array.isArray(value.responsePolicies)
    && value.responsePolicies.length >= 2
    && value.responsePolicies.every(isResponsePolicy);
}

function isLabData(value: unknown): value is LabData {
  return isEngagementEnvelopeData(value) || isControlPlaneFailureData(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? 'compact' : 'standard',
  }).format(value);
}

function formatDuration(seconds: number) {
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

export default function RedTeamInfrastructureCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No red team infrastructure model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the lab model (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) {
          throw new Error('The lab model does not match a supported contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Red team infrastructure lab"
          title="Loading the operating model"
          description="The lesson is loading its engagement limits and failure assumptions."
          icon={ShieldCheck}
          accent="blue"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center p-6 text-center">
            {error ? (
              <div>
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-neutral-600 dark:text-neutral-300">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm">Loading lab data...</p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    );
  }

  return data.kind === 'engagement-envelope'
    ? <EngagementEnvelopeLab data={data} />
    : <ControlPlaneFailureLab data={data} />;
}

function EngagementEnvelopeLab({ data }: { data: EngagementEnvelopeData }) {
  const initialProfile = data.profiles.find((item) => item.id === data.defaults.profileId)
    ?? data.profiles[0];
  const initialScopePolicy = data.scopePolicies.find(
    (item) => item.id === data.defaults.scopePolicyId,
  ) ?? data.scopePolicies[0];
  const [targets, setTargets] = useState(data.defaults.targets);
  const [exerciseDays, setExerciseDays] = useState(data.defaults.exerciseDays);
  const [collectors, setCollectors] = useState(data.defaults.collectors);
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [scopePolicyId, setScopePolicyId] = useState(initialScopePolicy.id);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const scopePolicy = data.scopePolicies.find((item) => item.id === scopePolicyId)
    ?? data.scopePolicies[0];

  const result = useMemo(() => {
    const averageEps = targets * profile.eventsPerTargetMinute / 60;
    const peakEps = averageEps * data.constants.peakMultiplier;
    const healthyCapacityEps = collectors * data.constants.collectorCapacityEps;
    const failureCapacityEps = Math.max(0, collectors - 1)
      * data.constants.collectorCapacityEps;
    const headroomPercent = peakEps === 0
      ? 0
      : 100 * (healthyCapacityEps / peakEps - 1);
    const eventCount = targets
      * profile.eventsPerTargetMinute
      * 60
      * data.constants.activeHoursPerDay
      * exerciseDays;
    const retainedGiB = eventCount * profile.bytesPerEvent / 1024 ** 3;

    let tone: ResultTone = 'emerald';
    let verdict = 'The engagement envelope is ready for a measured load test';
    let explanation = 'Scope is enforced and healthy ingest has at least 30% modeled headroom. Validate the estimate with the complete evidence path.';

    if (!scopePolicy.blocksOutOfScope) {
      tone = 'rose';
      verdict = 'The platform cannot enforce the approved scope';
      explanation = 'Capacity cannot compensate for advisory-only scope. Put a default-deny policy check on the execution path before the exercise.';
    } else if (healthyCapacityEps < peakEps) {
      tone = 'rose';
      verdict = 'Peak evidence traffic exceeds healthy collector capacity';
      explanation = 'Reduce telemetry volume or add measured collector capacity. Running this envelope would create an immediate evidence gap.';
    } else if (headroomPercent < 30 || failureCapacityEps < peakEps) {
      tone = 'amber';
      verdict = 'The healthy path works, but failure margin is thin';
      explanation = 'The design needs either more independent collector capacity or a tested buffer sized for repair time.';
    }

    return {
      averageEps,
      eventCount,
      failureCapacityEps,
      headroomPercent,
      healthyCapacityEps,
      peakEps,
      retainedGiB,
      tone,
      verdict,
      explanation,
    };
  }, [collectors, data.constants, exerciseDays, profile, scopePolicy, targets]);

  function reset() {
    setTargets(data.defaults.targets);
    setExerciseDays(data.defaults.exerciseDays);
    setCollectors(data.defaults.collectors);
    setProfileId(initialProfile.id);
    setScopePolicyId(initialScopePolicy.id);
  }

  return (
    <div data-content-block={ENGAGEMENT_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Engagement envelope lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Telemetry depth
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {data.profiles.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === profile.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={Activity}
                      accent="cyan"
                      onClick={() => setProfileId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Active targets"
                  value={targets}
                  output={String(targets)}
                  {...data.bounds.targets}
                  accent="blue"
                  lowLabel="Small exercise"
                  highLabel="Broad exercise"
                  onChange={setTargets}
                />
                <LabRange
                  label="Exercise duration"
                  value={exerciseDays}
                  output={`${exerciseDays} day${exerciseDays === 1 ? '' : 's'}`}
                  {...data.bounds.exerciseDays}
                  accent="violet"
                  lowLabel="Short"
                  highLabel="Extended"
                  onChange={setExerciseDays}
                />
                <LabRange
                  label="Collectors"
                  value={collectors}
                  output={String(collectors)}
                  {...data.bounds.collectors}
                  accent="emerald"
                  lowLabel="No redundancy"
                  highLabel="More capacity"
                  onChange={setCollectors}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Scope enforcement
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.scopePolicies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scopePolicy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.blocksOutOfScope ? ShieldCheck : TriangleAlert}
                      accent={candidate.blocksOutOfScope ? 'emerald' : 'rose'}
                      onClick={() => setScopePolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Modeled peak"
                value={`${result.peakEps.toFixed(1)}/s`}
                detail={`${result.averageEps.toFixed(1)}/s average`}
                icon={Activity}
                tone="cyan"
              />
              <LabMetric
                label="Healthy capacity"
                value={`${result.healthyCapacityEps}/s`}
                detail={`${result.headroomPercent.toFixed(0)}% headroom`}
                icon={Gauge}
                tone={result.healthyCapacityEps >= result.peakEps ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="After one failure"
                value={`${result.failureCapacityEps}/s`}
                detail={result.failureCapacityEps >= result.peakEps ? 'Peak remains covered' : 'Buffer or pause required'}
                icon={Network}
                tone={result.failureCapacityEps >= result.peakEps ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Evidence volume"
                value={`${result.retainedGiB.toFixed(1)} GiB`}
                detail={`${formatCompact(result.eventCount)} events`}
                icon={Archive}
                tone="violet"
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusNode
                  icon={Users}
                  eyebrow="Engagement"
                  title={`${targets} approved targets`}
                  detail={`${exerciseDays} day${exerciseDays === 1 ? '' : 's'}, ${profile.label.toLowerCase()}`}
                  state="healthy"
                />
                <StatusNode
                  icon={ShieldCheck}
                  eyebrow="Scope gate"
                  title={scopePolicy.blocksOutOfScope ? 'Enforced' : 'Advisory only'}
                  detail={scopePolicy.blocksOutOfScope ? 'Default deny at execution' : 'No machine denial'}
                  state={scopePolicy.blocksOutOfScope ? 'healthy' : 'failed'}
                />
                <StatusNode
                  icon={Waypoints}
                  eyebrow="Collectors"
                  title={`${collectors} active`}
                  detail={`${result.healthyCapacityEps} events/s measured capacity`}
                  state={result.healthyCapacityEps >= result.peakEps ? 'healthy' : 'failed'}
                />
                <StatusNode
                  icon={Database}
                  eyebrow="Evidence store"
                  title={`${result.retainedGiB.toFixed(1)} GiB planned`}
                  detail="Lifecycle and access policy required"
                  state="healthy"
                />
              </div>
            </div>

            <Verdict tone={result.tone} title={result.verdict}>
              {result.explanation}
            </Verdict>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ControlPlaneFailureLab({ data }: { data: ControlPlaneFailureData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialResponse = data.responsePolicies.find(
    (item) => item.id === data.defaults.responsePolicyId,
  ) ?? data.responsePolicies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [responsePolicyId, setResponsePolicyId] = useState(initialResponse.id);
  const [collectors, setCollectors] = useState(data.defaults.collectors);
  const [bufferMinutes, setBufferMinutes] = useState(data.defaults.bufferMinutes);
  const [revokeMinutes, setRevokeMinutes] = useState(data.defaults.revokeMinutes);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const responsePolicy = data.responsePolicies.find((item) => item.id === responsePolicyId)
    ?? data.responsePolicies[0];

  const result = useMemo(() => {
    const incomingEps = data.constants.baseEventRateEps;
    const availableCollectors = Math.max(0, collectors - scenario.lostCollectors);
    let availableCapacityEps = availableCollectors * data.constants.collectorCapacityEps;

    if (scenario.effect === 'evidence-store-outage') availableCapacityEps = 0;
    if (scenario.effect === 'policy-unavailable' || scenario.effect === 'credential-exposure') {
      availableCapacityEps = collectors * data.constants.collectorCapacityEps;
    }

    const overflowEps = Math.max(0, incomingEps - availableCapacityEps);
    const eventsNeedingBuffer = Math.ceil(overflowEps * scenario.durationSeconds);
    const bufferCapacityEvents = Math.floor(incomingEps * bufferMinutes * 60);
    const bufferedEvents = Math.min(eventsNeedingBuffer, bufferCapacityEvents);
    const unbufferedEvents = Math.max(0, eventsNeedingBuffer - bufferedEvents);
    const pauseForEvidence = unbufferedEvents > 0
      && responsePolicy.failClosed
      && (scenario.effect === 'collector-loss' || scenario.effect === 'evidence-store-outage');
    const evidenceGapEvents = pauseForEvidence ? 0 : unbufferedEvents;
    const unvalidatedEvents = scenario.effect === 'policy-unavailable' && !responsePolicy.failClosed
      ? incomingEps * scenario.durationSeconds
      : 0;
    const exposureMinutes = scenario.effect === 'credential-exposure'
      ? responsePolicy.stopExposedSessions
        ? Math.min(revokeMinutes, scenario.durationSeconds / 60)
        : scenario.durationSeconds / 60
      : 0;
    const newWorkPaused = (scenario.effect === 'policy-unavailable' && responsePolicy.failClosed)
      || (scenario.effect === 'credential-exposure' && responsePolicy.stopExposedSessions)
      || pauseForEvidence;

    let tone: ResultTone = 'emerald';
    let verdict = 'The injected failure stays inside the operating envelope';
    let explanation = 'Required evidence remains recoverable and no action bypasses current scope or identity controls.';

    if (unvalidatedEvents > 0) {
      tone = 'rose';
      verdict = 'The response permits unvalidated activity';
      explanation = 'Continuing without a scope decision breaks the engagement invariant. Deny new work until the policy service recovers.';
    } else if (
      scenario.effect === 'credential-exposure'
      && (!responsePolicy.stopExposedSessions
        || exposureMinutes > data.constants.maxRevocationMinutes)
    ) {
      tone = 'rose';
      verdict = 'The exposed identity remains useful for too long';
      explanation = 'Stop the affected sessions and meet the revocation objective before resuming the exercise.';
    } else if (evidenceGapEvents > 0) {
      tone = 'rose';
      verdict = 'The failure creates an unrecoverable evidence gap';
      explanation = 'Increase measured capacity or bounded buffering, shorten repair time, or pause before the buffer fills.';
    } else if (newWorkPaused) {
      tone = 'amber';
      verdict = 'Safety is preserved by pausing new work';
      explanation = 'The exercise loses availability, but scope and identity guarantees remain intact. Resume only after control health is proven.';
    } else if (eventsNeedingBuffer > 0 && bufferCapacityEvents - eventsNeedingBuffer < incomingEps * 60) {
      tone = 'amber';
      verdict = 'Evidence is preserved with less than one minute of buffer margin';
      explanation = 'The model passes narrowly. Test repair time and replay throughput before treating the buffer as sufficient.';
    }

    return {
      availableCapacityEps,
      availableCollectors,
      bufferCapacityEvents,
      bufferedEvents,
      evidenceGapEvents,
      eventsNeedingBuffer,
      exposureMinutes,
      newWorkPaused,
      preventedGapEvents: unbufferedEvents - evidenceGapEvents,
      tone,
      unvalidatedEvents,
      verdict,
      explanation,
    };
  }, [bufferMinutes, collectors, data.constants, responsePolicy, revokeMinutes, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setResponsePolicyId(initialResponse.id);
    setCollectors(data.defaults.collectors);
    setBufferMinutes(data.defaults.bufferMinutes);
    setRevokeMinutes(data.defaults.revokeMinutes);
  }

  return (
    <div data-content-block={FAILURE_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Control-plane failure lab"
          title={data.title}
          description={data.description}
          icon={TriangleAlert}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenario.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={failureIcons[candidate.effect]}
                      accent="rose"
                      onClick={() => setScenarioId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Choose a response
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.responsePolicies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === responsePolicy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.failClosed ? ShieldCheck : Activity}
                      accent={candidate.failClosed ? 'emerald' : 'amber'}
                      onClick={() => setResponsePolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              {scenario.effect === 'collector-loss' ? (
                <LabRange
                  label="Collector count"
                  value={collectors}
                  output={String(collectors)}
                  {...data.bounds.collectors}
                  accent="blue"
                  lowLabel="Single collector"
                  highLabel="More redundancy"
                  onChange={setCollectors}
                />
              ) : null}

              {scenario.effect === 'collector-loss' || scenario.effect === 'evidence-store-outage' ? (
                <LabRange
                  label="Evidence buffer"
                  value={bufferMinutes}
                  output={`${bufferMinutes} min`}
                  {...data.bounds.bufferMinutes}
                  accent="violet"
                  lowLabel="No buffer"
                  highLabel="Longer repair window"
                  onChange={setBufferMinutes}
                />
              ) : null}

              {scenario.effect === 'credential-exposure' ? (
                <LabRange
                  label="Credential revocation"
                  value={revokeMinutes}
                  output={`${revokeMinutes} min`}
                  {...data.bounds.revokeMinutes}
                  accent="amber"
                  lowLabel="Fast response"
                  highLabel="Long exposure"
                  onChange={setRevokeMinutes}
                />
              ) : null}
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Failure window"
                value={formatDuration(scenario.durationSeconds)}
                detail={scenario.label}
                icon={Timer}
                tone="neutral"
              />
              <LabMetric
                label="Evidence gap"
                value={formatCompact(result.evidenceGapEvents)}
                detail={result.preventedGapEvents > 0
                  ? `${formatCompact(result.preventedGapEvents)} avoided by pause`
                  : `${formatCompact(result.bufferedEvents)} buffered`}
                icon={Archive}
                tone={result.evidenceGapEvents === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Unvalidated events"
                value={formatCompact(result.unvalidatedEvents)}
                detail={result.unvalidatedEvents === 0 ? 'Scope preserved' : 'Policy bypassed'}
                icon={ShieldCheck}
                tone={result.unvalidatedEvents === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Credential exposure"
                value={`${result.exposureMinutes} min`}
                detail={scenario.effect === 'credential-exposure' ? `Objective: at most ${data.constants.maxRevocationMinutes} min` : 'No credential fault'}
                icon={KeyRound}
                tone={result.exposureMinutes <= data.constants.maxRevocationMinutes ? 'emerald' : 'rose'}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusNode
                  icon={ShieldCheck}
                  eyebrow="Policy gate"
                  title={scenario.effect === 'policy-unavailable' ? 'Unavailable' : 'Evaluating scope'}
                  detail={scenario.effect === 'policy-unavailable' && responsePolicy.failClosed ? 'New work denied' : responsePolicy.label}
                  state={result.unvalidatedEvents === 0 ? 'healthy' : 'failed'}
                />
                <StatusNode
                  icon={Network}
                  eyebrow="Collector path"
                  title={`${result.availableCollectors} available`}
                  detail={`${result.availableCapacityEps} events/s direct capacity`}
                  state={result.evidenceGapEvents === 0 ? 'healthy' : 'failed'}
                />
                <StatusNode
                  icon={Archive}
                  eyebrow="Bounded buffer"
                  title={`${formatCompact(result.bufferCapacityEvents)} events`}
                  detail={`${formatCompact(result.eventsNeedingBuffer)} needed${result.preventedGapEvents > 0 ? '; pause covers the remainder' : ''}`}
                  state={result.evidenceGapEvents === 0 ? 'healthy' : 'failed'}
                />
                <StatusNode
                  icon={KeyRound}
                  eyebrow="Operator access"
                  title={result.newWorkPaused ? 'Paused' : 'Active'}
                  detail={scenario.effect === 'credential-exposure' ? `${result.exposureMinutes} min to revoke` : 'No exposed identity'}
                  state={result.exposureMinutes <= data.constants.maxRevocationMinutes ? 'healthy' : 'failed'}
                />
              </div>
            </div>

            <Verdict tone={result.tone} title={result.verdict}>
              {result.explanation}
            </Verdict>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function StatusNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  state,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  state: 'healthy' | 'failed';
}) {
  return (
    <div className={`min-w-0 rounded-md border p-4 ${
      state === 'healthy'
        ? 'border-emerald-200 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
    }`}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="text-[11px] font-semibold uppercase">
          {state === 'healthy' ? 'Protected' : 'At risk'}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase opacity-70">{eyebrow}</p>
      <p className="mt-1 break-words text-base font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function Verdict({
  tone,
  title,
  children,
}: {
  tone: ResultTone;
  title: string;
  children: ReactNode;
}) {
  const styles = tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
    : tone === 'amber'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
      : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35';
  const Icon = tone === 'emerald' ? CheckCircle2 : TriangleAlert;

  return (
    <div className={`rounded-lg border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            tone === 'emerald'
              ? 'text-emerald-700 dark:text-emerald-300'
              : tone === 'amber'
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-rose-700 dark:text-rose-300'
          }`}
        />
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950 dark:text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
