'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Layers3,
  Network,
  RadioTower,
  Rows3,
  Server,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Range = {
  min: number;
  max: number;
  step: number;
};

type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  objectCount: number;
  criticalCount: number;
};

type Protocol = {
  id: 'h1' | 'h2' | 'h3';
  label: string;
  detail: string;
  transport: string;
  fieldCompression: string;
  maxParallel: number;
  lossScope: 'connection' | 'stream';
};

type LossConcurrencyModel = {
  kind: 'http-loss-concurrency';
  blockId: string;
  title: string;
  description: string;
  defaults: {
    protocolId: Protocol['id'];
    profileId: string;
    concurrency: number;
    rttMs: number;
    lossEvents: number;
  };
  ranges: {
    concurrency: Range;
    rttMs: Range;
    lossEvents: Range;
  };
  profiles: WorkloadProfile[];
  protocols: Protocol[];
};

type StreamState = 'flowing' | 'lost' | 'collateral' | 'queued';

const BLOCK_ID = 'technology/http2-http3-loss-concurrency-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLossConcurrencyModel(value: unknown): value is LossConcurrencyModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'http-loss-concurrency'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && isRecord(value.ranges)
      && Array.isArray(value.profiles)
      && value.profiles.length >= 3
      && Array.isArray(value.protocols)
      && value.protocols.length === 3,
  );
}

export default function HttpLossConcurrencyLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<LossConcurrencyModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No loss and concurrency model was supplied.');
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
        if (!isLossConcurrencyModel(payload)) {
          throw new Error('The loss and concurrency model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the protocol lab.');
      });

    return () => controller.abort();
  }, [dataFile, loadAttempt]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Loss scope lab"
            title="Trace multiplexing under packet loss"
            description="Loading protocol, workload, concurrency, and recovery assumptions."
            icon={Network}
            accent="cyan"
            onReset={error ? () => setLoadAttempt((attempt) => attempt + 1) : undefined}
          />
          <div className="flex min-h-48 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Loading loss trace...'}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <LossConcurrencyWorkbench model={model} />;
}

function LossConcurrencyWorkbench({ model }: { model: LossConcurrencyModel }) {
  const [protocolId, setProtocolId] = useState(model.defaults.protocolId);
  const [profileId, setProfileId] = useState(model.defaults.profileId);
  const [concurrency, setConcurrency] = useState(model.defaults.concurrency);
  const [rttMs, setRttMs] = useState(model.defaults.rttMs);
  const [lossEvents, setLossEvents] = useState(model.defaults.lossEvents);

  const protocol =
    model.protocols.find((item) => item.id === protocolId) ?? model.protocols[0];
  const profile =
    model.profiles.find((item) => item.id === profileId) ?? model.profiles[0];

  const result = useMemo(() => {
    const admitted = Math.min(profile.objectCount, concurrency, protocol.maxParallel);
    const queued = Math.max(0, profile.objectCount - admitted);
    const admissionWaves = Math.ceil(
      profile.objectCount / Math.max(1, Math.min(concurrency, protocol.maxParallel)),
    );
    const directLosses = Math.min(lossEvents, admitted);
    const collateral =
      protocol.id === 'h2' && lossEvents > 0
        ? Math.max(0, admitted - directLosses)
        : 0;
    const directlyBlocked =
      protocol.id === 'h2' && lossEvents > 0
        ? admitted
        : directLosses;
    const unrelatedBlocked = collateral;
    const recoveryPauseMs = lossEvents * rttMs;
    const criticalAtRisk = Math.min(
      profile.criticalCount,
      protocol.id === 'h2' ? directlyBlocked : directLosses,
    );

    let headline = 'All admitted responses can continue in this trace.';
    let explanation =
      'No transport loss was injected. Queueing still depends on the selected concurrency and protocol limit.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (lossEvents > 0 && protocol.id === 'h2') {
      headline = 'One TCP gap stalls every admitted HTTP/2 stream.';
      explanation =
        'HTTP/2 streams are independent at the frame layer, but the receiver cannot deliver later TCP bytes until the missing byte range is recovered.';
      tone = 'rose';
    } else if (lossEvents > 0 && protocol.id === 'h3') {
      headline = 'Loss recovery blocks the affected QUIC streams, not every request stream.';
      explanation =
        'Unrelated request streams can be delivered independently. Connection-wide congestion control can still reduce sending rate, and loss on control or QPACK streams has separate effects.';
      tone = 'emerald';
    } else if (lossEvents > 0) {
      headline = 'The affected HTTP/1.1 connections pause while other pool members continue.';
      explanation =
        'A connection pool isolates this loss from other TCP connections, but the six-connection cap creates more queued request waves.';
      tone = 'amber';
    }

    return {
      admitted,
      queued,
      admissionWaves,
      directLosses,
      collateral,
      directlyBlocked,
      unrelatedBlocked,
      recoveryPauseMs,
      criticalAtRisk,
      headline,
      explanation,
      tone,
    };
  }, [concurrency, lossEvents, profile, protocol, rttMs]);

  const displayedStreams = Array.from(
    { length: Math.min(profile.objectCount, 16) },
    (_, index): StreamState => {
      if (index >= result.admitted) return 'queued';
      if (index < result.directLosses) return 'lost';
      if (index < result.directlyBlocked) return 'collateral';
      return 'flowing';
    },
  );

  function reset() {
    setProtocolId(model.defaults.protocolId);
    setProfileId(model.defaults.profileId);
    setConcurrency(model.defaults.concurrency);
    setRttMs(model.defaults.rttMs);
    setLossEvents(model.defaults.lossEvents);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Loss and multiplexing lab"
          title={model.title}
          description={model.description}
          icon={Network}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Protocol expression
                </legend>
                <div className="mt-3 space-y-2">
                  {model.protocols.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === protocol.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'h1' ? Server : item.id === 'h2' ? Layers3 : RadioTower}
                      accent={item.id === 'h3' ? 'emerald' : item.id === 'h2' ? 'blue' : 'amber'}
                      onClick={() => setProtocolId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {model.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Rows3}
                      accent="violet"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Requested concurrency"
                value={concurrency}
                output={`${concurrency} requests`}
                min={model.ranges.concurrency.min}
                max={model.ranges.concurrency.max}
                step={model.ranges.concurrency.step}
                lowLabel="Serial"
                highLabel="Highly concurrent"
                accent="blue"
                onChange={setConcurrency}
              />
              <LabRange
                label="Round-trip time"
                value={rttMs}
                output={`${rttMs} ms`}
                min={model.ranges.rttMs.min}
                max={model.ranges.rttMs.max}
                step={model.ranges.rttMs.step}
                lowLabel="Near edge"
                highLabel="Long path"
                accent="cyan"
                onChange={setRttMs}
              />
              <LabRange
                label="Loss recovery events"
                value={lossEvents}
                output={String(lossEvents)}
                min={model.ranges.lossEvents.min}
                max={model.ranges.lossEvents.max}
                step={model.ranges.lossEvents.step}
                lowLabel="No loss"
                highLabel="Repeated recovery"
                accent="rose"
                onChange={setLossEvents}
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
                  <p className="text-xs font-semibold uppercase opacity-75">Observed consequence</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.headline}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Admitted now"
                value={`${result.admitted}/${profile.objectCount}`}
                detail={`${result.queued} requests wait for a slot`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Admission waves"
                value={String(result.admissionWaves)}
                detail={`Limit: ${Math.min(concurrency, protocol.maxParallel)} parallel`}
                icon={Layers3}
                tone="violet"
              />
              <LabMetric
                label="Directly blocked"
                value={String(result.directlyBlocked)}
                detail={`${result.unrelatedBlocked} are collateral to another stream's loss`}
                icon={ArrowDown}
                tone={result.directlyBlocked > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Recovery pause"
                value={`${result.recoveryPauseMs} ms`}
                detail="Illustrative RTT-sized pause for affected streams"
                icon={Clock3}
                tone={result.recoveryPauseMs > 0 ? 'amber' : 'emerald'}
              />
            </div>

            <TransportTrace
              protocol={protocol}
              states={displayedStreams}
              hiddenCount={Math.max(0, profile.objectCount - displayedStreams.length)}
              criticalAtRisk={result.criticalAtRisk}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Fact label="Transport" value={protocol.transport} icon={Network} />
              <Fact label="Field compression" value={protocol.fieldCompression} icon={Gauge} />
              <Fact
                label="Loss isolation"
                value={protocol.lossScope === 'stream' ? 'Request stream' : 'TCP connection'}
                icon={RadioTower}
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TransportTrace({
  protocol,
  states,
  hiddenCount,
  criticalAtRisk,
}: {
  protocol: Protocol;
  states: StreamState[];
  hiddenCount: number;
  criticalAtRisk: number;
}) {
  const stateClasses: Record<StreamState, string> = {
    flowing:
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    lost:
      'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100',
    collateral:
      'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
    queued:
      'border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400',
  };
  const stateLabels: Record<StreamState, string> = {
    flowing: 'flows',
    lost: 'lost bytes',
    collateral: 'waits on TCP',
    queued: 'queued',
  };

  return (
    <section
      aria-label={`${protocol.label} request trace`}
      className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Request trace
          </p>
          <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
            {protocol.label} over {protocol.transport}
          </h4>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {criticalAtRisk} critical response{criticalAtRisk === 1 ? '' : 's'} directly delayed
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {states.map((state, index) => (
          <div
            key={`${state}-${index}`}
            className={`min-h-16 rounded-md border p-2 ${stateClasses[state]}`}
          >
            <span className="block text-xs font-semibold">Request {index + 1}</span>
            <span className="mt-1 block text-[11px] uppercase opacity-75">{stateLabels[state]}</span>
          </div>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          + {hiddenCount} additional request{hiddenCount === 1 ? '' : 's'} follow the same admission rule.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
        <Legend swatch="bg-rose-400" label="Carries lost bytes" />
        <Legend swatch="bg-amber-400" label="Blocked by another stream's TCP gap" />
        <Legend swatch="bg-emerald-400" label="Can progress" />
        <Legend swatch="bg-neutral-300 dark:bg-neutral-700" label="Waiting for admission" />
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Network;
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}
