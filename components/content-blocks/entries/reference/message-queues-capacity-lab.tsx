'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Repeat2,
  Send,
  Users,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };

type CapacityModel = {
  observationMinutes: number;
  defaults: {
    producers: number;
    producerRate: number;
    messageSizeKb: number;
    partitions: number;
    consumers: number;
    serviceTimeMs: number;
    retryRatePercent: number;
    retentionHours: number;
  };
  bounds: Record<keyof CapacityModel['defaults'], Bound>;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024).toLocaleString()} KB`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

export default function MessageQueuesCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [producers, setProducers] = useState(8);
  const [producerRate, setProducerRate] = useState(180);
  const [messageSizeKb, setMessageSizeKb] = useState(4);
  const [partitions, setPartitions] = useState(6);
  const [consumers, setConsumers] = useState(5);
  const [serviceTimeMs, setServiceTimeMs] = useState(4);
  const [retryRatePercent, setRetryRatePercent] = useState(5);
  const [retentionHours, setRetentionHours] = useState(24);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The queue capacity model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<CapacityModel>;
      })
      .then((model) => {
        setData(model);
        const defaults = model.defaults;
        setProducers(defaults.producers);
        setProducerRate(defaults.producerRate);
        setMessageSizeKb(defaults.messageSizeKb);
        setPartitions(defaults.partitions);
        setConsumers(defaults.consumers);
        setServiceTimeMs(defaults.serviceTimeMs);
        setRetryRatePercent(defaults.retryRatePercent);
        setRetentionHours(defaults.retentionHours);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the queue capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/message-queues-capacity-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Queue capacity model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/message-queues-capacity-lab">
        <div className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading queue capacity model" />
      </div>
    );
  }

  const baseIngress = producers * producerRate;
  const retryIngress = baseIngress * (retryRatePercent / 100);
  const ingress = baseIngress + retryIngress;
  const activeAssignments = Math.min(partitions, consumers);
  const serviceRatePerConsumer = 1000 / serviceTimeMs;
  const consumerCapacity = activeAssignments * serviceRatePerConsumer;
  const throughput = Math.min(ingress, consumerCapacity);
  const utilization = consumerCapacity > 0 ? ingress / consumerCapacity : 0;
  const backlogGrowth = Math.max(0, ingress - consumerCapacity);
  const observationSeconds = data.observationMinutes * 60;
  const addedBacklog = backlogGrowth * observationSeconds;
  const backlogAgeSeconds = consumerCapacity > 0 ? addedBacklog / consumerCapacity : 0;
  const retainedBytes = ingress * messageSizeKb * 1024 * retentionHours * 3600 + addedBacklog * messageSizeKb * 1024;
  const partitionBound = consumers >= partitions;
  const overload = utilization > 1;
  const nearLimit = utilization >= 0.75 && !overload;
  const rounded = (value: number) => Math.round(value).toLocaleString();
  const ingressWidth = Math.min(100, (ingress / Math.max(ingress, consumerCapacity)) * 100);
  const capacityWidth = Math.min(100, (consumerCapacity / Math.max(ingress, consumerCapacity)) * 100);

  const guidance = overload
    ? partitionBound
      ? 'Overload: all current partitions already have consumers. Add partitions only if the ordering key can be split safely, then add consumers; otherwise reduce service time or retry pressure.'
      : 'Overload: idle partition capacity exists. Add consumers until assignments match partitions, then reduce service time or retry pressure if ingress is still higher.'
    : nearLimit
      ? 'Near saturation: leave headroom for deploys, uneven keys, retries, and slow downstream dependencies. Alert before backlog age reaches the user-visible deadline.'
      : partitionBound
        ? 'Healthy now, but partitions cap future consumer parallelism. Keep the key distribution and ordering scope explicit before scaling producers.'
        : 'Healthy with unused partition capacity. More consumers can raise capacity until the partition count becomes the limit.';
  const guidanceTone = overload
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
    : nearLimit
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';

  return (
    <div data-content-block="reference/message-queues-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Producer, consumer, and retention model"
          title="Find the bottleneck before backlog becomes delay"
          description="Tune the production rate, message footprint, consumer parallelism, service time, retries, and retention. The model accounts for retry deliveries and caps concurrent consumption at one assignment per partition."
          icon={Gauge}
          accent="cyan"
          onReset={() => {
            const defaults = data.defaults;
            setProducers(defaults.producers);
            setProducerRate(defaults.producerRate);
            setMessageSizeKb(defaults.messageSizeKb);
            setPartitions(defaults.partitions);
            setConsumers(defaults.consumers);
            setServiceTimeMs(defaults.serviceTimeMs);
            setRetryRatePercent(defaults.retryRatePercent);
            setRetentionHours(defaults.retentionHours);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange label="Producers" value={producers} output={`${producers}`} {...data.bounds.producers} accent="blue" lowLabel="one producer" highLabel="many producers" onChange={setProducers} />
              <LabRange label="Rate per producer" value={producerRate} output={`${producerRate} msg/s`} {...data.bounds.producerRate} accent="cyan" lowLabel="low rate" highLabel="high rate" onChange={setProducerRate} />
              <LabRange label="Message size" value={messageSizeKb} output={`${messageSizeKb} KB`} {...data.bounds.messageSizeKb} accent="violet" lowLabel="small event" highLabel="large payload" onChange={setMessageSizeKb} />
              <LabRange label="Partitions" value={partitions} output={`${partitions}`} {...data.bounds.partitions} accent="blue" lowLabel="serial" highLabel="parallel" onChange={setPartitions} />
              <LabRange label="Consumers" value={consumers} output={`${consumers}`} {...data.bounds.consumers} accent="emerald" lowLabel="few workers" highLabel="many workers" onChange={setConsumers} />
              <LabRange label="Service time" value={serviceTimeMs} output={`${serviceTimeMs} ms`} {...data.bounds.serviceTimeMs} accent="amber" lowLabel="fast handler" highLabel="slow handler" onChange={setServiceTimeMs} />
              <LabRange label="Retry deliveries" value={retryRatePercent} output={`${retryRatePercent}%`} {...data.bounds.retryRatePercent} accent="rose" lowLabel="no retry" highLabel="retry pressure" onChange={setRetryRatePercent} />
              <LabRange label="Retention" value={retentionHours} output={`${retentionHours} hr`} {...data.bounds.retentionHours} accent="violet" lowLabel="short replay" highLabel="long replay" onChange={setRetentionHours} />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric label="Ingress" value={`${rounded(ingress)} msg/s`} detail={`${rounded(baseIngress)} base + ${rounded(retryIngress)} retry deliveries`} icon={Send} tone="blue" />
            <LabMetric label="Consumer capacity" value={`${rounded(consumerCapacity)} msg/s`} detail={`${activeAssignments} active assignments x ${rounded(serviceRatePerConsumer)} msg/s`} icon={Users} tone="cyan" />
            <LabMetric label="Throughput" value={`${rounded(throughput)} msg/s`} detail={overload ? 'Limited by consumers' : 'Keeping up with ingress'} icon={Activity} tone={overload ? 'rose' : 'emerald'} />
            <LabMetric label="Utilization" value={`${(utilization * 100).toFixed(0)}%`} detail={partitionBound ? 'Partition-constrained parallelism' : 'Consumer-constrained parallelism'} icon={Gauge} tone={overload ? 'rose' : nearLimit ? 'amber' : 'emerald'} />
            <LabMetric label="Backlog age" value={overload ? formatDuration(backlogAgeSeconds) : '0 sec'} detail={overload ? `After ${data.observationMinutes} min at this rate` : 'No modeled queue growth'} icon={Clock3} tone={overload ? 'rose' : 'emerald'} />
            <LabMetric label="Retention storage" value={formatBytes(retainedBytes)} detail={`${retentionHours} hr of produced messages, plus modeled backlog`} icon={HardDrive} tone="violet" />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Capacity accounting over the next {data.observationMinutes} minutes</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Ingress = producers x rate x (1 + retry rate). Capacity = min(partitions, consumers) x 1,000 / service time.</p>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200"><span>Attempted ingress</span><span className="tabular-nums">{rounded(ingress)} msg/s</span></div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${ingressWidth}%` }} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200"><span>Available consumer capacity</span><span className="tabular-nums">{rounded(consumerCapacity)} msg/s</span></div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className={`h-full rounded-full ${overload ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${capacityWidth}%` }} /></div>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="flex items-center gap-2 font-semibold text-neutral-950 dark:text-white"><Layers3 aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />Assignments</span><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{activeAssignments} of {partitions} partitions are actively consumed.</p></div>
                <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="flex items-center gap-2 font-semibold text-neutral-950 dark:text-white"><Repeat2 aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />Retry load</span><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Retries add {rounded(retryIngress)} deliveries every second before useful work changes.</p></div>
                <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="flex items-center gap-2 font-semibold text-neutral-950 dark:text-white"><Database aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />Added backlog</span><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{overload ? `${rounded(addedBacklog)} messages accumulate in the model window.` : 'No new messages accumulate in the model window.'}</p></div>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${guidanceTone}`} role="status">
            <div className="flex items-start gap-3">
              {overload ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div><p className="text-sm font-semibold">{overload ? 'Overload guidance' : nearLimit ? 'Headroom guidance' : 'Capacity guidance'}</p><p className="mt-1 text-xs leading-5 opacity-80">{guidance}</p></div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
