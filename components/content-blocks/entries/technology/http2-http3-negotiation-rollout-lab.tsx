'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Gauge,
  Globe2,
  KeyRound,
  Network,
  RadioTower,
  RefreshCcw,
  Route,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Discovery = {
  id: 'none' | 'alt-svc' | 'https-record';
  label: string;
  detail: string;
  firstRoute: string;
  canAttemptH3: boolean;
};

type NetworkCondition = {
  id: 'udp-open' | 'udp-blocked' | 'wifi-to-cellular';
  label: string;
  detail: string;
  udpReachable: boolean;
  addressChanges: boolean;
};

type RequestContract = {
  id: string;
  label: string;
  detail: string;
  method: string;
  replaySafe: boolean;
};

type EarlyDataPolicy = {
  id: 'off' | 'safe-only' | 'all';
  label: string;
  detail: string;
  usesEarlyData: boolean;
  safeOnly: boolean;
};

type NegotiationRolloutModel = {
  kind: 'http3-negotiation-rollout';
  blockId: string;
  title: string;
  description: string;
  defaults: {
    discoveryId: Discovery['id'];
    networkId: NetworkCondition['id'];
    requestId: string;
    earlyDataId: EarlyDataPolicy['id'];
    fallbackEnabled: boolean;
    rolloutPercent: number;
  };
  rolloutRange: {
    min: number;
    max: number;
    step: number;
  };
  discoveries: Discovery[];
  networks: NetworkCondition[];
  requests: RequestContract[];
  earlyDataPolicies: EarlyDataPolicy[];
};

type RouteState = 'complete' | 'active' | 'warning' | 'idle';

const BLOCK_ID = 'technology/http2-http3-negotiation-rollout-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNegotiationRolloutModel(value: unknown): value is NegotiationRolloutModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'http3-negotiation-rollout'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && isRecord(value.rolloutRange)
      && Array.isArray(value.discoveries)
      && value.discoveries.length === 3
      && Array.isArray(value.networks)
      && value.networks.length === 3
      && Array.isArray(value.requests)
      && value.requests.length >= 3
      && Array.isArray(value.earlyDataPolicies)
      && value.earlyDataPolicies.length === 3,
  );
}

export default function Http3NegotiationRolloutLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<NegotiationRolloutModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No negotiation and rollout model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isNegotiationRolloutModel(payload)) {
          throw new Error('The negotiation and rollout model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the rollout lab.');
      });

    return () => controller.abort();
  }, [dataFile, loadAttempt]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Negotiation and rollout lab"
            title="Build an HTTP/3 path with a tested fallback"
            description="Loading discovery, network, request, early-data, and rollout contracts."
            icon={Route}
            accent="violet"
            onReset={error ? () => setLoadAttempt((attempt) => attempt + 1) : undefined}
          />
          <div className="flex min-h-48 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Loading rollout path...'}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <NegotiationRolloutWorkbench model={model} />;
}

function NegotiationRolloutWorkbench({ model }: { model: NegotiationRolloutModel }) {
  const [discoveryId, setDiscoveryId] = useState(model.defaults.discoveryId);
  const [networkId, setNetworkId] = useState(model.defaults.networkId);
  const [requestId, setRequestId] = useState(model.defaults.requestId);
  const [earlyDataId, setEarlyDataId] = useState(model.defaults.earlyDataId);
  const [fallbackEnabled, setFallbackEnabled] = useState(model.defaults.fallbackEnabled);
  const [rolloutPercent, setRolloutPercent] = useState(model.defaults.rolloutPercent);

  const discovery =
    model.discoveries.find((item) => item.id === discoveryId) ?? model.discoveries[0];
  const network =
    model.networks.find((item) => item.id === networkId) ?? model.networks[0];
  const request =
    model.requests.find((item) => item.id === requestId) ?? model.requests[0];
  const earlyData =
    model.earlyDataPolicies.find((item) => item.id === earlyDataId)
    ?? model.earlyDataPolicies[0];

  const result = useMemo(() => {
    const h3Attempted = discovery.canAttemptH3;
    const h3Connected = h3Attempted && network.udpReachable;
    const fallbackUsed = h3Attempted && !network.udpReachable && fallbackEnabled;
    const available = !h3Attempted || h3Connected || fallbackUsed;
    const protocol = h3Connected ? 'h3' : available ? 'h2' : 'unavailable';
    const earlyDataSent =
      h3Connected
      && earlyData.usesEarlyData
      && (!earlyData.safeOnly || request.replaySafe);
    const replayRisk =
      h3Connected
      && earlyData.usesEarlyData
      && !earlyData.safeOnly
      && !request.replaySafe;
    const migrationContinues = network.addressChanges && h3Connected;

    let headline = 'HTTP/3 is available with HTTP/2 kept as the fallback.';
    let explanation =
      'The advertisement reaches an eligible client, UDP works, and the rollout preserves an independent TCP path.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (replayRisk) {
      headline = 'The protocol works, but the early-data policy can repeat a business effect.';
      explanation =
        '0-RTT data can be replayed. Restrict early data to replay-safe operations or add a durable application idempotency boundary.';
      tone = 'rose';
    } else if (!available) {
      headline = 'The HTTP/3 attempt fails and no fallback can serve the request.';
      explanation =
        'UDP is unreachable on this path. Keeping HTTP/2 on TCP is the compatibility contract, not an optional cleanup task.';
      tone = 'rose';
    } else if (fallbackUsed) {
      headline = 'UDP fails, so the client returns to HTTP/2.';
      explanation =
        'The user stays served, while fallback rate and QUIC handshake failures identify a network or edge compatibility problem.';
      tone = 'amber';
    } else if (!h3Attempted) {
      headline = 'This client remains on HTTP/2 because HTTP/3 was never advertised.';
      explanation =
        'ALPN selects h2 on the TLS/TCP connection. Enable Alt-Svc or a supported HTTPS record for an h3 route to become discoverable.';
      tone = 'amber';
    } else if (migrationContinues) {
      headline = 'QUIC validates the new path without changing the HTTP origin.';
      explanation =
        'Connection IDs decouple the QUIC connection from one address tuple. The peer still validates the new path, and the server implementation must route migrated packets correctly.';
    }

    const migration =
      network.addressChanges
        ? migrationContinues
          ? 'Path validation'
          : 'Reconnect'
        : 'No change';
    const firstRequest =
      discovery.id === 'alt-svc'
        ? 'h2 first'
        : discovery.id === 'https-record' && h3Connected
          ? 'h3 eligible'
          : 'h2';
    const replayPosture =
      replayRisk
        ? 'Unsafe'
        : earlyDataSent
          ? 'Replay-safe'
          : earlyData.usesEarlyData
            ? 'Withheld'
            : 'Disabled';

    return {
      h3Attempted,
      h3Connected,
      fallbackUsed,
      available,
      protocol,
      earlyDataSent,
      replayRisk,
      migrationContinues,
      migration,
      firstRequest,
      replayPosture,
      headline,
      explanation,
      tone,
      affectedPercent: available && !replayRisk ? 0 : rolloutPercent,
    };
  }, [discovery, earlyData, fallbackEnabled, network, request.replaySafe, rolloutPercent]);

  const route = buildRoute(discovery, network, result, fallbackEnabled);

  function reset() {
    setDiscoveryId(model.defaults.discoveryId);
    setNetworkId(model.defaults.networkId);
    setRequestId(model.defaults.requestId);
    setEarlyDataId(model.defaults.earlyDataId);
    setFallbackEnabled(model.defaults.fallbackEnabled);
    setRolloutPercent(model.defaults.rolloutPercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Negotiation and rollout lab"
          title={model.title}
          description={model.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. HTTP/3 discovery
                </legend>
                <div className="mt-3 space-y-2">
                  {model.discoveries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === discovery.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'https-record' ? Globe2 : item.id === 'alt-svc' ? CloudCog : Network}
                      accent="violet"
                      onClick={() => setDiscoveryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Client network
                </legend>
                <div className="mt-3 space-y-2">
                  {model.networks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === network.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.addressChanges ? Smartphone : RadioTower}
                      accent={item.udpReachable ? 'cyan' : 'rose'}
                      onClick={() => setNetworkId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <PolicyToggle
                checked={fallbackEnabled}
                title="Keep HTTP/2 fallback"
                detail="Serve the origin over TCP when QUIC discovery, handshake, or network reachability fails."
                onChange={setFallbackEnabled}
              />

              <LabRange
                label="HTTP/3 rollout cohort"
                value={rolloutPercent}
                output={`${rolloutPercent}%`}
                min={model.rolloutRange.min}
                max={model.rolloutRange.max}
                step={model.rolloutRange.step}
                lowLabel="Canary"
                highLabel="All eligible traffic"
                accent="violet"
                onChange={setRolloutPercent}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                result.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'rose' ? (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Rollout consequence</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.headline}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Negotiated result"
                value={result.protocol}
                detail={result.fallbackUsed ? 'QUIC failed; TCP fallback served' : discovery.firstRoute}
                icon={Network}
                tone={result.available ? result.protocol === 'h3' ? 'emerald' : 'blue' : 'rose'}
              />
              <LabMetric
                label="First request"
                value={result.firstRequest}
                detail="Discovery changes which route is eligible before origin work starts"
                icon={Route}
                tone="violet"
              />
              <LabMetric
                label="Address change"
                value={result.migration}
                detail={network.addressChanges ? 'Connection continuity under a new client address' : 'No migration injected'}
                icon={Smartphone}
                tone={result.migrationContinues ? 'emerald' : network.addressChanges ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Cohort at risk"
                value={`${result.affectedPercent}%`}
                detail="Unavailable or replay-unsafe share of the selected rollout"
                icon={Gauge}
                tone={result.affectedPercent > 0 ? 'rose' : 'emerald'}
              />
            </div>

            <NegotiationPath route={route} />

            <div className="grid gap-5 lg:grid-cols-2">
              <fieldset className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <legend className="px-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Request contract
                </legend>
                <div className="mt-2 space-y-2">
                  {model.requests.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === request.id}
                      label={`${item.method} · ${item.label}`}
                      detail={item.detail}
                      icon={item.replaySafe ? ShieldCheck : CircleAlert}
                      accent={item.replaySafe ? 'emerald' : 'rose'}
                      onClick={() => setRequestId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <legend className="px-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Returning-client 0-RTT policy
                </legend>
                <div className="mt-2 space-y-2">
                  {model.earlyDataPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === earlyData.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'off' ? RefreshCcw : KeyRound}
                      accent={item.id === 'all' ? 'rose' : item.id === 'safe-only' ? 'emerald' : 'blue'}
                      onClick={() => setEarlyDataId(item.id)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Outcome: <strong className="text-neutral-800 dark:text-neutral-200">{result.replayPosture}</strong>.
                  Early data requires session resumption; this control tests policy once a returning client is eligible.
                </p>
              </fieldset>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function buildRoute(
  discovery: Discovery,
  network: NetworkCondition,
  result: {
    h3Attempted: boolean;
    h3Connected: boolean;
    fallbackUsed: boolean;
    available: boolean;
  },
  fallbackEnabled: boolean,
) {
  const discoveryState: RouteState = discovery.canAttemptH3 ? 'complete' : 'active';
  const quicState: RouteState =
    !result.h3Attempted ? 'idle' : result.h3Connected ? 'complete' : 'warning';
  const fallbackState: RouteState =
    result.fallbackUsed ? 'complete' : !network.udpReachable && !fallbackEnabled ? 'warning' : 'idle';
  const serveState: RouteState = result.available ? 'active' : 'warning';

  return [
    {
      label: 'Discover',
      value: discovery.label,
      detail: discovery.firstRoute,
      state: discoveryState,
    },
    {
      label: 'Attempt QUIC',
      value: result.h3Attempted ? network.label : 'No h3 route',
      detail: result.h3Connected ? 'TLS 1.3 and h3 established' : result.h3Attempted ? 'QUIC path did not establish' : 'Client remains on TLS/TCP',
      state: quicState,
    },
    {
      label: 'Fallback',
      value: fallbackEnabled ? 'h2 retained' : 'disabled',
      detail: result.fallbackUsed ? 'TCP carries the request' : fallbackEnabled ? 'Ready if QUIC fails' : 'No compatibility route',
      state: fallbackState,
    },
    {
      label: 'Serve',
      value: result.available ? result.h3Connected ? 'HTTP/3' : 'HTTP/2' : 'Unavailable',
      detail: result.available ? 'Origin semantics stay unchanged' : 'Selected cohort cannot reach the origin',
      state: serveState,
    },
  ];
}

function NegotiationPath({
  route,
}: {
  route: Array<{ label: string; value: string; detail: string; state: RouteState }>;
}) {
  return (
    <section
      aria-label="Negotiated request route"
      className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Negotiated route
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {route.map((step, index) => (
          <div key={step.label} className="flex min-w-0 items-stretch gap-3 lg:block">
            <PathStep {...step} />
            {index < route.length - 1 ? (
              <ArrowRight
                aria-hidden="true"
                className="mt-8 h-4 w-4 shrink-0 rotate-90 text-neutral-400 lg:mx-auto lg:mt-3 lg:rotate-0"
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PathStep({
  label,
  value,
  detail,
  state,
}: {
  label: string;
  value: string;
  detail: string;
  state: RouteState;
}) {
  const styles: Record<RouteState, string> = {
    complete:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    active:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
    warning:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    idle:
      'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',
  };

  return (
    <div className={`min-h-32 min-w-0 flex-1 rounded-md border p-3 ${styles[state]}`}>
      <p className="text-[11px] font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function PolicyToggle({
  checked,
  title,
  detail,
  onChange,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`w-full rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        checked
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${
            checked ? 'justify-end bg-emerald-600' : 'justify-start bg-rose-600'
          }`}
        >
          <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
        </span>
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
      </span>
    </button>
  );
}
