'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Gauge,
  KeyRound,
  Layers3,
  LoaderCircle,
  RadioTower,
  Route,
  Scale,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type SubscriptionId = 'exclusive' | 'failover' | 'shared' | 'key-shared';
type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  compatibleModes: SubscriptionId[];
  recommendedMode: SubscriptionId;
  invariant: string;
};
type SubscriptionMode = {
  id: SubscriptionId;
  label: string;
  detail: string;
  ordering: string;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    messagesPerPartitionSecond: number;
    messagesPerConsumerSecond: number;
  };
  defaults: {
    workloadId: string;
    subscriptionId: SubscriptionId;
    arrivalRate: number;
    partitions: number;
    consumers: number;
    hotKeyPercent: number;
    keyBasedBatching: boolean;
  };
  bounds: {
    arrivalRate: Bound;
    partitions: Bound;
    consumers: Bound;
    hotKeyPercent: Bound;
  };
  workloads: Workload[];
  subscriptions: SubscriptionMode[];
};

const BLOCK_ID = 'technology/pulsar-cluster';

const modeIcons = {
  exclusive: RadioTower,
  failover: Scale,
  shared: UsersRound,
  'key-shared': KeyRound,
} as const;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bound>;
  return [item.min, item.max, item.step].every(
    (number) => typeof number === 'number' && Number.isFinite(number),
  );
}

function isSubscriptionId(value: unknown): value is SubscriptionId {
  return ['exclusive', 'failover', 'shared', 'key-shared'].includes(String(value));
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CapacityData>;
  const defaults = item.defaults;
  const assumptions = item.assumptions;

  return Boolean(
    item.title
      && item.description
      && typeof assumptions?.messagesPerPartitionSecond === 'number'
      && typeof assumptions.messagesPerConsumerSecond === 'number'
      && defaults?.workloadId
      && isSubscriptionId(defaults.subscriptionId)
      && typeof defaults.arrivalRate === 'number'
      && typeof defaults.partitions === 'number'
      && typeof defaults.consumers === 'number'
      && typeof defaults.hotKeyPercent === 'number'
      && typeof defaults.keyBasedBatching === 'boolean'
      && isBound(item.bounds?.arrivalRate)
      && isBound(item.bounds?.partitions)
      && isBound(item.bounds?.consumers)
      && isBound(item.bounds?.hotKeyPercent)
      && Array.isArray(item.workloads)
      && item.workloads.length >= 3
      && item.workloads.every((workload) => (
        workload.id
        && workload.label
        && workload.detail
        && workload.invariant
        && isSubscriptionId(workload.recommendedMode)
        && Array.isArray(workload.compatibleModes)
        && workload.compatibleModes.every(isSubscriptionId)
      ))
      && Array.isArray(item.subscriptions)
      && item.subscriptions.length === 4
      && item.subscriptions.every((mode) => (
        isSubscriptionId(mode.id) && mode.label && mode.detail && mode.ordering
      )),
  );
}

export default function PulsarCluster({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No partition and subscription model was supplied.');
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
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex min-h-40 items-center justify-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                Capacity model unavailable
              </p>
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
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-cyan-600" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Loading the partition model...
              </p>
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
  const [subscriptionId, setSubscriptionId] = useState<SubscriptionId>(
    data.defaults.subscriptionId,
  );
  const [arrivalRate, setArrivalRate] = useState(data.defaults.arrivalRate);
  const [partitions, setPartitions] = useState(data.defaults.partitions);
  const [consumers, setConsumers] = useState(data.defaults.consumers);
  const [hotKeyPercent, setHotKeyPercent] = useState(data.defaults.hotKeyPercent);
  const [keyBasedBatching, setKeyBasedBatching] = useState(data.defaults.keyBasedBatching);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const subscription = data.subscriptions.find((item) => item.id === subscriptionId)
    ?? data.subscriptions[0];

  const result = useMemo(() => {
    const publishCapacity = partitions * data.assumptions.messagesPerPartitionSecond;
    const activeConsumers = subscriptionId === 'exclusive'
      ? 1
      : subscriptionId === 'failover'
        ? Math.min(partitions, consumers)
        : consumers;
    const baseConsumeCapacity = activeConsumers * data.assumptions.messagesPerConsumerSecond;
    const hotKeyCapacity = subscriptionId === 'key-shared'
      ? Math.round(data.assumptions.messagesPerConsumerSecond / (hotKeyPercent / 100))
      : Number.POSITIVE_INFINITY;
    const consumeCapacity = Math.min(baseConsumeCapacity, hotKeyCapacity);
    const requiredPartitions = Math.ceil(
      arrivalRate / data.assumptions.messagesPerPartitionSecond,
    );
    const requiredConsumers = Math.ceil(
      arrivalRate / data.assumptions.messagesPerConsumerSecond,
    );
    const semanticFit = workload.compatibleModes.includes(subscriptionId)
      && (subscriptionId !== 'key-shared' || keyBasedBatching);
    const publishFit = publishCapacity >= arrivalRate;
    const consumeFit = consumeCapacity >= arrivalRate;
    const rejectedConsumers = subscriptionId === 'exclusive' ? Math.max(0, consumers - 1) : 0;
    const standbyConsumers = subscriptionId === 'failover'
      ? Math.max(0, consumers - activeConsumers)
      : 0;
    const status = !semanticFit
      ? 'critical'
      : !publishFit || !consumeFit
        ? 'warning'
        : 'healthy';

    let headline = 'The plan preserves the workload invariant with capacity headroom';
    let explanation = `${partitions} partitions can accept the modeled arrival rate, and ${activeConsumers} active consumers can drain it.`;

    if (!semanticFit) {
      headline = subscriptionId === 'key-shared' && !keyBasedBatching
        ? 'Default batching can mix keys and break Key_Shared routing semantics'
        : `${subscription.label} does not preserve this workload's delivery invariant`;
      explanation = subscriptionId === 'key-shared' && !keyBasedBatching
        ? 'Use key-based batching or disable batching so messages with one key remain assignable to one consumer.'
        : `The recommended starting point is ${data.subscriptions.find((item) => item.id === workload.recommendedMode)?.label}.`;
    } else if (!publishFit) {
      headline = `The topic needs at least ${requiredPartitions} partitions for this planning target`;
      explanation = 'Consumer count cannot remove a producer-side partition bottleneck. Increase partitions only after validating routing and ordering assumptions.';
    } else if (!consumeFit) {
      headline = subscriptionId === 'key-shared' && hotKeyCapacity < baseConsumeCapacity
        ? 'One hot key caps useful consumer parallelism'
        : `The subscription needs at least ${requiredConsumers} active consumer slots`;
      explanation = subscriptionId === 'key-shared' && hotKeyCapacity < baseConsumeCapacity
        ? `${hotKeyPercent}% of traffic is pinned to one consumer, so adding consumers does not raise that key's processing rate.`
        : 'The backlog grows whenever the modeled arrival rate stays above aggregate consumer service rate.';
    }

    return {
      activeConsumers,
      consumeCapacity,
      consumeFit,
      explanation,
      headline,
      publishCapacity,
      publishFit,
      rejectedConsumers,
      requiredConsumers,
      requiredPartitions,
      semanticFit,
      standbyConsumers,
      status,
    } as const;
  }, [
    arrivalRate,
    consumers,
    data.assumptions,
    data.subscriptions,
    hotKeyPercent,
    keyBasedBatching,
    partitions,
    subscription,
    subscriptionId,
    workload,
  ]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setSubscriptionId(data.defaults.subscriptionId);
    setArrivalRate(data.defaults.arrivalRate);
    setPartitions(data.defaults.partitions);
    setConsumers(data.defaults.consumers);
    setHotKeyPercent(data.defaults.hotKeyPercent);
    setKeyBasedBatching(data.defaults.keyBasedBatching);
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
          eyebrow="Partition and subscription lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the invariant
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'key-ordered' ? KeyRound : item.id === 'active-standby' ? Scale : Boxes}
                      accent={item.id === 'key-ordered' ? 'violet' : item.id === 'active-standby' ? 'amber' : 'cyan'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Select a subscription
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.subscriptions.map((item) => {
                    const Icon = modeIcons[item.id];
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === subscriptionId}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'key-shared' ? 'violet' : item.id === 'failover' ? 'amber' : 'cyan'}
                        onClick={() => setSubscriptionId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Arrival rate"
                  value={arrivalRate}
                  output={`${arrivalRate.toLocaleString()} msg/s`}
                  min={data.bounds.arrivalRate.min}
                  max={data.bounds.arrivalRate.max}
                  step={data.bounds.arrivalRate.step}
                  lowLabel="Small stream"
                  highLabel="Heavy stream"
                  accent="cyan"
                  onChange={setArrivalRate}
                />
                <LabRange
                  label="Topic partitions"
                  value={partitions}
                  output={partitions.toString()}
                  min={data.bounds.partitions.min}
                  max={data.bounds.partitions.max}
                  step={data.bounds.partitions.step}
                  lowLabel="One broker owner"
                  highLabel="More topic lanes"
                  accent="blue"
                  onChange={setPartitions}
                />
                <LabRange
                  label="Consumer processes"
                  value={consumers}
                  output={consumers.toString()}
                  min={data.bounds.consumers.min}
                  max={data.bounds.consumers.max}
                  step={data.bounds.consumers.step}
                  lowLabel="One process"
                  highLabel="Larger pool"
                  accent="emerald"
                  onChange={setConsumers}
                />
                {subscriptionId === 'key-shared' ? (
                  <>
                    <LabRange
                      label="Traffic on hottest key"
                      value={hotKeyPercent}
                      output={`${hotKeyPercent}%`}
                      min={data.bounds.hotKeyPercent.min}
                      max={data.bounds.hotKeyPercent.max}
                      step={data.bounds.hotKeyPercent.step}
                      lowLabel="Even key spread"
                      highLabel="Hot-key pressure"
                      accent="violet"
                      onChange={setHotKeyPercent}
                    />
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                      <input
                        type="checkbox"
                        checked={keyBasedBatching}
                        onChange={(event) => setKeyBasedBatching(event.target.checked)}
                        className="mt-1 h-4 w-4 accent-violet-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                          Use key-based batching
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          Keep different keys out of one producer batch so the broker can preserve Key_Shared assignment.
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Publish capacity"
                value={`${Math.round(result.publishCapacity / 1000)}k/s`}
                detail={`${result.requiredPartitions} partitions required`}
                icon={Layers3}
                tone={result.publishFit ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Consumer capacity"
                value={`${Math.round(result.consumeCapacity / 1000)}k/s`}
                detail={`${result.activeConsumers} processes actively receive`}
                icon={UsersRound}
                tone={result.consumeFit ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Ordering contract"
                value={subscription.ordering}
                detail={workload.invariant}
                icon={KeyRound}
                tone={result.semanticFit ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Plan state"
                value={result.status === 'healthy' ? 'Ready' : result.status === 'warning' ? 'Backlog risk' : 'Wrong contract'}
                detail="Capacity and semantics must both pass"
                icon={result.status === 'healthy' ? CheckCircle2 : CircleAlert}
                tone={result.status === 'healthy' ? 'emerald' : result.status === 'warning' ? 'amber' : 'rose'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Topic-side lanes
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    Each partition is an internal topic with one broker owner at a time.
                  </p>
                </div>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                  {partitions} partitions
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {Array.from({ length: Math.min(partitions, 16) }, (_, index) => (
                  <div
                    key={index}
                    className="flex h-11 items-center justify-center rounded-md border border-blue-200 bg-white text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    P{index}
                  </div>
                ))}
              </div>
              {partitions > 16 ? (
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  +{partitions - 16} more partitions
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CapacityBar
                label="Producer path"
                value={result.publishCapacity}
                target={arrivalRate}
                detail={`${partitions} x ${data.assumptions.messagesPerPartitionSecond.toLocaleString()} msg/s planning capacity`}
                healthy={result.publishFit}
              />
              <CapacityBar
                label="Subscription path"
                value={result.consumeCapacity}
                target={arrivalRate}
                detail={`${result.activeConsumers} active x ${data.assumptions.messagesPerConsumerSecond.toLocaleString()} msg/s, before any hot-key cap`}
                healthy={result.consumeFit}
              />
            </div>

            <div className={`rounded-md border p-5 ${statusStyle}`} role="status" aria-live="polite">
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{result.headline}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p>
                  {result.standbyConsumers > 0 ? (
                    <p className="mt-2 text-xs font-semibold">
                      {result.standbyConsumers} configured consumers remain standby because Failover activates at most one consumer per partition.
                    </p>
                  ) : null}
                  {result.rejectedConsumers > 0 ? (
                    <p className="mt-2 text-xs font-semibold">
                      Exclusive permits one attached consumer; {result.rejectedConsumers} additional connection attempts are rejected.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-neutral-200 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
              <p className="leading-6">
                This is a transparent planning model, not a Pulsar benchmark. Replace its per-partition and per-consumer assumptions with measurements from your payload size, batching, acknowledgments, storage, and handler.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function CapacityBar({
  label,
  value,
  target,
  detail,
  healthy,
}: {
  label: string;
  value: number;
  target: number;
  detail: string;
  healthy: boolean;
}) {
  const width = Math.min(100, Math.round((value / Math.max(1, target)) * 100));

  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <span className={`text-xs font-semibold ${healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {value.toLocaleString()} / {target.toLocaleString()} msg/s
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${healthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
