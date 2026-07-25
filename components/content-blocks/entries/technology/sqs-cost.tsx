'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  Gauge,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Timer,
  Users,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type QueueType = 'standard' | 'fifo';
type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  averageMessageKiB: number;
  workerMessagesPerSecond: number;
  defaultMessageRate: number;
  recommendedQueueType: QueueType;
};
type CapacityData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    queueType: QueueType;
    messageRate: number;
    batchSize: number;
    workers: number;
    messageGroups: number;
    outageMinutes: number;
  };
  bounds: {
    messageRate: Bound;
    batchSize: Bound;
    workers: Bound;
    messageGroups: Bound;
    outageMinutes: Bound;
  };
  planningAssumptions: {
    requestPayloadUnitKiB: number;
    maximumMessageKiB: number;
    healthyWorkerUtilizationPct: number;
    warningCatchupMultiple: number;
  };
  workloads: Workload[];
};
type Finding = {
  severity: 'healthy' | 'warning' | 'critical';
  title: string;
  detail: string;
};

const BLOCK_ID = 'technology/sqs-cost';

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
      && typeof candidate.averageMessageKiB === 'number'
      && typeof candidate.workerMessagesPerSecond === 'number'
      && typeof candidate.defaultMessageRate === 'number'
      && (candidate.recommendedQueueType === 'standard' || candidate.recommendedQueueType === 'fifo'),
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
      && (defaults.queueType === 'standard' || defaults.queueType === 'fifo')
      && typeof defaults.messageRate === 'number'
      && typeof defaults.batchSize === 'number'
      && typeof defaults.workers === 'number'
      && typeof defaults.messageGroups === 'number'
      && typeof defaults.outageMinutes === 'number'
      && isBound(candidate.bounds?.messageRate)
      && isBound(candidate.bounds?.batchSize)
      && isBound(candidate.bounds?.workers)
      && isBound(candidate.bounds?.messageGroups)
      && isBound(candidate.bounds?.outageMinutes)
      && typeof assumptions?.requestPayloadUnitKiB === 'number'
      && typeof assumptions.maximumMessageKiB === 'number'
      && typeof assumptions.healthyWorkerUtilizationPct === 'number'
      && typeof assumptions.warningCatchupMultiple === 'number'
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

export default function SQSCost({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No queue-capacity model was supplied.');
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
        if (!isCapacityData(payload)) throw new Error('The queue-capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex min-h-36 items-center justify-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Capacity model unavailable</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
              >
                Try again
              </button>
            </div>
          ) : (
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-blue-600" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the queue model...</p>
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
  const [queueType, setQueueType] = useState<QueueType>(data.defaults.queueType);
  const [messageRate, setMessageRate] = useState(data.defaults.messageRate);
  const [batchSize, setBatchSize] = useState(data.defaults.batchSize);
  const [workers, setWorkers] = useState(data.defaults.workers);
  const [messageGroups, setMessageGroups] = useState(data.defaults.messageGroups);
  const [outageMinutes, setOutageMinutes] = useState(data.defaults.outageMinutes);
  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const activeWorkers = queueType === 'fifo' ? Math.min(workers, messageGroups) : workers;
    const workerCapacity = activeWorkers * workload.workerMessagesPerSecond;
    const utilizationPct = workerCapacity > 0 ? (messageRate / workerCapacity) * 100 : Number.POSITIVE_INFINITY;
    const outageBacklog = messageRate * outageMinutes * 60;
    const catchupRate = workerCapacity - messageRate;
    const catchupMinutes = catchupRate > 0 ? outageBacklog / catchupRate / 60 : Number.POSITIVE_INFINITY;
    const receiveCallsPerSecond = Math.ceil(messageRate / batchSize);
    const sendPayloadUnitsPerSecond = Math.ceil(
      (messageRate * workload.averageMessageKiB) / data.planningAssumptions.requestPayloadUnitKiB,
    );
    const requestUnitsPerSecond = sendPayloadUnitsPerSecond + receiveCallsPerSecond * 2;
    const backlogGiB = outageBacklog * workload.averageMessageKiB / 1024 / 1024;
    const findings: Finding[] = [];

    if (workload.averageMessageKiB > data.planningAssumptions.maximumMessageKiB) {
      findings.push({
        severity: 'critical',
        title: 'Payload exceeds the queue message limit',
        detail: 'Store the object elsewhere and put a durable pointer plus integrity metadata in SQS.',
      });
    }
    if (queueType !== workload.recommendedQueueType) {
      findings.push({
        severity: 'warning',
        title: queueType === 'fifo' ? 'Ordering may be unnecessary' : 'The selected contract loses required ordering',
        detail: queueType === 'fifo'
          ? 'FIFO adds an ordering boundary. Use it only when the business operation needs per-group sequence.'
          : 'This workload describes ordered commands. Use FIFO groups or make ordering irrelevant in the consumer.',
      });
    }
    if (queueType === 'fifo' && messageGroups < workers) {
      findings.push({
        severity: 'warning',
        title: `${workers - messageGroups} workers cannot receive an active group`,
        detail: 'FIFO parallelism comes from independent message groups, not worker count alone.',
      });
    }
    if (!Number.isFinite(catchupMinutes)) {
      findings.push({
        severity: 'critical',
        title: 'The backlog never drains',
        detail: `Consumers can process ${formatNumber(workerCapacity)} messages/s while ${formatNumber(messageRate)} messages/s continue to arrive.`,
      });
    } else if (utilizationPct > data.planningAssumptions.healthyWorkerUtilizationPct) {
      findings.push({
        severity: 'warning',
        title: 'Recovery headroom is thin',
        detail: `${formatNumber(utilizationPct)}% steady utilization leaves only ${formatNumber(catchupRate)} messages/s for replaying accumulated work.`,
      });
    }
    if (
      Number.isFinite(catchupMinutes)
      && catchupMinutes > outageMinutes * data.planningAssumptions.warningCatchupMultiple
    ) {
      findings.push({
        severity: 'warning',
        title: 'Recovery takes much longer than the outage',
        detail: `A ${outageMinutes}-minute interruption needs about ${formatNumber(catchupMinutes, 1)} minutes of catch-up at this capacity.`,
      });
    }
    if (findings.length === 0) {
      findings.push({
        severity: 'healthy',
        title: 'The modeled queue has recovery headroom',
        detail: 'Validate worker throughput, downstream quotas, payload distribution, and peak arrival shape with production-like load tests.',
      });
    }

    const status = findings.some((item) => item.severity === 'critical')
      ? 'critical'
      : findings.some((item) => item.severity === 'warning')
        ? 'warning'
        : 'healthy';

    return {
      activeWorkers,
      backlogGiB,
      catchupMinutes,
      findings,
      outageBacklog,
      requestUnitsPerSecond,
      status,
      utilizationPct,
      workerCapacity,
    } as const;
  }, [batchSize, data, messageGroups, messageRate, outageMinutes, queueType, workers, workload]);

  function chooseWorkload(next: Workload) {
    setWorkloadId(next.id);
    setMessageRate(next.defaultMessageRate);
    setQueueType(next.recommendedQueueType);
  }

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setQueueType(data.defaults.queueType);
    setMessageRate(data.defaults.messageRate);
    setBatchSize(data.defaults.batchSize);
    setWorkers(data.defaults.workers);
    setMessageGroups(data.defaults.messageGroups);
    setOutageMinutes(data.defaults.outageMinutes);
  }

  const statusStyle = result.status === 'critical'
    ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    : result.status === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Queue capacity lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Workload</legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={`${item.averageMessageKiB} KiB average · ${item.workerMessagesPerSecond} messages/s per worker`}
                      icon={item.recommendedQueueType === 'fifo' ? Layers3 : MessageSquare}
                      accent={item.recommendedQueueType === 'fifo' ? 'violet' : 'blue'}
                      onClick={() => chooseWorkload(item)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{workload.detail}</p>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Delivery contract</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <LabChoice
                    selected={queueType === 'standard'}
                    label="Standard"
                    detail="At least once, best-effort order"
                    icon={Zap}
                    accent="cyan"
                    onClick={() => setQueueType('standard')}
                  />
                  <LabChoice
                    selected={queueType === 'fifo'}
                    label="FIFO"
                    detail="Ordered within each message group"
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setQueueType('fifo')}
                  />
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Arrival rate"
                  value={messageRate}
                  output={`${messageRate.toLocaleString()} msg/s`}
                  {...data.bounds.messageRate}
                  lowLabel="Quiet"
                  highLabel="Burst"
                  accent="blue"
                  onChange={setMessageRate}
                />
                <LabRange
                  label="Workers"
                  value={workers}
                  output={`${workers} workers`}
                  {...data.bounds.workers}
                  lowLabel="Small pool"
                  highLabel="Large pool"
                  accent="emerald"
                  onChange={setWorkers}
                />
                {queueType === 'fifo' ? (
                  <LabRange
                    label="Message groups"
                    value={messageGroups}
                    output={`${messageGroups} groups`}
                    {...data.bounds.messageGroups}
                    lowLabel="Serial"
                    highLabel="Parallel"
                    accent="violet"
                    onChange={setMessageGroups}
                  />
                ) : null}
                <LabRange
                  label="API batch size"
                  value={batchSize}
                  output={`${batchSize} messages`}
                  {...data.bounds.batchSize}
                  lowLabel="More calls"
                  highLabel="Fewer calls"
                  accent="cyan"
                  onChange={setBatchSize}
                />
                <LabRange
                  label="Worker outage"
                  value={outageMinutes}
                  output={`${outageMinutes} min`}
                  {...data.bounds.outageMinutes}
                  lowLabel="Brief"
                  highLabel="Extended"
                  accent="amber"
                  onChange={setOutageMinutes}
                />
              </div>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Steady utilization"
              value={`${formatNumber(result.utilizationPct)}%`}
              detail={`${formatNumber(result.workerCapacity)} messages/s modeled capacity`}
              icon={Gauge}
              tone={result.utilizationPct > 100 ? 'rose' : result.utilizationPct > 70 ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="Outage backlog"
              value={formatNumber(result.outageBacklog)}
              detail={`${formatNumber(result.backlogGiB, 2)} GiB of message bodies`}
              icon={Cloud}
              tone="blue"
            />
            <LabMetric
              label="Catch-up time"
              value={Number.isFinite(result.catchupMinutes) ? `${formatNumber(result.catchupMinutes, 1)} min` : 'Never'}
              detail="While new messages continue arriving"
              icon={Timer}
              tone={Number.isFinite(result.catchupMinutes) ? 'violet' : 'rose'}
            />
            <LabMetric
              label="Request pressure"
              value={`${formatNumber(result.requestUnitsPerSecond)}/s`}
              detail={`Modeled ${data.planningAssumptions.requestPayloadUnitKiB} KiB send units plus receive/delete calls`}
              icon={Zap}
              tone="cyan"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="grid gap-px bg-neutral-200 sm:grid-cols-3 dark:bg-neutral-800">
              <CapacityStage icon={MessageSquare} label="Producers" value={`${formatNumber(messageRate)} msg/s`} detail={`${workload.averageMessageKiB} KiB average`} />
              <CapacityStage icon={Cloud} label="SQS buffer" value={`${formatNumber(result.outageBacklog)} queued`} detail={`After ${outageMinutes} min unavailable`} />
              <CapacityStage icon={Users} label="Active workers" value={`${result.activeWorkers} of ${workers}`} detail={`${formatNumber(result.workerCapacity)} msg/s capacity`} />
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${statusStyle}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {result.status === 'healthy' ? <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}
              {result.status === 'healthy' ? 'Recovery envelope is healthy' : result.status === 'warning' ? 'Review before production' : 'The modeled contract fails'}
            </div>
            <ul className="mt-4 space-y-3">
              {result.findings.map((finding) => (
                <li key={finding.title} className="grid gap-1 sm:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.3fr)] sm:gap-4">
                  <span className="text-sm font-semibold">{finding.title}</span>
                  <span className="text-sm leading-6 opacity-80">{finding.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function CapacityStage({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Cloud;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 bg-white p-4 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
