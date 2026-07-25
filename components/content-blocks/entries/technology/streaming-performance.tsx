'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Network,
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

type Bound = { min: number; max: number; step: number };
type Profile = {
  id: string;
  label: string;
  detail: string;
  inputEventsPerSecond: number;
  partitionCount: number;
  consumerCount: number;
  consumerCapacity: number;
  outageSeconds: number;
  windowSeconds: number;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    eventBytes: number;
    retainedCopies: number;
    targetMaxUtilizationPct: number;
    recoveryTargetMinutes: number;
  };
  bounds: {
    inputEventsPerSecond: Bound;
    partitionCount: Bound;
    consumerCount: Bound;
    consumerCapacity: Bound;
    outageSeconds: Bound;
    windowSeconds: Bound;
  };
  profiles: Profile[];
};

const BLOCK_ID = 'technology/streaming-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/streaming/data/capacity-envelope.json';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.assumptions?.eventBytes
      && candidate.bounds?.inputEventsPerSecond
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function seconds(value: number) {
  if (!Number.isFinite(value)) return 'No finite recovery';
  if (value < 60) return `${Math.round(value)} sec`;
  return `${(value / 60).toFixed(value < 600 ? 1 : 0)} min`;
}

export default function StreamingPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [inputEventsPerSecond, setInputEventsPerSecond] = useState(120000);
  const [partitionCount, setPartitionCount] = useState(12);
  const [consumerCount, setConsumerCount] = useState(10);
  const [consumerCapacity, setConsumerCapacity] = useState(15000);
  const [outageSeconds, setOutageSeconds] = useState(60);
  const [windowSeconds, setWindowSeconds] = useState(60);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setInputEventsPerSecond(profile.inputEventsPerSecond);
    setPartitionCount(profile.partitionCount);
    setConsumerCount(profile.consumerCount);
    setConsumerCapacity(profile.consumerCapacity);
    setOutageSeconds(profile.outageSeconds);
    setWindowSeconds(profile.windowSeconds);
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
        if (!isCapacityData(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load capacity data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const usefulConsumers = Math.min(partitionCount, consumerCount);
    const idleConsumers = Math.max(0, consumerCount - usefulConsumers);
    const processingCapacity = usefulConsumers * consumerCapacity;
    const utilizationPct = (inputEventsPerSecond / processingCapacity) * 100;
    const lagGrowth = Math.max(0, inputEventsPerSecond - processingCapacity);
    const outageBacklog = inputEventsPerSecond * outageSeconds;
    const spareCapacity = Math.max(0, processingCapacity - inputEventsPerSecond);
    const recoverySeconds = outageBacklog === 0
      ? 0
      : spareCapacity > 0
        ? outageBacklog / spareCapacity
        : Number.POSITIVE_INFINITY;
    const ingressMegabytesPerSecond =
      (inputEventsPerSecond * data.assumptions.eventBytes) / 1_000_000;
    const retainedWindowMegabytes =
      (inputEventsPerSecond
        * windowSeconds
        * data.assumptions.eventBytes
        * data.assumptions.retainedCopies)
      / 1_000_000;

    if (lagGrowth > 0) {
      return {
        usefulConsumers,
        idleConsumers,
        processingCapacity,
        utilizationPct,
        lagGrowth,
        outageBacklog,
        recoverySeconds,
        ingressMegabytesPerSecond,
        retainedWindowMegabytes,
        status: 'Lag grows continuously',
        tone: 'rose' as const,
        verdict: `Input exceeds useful worker capacity by ${compact(lagGrowth)} events/s. No checkpoint setting can make this steady state recoverable; reduce work, rebalance keys, or add useful partitions and consumers.`,
      };
    }

    if (recoverySeconds > data.assumptions.recoveryTargetMinutes * 60) {
      return {
        usefulConsumers,
        idleConsumers,
        processingCapacity,
        utilizationPct,
        lagGrowth,
        outageBacklog,
        recoverySeconds,
        ingressMegabytesPerSecond,
        retainedWindowMegabytes,
        status: 'Recovery misses target',
        tone: 'amber' as const,
        verdict: `The live path is stable, but the outage backlog takes ${seconds(recoverySeconds)} to drain. The target is ${data.assumptions.recoveryTargetMinutes} minutes, so recovery needs more spare capacity or a smaller failure interval.`,
      };
    }

    if (utilizationPct > data.assumptions.targetMaxUtilizationPct || idleConsumers > 0) {
      return {
        usefulConsumers,
        idleConsumers,
        processingCapacity,
        utilizationPct,
        lagGrowth,
        outageBacklog,
        recoverySeconds,
        ingressMegabytesPerSecond,
        retainedWindowMegabytes,
        status: idleConsumers > 0 ? 'Workers wait idle' : 'Thin live headroom',
        tone: 'amber' as const,
        verdict: idleConsumers > 0
          ? `${idleConsumers} consumer${idleConsumers === 1 ? '' : 's'} cannot own a partition. More process instances do not add capacity until the partition plan changes.`
          : `Steady-state utilization is ${Math.round(utilizationPct)}%, above the ${data.assumptions.targetMaxUtilizationPct}% planning target. A burst or slow sink can create lag before autoscaling reacts.`,
      };
    }

    return {
      usefulConsumers,
      idleConsumers,
      processingCapacity,
      utilizationPct,
      lagGrowth,
      outageBacklog,
      recoverySeconds,
      ingressMegabytesPerSecond,
      retainedWindowMegabytes,
      status: 'Inside the envelope',
      tone: 'emerald' as const,
      verdict: `The stream has ${compact(processingCapacity - inputEventsPerSecond)} events/s of spare capacity and drains the modeled outage in ${seconds(recoverySeconds)}. Validate this estimate with skewed keys and a real sink before launch.`,
    };
  }, [
    consumerCapacity,
    consumerCount,
    data,
    inputEventsPerSecond,
    outageSeconds,
    partitionCount,
    windowSeconds,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and backpressure lab"
          title={data?.title ?? 'Can the stream absorb live traffic and recover?'}
          description={data?.description ?? 'Loading the capacity model.'}
          icon={Gauge}
          accent="violet"
          onReset={data ? () => applyProfile(data.profiles[0]) : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload profile
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={profile.id === 'telemetry-burst' ? Network : Activity}
                        accent="violet"
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Input rate"
                  value={inputEventsPerSecond}
                  output={`${compact(inputEventsPerSecond)} events/s`}
                  {...data.bounds.inputEventsPerSecond}
                  accent="blue"
                  lowLabel="Light flow"
                  highLabel="Traffic burst"
                  onChange={(value) => { setProfileId('custom'); setInputEventsPerSecond(value); }}
                />
                <LabRange
                  label="Partitions"
                  value={partitionCount}
                  output={`${partitionCount}`}
                  {...data.bounds.partitionCount}
                  accent="violet"
                  lowLabel="Few owners"
                  highLabel="More ownership slots"
                  onChange={(value) => { setProfileId('custom'); setPartitionCount(value); }}
                />
                <LabRange
                  label="Consumers"
                  value={consumerCount}
                  output={`${consumerCount}`}
                  {...data.bounds.consumerCount}
                  accent="cyan"
                  lowLabel="Small group"
                  highLabel="Large group"
                  onChange={(value) => { setProfileId('custom'); setConsumerCount(value); }}
                />
                <LabRange
                  label="Capacity per consumer"
                  value={consumerCapacity}
                  output={`${compact(consumerCapacity)} events/s`}
                  {...data.bounds.consumerCapacity}
                  accent="emerald"
                  lowLabel="Heavy operator"
                  highLabel="Efficient operator"
                  onChange={(value) => { setProfileId('custom'); setConsumerCapacity(value); }}
                />
                <LabRange
                  label="Processor outage"
                  value={outageSeconds}
                  output={`${outageSeconds} sec`}
                  {...data.bounds.outageSeconds}
                  accent="rose"
                  lowLabel="No interruption"
                  highLabel="Long restore"
                  onChange={(value) => { setProfileId('custom'); setOutageSeconds(value); }}
                />
                <LabRange
                  label="State window"
                  value={windowSeconds}
                  output={`${windowSeconds} sec`}
                  {...data.bounds.windowSeconds}
                  accent="amber"
                  lowLabel="Short state"
                  highLabel="Long retention"
                  onChange={(value) => { setProfileId('custom'); setWindowSeconds(value); }}
                />
              </div>
            )}
          >
            <div className="min-w-0" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Useful capacity"
                  value={`${compact(result.processingCapacity)}/s`}
                  detail={`${result.usefulConsumers} active of ${consumerCount} consumers`}
                  icon={Server}
                  tone={result.tone}
                />
                <LabMetric
                  label="Utilization"
                  value={`${Math.round(result.utilizationPct)}%`}
                  detail={`${compact(inputEventsPerSecond)} in / ${compact(result.processingCapacity)} possible`}
                  icon={Gauge}
                  tone={result.utilizationPct > 100 ? 'rose' : 'blue'}
                />
                <LabMetric
                  label="Outage backlog"
                  value={compact(result.outageBacklog)}
                  detail={outageSeconds === 0 ? 'No modeled interruption' : `${outageSeconds} seconds without processing`}
                  icon={Database}
                  tone={result.outageBacklog > 0 ? 'amber' : 'neutral'}
                />
                <LabMetric
                  label="Catch-up time"
                  value={seconds(result.recoverySeconds)}
                  detail={`${compact(result.lagGrowth)} events/s steady lag growth`}
                  icon={Clock3}
                  tone={result.tone}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Live input against useful capacity</span>
                  <span className="text-right tabular-nums">
                    {compact(inputEventsPerSecond)} / {compact(result.processingCapacity)} events/s
                  </span>
                </div>
                <div
                  className="mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                  role="img"
                  aria-label={`Input uses ${Math.round(result.utilizationPct)} percent of useful processing capacity`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${result.utilizationPct > 100 ? 'bg-rose-500' : result.utilizationPct > data.assumptions.targetMaxUtilizationPct ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, result.utilizationPct)}%` }}
                  />
                </div>
              </section>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <FlowNode
                  icon={Activity}
                  label="Producers"
                  value={`${compact(inputEventsPerSecond)} events/s`}
                  detail={`${result.ingressMegabytesPerSecond.toFixed(1)} MB/s payload ingress`}
                  tone="blue"
                />
                <FlowArrow />
                <FlowNode
                  icon={Layers3}
                  label="Partitioned log"
                  value={`${partitionCount} ownership slots`}
                  detail={`${compact(result.outageBacklog)} events queued by the outage`}
                  tone="violet"
                />
                <FlowArrow />
                <FlowNode
                  icon={Server}
                  label="Stateful workers"
                  value={`${result.usefulConsumers} active consumers`}
                  detail={`${result.retainedWindowMegabytes.toFixed(0)} MB upper bound if ${data.assumptions.retainedCopies} copies retain full event bytes`}
                  tone={result.tone === 'rose' ? 'rose' : 'emerald'}
                />
              </div>

              <section className={`mt-5 border-l-4 p-4 ${result.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">{result.verdict}</p>
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

function FlowNode({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <span className="hidden h-px w-5 bg-current md:block" />
      <span className="md:hidden">↓</span>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) {
    return (
      <div
        className="min-h-[520px] animate-pulse bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900"
        aria-label="Loading stream capacity model"
      />
    );
  }

  return (
    <div className="p-5 md:p-6" role="alert">
      <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
        <p className="text-sm font-semibold">Capacity model unavailable</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
