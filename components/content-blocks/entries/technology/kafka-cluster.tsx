'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  LoaderCircle,
  Server,
  Users,
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

type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  eventsPerSecond: number;
  averageEventBytes: number;
  consumerCapacityEventsPerSecond: number;
};
type TopicCapacityData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    brokers: number;
    partitions: number;
    replicationFactor: number;
    retentionHours: number;
    consumerInstances: number;
  };
  bounds: {
    brokers: Bound;
    partitions: Bound;
    replicationFactor: Bound;
    retentionHours: Bound;
    consumerInstances: Bound;
  };
  planningAssumptions: {
    brokerIngressMiBPerSecond: number;
    brokerUsableStorageTiB: number;
    partitionIngressMiBPerSecond: number;
    operationalReservePct: number;
  };
  workloads: Workload[];
};

type Finding = {
  label: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
};

const BLOCK_ID = 'technology/kafka-cluster';
const MIB = 1024 ** 2;
const TIB = 1024 ** 4;

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
      && typeof candidate.eventsPerSecond === 'number'
      && typeof candidate.averageEventBytes === 'number'
      && typeof candidate.consumerCapacityEventsPerSecond === 'number',
  );
}

function isTopicCapacityData(value: unknown): value is TopicCapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TopicCapacityData>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;
  const assumptions = candidate.planningAssumptions;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.workloadId
      && typeof defaults.brokers === 'number'
      && typeof defaults.partitions === 'number'
      && typeof defaults.replicationFactor === 'number'
      && typeof defaults.retentionHours === 'number'
      && typeof defaults.consumerInstances === 'number'
      && isBound(bounds?.brokers)
      && isBound(bounds?.partitions)
      && isBound(bounds?.replicationFactor)
      && isBound(bounds?.retentionHours)
      && isBound(bounds?.consumerInstances)
      && typeof assumptions?.brokerIngressMiBPerSecond === 'number'
      && typeof assumptions.brokerUsableStorageTiB === 'number'
      && typeof assumptions.partitionIngressMiBPerSecond === 'number'
      && typeof assumptions.operationalReservePct === 'number'
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every(isWorkload),
  );
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value > 0 && value < 1 ? Math.min(2, digits) : 0,
  }).format(value);
}

export default function KafkaCluster({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<TopicCapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No topic-capacity model was supplied.');
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
        if (!isTopicCapacityData(payload)) {
          throw new Error('The topic-capacity model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: TopicCapacityData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [brokers, setBrokers] = useState(data.defaults.brokers);
  const [partitions, setPartitions] = useState(data.defaults.partitions);
  const [replicationFactor, setReplicationFactor] = useState(data.defaults.replicationFactor);
  const [retentionHours, setRetentionHours] = useState(data.defaults.retentionHours);
  const [consumerInstances, setConsumerInstances] = useState(data.defaults.consumerInstances);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const logicalBytesPerSecond = workload.eventsPerSecond * workload.averageEventBytes;
    const logicalMiBPerSecond = logicalBytesPerSecond / MIB;
    const replicaMiBPerSecond = logicalMiBPerSecond * replicationFactor;
    const replicaMiBPerBroker = replicaMiBPerSecond / brokers;
    const retainedReplicaBytes = logicalBytesPerSecond
      * retentionHours
      * 3600
      * replicationFactor;
    const reserveFraction = data.planningAssumptions.operationalReservePct / 100;
    const provisionedTiB = retainedReplicaBytes / (1 - reserveFraction) / TIB;
    const storageTiBPerBroker = provisionedTiB / brokers;
    const partitionMiBPerSecond = logicalMiBPerSecond / partitions;
    const eventsPerPartition = workload.eventsPerSecond / partitions;
    const activeConsumers = Math.min(partitions, consumerInstances);
    const idleConsumers = Math.max(0, consumerInstances - activeConsumers);
    const eventsPerConsumer = workload.eventsPerSecond / activeConsumers;
    const consumerUtilization = eventsPerConsumer
      / workload.consumerCapacityEventsPerSecond
      * 100;
    const findings: Finding[] = [];

    if (replicationFactor > brokers) {
      findings.push({
        severity: 'critical',
        label: 'Replica placement is impossible',
        detail: `Replication factor ${replicationFactor} needs at least ${replicationFactor} brokers.`,
      });
    }
    if (replicationFactor === 1) {
      findings.push({
        severity: 'critical',
        label: 'There is no broker-level data redundancy',
        detail: 'A failed partition leader has no follower copy available for promotion.',
      });
    }
    if (replicaMiBPerBroker > data.planningAssumptions.brokerIngressMiBPerSecond) {
      findings.push({
        severity: 'critical',
        label: 'Broker ingress exceeds the planning envelope',
        detail: `${formatNumber(replicaMiBPerBroker)} MiB/s per broker is above the modeled ${data.planningAssumptions.brokerIngressMiBPerSecond} MiB/s target.`,
      });
    }
    if (storageTiBPerBroker > data.planningAssumptions.brokerUsableStorageTiB) {
      findings.push({
        severity: 'critical',
        label: 'Retention does not fit the broker disk envelope',
        detail: `${formatNumber(storageTiBPerBroker, 2)} TiB per broker is above the modeled ${data.planningAssumptions.brokerUsableStorageTiB} TiB usable target.`,
      });
    }
    if (partitionMiBPerSecond > data.planningAssumptions.partitionIngressMiBPerSecond) {
      findings.push({
        severity: 'warning',
        label: 'Average partition ingress is too concentrated',
        detail: `Average load is ${formatNumber(partitionMiBPerSecond, 2)} MiB/s per partition before key skew.`,
      });
    }
    if (consumerUtilization > 100) {
      findings.push({
        severity: 'critical',
        label: 'Consumer lag grows continuously',
        detail: `Each active consumer needs ${formatNumber(consumerUtilization)}% of its modeled sustainable capacity.`,
      });
    } else if (consumerUtilization > 80) {
      findings.push({
        severity: 'warning',
        label: 'Consumer recovery headroom is thin',
        detail: `${formatNumber(consumerUtilization)}% steady utilization leaves little room for replays or a failed instance.`,
      });
    }
    if (idleConsumers > 0) {
      findings.push({
        severity: 'info',
        label: `${idleConsumers} consumer ${idleConsumers === 1 ? 'instance is' : 'instances are'} idle`,
        detail: 'One group cannot actively assign more consumers than subscribed partitions.',
      });
    }
    if (findings.length === 0) {
      findings.push({
        severity: 'info',
        label: 'The modeled workload fits with operating headroom',
        detail: 'Validate the assumptions with representative records, compression, acknowledgement policy, disk, and failure recovery.',
      });
    }

    const hasCritical = findings.some((item) => item.severity === 'critical');
    const hasWarning = findings.some((item) => item.severity === 'warning');

    return {
      activeConsumers,
      consumerUtilization,
      eventsPerConsumer,
      eventsPerPartition,
      findings,
      idleConsumers,
      logicalMiBPerSecond,
      partitionMiBPerSecond,
      provisionedTiB,
      replicaMiBPerBroker,
      status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy',
      storageTiBPerBroker,
    } as const;
  }, [brokers, consumerInstances, data, partitions, replicationFactor, retentionHours, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setBrokers(data.defaults.brokers);
    setPartitions(data.defaults.partitions);
    setReplicationFactor(data.defaults.replicationFactor);
    setRetentionHours(data.defaults.retentionHours);
    setConsumerInstances(data.defaults.consumerInstances);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Topic capacity lab"
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
                      detail={`${item.eventsPerSecond.toLocaleString()} events/s · ${item.averageEventBytes.toLocaleString()} bytes average`}
                      icon={item.id === 'device-telemetry' ? Activity : item.id === 'database-cdc' ? Database : Layers3}
                      accent={item.id === 'device-telemetry' ? 'cyan' : item.id === 'database-cdc' ? 'violet' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {workload.detail}
                </p>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Brokers"
                  value={brokers}
                  output={`${brokers} brokers`}
                  {...data.bounds.brokers}
                  lowLabel="Small failure domain"
                  highLabel="More placement capacity"
                  accent="blue"
                  onChange={setBrokers}
                />
                <LabRange
                  label="Partitions"
                  value={partitions}
                  output={`${partitions} partitions`}
                  {...data.bounds.partitions}
                  lowLabel="Less parallelism"
                  highLabel="More metadata"
                  accent="violet"
                  onChange={setPartitions}
                />
                <LabRange
                  label="Replication factor"
                  value={replicationFactor}
                  output={`${replicationFactor} copies`}
                  {...data.bounds.replicationFactor}
                  lowLabel="Less redundancy"
                  highLabel="More replica traffic"
                  accent="amber"
                  onChange={setReplicationFactor}
                />
                <LabRange
                  label="Retention"
                  value={retentionHours}
                  output={`${retentionHours / 24} days`}
                  {...data.bounds.retentionHours}
                  lowLabel="1 day"
                  highLabel="14 days"
                  accent="cyan"
                  onChange={setRetentionHours}
                />
                <LabRange
                  label="Consumer instances"
                  value={consumerInstances}
                  output={`${consumerInstances} instances`}
                  {...data.bounds.consumerInstances}
                  lowLabel="Less drain capacity"
                  highLabel="Bounded by partitions"
                  accent="emerald"
                  onChange={setConsumerInstances}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Logical ingress"
                value={`${formatNumber(result.logicalMiBPerSecond)} MiB/s`}
                detail={`${workload.eventsPerSecond.toLocaleString()} events/s before replication`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Provisioned retention"
                value={`${formatNumber(result.provisionedTiB, 2)} TiB`}
                detail={`${data.planningAssumptions.operationalReservePct}% reserve across all replica copies`}
                icon={HardDrive}
                tone={result.storageTiBPerBroker > data.planningAssumptions.brokerUsableStorageTiB ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Replica ingress / broker"
                value={`${formatNumber(result.replicaMiBPerBroker)} MiB/s`}
                detail={`${replicationFactor} copies distributed across ${brokers} brokers`}
                icon={Server}
                tone={result.replicaMiBPerBroker > data.planningAssumptions.brokerIngressMiBPerSecond ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="Consumer utilization"
                value={`${formatNumber(result.consumerUtilization)}%`}
                detail={`${result.activeConsumers} active · ${result.idleConsumers} idle`}
                icon={Users}
                tone={result.consumerUtilization > 100 ? 'rose' : result.consumerUtilization > 80 ? 'amber' : 'emerald'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Capacity path
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    One logical stream, three independent pressure points
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Averages before key and leader skew
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch">
                <CapacityStage
                  icon={Activity}
                  eyebrow="Producer"
                  title={`${workload.eventsPerSecond.toLocaleString()} events/s`}
                  detail={`${formatNumber(result.logicalMiBPerSecond)} MiB/s logical ingress`}
                  tone="blue"
                />
                <PathArrow />
                <CapacityStage
                  icon={Layers3}
                  eyebrow="Partitions"
                  title={`${formatNumber(result.eventsPerPartition)} events/s each`}
                  detail={`${formatNumber(result.partitionMiBPerSecond, 2)} MiB/s average per partition`}
                  tone="violet"
                />
                <PathArrow />
                <CapacityStage
                  icon={Server}
                  eyebrow="Broker fleet"
                  title={`${formatNumber(result.storageTiBPerBroker, 2)} TiB each`}
                  detail={`${formatNumber(result.replicaMiBPerBroker)} MiB/s replica ingress per broker`}
                  tone="amber"
                />
                <PathArrow />
                <CapacityStage
                  icon={Users}
                  eyebrow="Consumer group"
                  title={`${formatNumber(result.eventsPerConsumer)} events/s each`}
                  detail={`${result.activeConsumers} active partition owners`}
                  tone="emerald"
                />
              </div>
            </section>

            <section className={`rounded-md border p-4 ${result.status === 'critical'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
              : result.status === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.status === 'healthy'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <h4 className="font-semibold">
                    {result.status === 'critical'
                      ? 'The topic breaks at least one modeled limit'
                      : result.status === 'warning'
                        ? 'The topic fits, but recovery headroom needs review'
                        : 'The topic fits the modeled operating envelope'}
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm leading-6">
                    {result.findings.map((finding) => (
                      <li key={`${finding.severity}-${finding.label}`} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        <span><strong>{finding.label}.</strong> {finding.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function CapacityStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'amber' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
  } as const;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold tabular-nums">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-4 w-4 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
        {error ? (
          <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
        ) : (
          <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-500 motion-reduce:animate-none" />
        )}
        <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
          {error ? 'Capacity model unavailable' : 'Loading capacity model'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing workload, partition, storage, and consumer assumptions.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
          >
            Retry
          </button>
        ) : null}
      </div>
    </LearningLab>
  );
}
