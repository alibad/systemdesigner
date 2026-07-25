'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Database,
  Gauge,
  LoaderCircle,
  MessageSquare,
  ShieldCheck,
  TimerReset,
  Users,
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
type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  averageMessageBytes: number;
  defaultMessagesPerSecond: number;
  consumerMessagesPerSecond: number;
  defaultConsumers: number;
  defaultPersistentPercent: number;
  defaultOutageMinutes: number;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    consumerReservePercent: number;
    recoveryWarningMultiple: number;
  };
  bounds: {
    messagesPerSecond: Bound;
    consumers: Bound;
    persistentPercent: Bound;
    outageMinutes: Bound;
  };
  profiles: WorkloadProfile[];
};

const BLOCK_ID = 'technology/activemq-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/activemq/data/broker-capacity-envelope.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isProfile(value: unknown): value is WorkloadProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isFiniteNumber(candidate.averageMessageBytes)
      && candidate.averageMessageBytes > 0
      && isFiniteNumber(candidate.defaultMessagesPerSecond)
      && isFiniteNumber(candidate.consumerMessagesPerSecond)
      && candidate.consumerMessagesPerSecond > 0
      && isFiniteNumber(candidate.defaultConsumers)
      && isFiniteNumber(candidate.defaultPersistentPercent)
      && isFiniteNumber(candidate.defaultOutageMinutes),
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const assumptions = candidate.assumptions;
  const bounds = candidate.bounds;
  return Boolean(
    candidate.title
      && candidate.description
      && assumptions
      && isFiniteNumber(assumptions.consumerReservePercent)
      && assumptions.consumerReservePercent > 0
      && assumptions.consumerReservePercent < 100
      && isFiniteNumber(assumptions.recoveryWarningMultiple)
      && assumptions.recoveryWarningMultiple > 0
      && bounds
      && isBound(bounds.messagesPerSecond)
      && isBound(bounds.consumers)
      && isBound(bounds.persistentPercent)
      && isBound(bounds.outageMinutes)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isProfile),
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes)) return 'Never';
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  if (minutes < 60) return `${formatNumber(minutes, 1)} min`;
  return `${formatNumber(minutes / 60, 1)} hr`;
}

function formatStorage(gib: number) {
  if (gib < 1) return `${formatNumber(gib * 1024, 1)} MiB`;
  return `${formatNumber(gib, 1)} GiB`;
}

export default function ActiveMQPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [messagesPerSecond, setMessagesPerSecond] = useState(2500);
  const [consumers, setConsumers] = useState(10);
  const [persistentPercent, setPersistentPercent] = useState(100);
  const [outageMinutes, setOutageMinutes] = useState(10);

  function applyProfile(profile: WorkloadProfile) {
    setProfileId(profile.id);
    setMessagesPerSecond(profile.defaultMessagesPerSecond);
    setConsumers(profile.defaultConsumers);
    setPersistentPercent(profile.defaultPersistentPercent);
    setOutageMinutes(profile.defaultOutageMinutes);
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
        if (!isCapacityData(payload)) throw new Error('The ActiveMQ capacity model is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
    const measuredCapacity = consumers * profile.consumerMessagesPerSecond;
    const plannedCapacity = measuredCapacity * (1 - data.assumptions.consumerReservePercent / 100);
    const utilizationPercent = measuredCapacity > 0
      ? messagesPerSecond / measuredCapacity * 100
      : Number.POSITIVE_INFINITY;
    const recoveryHeadroom = plannedCapacity - messagesPerSecond;
    const outageBacklog = messagesPerSecond * outageMinutes * 60;
    const recoveryMinutes = recoveryHeadroom > 0
      ? outageBacklog / recoveryHeadroom / 60
      : Number.POSITIVE_INFINITY;
    const rawPayloadGiBPerHour = messagesPerSecond
      * profile.averageMessageBytes
      * 3600
      / 1024 ** 3;
    const durablePayloadGiBPerHour = rawPayloadGiBPerHour * persistentPercent / 100;

    if (messagesPerSecond > measuredCapacity) {
      return {
        durablePayloadGiBPerHour,
        measuredCapacity,
        outageBacklog,
        plannedCapacity,
        recoveryMinutes,
        status: 'Backlog grows during normal traffic',
        tone: 'rose' as const,
        utilizationPercent,
        verdict: `${formatNumber(messagesPerSecond)} messages/s arrive, but the modeled consumers complete about ${formatNumber(measuredCapacity)} messages/s. Producer flow control can protect broker resources, but it cannot create missing consumer capacity.`,
      };
    }

    if (messagesPerSecond > plannedCapacity || recoveryMinutes > outageMinutes * data.assumptions.recoveryWarningMultiple) {
      return {
        durablePayloadGiBPerHour,
        measuredCapacity,
        outageBacklog,
        plannedCapacity,
        recoveryMinutes,
        status: 'The workload has little recovery margin',
        tone: 'amber' as const,
        utilizationPercent,
        verdict: `Steady traffic consumes the reserve or a ${outageMinutes}-minute interruption needs ${formatDuration(recoveryMinutes)} to drain. Add measured handler capacity before increasing retry pressure or broker limits.`,
      };
    }

    return {
      durablePayloadGiBPerHour,
      measuredCapacity,
      outageBacklog,
      plannedCapacity,
      recoveryMinutes,
      status: 'The modeled consumers retain recovery headroom',
      tone: 'emerald' as const,
      utilizationPercent,
      verdict: `The plan keeps ${data.assumptions.consumerReservePercent}% of measured handler capacity for variance and catch-up. Validate this envelope with real message sizes, acknowledgements, persistence, selectors, storage, and downstream latency.`,
    };
  }, [consumers, data, messagesPerSecond, outageMinutes, persistentPercent, profileId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Backlog and recovery lab"
          title={data?.title ?? 'Can the consumers recover after an interruption?'}
          description={data?.description ?? 'Loading the ActiveMQ workload model.'}
          icon={Gauge}
          accent="cyan"
          onReset={data ? () => applyProfile(data.profiles[0]) : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload shape
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={MessageSquare}
                        accent={profile.id === 'telemetry-bridge' ? 'violet' : profile.id === 'document-jobs' ? 'amber' : 'cyan'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Arrival rate"
                  value={messagesPerSecond}
                  output={`${compact(messagesPerSecond)} msg/s`}
                  {...data.bounds.messagesPerSecond}
                  accent="blue"
                  lowLabel="Steady"
                  highLabel="Burst"
                  onChange={(value) => { setProfileId(''); setMessagesPerSecond(value); }}
                />
                <LabRange
                  label="Consumers"
                  value={consumers}
                  output={`${consumers}`}
                  {...data.bounds.consumers}
                  accent="emerald"
                  lowLabel="Small pool"
                  highLabel="Wide pool"
                  onChange={(value) => { setProfileId(''); setConsumers(value); }}
                />
                <LabRange
                  label="Persistent messages"
                  value={persistentPercent}
                  output={`${persistentPercent}%`}
                  {...data.bounds.persistentPercent}
                  accent="violet"
                  lowLabel="Transient"
                  highLabel="Durable"
                  onChange={(value) => { setProfileId(''); setPersistentPercent(value); }}
                />
                <LabRange
                  label="Consumer interruption"
                  value={outageMinutes}
                  output={`${outageMinutes} min`}
                  {...data.bounds.outageMinutes}
                  accent="rose"
                  lowLabel="Brief"
                  highLabel="Extended"
                  onChange={(value) => { setProfileId(''); setOutageMinutes(value); }}
                />
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <section className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-75">Planning verdict</p>
                    <h4 className="mt-1 text-xl font-semibold">{result.status}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.verdict}</p>
                  </div>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Measured capacity"
                  value={`${compact(result.measuredCapacity)}/s`}
                  detail="Consumer count multiplied by the selected measured handler rate"
                  icon={Users}
                  tone="blue"
                />
                <LabMetric
                  label="Planned ceiling"
                  value={`${compact(result.plannedCapacity)}/s`}
                  detail={`${data.assumptions.consumerReservePercent}% reserved for variance and recovery`}
                  icon={Activity}
                  tone={messagesPerSecond > result.plannedCapacity ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Outage backlog"
                  value={compact(result.outageBacklog)}
                  detail={`${outageMinutes} minutes of arrivals with no successful processing`}
                  icon={Database}
                  tone="violet"
                />
                <LabMetric
                  label="Catch-up time"
                  value={formatDuration(result.recoveryMinutes)}
                  detail="Uses reserved capacity after new arrivals are served"
                  icon={TimerReset}
                  tone={Number.isFinite(result.recoveryMinutes) ? 'cyan' : 'rose'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Steady consumer load</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                      {formatNumber(result.utilizationPercent, 1)}% of measured capacity
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    {formatStorage(result.durablePayloadGiBPerHour)} raw persistent payload/hour
                  </p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${result.tone === 'rose' ? 'bg-rose-500' : result.tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, result.utilizationPercent)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The storage estimate is payload arithmetic, not a KahaDB sizing claim. Add journal, index, filesystem, retention, backup, and replica overhead measured on the actual deployment.
                </p>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-44 items-center justify-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Capacity model unavailable</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
            >
              Try again
            </button>
          </div>
        ) : (
          <div>
            <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-600 motion-reduce:animate-none" />
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the capacity model...</p>
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
