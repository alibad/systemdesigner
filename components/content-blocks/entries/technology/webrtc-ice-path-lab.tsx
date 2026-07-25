'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Network,
  Radio,
  Server,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CandidatePolicy = 'all' | 'relay-only';
type TurnTransport = 'auto' | 'udp' | 'tls';
type Scenario = {
  id: string;
  label: string;
  detail: string;
  hostReachable: boolean;
  serverReflexiveReachable: boolean;
  udpAllowed: boolean;
  tcp443Allowed: boolean;
  turnAvailable: boolean;
  baseRttMs: number;
  gatheringMs: number;
};
type IceData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    candidatePolicy: CandidatePolicy;
    turnTransport: TurnTransport;
    trickleIce: boolean;
  };
  assumptions: {
    failedProbeMs: number;
    trickleSavingsMs: number;
    turnUdpPenaltyMs: number;
    turnTlsPenaltyMs: number;
    mediaMbps: number;
  };
  scenarios: Scenario[];
};
type PathId = 'host' | 'server-reflexive' | 'relay-udp' | 'relay-tls' | 'failed';
type StageState = 'selected' | 'failed' | 'skipped' | 'not-needed';

const BLOCK_ID = 'technology/webrtc-ice-path-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Scenario>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.hostReachable === 'boolean'
      && typeof candidate.serverReflexiveReachable === 'boolean'
      && typeof candidate.udpAllowed === 'boolean'
      && typeof candidate.tcp443Allowed === 'boolean'
      && typeof candidate.turnAvailable === 'boolean'
      && isNumber(candidate.baseRttMs)
      && isNumber(candidate.gatheringMs),
  );
}

function isIceData(value: unknown): value is IceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IceData>;
  const defaults = candidate.defaults;
  const assumptions = candidate.assumptions;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.scenarioId
      && ['all', 'relay-only'].includes(defaults.candidatePolicy ?? '')
      && ['auto', 'udp', 'tls'].includes(defaults.turnTransport ?? '')
      && typeof defaults.trickleIce === 'boolean'
      && isNumber(assumptions?.failedProbeMs)
      && isNumber(assumptions?.trickleSavingsMs)
      && isNumber(assumptions?.turnUdpPenaltyMs)
      && isNumber(assumptions?.turnTlsPenaltyMs)
      && isNumber(assumptions?.mediaMbps)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 4
      && candidate.scenarios.every(isScenario),
  );
}

export default function WebRTCIcePathLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<IceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No ICE scenario model was supplied.');
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
        if (!isIceData(payload)) throw new Error('The ICE scenario model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the ICE lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <IceWorkbench data={data} />;
}

function IceWorkbench({ data }: { data: IceData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [candidatePolicy, setCandidatePolicy] = useState<CandidatePolicy>(data.defaults.candidatePolicy);
  const [turnTransport, setTurnTransport] = useState<TurnTransport>(data.defaults.turnTransport);
  const [trickleIce, setTrickleIce] = useState(data.defaults.trickleIce);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const result = useMemo(() => {
    const attempted = new Set<string>();
    let selected: PathId = 'failed';

    if (candidatePolicy === 'all') {
      attempted.add('host');
      if (scenario.hostReachable) {
        selected = 'host';
      } else {
        attempted.add('server-reflexive');
        if (scenario.serverReflexiveReachable && scenario.udpAllowed) {
          selected = 'server-reflexive';
        }
      }
    }

    if (selected === 'failed') {
      attempted.add('relay');
      const canUseUdp = scenario.turnAvailable && scenario.udpAllowed;
      const canUseTls = scenario.turnAvailable && scenario.tcp443Allowed;

      if ((turnTransport === 'udp' || turnTransport === 'auto') && canUseUdp) {
        selected = 'relay-udp';
      } else if ((turnTransport === 'tls' || turnTransport === 'auto') && canUseTls) {
        selected = 'relay-tls';
      }
    }

    const failedAttempts = [...attempted].filter((candidate) => {
      if (candidate === 'host') return selected !== 'host';
      if (candidate === 'server-reflexive') return selected !== 'server-reflexive';
      return selected === 'failed';
    }).length;
    const relayPenalty = selected === 'relay-udp'
      ? data.assumptions.turnUdpPenaltyMs
      : selected === 'relay-tls'
        ? data.assumptions.turnTlsPenaltyMs
        : 0;
    const setupMs = Math.max(
      120,
      scenario.gatheringMs
        + failedAttempts * data.assumptions.failedProbeMs
        + relayPenalty
        - (trickleIce ? data.assumptions.trickleSavingsMs : 0),
    );
    const rttMs = selected === 'failed' ? null : scenario.baseRttMs + relayPenalty;
    const relayMbps = selected === 'relay-udp' || selected === 'relay-tls'
      ? data.assumptions.mediaMbps * 2
      : 0;
    const selectedLabel = selected === 'host'
      ? 'Host candidate'
      : selected === 'server-reflexive'
        ? 'Direct via STUN mapping'
        : selected === 'relay-udp'
          ? 'TURN relay over UDP'
          : selected === 'relay-tls'
            ? 'TURN relay over TLS/TCP 443'
            : 'No viable candidate pair';
    const outcome = selected === 'failed'
      ? 'The session cannot establish media with this network and fallback policy.'
      : selected.startsWith('relay')
        ? 'The session connects, but relay availability, regional placement, and bandwidth now sit on the media path.'
        : 'The session keeps media direct after ICE connectivity checks select the reachable pair.';

    function stageState(stage: 'host' | 'server-reflexive' | 'relay'): StageState {
      if (stage === 'host' && selected === 'host') return 'selected';
      if (stage === 'server-reflexive' && selected === 'server-reflexive') return 'selected';
      if (stage === 'relay' && selected.startsWith('relay')) return 'selected';
      if (attempted.has(stage)) return 'failed';
      if (candidatePolicy === 'relay-only' && stage !== 'relay') return 'skipped';
      return 'not-needed';
    }

    return {
      attemptedCount: attempted.size,
      outcome,
      path: selected,
      relayMbps,
      rttMs,
      selectedLabel,
      setupMs: selected === 'failed' ? setupMs + 1000 : setupMs,
      stages: [
        { id: 'host', label: 'Host', detail: 'Local interface address', state: stageState('host') },
        { id: 'server-reflexive', label: 'Server-reflexive', detail: 'Public mapping learned with STUN', state: stageState('server-reflexive') },
        { id: 'relay', label: 'Relay', detail: 'TURN forwards media when direct checks fail', state: stageState('relay') },
      ],
    } as const;
  }, [candidatePolicy, data, scenario, trickleIce, turnTransport]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setCandidatePolicy(data.defaults.candidatePolicy);
    setTurnTransport(data.defaults.turnTransport);
    setTrickleIce(data.defaults.trickleIce);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="ICE path lab"
          title={data.title}
          description={data.description}
          icon={Network}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Network condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'turn-outage' ? CircleAlert : Network}
                      accent={item.id === 'turn-outage' ? 'rose' : item.id === 'corporate-firewall' ? 'amber' : 'violet'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate policy
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <LabChoice
                    selected={candidatePolicy === 'all'}
                    label="Try direct, then relay"
                    detail="Gather host, server-reflexive, and relay candidates."
                    icon={Network}
                    accent="blue"
                    onClick={() => setCandidatePolicy('all')}
                  />
                  <LabChoice
                    selected={candidatePolicy === 'relay-only'}
                    label="Relay only"
                    detail="Hide peer addresses and require TURN capacity."
                    icon={ShieldCheck}
                    accent="violet"
                    onClick={() => setCandidatePolicy('relay-only')}
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. TURN transport
                </legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice
                    selected={turnTransport === 'auto'}
                    label="UDP, then TLS/TCP 443"
                    detail="Prefer lower transport overhead and retain a restrictive-network fallback."
                    icon={Radio}
                    accent="emerald"
                    onClick={() => setTurnTransport('auto')}
                  />
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <LabChoice
                      selected={turnTransport === 'udp'}
                      label="UDP only"
                      detail="Lower overhead; blocked on some networks."
                      icon={Radio}
                      accent="cyan"
                      onClick={() => setTurnTransport('udp')}
                    />
                    <LabChoice
                      selected={turnTransport === 'tls'}
                      label="TLS/TCP 443 only"
                      detail="More reachable; head-of-line blocking can hurt media."
                      icon={ShieldCheck}
                      accent="amber"
                      onClick={() => setTurnTransport('tls')}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Candidate exchange
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <LabChoice
                    selected={trickleIce}
                    label="Trickle ICE"
                    detail="Send candidates as they are discovered."
                    icon={Gauge}
                    accent="blue"
                    onClick={() => setTrickleIce(true)}
                  />
                  <LabChoice
                    selected={!trickleIce}
                    label="Wait for gathering"
                    detail="Exchange the description after gathering completes."
                    icon={Server}
                    accent="amber"
                    onClick={() => setTrickleIce(false)}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Selected path"
                value={result.selectedLabel}
                detail={`${result.attemptedCount} candidate ${result.attemptedCount === 1 ? 'class' : 'classes'} attempted`}
                icon={Network}
                tone={result.path === 'failed' ? 'rose' : result.path.startsWith('relay') ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Modeled setup"
                value={`${Math.round(result.setupMs)} ms`}
                detail={trickleIce ? 'Candidates are exchanged while gathering' : 'Offer waits for candidate gathering'}
                icon={Gauge}
                tone={result.setupMs > 1800 ? 'rose' : result.setupMs > 900 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Path RTT"
                value={result.rttMs === null ? 'Unavailable' : `${result.rttMs} ms`}
                detail="Scenario baseline plus modeled relay transport penalty"
                icon={Radio}
                tone={result.rttMs === null ? 'rose' : result.rttMs > 120 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Relay-carried media"
                value={`${result.relayMbps.toFixed(1)} Mbps`}
                detail={result.relayMbps > 0 ? 'Two directions for one modeled session' : 'TURN stays off the selected media path'}
                icon={Server}
                tone={result.relayMbps > 0 ? 'amber' : 'neutral'}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Connectivity checks</p>
              <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                {result.stages.map((stage, index) => (
                  <div key={stage.id} className="contents">
                    <CandidateStage {...stage} />
                    {index < result.stages.length - 1 ? (
                      <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 md:rotate-0" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border p-5 ${result.path === 'failed'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
              : result.path.startsWith('relay')
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}>
              <div className="flex items-start gap-3">
                {result.path === 'failed'
                  ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">User-visible outcome</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.outcome}</p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This is a transparent planning model, not a browser timing guarantee. ICE checks can
              run in parallel, candidate priority varies, and real setup time depends on signaling,
              DNS, transport, geography, and network loss.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const stageStyles: Record<StageState, string> = {
  selected: 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  skipped: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  'not-needed': 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300',
};

function CandidateStage({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: StageState;
}) {
  const stateLabel = state === 'selected'
    ? 'Selected'
    : state === 'failed'
      ? 'Check failed'
      : state === 'skipped'
        ? 'Skipped by policy'
        : 'Not needed';

  return (
    <div className={`min-w-0 rounded-md border p-3 ${stageStyles[state]}`}>
      <p className="text-[11px] font-semibold uppercase opacity-70">{stateLabel}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="ICE path lab"
          title="Loading network scenarios"
          description="The lab makes direct and relay fallback behavior inspectable."
          icon={Network}
          accent="violet"
        />
        <LearningLabBody>
          {error ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
              <p className="text-sm font-semibold">The scenario model could not load.</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold">
                Retry
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading ICE scenarios...</p>
          )}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
