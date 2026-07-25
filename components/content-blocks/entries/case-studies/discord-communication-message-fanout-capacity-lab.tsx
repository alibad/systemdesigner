'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  MessageSquareText,
  Network,
  RadioTower,
  Server,
  Users,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeData {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface MessageFanoutCapacityData {
  title: string;
  description: string;
  sourceMessagesPerSecond: RangeData;
  onlineRecipientsPerMessage: RangeData;
  retryPercent: RangeData;
  workerCount: RangeData;
  deliveryAttemptsPerWorkerSecond: number;
  targetUtilization: number;
  averageEnvelopeBytes: number;
}

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeData>;
  return (
    typeof candidate.default === 'number' &&
    typeof candidate.min === 'number' &&
    typeof candidate.max === 'number' &&
    typeof candidate.step === 'number' &&
    candidate.min < candidate.max &&
    candidate.step > 0 &&
    candidate.default >= candidate.min &&
    candidate.default <= candidate.max
  );
}

function isMessageFanoutCapacityData(value: unknown): value is MessageFanoutCapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MessageFanoutCapacityData>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    isRangeData(candidate.sourceMessagesPerSecond) &&
    isRangeData(candidate.onlineRecipientsPerMessage) &&
    isRangeData(candidate.retryPercent) &&
    isRangeData(candidate.workerCount) &&
    typeof candidate.deliveryAttemptsPerWorkerSecond === 'number' &&
    candidate.deliveryAttemptsPerWorkerSecond > 0 &&
    typeof candidate.targetUtilization === 'number' &&
    candidate.targetUtilization > 0 &&
    candidate.targetUtilization < 1 &&
    typeof candidate.averageEnvelopeBytes === 'number' &&
    candidate.averageEnvelopeBytes > 0
  );
}

function formatRate(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

function formatBandwidth(gigabitsPerSecond: number) {
  if (gigabitsPerSecond >= 1) return `${gigabitsPerSecond.toFixed(1)} Gbps`;
  return `${Math.round(gigabitsPerSecond * 1_000)} Mbps`;
}

export default function DiscordCommunicationMessageFanoutCapacityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MessageFanoutCapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sourceMessagesPerSecond, setSourceMessagesPerSecond] = useState(0);
  const [onlineRecipientsPerMessage, setOnlineRecipientsPerMessage] = useState(0);
  const [retryPercent, setRetryPercent] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMessageFanoutCapacityData(payload)) {
          throw new Error('Capacity model data is invalid');
        }
        setData(payload);
        setSourceMessagesPerSecond(payload.sourceMessagesPerSecond.default);
        setOnlineRecipientsPerMessage(payload.onlineRecipientsPerMessage.default);
        setRetryPercent(payload.retryPercent.default);
        setWorkerCount(payload.workerCount.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const firstAttempts = sourceMessagesPerSecond * onlineRecipientsPerMessage;
    const deliveryAttempts = Math.round(firstAttempts * (1 + retryPercent / 100));
    const rawCapacity = workerCount * data.deliveryAttemptsPerWorkerSecond;
    const plannedCapacity = Math.floor(rawCapacity * data.targetUtilization);
    const targetPressure = plannedCapacity === 0 ? 0 : deliveryAttempts / plannedCapacity;
    const backlogPerMinute = Math.max(0, deliveryAttempts - plannedCapacity) * 60;
    const headroomAttemptsPerSecond = Math.max(0, plannedCapacity - deliveryAttempts);
    const drainSecondsAfterOneMinute =
      plannedCapacity === 0 ? 0 : backlogPerMinute / plannedCapacity;
    const egressGigabitsPerSecond =
      (deliveryAttempts * data.averageEnvelopeBytes * 8) / 1_000_000_000;
    const overloaded = targetPressure > 1;
    const tight = !overloaded && targetPressure >= 0.8;

    return {
      deliveryAttempts,
      rawCapacity,
      plannedCapacity,
      targetPressure,
      backlogPerMinute,
      headroomAttemptsPerSecond,
      drainSecondsAfterOneMinute,
      egressGigabitsPerSecond,
      overloaded,
      tight,
    };
  }, [
    data,
    onlineRecipientsPerMessage,
    retryPercent,
    sourceMessagesPerSecond,
    workerCount,
  ]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        The message fan-out capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading message fan-out capacity model"
        className="min-h-[680px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const reset = () => {
    setSourceMessagesPerSecond(data.sourceMessagesPerSecond.default);
    setOnlineRecipientsPerMessage(data.onlineRecipientsPerMessage.default);
    setRetryPercent(data.retryPercent.default);
    setWorkerCount(data.workerCount.default);
  };

  const stateTone = model.overloaded ? 'rose' : model.tight ? 'amber' : 'emerald';
  const verdict = model.overloaded
    ? 'Durable acceptance is outrunning recipient delivery'
    : model.tight
      ? 'Normal traffic fits, but retry and failure headroom is thin'
      : 'Fan-out fits inside the operating target';
  const consequence = model.overloaded
    ? `The queue adds ${formatRate(model.backlogPerMinute)} delivery attempts per minute. If arrivals stopped after one minute, the planned fleet would still need ${model.drainSecondsAfterOneMinute.toFixed(1)} seconds to drain that backlog.`
    : model.tight
      ? 'A hot channel, reconnect wave, or worker loss can cross the boundary. Shed typing and presence work before durable channel messages start waiting.'
      : 'The fleet keeps retry and failure reserve while delivering accepted messages without sustained queue growth.';
  const userExperience = model.overloaded
    ? 'The sender can see an accepted message while recipients lag. Clients show delayed synchronization, hold newer channel sequences behind a gap, and replay after recovery.'
    : model.tight
      ? 'Messages are prompt now, but a burst can produce visible lag. Ephemeral typing and presence updates should degrade first.'
      : 'Connected recipients receive prompt updates. Retries are deduplicated by message ID, and channel sequence numbers preserve visible order.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Message and fan-out capacity lab"
        title={data.title}
        description={data.description}
        icon={RadioTower}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Accepted messages"
              value={sourceMessagesPerSecond}
              output={`${formatRate(sourceMessagesPerSecond)}/s`}
              min={data.sourceMessagesPerSecond.min}
              max={data.sourceMessagesPerSecond.max}
              step={data.sourceMessagesPerSecond.step}
              lowLabel="Normal region"
              highLabel="Event surge"
              onChange={setSourceMessagesPerSecond}
            />
            <LabRange
              label="Online recipient sessions"
              value={onlineRecipientsPerMessage}
              output={onlineRecipientsPerMessage.toLocaleString()}
              min={data.onlineRecipientsPerMessage.min}
              max={data.onlineRecipientsPerMessage.max}
              step={data.onlineRecipientsPerMessage.step}
              accent="violet"
              lowLabel="Small channels"
              highLabel="Busy channels"
              onChange={setOnlineRecipientsPerMessage}
            />
            <LabRange
              label="Retry attempts"
              value={retryPercent}
              output={`${retryPercent}%`}
              min={data.retryPercent.min}
              max={data.retryPercent.max}
              step={data.retryPercent.step}
              accent="amber"
              lowLabel="Stable network"
              highLabel="Reconnect wave"
              onChange={setRetryPercent}
            />
            <LabRange
              label="Fan-out workers"
              value={workerCount}
              output={workerCount.toLocaleString()}
              min={data.workerCount.min}
              max={data.workerCount.max}
              step={data.workerCount.step}
              accent="blue"
              lowLabel={data.workerCount.min.toLocaleString()}
              highLabel={data.workerCount.max.toLocaleString()}
              onChange={setWorkerCount}
            />
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              One worker sustains {data.deliveryAttemptsPerWorkerSecond.toLocaleString()} attempts/s in this model. The operating target uses only{' '}
              {Math.round(data.targetUtilization * 100)}% of raw capacity so retries, hot partitions, and worker loss have room.
            </p>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Source messages"
            value={`${formatRate(sourceMessagesPerSecond)}/s`}
            detail="Authorized and durably accepted once"
            icon={MessageSquareText}
            tone="blue"
          />
          <LabMetric
            label="Delivery attempts"
            value={`${formatRate(model.deliveryAttempts)}/s`}
            detail={`${onlineRecipientsPerMessage} sessions plus ${retryPercent}% retries`}
            icon={Users}
            tone="violet"
          />
          <LabMetric
            label="Fan-out egress"
            value={formatBandwidth(model.egressGigabitsPerSecond)}
            detail={`${data.averageEnvelopeBytes.toLocaleString()} bytes per envelope`}
            icon={Network}
            tone="amber"
          />
          <LabMetric
            label="Planned capacity"
            value={`${formatRate(model.plannedCapacity)}/s`}
            detail={`${formatRate(model.rawCapacity)}/s raw ceiling`}
            icon={Server}
            tone={stateTone}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Fan-out amplification</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {formatRate(sourceMessagesPerSecond)} messages/s x {onlineRecipientsPerMessage} sessions x {(1 + retryPercent / 100).toFixed(2)} attempts = {formatRate(model.deliveryAttempts)} deliveries/s
              </p>
            </div>
            <output className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {(model.targetPressure * 100).toFixed(0)}% of target
            </output>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
            role="progressbar"
            aria-label="Fan-out pressure against the operating target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(model.targetPressure * 100))}
            aria-valuetext={`${(model.targetPressure * 100).toFixed(0)} percent of the operating target`}
          >
            <div
              className={`h-full transition-[width] duration-200 motion-reduce:transition-none ${
                model.overloaded ? 'bg-rose-500' : model.tight ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, model.targetPressure * 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.overloaded
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
              : model.tight
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.overloaded ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  model.tight ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Operational consequence</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{verdict}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{consequence}</p>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-neutral-200 pt-5 sm:grid-cols-2 dark:border-neutral-800">
          <div className="min-w-0">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Delivery semantics
            </dt>
            <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">At-least-once attempts with stable message IDs and client deduplication.</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Clock3 aria-hidden="true" className="h-4 w-4" />
              Ordering boundary
            </dt>
            <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">One monotonic sequence per channel; no global order across unrelated channels.</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Backpressure signal
            </dt>
            <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {model.overloaded
                ? `${formatRate(model.backlogPerMinute)} queued attempts added per minute.`
                : `${formatRate(model.headroomAttemptsPerSecond)}/s remains before the operating target.`}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <RadioTower aria-hidden="true" className="h-4 w-4" />
              User-visible behavior
            </dt>
            <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{userExperience}</dd>
          </div>
        </dl>
      </LearningLabBody>
    </LearningLab>
  );
}
