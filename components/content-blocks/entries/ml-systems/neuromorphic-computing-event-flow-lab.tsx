'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Gauge,
  Network,
  Radio,
  Sparkles,
  TriangleAlert,
  Zap,
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

const BLOCK_ID = 'ml-systems/neuromorphic-computing-event-flow-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/neuromorphic-computing/data/event-flow-model.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  eventRateAtFullActivity: number;
  burstFactor: number;
  pattern: number[];
};

type Encoder = {
  id: string;
  label: string;
  detail: string;
  eventMultiplier: number;
  tonicEventsPerSecond: number;
};

type EventFlowData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    encoderId: string;
    activityPercent: number;
    thresholdPercent: number;
  };
  denseBaseline: {
    sampleRateHz: number;
    channels: number;
    fanout: number;
  };
  routerCapacityEventsPerSecond: number;
  scenarios: Scenario[];
  encoders: Encoder[];
};

function isEventFlowData(value: unknown): value is EventFlowData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<EventFlowData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      data.denseBaseline &&
      typeof data.routerCapacityEventsPerSecond === 'number' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length >= 3 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.eventRateAtFullActivity === 'number' &&
          Array.isArray(scenario.pattern) &&
          scenario.pattern.length === 12,
      ) &&
      Array.isArray(data.encoders) &&
      data.encoders.length >= 3,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRate(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M/s`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k/s`;
  return `${Math.round(value)}/s`;
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 sm:block" />
      <ArrowDown aria-hidden="true" className="h-5 w-5 sm:hidden" />
    </div>
  );
}

function FlowStage({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100',
    violet:
      'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function LabState({ blockId, error }: { blockId: string; error?: string }) {
  return (
    <div data-content-block={blockId}>
      <div
        className={`not-prose my-7 min-h-[560px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        aria-label={error ? 'Event flow lab unavailable' : 'Loading event flow lab'}
        role={error ? 'alert' : undefined}
      >
        {error ? (
          <>
            <p className="font-semibold">Event flow lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function NeuromorphicComputingEventFlowLab({
  blockId = BLOCK_ID,
  dataFile = DEFAULT_DATA_FILE,
}: {
  blockId?: string;
  dataFile?: string;
}) {
  const [data, setData] = useState<EventFlowData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('intermittent-motion');
  const [encoderId, setEncoderId] = useState('change-events');
  const [activityPercent, setActivityPercent] = useState(24);
  const [thresholdPercent, setThresholdPercent] = useState(58);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isEventFlowData(value)) {
          throw new Error('The event-flow data does not match the expected contract.');
        }
        setData(value);
        setScenarioId(value.defaults.scenarioId);
        setEncoderId(value.defaults.encoderId);
        setActivityPercent(value.defaults.activityPercent);
        setThresholdPercent(value.defaults.thresholdPercent);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the event model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const encoder = data.encoders.find((item) => item.id === encoderId) ?? data.encoders[0];
    if (!scenario || !encoder) return null;

    const thresholdFactor = clamp((112 - thresholdPercent) / 54, 0.32, 1.42);
    const inputEventRate = scenario.eventRateAtFullActivity * (activityPercent / 100);
    const encodedEventRate =
      inputEventRate * encoder.eventMultiplier * thresholdFactor + encoder.tonicEventsPerSecond;
    const peakEventRate = encodedEventRate * scenario.burstFactor;
    const routerUtilization = peakEventRate / data.routerCapacityEventsPerSecond;
    const eventSynapticAdds = encodedEventRate * data.denseBaseline.fanout;
    const denseSynapticOpportunities =
      data.denseBaseline.sampleRateHz *
      data.denseBaseline.channels *
      data.denseBaseline.fanout;
    const eventWorkShare = eventSynapticAdds / denseSynapticOpportunities;

    let membrane = 0.12;
    let outputSpikes = 0;
    const threshold = 0.48 + thresholdPercent / 100;
    const timeline = scenario.pattern.map((weight) => {
      const inputEvents = Math.max(
        0,
        Math.round(weight * activityPercent * encoder.eventMultiplier * thresholdFactor * 0.28),
      );
      membrane = membrane * 0.58 + Math.min(1.15, inputEvents / 9);
      const fired = membrane >= threshold;
      if (fired) {
        outputSpikes += 1;
        membrane = 0.14;
      }
      return { inputEvents, fired, membrane: clamp(membrane / threshold, 0, 1) };
    });

    const status =
      routerUtilization > 1
        ? {
            label: 'Router saturation',
            detail: 'Peak ingress exceeds the modeled routing boundary. Events queue or drop, so sparse semantics alone do not protect latency.',
            tone: 'rose' as const,
          }
        : eventWorkShare > 0.72
          ? {
              label: 'Sparse advantage is eroding',
              detail: 'The encoded spike stream now performs most of the dense baseline work. Measure the complete path before choosing specialized hardware.',
              tone: 'amber' as const,
            }
          : {
              label: 'Event-driven window remains useful',
              detail: 'The model skips many dense update opportunities and peak traffic remains inside the routing boundary.',
              tone: 'emerald' as const,
            };

    return {
      denseSynapticOpportunities,
      encodedEventRate,
      eventSynapticAdds,
      eventWorkShare,
      outputSpikes,
      peakEventRate,
      routerUtilization,
      scenario,
      encoder,
      status,
      timeline,
    };
  }, [activityPercent, data, encoderId, scenarioId, thresholdPercent]);

  if (loadError) return <LabState blockId={blockId} error={loadError} />;
  if (!data) return <LabState blockId={blockId} />;
  if (!model) {
    return <LabState blockId={blockId} error="The selected scenario or encoder is missing." />;
  }

  const statusStyles = {
    emerald:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    amber:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <div data-content-block={blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Event-flow workbench"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="cyan"
          onReset={() => {
            setScenarioId(data.defaults.scenarioId);
            setEncoderId(data.defaults.encoderId);
            setActivityPercent(data.defaults.activityPercent);
            setThresholdPercent(data.defaults.thresholdPercent);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Signal shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === model.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Radio}
                      accent="blue"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Spike encoding
                </legend>
                <div className="mt-3 space-y-2">
                  {data.encoders.map((encoder) => (
                    <LabChoice
                      key={encoder.id}
                      selected={encoder.id === model.encoder.id}
                      label={encoder.label}
                      detail={encoder.detail}
                      icon={Zap}
                      accent="violet"
                      onClick={() => setEncoderId(encoder.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Signal activity"
                value={activityPercent}
                output={`${activityPercent}%`}
                min={4}
                max={100}
                step={2}
                accent="cyan"
                lowLabel="Mostly idle"
                highLabel="Continuously changing"
                onChange={setActivityPercent}
              />

              <LabRange
                label="Neuron threshold"
                value={thresholdPercent}
                output={`${thresholdPercent}%`}
                min={35}
                max={85}
                step={1}
                accent="amber"
                lowLabel="Sensitive"
                highLabel="Selective"
                onChange={setThresholdPercent}
              />
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
              <FlowStage
                icon={Activity}
                label="Encoded ingress"
                value={formatRate(model.encodedEventRate)}
                detail={`${model.encoder.label}; activity and threshold determine emitted events.`}
                tone="blue"
              />
              <FlowArrow />
              <FlowStage
                icon={Network}
                label="Peak router load"
                value={`${Math.round(model.routerUtilization * 100)}%`}
                detail={`${formatRate(model.peakEventRate)} against the modeled burst boundary.`}
                tone="violet"
              />
              <FlowArrow />
              <FlowStage
                icon={Sparkles}
                label="Output spikes"
                value={`${model.outputSpikes} / 12 bins`}
                detail="Membrane state leaks, integrates input, fires, and resets."
                tone="emerald"
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Twelve-bin event trace
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
                  Bars show membrane fill; dots show bins that cross the firing threshold.
                </p>
              </div>
              <div className="grid grid-cols-6 gap-2 p-4 sm:grid-cols-12">
                {model.timeline.map((bin, index) => (
                  <div key={index} className="min-w-0 text-center">
                    <div className="relative flex h-24 items-end overflow-hidden rounded-sm border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                      <div
                        className={`w-full transition-[height] motion-reduce:transition-none ${
                          bin.fired ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-cyan-300 dark:bg-cyan-700'
                        }`}
                        style={{ height: `${Math.max(5, bin.membrane * 100)}%` }}
                      />
                      {bin.fired ? (
                        <span
                          className="absolute left-1/2 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-600 shadow-sm dark:border-neutral-950 dark:bg-emerald-300"
                          aria-label={`Bin ${index + 1} fired`}
                        />
                      ) : null}
                    </div>
                    <span className="mt-1 block text-[10px] font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                      {bin.inputEvents} evt
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Event work share"
                value={`${Math.round(model.eventWorkShare * 100)}%`}
                detail="Synaptic additions divided by dense update opportunities."
                icon={Gauge}
                tone={model.eventWorkShare <= 0.5 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Event additions"
                value={formatRate(model.eventSynapticAdds)}
                detail="Encoded events multiplied by modeled fan-out."
                icon={Zap}
                tone="cyan"
              />
              <LabMetric
                label="Dense opportunities"
                value={formatRate(model.denseSynapticOpportunities)}
                detail="Fixed-rate samples multiplied by channels and fan-out."
                icon={Cpu}
                tone="neutral"
              />
            </div>

            <div className={`rounded-md border p-4 ${statusStyles[model.status.tone]}`}>
              <div className="flex items-start gap-3">
                {model.status.tone === 'rose' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{model.status.label}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{model.status.detail}</p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This is a work model, not a power claim. Replace event rates, fan-out, routing capacity, and dense baseline operations with traces from the target sensor, network, compiler, and hardware.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
