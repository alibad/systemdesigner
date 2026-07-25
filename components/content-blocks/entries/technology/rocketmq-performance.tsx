'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  LoaderCircle,
  MessageSquare,
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
type Workload = {
  id: string;
  label: string;
  detail: string;
  averageMessageBytes: number;
  defaultMessagesPerSecond: number;
  consumerMessagesPerSecond: number;
};
type CapacityData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    messagesPerSecond: number;
    consumers: number;
    retentionHours: number;
    outageMinutes: number;
  };
  bounds: {
    messagesPerSecond: Bound;
    consumers: Bound;
    retentionHours: Bound;
    outageMinutes: Bound;
  };
  planningAssumptions: {
    consumerReservePct: number;
    warningRecoveryMultiple: number;
  };
  workloads: Workload[];
};
type Finding = {
  severity: 'healthy' | 'warning' | 'critical';
  title: string;
  detail: string;
};

const BLOCK_ID = 'technology/rocketmq-performance';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isWorkload(value: unknown): value is Workload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workload>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.averageMessageBytes === 'number'
      && candidate.averageMessageBytes > 0
      && typeof candidate.defaultMessagesPerSecond === 'number'
      && candidate.defaultMessagesPerSecond > 0
      && typeof candidate.consumerMessagesPerSecond === 'number'
      && candidate.consumerMessagesPerSecond > 0,
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const defaults = candidate.defaults;
  const assumptions = candidate.planningAssumptions;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.workloadId
      && typeof defaults.messagesPerSecond === 'number'
      && typeof defaults.consumers === 'number'
      && typeof defaults.retentionHours === 'number'
      && typeof defaults.outageMinutes === 'number'
      && isBound(candidate.bounds?.messagesPerSecond)
      && isBound(candidate.bounds?.consumers)
      && isBound(candidate.bounds?.retentionHours)
      && isBound(candidate.bounds?.outageMinutes)
      && typeof assumptions?.consumerReservePct === 'number'
      && assumptions.consumerReservePct > 0
      && assumptions.consumerReservePct < 100
      && typeof assumptions.warningRecoveryMultiple === 'number'
      && assumptions.warningRecoveryMultiple > 0
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every(isWorkload),
  );
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function RocketMQPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No RocketMQ capacity model was supplied.');
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
        if (!isCapacityData(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex min-h-36 items-center justify-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Capacity model unavailable</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
              >
                Try again
              </button>
            </div>
          ) : (
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-600" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the capacity model...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [messagesPerSecond, setMessagesPerSecond] = useState(data.defaults.messagesPerSecond);
  const [consumers, setConsumers] = useState(data.defaults.consumers);
  const [retentionHours, setRetentionHours] = useState(data.defaults.retentionHours);
  const [outageMinutes, setOutageMinutes] = useState(data.defaults.outageMinutes);
  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const measuredCapacity = consumers * workload.consumerMessagesPerSecond;
    const reserveFraction = data.planningAssumptions.consumerReservePct / 100;
    const plannedCapacity = measuredCapacity * (1 - reserveFraction);
    const utilizationPct = measuredCapacity > 0
      ? (messagesPerSecond / measuredCapacity) * 100
      : Number.POSITIVE_INFINITY;
    const recoveryHeadroom = plannedCapacity - messagesPerSecond;
    const outageBacklog = messagesPerSecond * outageMinutes * 60;
    const recoveryMinutes = recoveryHeadroom > 0
      ? outageBacklog / recoveryHeadroom / 60
      : Number.POSITIVE_INFINITY;
    const ingressMiBPerSecond = messagesPerSecond * workload.averageMessageBytes / 1024 / 1024;
    const retainedPayloadGiB = messagesPerSecond
      * workload.averageMessageBytes
      * retentionHours
      * 3600
      / 1024
      / 1024
      / 1024;
    const findings: Finding[] = [];

    if (messagesPerSecond > measuredCapacity) {
      findings.push({
        severity: 'critical',
        title: 'The consumer backlog grows during normal traffic',
        detail: `${formatNumber(messagesPerSecond)} messages/s arrive while the measured handlers complete about ${formatNumber(measuredCapacity)} messages/s.`,
      });
    } else if (messagesPerSecond > plannedCapacity) {
      findings.push({
        severity: 'warning',
        title: 'Steady traffic consumes the recovery reserve',
        detail: `The plan holds ${data.planningAssumptions.consumerReservePct}% of measured capacity for variance and catch-up. Add capacity or reduce the sustained rate.`,
      });
    }

    if (!Number.isFinite(recoveryMinutes)) {
      findings.push({
        severity: 'critical',
        title: 'The modeled outage backlog never drains',
        detail: 'Reserved consumer capacity does not exceed ongoing arrivals, so every new message replaces the work that just completed.',
      });
    } else if (recoveryMinutes > outageMinutes * data.planningAssumptions.warningRecoveryMultiple) {
      findings.push({
        severity: 'warning',
        title: 'Recovery takes much longer than the outage',
        detail: `A ${outageMinutes}-minute interruption needs about ${formatNumber(recoveryMinutes, 1)} minutes of catch-up at the reserved planning rate.`,
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'healthy',
        title: 'The modeled consumers keep recovery headroom',
        detail: 'Validate the per-consumer rate against real handlers, downstream limits, message groups, payload skew, and failure conditions.',
      });
    }

    const status = findings.some((item) => item.severity === 'critical')
      ? 'critical'
      : findings.some((item) => item.severity === 'warning')
        ? 'warning'
        : 'healthy';

    return {
      findings,
      ingressMiBPerSecond,
      measuredCapacity,
      outageBacklog,
      plannedCapacity,
      recoveryHeadroom,
      recoveryMinutes,
      retainedPayloadGiB,
      status,
      utilizationPct,
    } as const;
  }, [consumers, data, messagesPerSecond, outageMinutes, retentionHours, workload]);

  function chooseWorkload(next: Workload) {
    setWorkloadId(next.id);
    setMessagesPerSecond(next.defaultMessagesPerSecond);
  }

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setMessagesPerSecond(data.defaults.messagesPerSecond);
    setConsumers(data.defaults.consumers);
    setRetentionHours(data.defaults.retentionHours);
    setOutageMinutes(data.defaults.outageMinutes);
  }

  const statusStyle = result.status === 'critical'
    ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    : result.status === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100';
  const StatusIcon = result.status === 'healthy' ? CheckCircle2 : CircleAlert;
  const loadWidth = Math.min(100, Math.max(0, result.utilizationPct));

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and recovery lab"
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
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={MessageSquare}
                      accent="cyan"
                      onClick={() => chooseWorkload(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Arrival rate"
                  value={messagesPerSecond}
                  output={`${formatCompact(messagesPerSecond)} msg/s`}
                  min={data.bounds.messagesPerSecond.min}
                  max={data.bounds.messagesPerSecond.max}
                  step={data.bounds.messagesPerSecond.step}
                  lowLabel={`${formatCompact(data.bounds.messagesPerSecond.min)}/s`}
                  highLabel={`${formatCompact(data.bounds.messagesPerSecond.max)}/s`}
                  accent="cyan"
                  onChange={setMessagesPerSecond}
                />
                <LabRange
                  label="Consumer instances"
                  value={consumers}
                  output={formatNumber(consumers)}
                  min={data.bounds.consumers.min}
                  max={data.bounds.consumers.max}
                  step={data.bounds.consumers.step}
                  lowLabel="Small group"
                  highLabel="Large group"
                  accent="emerald"
                  onChange={setConsumers}
                />
                <LabRange
                  label="Retention window"
                  value={retentionHours}
                  output={`${retentionHours} h`}
                  min={data.bounds.retentionHours.min}
                  max={data.bounds.retentionHours.max}
                  step={data.bounds.retentionHours.step}
                  lowLabel="1 day"
                  highLabel="7 days"
                  accent="violet"
                  onChange={setRetentionHours}
                />
                <LabRange
                  label="Consumer outage"
                  value={outageMinutes}
                  output={`${outageMinutes} min`}
                  min={data.bounds.outageMinutes.min}
                  max={data.bounds.outageMinutes.max}
                  step={data.bounds.outageMinutes.step}
                  lowLabel="Brief"
                  highLabel="1 hour"
                  accent="amber"
                  onChange={setOutageMinutes}
                />
              </div>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Payload ingress"
                value={`${formatNumber(result.ingressMiBPerSecond, 1)} MiB/s`}
                detail={`${formatNumber(workload.averageMessageBytes)} average bytes per message`}
                icon={Activity}
                tone="cyan"
              />
              <LabMetric
                label="Measured consumer capacity"
                value={`${formatCompact(result.measuredCapacity)} msg/s`}
                detail={`${formatNumber(workload.consumerMessagesPerSecond)} msg/s per tested instance`}
                icon={Users}
                tone="emerald"
              />
              <LabMetric
                label="Raw retained payload"
                value={`${formatNumber(result.retainedPayloadGiB, 1)} GiB`}
                detail="Before replicas, indexes, metadata, overhead, or compression"
                icon={HardDrive}
                tone="violet"
              />
              <LabMetric
                label="Outage backlog"
                value={`${formatCompact(result.outageBacklog)} messages`}
                detail={Number.isFinite(result.recoveryMinutes)
                  ? `${formatNumber(result.recoveryMinutes, 1)} min cautious recovery`
                  : 'No recovery at the reserved planning rate'}
                icon={TimerReset}
                tone={result.status === 'critical' ? 'rose' : 'amber'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Steady consumer load</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatNumber(result.utilizationPct, 1)}% of measured capacity; the plan reserves {data.planningAssumptions.consumerReservePct}%.
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {formatCompact(messagesPerSecond)} / {formatCompact(result.measuredCapacity)} msg/s
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                <div
                  className={`h-full rounded-full transition-[width] ${result.status === 'critical' ? 'bg-rose-500' : result.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${loadWidth}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{formatCompact(result.plannedCapacity)} msg/s planned capacity after reserve</span>
                <span>{formatCompact(Math.max(0, result.recoveryHeadroom))} msg/s catch-up headroom</span>
              </div>
            </div>

            <div className={`rounded-md border p-4 ${statusStyle}`} aria-live="polite">
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {result.status === 'healthy' ? 'Recovery envelope is viable' : result.status === 'warning' ? 'Recovery envelope needs attention' : 'Recovery envelope is broken'}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {result.findings.map((finding) => (
                      <li key={finding.title} className="text-sm leading-6">
                        <span className="font-semibold">{finding.title}.</span> {finding.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              <Database aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
              <p>
                This model sizes application demand, not RocketMQ's maximum throughput. Benchmark brokers and consumers together with the chosen replication, flush, Proxy, filtering, message-group, and downstream settings.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
