'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  MessageSquareText,
  RadioTower,
  Server,
  Smartphone,
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

interface CapacityData {
  title: string;
  description: string;
  activeUsersMillions: RangeData;
  messagesPerUserDay: RangeData;
  groupSize: RangeData;
  offlinePercent: RangeData;
  assumptions: {
    peakMultiplier: number;
    groupMessageShare: number;
    devicesPerUser: number;
    averageEnvelopeBytes: number;
    averageOfflineHours: number;
    retryAllowance: number;
    targetUtilization: number;
  };
  provisionedCapacity: {
    gatewayNodes: number;
    sessionsPerGateway: number;
    queuePartitions: number;
    enqueuesPerPartitionSecond: number;
    ciphertextStorageTiB: number;
    deliveryWorkers: number;
    attemptsPerWorkerSecond: number;
  };
}

type PressureTone = 'emerald' | 'amber' | 'rose';

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeData>;
  return (
    typeof range.default === 'number' &&
    typeof range.min === 'number' &&
    typeof range.max === 'number' &&
    typeof range.step === 'number' &&
    range.min < range.max &&
    range.step > 0 &&
    range.default >= range.min &&
    range.default <= range.max
  );
}

function allPositiveNumbers(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return keys.every((key) => typeof candidate[key] === 'number' && candidate[key] > 0);
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CapacityData>;
  const assumptions = data.assumptions;
  const provisionedCapacity = data.provisionedCapacity;
  if (!assumptions || !provisionedCapacity) return false;

  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    isRangeData(data.activeUsersMillions) &&
    isRangeData(data.messagesPerUserDay) &&
    isRangeData(data.groupSize) &&
    isRangeData(data.offlinePercent) &&
    allPositiveNumbers(assumptions, [
      'peakMultiplier',
      'groupMessageShare',
      'devicesPerUser',
      'averageEnvelopeBytes',
      'averageOfflineHours',
      'retryAllowance',
      'targetUtilization',
    ]) &&
    allPositiveNumbers(provisionedCapacity, [
      'gatewayNodes',
      'sessionsPerGateway',
      'queuePartitions',
      'enqueuesPerPartitionSecond',
      'ciphertextStorageTiB',
      'deliveryWorkers',
      'attemptsPerWorkerSecond',
    ]) &&
    assumptions.groupMessageShare <= 1 &&
    assumptions.retryAllowance <= 1 &&
    assumptions.targetUtilization <= 1
  );
}

function formatCompact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return Math.round(value).toLocaleString();
}

function formatBytes(value: number) {
  const tebibyte = 1024 ** 4;
  const pebibyte = 1024 ** 5;
  if (value >= pebibyte) return `${(value / pebibyte).toFixed(2)} PiB`;
  if (value >= tebibyte) return `${(value / tebibyte).toFixed(1)} TiB`;
  return `${(value / 1024 ** 3).toFixed(0)} GiB`;
}

function pressureTone(pressure: number): PressureTone {
  if (pressure > 1) return 'rose';
  if (pressure >= 0.8) return 'amber';
  return 'emerald';
}

function pressureLabel(pressure: number) {
  if (pressure > 1) return 'Over target';
  if (pressure >= 0.8) return 'Thin headroom';
  return 'Within target';
}

function PressureMeter({
  label,
  value,
  pressure,
  detail,
}: {
  label: string;
  value: string;
  pressure: number;
  detail: string;
}) {
  const tone = pressureTone(pressure);
  const barColor =
    tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="border-b border-neutral-200 py-4 last:border-b-0 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {pressureLabel(pressure)} at {(pressure * 100).toFixed(0)}%
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={`${label} pressure`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(pressure * 100))}
        aria-valuetext={`${(pressure * 100).toFixed(0)} percent of operating target`}
      >
        <div
          className={`h-full transition-[width] duration-200 motion-reduce:transition-none ${barColor}`}
          style={{ width: `${Math.min(100, pressure * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function WhatsappMessagingCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeUsersMillions, setActiveUsersMillions] = useState(0);
  const [messagesPerUserDay, setMessagesPerUserDay] = useState(0);
  const [groupSize, setGroupSize] = useState(0);
  const [offlinePercent, setOfflinePercent] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setLoadError(false);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity model data is invalid');
        setData(payload);
        setActiveUsersMillions(payload.activeUsersMillions.default);
        setMessagesPerUserDay(payload.messagesPerUserDay.default);
        setGroupSize(payload.groupSize.default);
        setOfflinePercent(payload.offlinePercent.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const users = activeUsersMillions * 1_000_000;
    const offlineRatio = offlinePercent / 100;
    const averageSourceMessagesPerSecond = (users * messagesPerUserDay) / 86_400;
    const peakSourceMessagesPerSecond =
      averageSourceMessagesPerSecond * data.assumptions.peakMultiplier;
    const groupRecipients = Math.max(1, groupSize - 1);
    const averageRecipients =
      (1 - data.assumptions.groupMessageShare) +
      data.assumptions.groupMessageShare * groupRecipients;
    const firstDeliveryAttempts = peakSourceMessagesPerSecond * averageRecipients;
    const onlineDeliveries = firstDeliveryAttempts * (1 - offlineRatio);
    const offlineEnqueues = firstDeliveryAttempts * offlineRatio;
    const deliveryAttempts = firstDeliveryAttempts * (1 + data.assumptions.retryAllowance);
    const connectedSessions = users * data.assumptions.devicesPerUser * (1 - offlineRatio);
    const ciphertextBytes =
      offlineEnqueues *
      data.assumptions.averageEnvelopeBytes *
      data.assumptions.averageOfflineHours *
      3600;

    const gatewayCapacity =
      data.provisionedCapacity.gatewayNodes *
      data.provisionedCapacity.sessionsPerGateway *
      data.assumptions.targetUtilization;
    const queueCapacity =
      data.provisionedCapacity.queuePartitions *
      data.provisionedCapacity.enqueuesPerPartitionSecond *
      data.assumptions.targetUtilization;
    const storageCapacity =
      data.provisionedCapacity.ciphertextStorageTiB *
      1024 ** 4 *
      data.assumptions.targetUtilization;
    const deliveryCapacity =
      data.provisionedCapacity.deliveryWorkers *
      data.provisionedCapacity.attemptsPerWorkerSecond *
      data.assumptions.targetUtilization;

    const pressures = {
      gateway: connectedSessions / gatewayCapacity,
      queue: offlineEnqueues / queueCapacity,
      storage: ciphertextBytes / storageCapacity,
      delivery: deliveryAttempts / deliveryCapacity,
    };

    return {
      averageSourceMessagesPerSecond,
      peakSourceMessagesPerSecond,
      averageRecipients,
      firstDeliveryAttempts,
      onlineDeliveries,
      offlineEnqueues,
      deliveryAttempts,
      connectedSessions,
      ciphertextBytes,
      gatewayCapacity,
      queueCapacity,
      storageCapacity,
      deliveryCapacity,
      pressures,
    };
  }, [activeUsersMillions, data, groupSize, messagesPerUserDay, offlinePercent]);

  return (
    <div data-content-block="case-studies/whatsapp-messaging-capacity-lab">
      {loadError ? (
        <div
          role="alert"
          className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          The messaging capacity model could not be loaded.
        </div>
      ) : !data || !model ? (
        <div
          aria-busy="true"
          aria-label="Loading messaging capacity model"
          className="min-h-[760px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Fan-out, storage, and delivery capacity lab"
            title={data.title}
            description={data.description}
            icon={RadioTower}
            accent="cyan"
            onReset={() => {
              setActiveUsersMillions(data.activeUsersMillions.default);
              setMessagesPerUserDay(data.messagesPerUserDay.default);
              setGroupSize(data.groupSize.default);
              setOfflinePercent(data.offlinePercent.default);
            }}
          />
          <LearningLabBody
            controls={
              <div className="space-y-6">
                <LabRange
                  label="Active users"
                  value={activeUsersMillions}
                  output={`${activeUsersMillions}M`}
                  min={data.activeUsersMillions.min}
                  max={data.activeUsersMillions.max}
                  step={data.activeUsersMillions.step}
                  lowLabel="Regional scale"
                  highLabel="Global scale"
                  onChange={setActiveUsersMillions}
                />
                <LabRange
                  label="Messages per user per day"
                  value={messagesPerUserDay}
                  output={messagesPerUserDay.toString()}
                  min={data.messagesPerUserDay.min}
                  max={data.messagesPerUserDay.max}
                  step={data.messagesPerUserDay.step}
                  accent="blue"
                  lowLabel="Quiet"
                  highLabel="Busy"
                  onChange={setMessagesPerUserDay}
                />
                <LabRange
                  label="Typical group size"
                  value={groupSize}
                  output={`${groupSize} members`}
                  min={data.groupSize.min}
                  max={data.groupSize.max}
                  step={data.groupSize.step}
                  accent="violet"
                  lowLabel="Direct chat"
                  highLabel="Large group"
                  onChange={setGroupSize}
                />
                <LabRange
                  label="Offline recipients"
                  value={offlinePercent}
                  output={`${offlinePercent}%`}
                  min={data.offlinePercent.min}
                  max={data.offlinePercent.max}
                  step={data.offlinePercent.step}
                  accent="amber"
                  lowLabel="Mostly online"
                  highLabel="Queue heavy"
                  onChange={setOfflinePercent}
                />
                <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The model assumes {Math.round(data.assumptions.groupMessageShare * 100)}% of
                  sends are group messages, {data.assumptions.devicesPerUser} devices per user,
                  a {data.assumptions.peakMultiplier}x peak multiplier, and a{' '}
                  {Math.round(data.assumptions.targetUtilization * 100)}% operating target.
                </p>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Peak source rate"
                value={`${formatCompact(model.peakSourceMessagesPerSecond)}/s`}
                detail={`${formatCompact(model.averageSourceMessagesPerSecond)}/s daily average`}
                icon={MessageSquareText}
                tone="blue"
              />
              <LabMetric
                label="Recipients per send"
                value={model.averageRecipients.toFixed(1)}
                detail={`${Math.round(data.assumptions.groupMessageShare * 100)}% group-message mix`}
                icon={Users}
                tone="violet"
              />
              <LabMetric
                label="Online delivery"
                value={`${formatCompact(model.onlineDeliveries)}/s`}
                detail={`${100 - offlinePercent}% of recipient attempts`}
                icon={Smartphone}
                tone="emerald"
              />
              <LabMetric
                label="Offline enqueue"
                value={`${formatCompact(model.offlineEnqueues)}/s`}
                detail={`${offlinePercent}% retained for later delivery`}
                icon={Database}
                tone="amber"
              />
            </div>

            <div className="mt-6 border-y border-neutral-200 dark:border-neutral-800">
              <PressureMeter
                label="Gateway connection pressure"
                value={`${formatCompact(model.connectedSessions)} sessions`}
                pressure={model.pressures.gateway}
                detail={`${data.provisionedCapacity.gatewayNodes.toLocaleString()} gateways at ${formatCompact(model.gatewayCapacity)} planned concurrent sessions`}
              />
              <PressureMeter
                label="Offline queue write pressure"
                value={`${formatCompact(model.offlineEnqueues)} enqueues/s`}
                pressure={model.pressures.queue}
                detail={`${data.provisionedCapacity.queuePartitions.toLocaleString()} partitions at ${formatCompact(model.queueCapacity)} planned enqueues/s`}
              />
              <PressureMeter
                label="Ciphertext storage pressure"
                value={formatBytes(model.ciphertextBytes)}
                pressure={model.pressures.storage}
                detail={`${data.assumptions.averageOfflineHours} average queued hours at ${data.assumptions.averageEnvelopeBytes.toLocaleString()} bytes per device envelope`}
              />
              <PressureMeter
                label="Delivery worker pressure"
                value={`${formatCompact(model.deliveryAttempts)} attempts/s`}
                pressure={model.pressures.delivery}
                detail={`${formatCompact(model.firstDeliveryAttempts)}/s first attempts plus ${Math.round(data.assumptions.retryAllowance * 100)}% retry allowance`}
              />
            </div>

            <div
              className={`mt-6 border-l-4 p-4 ${
                Object.values(model.pressures).some((pressure) => pressure > 1)
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                  : Object.values(model.pressures).some((pressure) => pressure >= 0.8)
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {Object.values(model.pressures).some((pressure) => pressure > 1) ? (
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300"
                  />
                ) : (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {Object.values(model.pressures).some((pressure) => pressure > 1)
                      ? 'At least one plane grows work faster than it can clear it'
                      : Object.values(model.pressures).some((pressure) => pressure >= 0.8)
                        ? 'The workload fits, but failure headroom is thin'
                        : 'The illustrative fleet keeps operating headroom'}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.pressures.gateway > 1 ? (
                      <li>Gateway admission and reconnect latency rise as live sessions exceed the target.</li>
                    ) : null}
                    {model.pressures.queue > 1 ? (
                      <li>Offline queue writes back up before devices can even begin replay.</li>
                    ) : null}
                    {model.pressures.storage > 1 ? (
                      <li>Queued ciphertext exceeds the retention budget, forcing more capacity or a shorter expiry.</li>
                    ) : null}
                    {model.pressures.delivery > 1 ? (
                      <li>Recipient delivery lag grows even if sender acceptance remains fast.</li>
                    ) : null}
                    {Object.values(model.pressures).every((pressure) => pressure <= 1) ? (
                      <li>
                        The highest pressure is{' '}
                        {(Math.max(...Object.values(model.pressures)) * 100).toFixed(0)}%; test a
                        reconnect wave and one failed capacity zone before calling the plan safe.
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Server aria-hidden="true" className="h-4 w-4" />
                  Source-to-delivery amplification
                </dt>
                <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {formatCompact(model.peakSourceMessagesPerSecond)}/s source messages become{' '}
                  {formatCompact(model.firstDeliveryAttempts)}/s first recipient attempts.
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <HardDrive aria-hidden="true" className="h-4 w-4" />
                  Storage budget
                </dt>
                <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {formatBytes(model.storageCapacity)} is available at the operating target; expiry
                  bounds growth when devices stay offline.
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Gauge aria-hidden="true" className="h-4 w-4" />
                  Queue budget
                </dt>
                <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  Offline ratio moves work from immediate gateway pushes into durable per-device
                  queue writes and later replay.
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <RadioTower aria-hidden="true" className="h-4 w-4" />
                  Capacity decision
                </dt>
                <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  Scale the first saturated plane; adding gateways cannot repair a storage or
                  delivery-worker bottleneck.
                </dd>
              </div>
            </dl>
          </LearningLabBody>
        </LearningLab>
      )}
    </div>
  );
}
