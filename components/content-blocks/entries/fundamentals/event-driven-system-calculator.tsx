'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  RadioTower,
  RefreshCw,
  UsersRound,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type CapacityInputs = {
  eventRate: number;
  eventSizeKb: number;
  subscriberGroups: number;
  retentionHours: number;
  partitions: number;
};
type EventCapacityModel = {
  modeledPartitionTargetEventsPerSecond: number;
  replicationFactor: number;
  defaults: CapacityInputs;
  bounds: Record<keyof CapacityInputs, Bound>;
};

const BLOCK_ID = 'fundamentals/event-driven-system-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/event-driven-architecture/data/event-capacity-model.json';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const bound = value as Partial<Bound>;
  return (
    typeof bound.min === 'number' &&
    typeof bound.max === 'number' &&
    typeof bound.step === 'number'
  );
}

function isCapacityModel(value: unknown): value is EventCapacityModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<EventCapacityModel>;
  const defaults = model.defaults as Partial<CapacityInputs> | undefined;
  const bounds = model.bounds as Partial<Record<keyof CapacityInputs, Bound>> | undefined;
  const keys: Array<keyof CapacityInputs> = [
    'eventRate',
    'eventSizeKb',
    'subscriberGroups',
    'retentionHours',
    'partitions',
  ];

  return Boolean(
    typeof model.modeledPartitionTargetEventsPerSecond === 'number' &&
      model.modeledPartitionTargetEventsPerSecond > 0 &&
      Number.isInteger(model.replicationFactor) &&
      model.replicationFactor &&
      defaults &&
      bounds &&
      keys.every((key) => typeof defaults[key] === 'number' && isBound(bounds[key])),
  );
}

function formatRate(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatThroughput(mebibytesPerSecond: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(mebibytesPerSecond)} MiB/s`;
}

function formatStorage(gibibytes: number) {
  if (gibibytes >= 1024) return `${(gibibytes / 1024).toFixed(2)} TiB`;
  return `${gibibytes.toFixed(gibibytes >= 100 ? 0 : 1)} GiB`;
}

export default function EventDrivenSystemCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EventCapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [eventRate, setEventRate] = useState(2400);
  const [eventSizeKb, setEventSizeKb] = useState(2);
  const [subscriberGroups, setSubscriberGroups] = useState(3);
  const [retentionHours, setRetentionHours] = useState(24);
  const [partitions, setPartitions] = useState(6);

  function reset(model: EventCapacityModel) {
    setEventRate(model.defaults.eventRate);
    setEventSizeKb(model.defaults.eventSizeKb);
    setSubscriberGroups(model.defaults.subscriberGroups);
    setRetentionHours(model.defaults.retentionHours);
    setPartitions(model.defaults.partitions);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setLoadError(error instanceof Error ? error.message : 'Unable to load capacity data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const ingressMibPerSecond = (eventRate * eventSizeKb) / 1024;
    const egressMibPerSecond = ingressMibPerSecond * subscriberGroups;
    const logicalDeliveriesPerSecond = eventRate * subscriberGroups;
    const retainedGib =
      (ingressMibPerSecond * 3600 * retentionHours * data.replicationFactor) / 1024;
    const eventsPerPartition = eventRate / partitions;
    const partitionUtilization =
      (eventsPerPartition / data.modeledPartitionTargetEventsPerSecond) * 100;
    const status =
      partitionUtilization > 100
        ? 'overloaded'
        : partitionUtilization > 80
          ? 'thin-headroom'
          : 'healthy';

    return {
      ingressMibPerSecond,
      egressMibPerSecond,
      logicalDeliveriesPerSecond,
      retainedGib,
      eventsPerPartition,
      partitionUtilization,
      status,
    };
  }, [data, eventRate, eventSizeKb, partitions, retentionHours, subscriberGroups]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Fan-out capacity lab"
          title="Separate ingest, delivery, retention, and partition pressure"
          description="Change the workload and observe four different costs. A broker stores each retained event once per replica, while every independent subscriber group creates another logical delivery path."
          icon={RadioTower}
          accent="cyan"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {loadError ? (
              <div className="max-w-md text-center" role="alert">
                <AlertTriangle aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Capacity data could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Loading event capacity model...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <LabRange
                  label="Published event rate"
                  value={eventRate}
                  output={`${formatRate(eventRate)}/s`}
                  {...data.bounds.eventRate}
                  accent="blue"
                  lowLabel="steady"
                  highLabel="busy"
                  onChange={setEventRate}
                />
                <LabRange
                  label="Average event size"
                  value={eventSizeKb}
                  output={`${eventSizeKb} KiB`}
                  {...data.bounds.eventSizeKb}
                  accent="violet"
                  lowLabel="compact fact"
                  highLabel="large payload"
                  onChange={setEventSizeKb}
                />
                <LabRange
                  label="Subscriber groups"
                  value={subscriberGroups}
                  output={`${subscriberGroups}`}
                  {...data.bounds.subscriberGroups}
                  accent="emerald"
                  lowLabel="one reaction"
                  highLabel="wide fan-out"
                  onChange={setSubscriberGroups}
                />
                <LabRange
                  label="Retention window"
                  value={retentionHours}
                  output={`${retentionHours} h`}
                  {...data.bounds.retentionHours}
                  accent="amber"
                  lowLabel="brief recovery"
                  highLabel="long replay"
                  onChange={setRetentionHours}
                />
                <LabRange
                  label="Topic partitions"
                  value={partitions}
                  output={`${partitions}`}
                  {...data.bounds.partitions}
                  accent="cyan"
                  lowLabel="less parallelism"
                  highLabel="more parallelism"
                  onChange={setPartitions}
                />
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Broker ingest"
                value={formatThroughput(view.ingressMibPerSecond)}
                detail={`${formatRate(eventRate)} events/s x ${eventSizeKb} KiB`}
                icon={RadioTower}
                tone="blue"
              />
              <LabMetric
                label="Logical deliveries"
                value={`${formatRate(view.logicalDeliveriesPerSecond)}/s`}
                detail={`${subscriberGroups} independent subscriber groups`}
                icon={UsersRound}
                tone="emerald"
              />
              <LabMetric
                label="Read egress"
                value={formatThroughput(view.egressMibPerSecond)}
                detail="Before protocol and retry overhead"
                icon={Gauge}
                tone="violet"
              />
              <LabMetric
                label="Retained replicas"
                value={formatStorage(view.retainedGib)}
                detail={`${retentionHours} h x ${data.replicationFactor} replicas`}
                icon={Database}
                tone="amber"
              />
            </div>

            <div className="mt-6 grid min-h-[220px] items-stretch gap-3 lg:grid-cols-[1fr_auto_1.2fr_auto_1fr] lg:items-center">
              <FlowStage
                icon={Layers3}
                eyebrow="Producer"
                value={`${formatRate(eventRate)} events/s`}
                detail={`${eventSizeKb} KiB average payload`}
              />
              <ArrowRight
                aria-hidden="true"
                className="mx-auto h-5 w-5 rotate-90 text-neutral-400 lg:rotate-0"
              />
              <FlowStage
                icon={RadioTower}
                eyebrow={`${partitions} partitions`}
                value={`${formatRate(view.eventsPerPartition)} events/s each`}
                detail={`${view.partitionUtilization.toFixed(0)}% of the illustrative planning target`}
              />
              <ArrowRight
                aria-hidden="true"
                className="mx-auto h-5 w-5 rotate-90 text-neutral-400 lg:rotate-0"
              />
              <FlowStage
                icon={UsersRound}
                eyebrow="Independent groups"
                value={`${subscriberGroups} copies of the flow`}
                detail={`${formatThroughput(view.egressMibPerSecond)} aggregate read egress`}
              />
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-neutral-950 dark:text-white">
                  Modeled partition pressure
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {view.partitionUtilization.toFixed(0)}%
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    view.status === 'overloaded'
                      ? 'bg-rose-500'
                      : view.status === 'thin-headroom'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, view.partitionUtilization)}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The {formatRate(data.modeledPartitionTargetEventsPerSecond)} events/s target is an
                illustrative planning assumption, not a vendor guarantee. Benchmark payloads,
                replication, storage, and consumers on the intended platform.
              </p>
            </div>

            <div
              className={`mt-5 rounded-md border p-4 ${
                view.status === 'overloaded'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : view.status === 'thin-headroom'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {view.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">Capacity consequence</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    {view.status === 'overloaded'
                      ? 'The selected event rate exceeds the modeled per-partition target. Increase parallelism only after choosing an ordering key that can be split safely, or reduce the work carried by each event.'
                      : view.status === 'thin-headroom'
                        ? 'The partition plan fits, but it leaves little room for uneven keys, rebalances, retries, or maintenance. Preserve operating headroom before calling the design production-ready.'
                        : 'The modeled ingest fits with headroom. Subscriber count still multiplies delivery work, and retention still multiplies replicated storage, so size those resources independently.'}
                  </p>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function FlowStage({
  icon: Icon,
  eyebrow,
  value,
  detail,
}: {
  icon: typeof RadioTower;
  eyebrow: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex h-full min-h-[150px] min-w-0 flex-col justify-center rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {eyebrow}
      </p>
      <p className="mt-2 break-words text-lg font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
