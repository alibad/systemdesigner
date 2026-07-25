'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Cable,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Gauge,
  LoaderCircle,
  Network,
  Radio,
  RotateCcw,
  ShieldAlert,
  Timer,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/neural-interface-architecture-signal-path-budget-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/neural-interface-architecture/data/signal-path-budget-model.json';

type NumericBound = {
  min: number;
  max: number;
  step: number;
};

type SignalProfile = {
  id: string;
  label: string;
  detail: string;
  channels: number;
  sampleRateHz: number;
  bitsPerSample: number;
};

type Transport = {
  id: string;
  label: string;
  detail: string;
  effectiveCapacityMbps: number;
  baseDelayMs: number;
  jitterAllowanceMs: number;
};

type SignalPathModel = {
  kind: 'neural-signal-path-budget';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    profileId: string;
    transportId: string;
    windowMs: number;
    retainedPayloadPercent: number;
    processingMs: number;
    deadlineMs: number;
  };
  bounds: {
    windowMs: NumericBound;
    retainedPayloadPercent: NumericBound;
    processingMs: NumericBound;
    deadlineMs: NumericBound;
  };
  queueAllowanceMs: number;
  protocolOverheadPercent: number;
  profiles: SignalProfile[];
  transports: Transport[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isBound(value: unknown): value is NumericBound {
  return Boolean(
    isRecord(value)
      && typeof value.min === 'number'
      && typeof value.max === 'number'
      && typeof value.step === 'number'
      && value.min < value.max
      && value.step > 0,
  );
}

function isSignalPathModel(value: unknown): value is SignalPathModel {
  if (
    !isRecord(value)
    || value.kind !== 'neural-signal-path-budget'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.profileId !== 'string'
    || typeof value.defaults.transportId !== 'string'
    || typeof value.defaults.windowMs !== 'number'
    || typeof value.defaults.retainedPayloadPercent !== 'number'
    || typeof value.defaults.processingMs !== 'number'
    || typeof value.defaults.deadlineMs !== 'number'
    || !isRecord(value.bounds)
    || !isBound(value.bounds.windowMs)
    || !isBound(value.bounds.retainedPayloadPercent)
    || !isBound(value.bounds.processingMs)
    || !isBound(value.bounds.deadlineMs)
    || typeof value.queueAllowanceMs !== 'number'
    || value.queueAllowanceMs < 0
    || typeof value.protocolOverheadPercent !== 'number'
    || value.protocolOverheadPercent < 0
    || !Array.isArray(value.profiles)
    || value.profiles.length < 3
    || !Array.isArray(value.transports)
    || value.transports.length < 3
  ) {
    return false;
  }

  const profilesValid = value.profiles.every((profile) => (
    isRecord(profile)
    && typeof profile.id === 'string'
    && typeof profile.label === 'string'
    && typeof profile.detail === 'string'
    && typeof profile.channels === 'number'
    && profile.channels > 0
    && typeof profile.sampleRateHz === 'number'
    && profile.sampleRateHz > 0
    && typeof profile.bitsPerSample === 'number'
    && profile.bitsPerSample > 0
  ));
  const transportsValid = value.transports.every((transport) => (
    isRecord(transport)
    && typeof transport.id === 'string'
    && typeof transport.label === 'string'
    && typeof transport.detail === 'string'
    && typeof transport.effectiveCapacityMbps === 'number'
    && transport.effectiveCapacityMbps > 0
    && typeof transport.baseDelayMs === 'number'
    && transport.baseDelayMs >= 0
    && typeof transport.jitterAllowanceMs === 'number'
    && transport.jitterAllowanceMs >= 0
  ));

  if (!profilesValid || !transportsValid) return false;

  const defaults = value.defaults as SignalPathModel['defaults'];
  return (
    value.profiles.some((profile) => profile.id === defaults.profileId)
    && value.transports.some((transport) => transport.id === defaults.transportId)
  );
}

function profileIcon(id: string) {
  if (id === 'surface-field') return Waves;
  if (id === 'cortical-field') return Activity;
  return Database;
}

function transportIcon(id: string) {
  if (id === 'low-power-radio') return Radio;
  if (id === 'edge-bridge') return Network;
  return Cable;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          {error} Retry
        </button>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
          Loading signal-path fixture...
        </>
      )}
    </div>
  );
}

export default function NeuralInterfaceSignalPathBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SignalPathModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSignalPathModel(payload)) {
          throw new Error('The signal-path fixture is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the signal-path fixture.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Signal-path budget lab"
            title="Budget samples before selecting hardware"
            description="Loading the illustrative signal and transport contract."
            icon={Activity}
            accent="cyan"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <SignalPathLab model={model} />
    </div>
  );
}

function SignalPathLab({ model }: { model: SignalPathModel }) {
  const [profileId, setProfileId] = useState(model.defaults.profileId);
  const [transportId, setTransportId] = useState(model.defaults.transportId);
  const [windowMs, setWindowMs] = useState(model.defaults.windowMs);
  const [retainedPayloadPercent, setRetainedPayloadPercent] = useState(
    model.defaults.retainedPayloadPercent,
  );
  const [processingMs, setProcessingMs] = useState(model.defaults.processingMs);
  const [deadlineMs, setDeadlineMs] = useState(model.defaults.deadlineMs);

  const profile =
    model.profiles.find((candidate) => candidate.id === profileId)
    ?? model.profiles[0];
  const transport =
    model.transports.find((candidate) => candidate.id === transportId)
    ?? model.transports[0];

  const view = useMemo(() => {
    const rawBitsPerSecond =
      profile.channels * profile.sampleRateHz * profile.bitsPerSample;
    const rawMbps = rawBitsPerSecond / 1_000_000;
    const retainedFraction = retainedPayloadPercent / 100;
    const overheadMultiplier = 1 + model.protocolOverheadPercent / 100;
    const transmittedMbps = rawMbps * retainedFraction * overheadMultiplier;
    const frameBytes =
      rawBitsPerSecond
      * (windowMs / 1000)
      * retainedFraction
      * overheadMultiplier
      / 8;
    const serializationMs =
      frameBytes * 8 / (transport.effectiveCapacityMbps * 1_000_000) * 1000;
    const transportMs =
      transport.baseDelayMs + transport.jitterAllowanceMs + serializationMs;
    const totalLatencyMs =
      windowMs + model.queueAllowanceMs + processingMs + transportMs;
    const linkUtilizationPercent =
      transmittedMbps / transport.effectiveCapacityMbps * 100;
    const linkOverloaded = linkUtilizationPercent >= 100;
    const linkPressured =
      linkUtilizationPercent >= 80 && !linkOverloaded;
    const deadlineClears = totalLatencyMs <= deadlineMs;
    const stages = [
      {
        label: 'Frame',
        value: windowMs,
        detail: 'Wait for the sample window.',
        tone: 'bg-blue-500 dark:bg-blue-400',
      },
      {
        label: 'Queue',
        value: model.queueAllowanceMs,
        detail: 'Bounded scheduling allowance.',
        tone: 'bg-amber-500 dark:bg-amber-400',
      },
      {
        label: 'Process',
        value: processingMs,
        detail: 'Condition, featurize, infer.',
        tone: 'bg-violet-500 dark:bg-violet-400',
      },
      {
        label: 'Transport',
        value: transportMs,
        detail: 'Serialize, move, absorb jitter.',
        tone: 'bg-cyan-500 dark:bg-cyan-400',
      },
    ];
    const status = linkOverloaded
      ? 'Sustained path overload'
      : !deadlineClears
        ? 'Decision deadline missed'
        : linkPressured
          ? 'Feasible with little link headroom'
          : 'Budget clears with headroom';
    const verdict = linkOverloaded
      ? 'Offered payload exceeds effective capacity, so queue age can grow without bound. Reduce the retained stream, move feature extraction closer to acquisition, or select a validated higher-capacity path.'
      : !deadlineClears
        ? 'The link can carry the stream, but frame accumulation, processing, and transport exceed the declared deadline. Reduce a named term instead of optimizing only model inference.'
        : linkPressured
          ? 'The current fixture clears, but burst and protocol variation have little room. Measure sustained and tail behavior before accepting this link.'
          : 'The illustrative path clears both the utilization and decision-age gates. Validate every input against the intended signal, device, and task before implementation.';

    return {
      rawMbps,
      transmittedMbps,
      frameBytes,
      serializationMs,
      transportMs,
      totalLatencyMs,
      linkUtilizationPercent,
      linkOverloaded,
      linkPressured,
      deadlineClears,
      stages,
      status,
      verdict,
    };
  }, [
    deadlineMs,
    model.protocolOverheadPercent,
    model.queueAllowanceMs,
    processingMs,
    profile,
    retainedPayloadPercent,
    transport,
    windowMs,
  ]);

  function reset() {
    setProfileId(model.defaults.profileId);
    setTransportId(model.defaults.transportId);
    setWindowMs(model.defaults.windowMs);
    setRetainedPayloadPercent(model.defaults.retainedPayloadPercent);
    setProcessingMs(model.defaults.processingMs);
    setDeadlineMs(model.defaults.deadlineMs);
  }

  const statusTone =
    view.linkOverloaded || !view.deadlineClears
      ? 'rose'
      : view.linkPressured
        ? 'amber'
        : 'emerald';
  const StatusIcon =
    view.linkOverloaded || !view.deadlineClears
      ? ShieldAlert
      : CheckCircle2;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Signal-path budget lab"
        title={model.title}
        description={model.description}
        icon={Activity}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Signal fixture
              </legend>
              <div className="mt-3 grid gap-2">
                {model.profiles.map((item) => {
                  const Icon = profileIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent="blue"
                      onClick={() => setProfileId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Transport fixture
              </legend>
              <div className="mt-3 grid gap-2">
                {model.transports.map((item) => {
                  const Icon = transportIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === transport.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent="cyan"
                      onClick={() => setTransportId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <LabRange
                label="Frame window"
                value={windowMs}
                output={`${windowMs} ms`}
                min={model.bounds.windowMs.min}
                max={model.bounds.windowMs.max}
                step={model.bounds.windowMs.step}
                lowLabel="Less context"
                highLabel="More wait"
                accent="blue"
                onChange={setWindowMs}
              />
              <LabRange
                label="Payload retained"
                value={retainedPayloadPercent}
                output={`${retainedPayloadPercent}%`}
                min={model.bounds.retainedPayloadPercent.min}
                max={model.bounds.retainedPayloadPercent.max}
                step={model.bounds.retainedPayloadPercent.step}
                lowLabel="Edge features"
                highLabel="Near raw"
                accent="cyan"
                onChange={setRetainedPayloadPercent}
              />
              <LabRange
                label="Processing allowance"
                value={processingMs}
                output={`${processingMs} ms`}
                min={model.bounds.processingMs.min}
                max={model.bounds.processingMs.max}
                step={model.bounds.processingMs.step}
                lowLabel="Small pipeline"
                highLabel="Heavy pipeline"
                accent="violet"
                onChange={setProcessingMs}
              />
              <LabRange
                label="Decision deadline"
                value={deadlineMs}
                output={`${deadlineMs} ms`}
                min={model.bounds.deadlineMs.min}
                max={model.bounds.deadlineMs.max}
                step={model.bounds.deadlineMs.step}
                lowLabel="Tight"
                highLabel="Relaxed"
                accent="emerald"
                onChange={setDeadlineMs}
              />
            </div>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Raw stream"
              value={`${view.rawMbps.toFixed(2)} Mb/s`}
              detail={`${profile.channels} channels x ${profile.sampleRateHz.toLocaleString()} Hz x ${profile.bitsPerSample} bits`}
              icon={Database}
              tone="blue"
            />
            <LabMetric
              label="Transmitted"
              value={`${view.transmittedMbps.toFixed(2)} Mb/s`}
              detail={`${retainedPayloadPercent}% retained plus ${model.protocolOverheadPercent}% overhead`}
              icon={Network}
              tone="cyan"
            />
            <LabMetric
              label="Link utilization"
              value={`${view.linkUtilizationPercent.toFixed(1)}%`}
              detail={`${transport.effectiveCapacityMbps.toLocaleString()} Mb/s effective capacity`}
              icon={Gauge}
              tone={
                view.linkOverloaded
                  ? 'rose'
                  : view.linkPressured
                    ? 'amber'
                    : 'emerald'
              }
            />
            <LabMetric
              label="Decision age"
              value={`${view.totalLatencyMs.toFixed(1)} ms`}
              detail={`${deadlineMs} ms teaching deadline`}
              icon={Clock3}
              tone={view.deadlineClears ? 'emerald' : 'rose'}
            />
          </div>

          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  End-to-end latency equation
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Every stage consumes the same deadline
                </h4>
              </div>
              <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {view.totalLatencyMs.toFixed(1)} / {deadlineMs} ms
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="flex h-3 bg-neutral-100 dark:bg-neutral-900">
                {view.stages.map((stage) => (
                  <span
                    key={stage.label}
                    className={stage.tone}
                    style={{
                      width: `${Math.max(
                        4,
                        stage.value / view.totalLatencyMs * 100,
                      )}%`,
                    }}
                  />
                ))}
              </div>
              <div className="grid gap-px bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4 dark:bg-neutral-800">
                {view.stages.map((stage) => (
                  <div
                    key={stage.label}
                    className="min-w-0 bg-white p-3 dark:bg-neutral-950"
                  >
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      {stage.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {stage.value.toFixed(1)} ms
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {stage.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Cpu aria-hidden="true" className="h-4 w-4" />
                Frame payload
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {(view.frameBytes / 1024).toFixed(1)} KiB
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                Retained frame size after the illustrative reduction and protocol overhead.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Timer aria-hidden="true" className="h-4 w-4" />
                Serialization
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {view.serializationMs.toFixed(2)} ms
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                Time to place one retained frame on the effective link.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Network aria-hidden="true" className="h-4 w-4" />
                Transport allowance
              </div>
              <p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {view.transportMs.toFixed(2)} ms
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                Base delay, jitter allowance, and serialization for this fixture.
              </p>
            </div>
          </section>

          <section
            className={`mt-6 rounded-md border p-5 ${
              statusTone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                : statusTone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Modeled outcome
                </p>
                <h4 className="mt-1 text-lg font-semibold">{view.status}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{view.verdict}</p>
              </div>
            </div>
          </section>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
