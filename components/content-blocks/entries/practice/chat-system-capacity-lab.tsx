'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Layers3,
  MessageSquare,
  Network,
  RadioTower,
  Users,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type DispatchMode = 'recipient-jobs' | 'gateway-batches';

const WORK_UNITS_PER_SHARD = 5_000;
const TARGET_UTILIZATION = 0.7;
const GATEWAY_BATCH_SIZE = 6;

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function ChatSystemCapacityLab() {
  const [dailyMessagesMillions, setDailyMessagesMillions] = useState(1_000);
  const [peakMultiplier, setPeakMultiplier] = useState(5);
  const [recipients, setRecipients] = useState(4);
  const [onlinePercent, setOnlinePercent] = useState(65);
  const [shards, setShards] = useState(64);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>('gateway-batches');

  const model = useMemo(() => {
    const dailyMessages = dailyMessagesMillions * 1_000_000;
    const averageIngress = dailyMessages / 86_400;
    const peakIngress = averageIngress * peakMultiplier;
    const deliveryAttempts = peakIngress * recipients;
    const onlineAttempts = deliveryAttempts * (onlinePercent / 100);
    const offlineAppends = deliveryAttempts - onlineAttempts;
    const onlineQueueJobs = dispatchMode === 'gateway-batches'
      ? onlineAttempts / GATEWAY_BATCH_SIZE
      : onlineAttempts;
    const queueWork = onlineQueueJobs + offlineAppends;
    const capacity = shards * WORK_UNITS_PER_SHARD;
    const utilization = (queueWork / capacity) * 100;
    const requiredShards = Math.ceil(queueWork / (WORK_UNITS_PER_SHARD * TARGET_UTILIZATION));
    const egressGbps = (onlineAttempts * 700 * 8) / 1_000_000_000;
    const healthy = utilization <= TARGET_UTILIZATION * 100;
    const queueReduction = deliveryAttempts === 0
      ? 0
      : (1 - queueWork / deliveryAttempts) * 100;

    return {
      averageIngress,
      peakIngress,
      deliveryAttempts,
      onlineAttempts,
      offlineAppends,
      queueWork,
      utilization,
      requiredShards,
      egressGbps,
      healthy,
      queueReduction,
    };
  }, [dailyMessagesMillions, dispatchMode, onlinePercent, peakMultiplier, recipients, shards]);

  const reset = () => {
    setDailyMessagesMillions(1_000);
    setPeakMultiplier(5);
    setRecipients(4);
    setOnlinePercent(65);
    setShards(64);
    setDispatchMode('gateway-batches');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and fanout lab"
        title="Size the work after one message becomes many deliveries"
        description="Change the workload and dispatch plan. The model separates logical messages, recipient delivery attempts, queue work, and final socket writes so batching is not mistaken for eliminating fanout."
        icon={RadioTower}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Daily logical messages"
              value={dailyMessagesMillions}
              output={`${(dailyMessagesMillions / 1_000).toFixed(2)}B`}
              min={250}
              max={3_000}
              step={250}
              lowLabel="250M"
              highLabel="3B"
              onChange={setDailyMessagesMillions}
            />
            <LabRange
              label="Peak multiplier"
              value={peakMultiplier}
              output={`${peakMultiplier.toFixed(1)}x`}
              min={2}
              max={8}
              step={0.5}
              lowLabel="2x average"
              highLabel="8x average"
              onChange={setPeakMultiplier}
            />
            <LabRange
              label="Average recipients"
              value={recipients}
              output={recipients.toFixed(0)}
              min={1}
              max={32}
              lowLabel="1:1"
              highLabel="Group-heavy"
              onChange={setRecipients}
            />
            <LabRange
              label="Recipients online"
              value={onlinePercent}
              output={`${onlinePercent}%`}
              min={20}
              max={90}
              step={5}
              lowLabel="More replay"
              highLabel="More live writes"
              onChange={setOnlinePercent}
            />
            <LabRange
              label="Fanout shards"
              value={shards}
              output={shards.toFixed(0)}
              min={16}
              max={256}
              step={16}
              lowLabel="16"
              highLabel="256"
              onChange={setShards}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Online dispatch
              </legend>
              <div className="mt-3 space-y-2">
                <LabChoice
                  selected={dispatchMode === 'recipient-jobs'}
                  label="One queue job per recipient"
                  detail="Simple routing, but every online device creates separate internal work."
                  icon={Users}
                  accent="amber"
                  onClick={() => setDispatchMode('recipient-jobs')}
                />
                <LabChoice
                  selected={dispatchMode === 'gateway-batches'}
                  label="Batch by destination gateway"
                  detail="Model six online recipients per internal batch; socket writes still happen individually."
                  icon={Network}
                  accent="cyan"
                  onClick={() => setDispatchMode('gateway-batches')}
                />
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Peak ingress"
            value={`${compact(model.peakIngress)}/s`}
            detail={`${compact(model.averageIngress)}/s daily average`}
            icon={MessageSquare}
            tone="blue"
          />
          <LabMetric
            label="Delivery attempts"
            value={`${compact(model.deliveryAttempts)}/s`}
            detail="One logical target per recipient"
            icon={Users}
            tone="violet"
          />
          <LabMetric
            label="Queue work"
            value={`${compact(model.queueWork)}/s`}
            detail={`${model.queueReduction.toFixed(0)}% fewer jobs from batching`}
            icon={Layers3}
            tone="cyan"
          />
          <LabMetric
            label="Shard utilization"
            value={`${model.utilization.toFixed(0)}%`}
            detail={`Target <= 70%; need ${model.requiredShards} shards`}
            icon={Gauge}
            tone={model.healthy ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Work expansion at peak
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
                Each accepted message expands into online socket attempts and offline cursor work.
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
              {recipients.toFixed(0)} deliveries/message
            </span>
          </div>

          <div className="mt-5 space-y-4" aria-label="Fanout work breakdown">
            <div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-2 font-semibold text-neutral-700 dark:text-neutral-200">
                  <RadioTower aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                  Online socket attempts
                </span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                  {compact(model.onlineAttempts)}/s
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-cyan-400"
                  style={{ width: `${onlinePercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-2 font-semibold text-neutral-700 dark:text-neutral-200">
                  <Database aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  Offline durable work
                </span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                  {compact(model.offlineAppends)}/s
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-violet-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-violet-400"
                  style={{ width: `${100 - onlinePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
          <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              What batching changes
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              This model assumes 5,000 queue work units per shard, 700 bytes per live envelope, and six online recipients per gateway batch. Internal batching reduces queue and network calls, while the gateway still performs {compact(model.onlineAttempts)} socket writes per second.
            </p>
            <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
              Estimated live egress: {model.egressGbps.toFixed(2)} Gbit/s before protocol overhead.
            </p>
          </div>

          <div
            className={`rounded-md border p-4 ${
              model.healthy
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
            }`}
            aria-live="polite"
          >
            {model.healthy ? (
              <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="h-6 w-6 text-rose-700 dark:text-rose-300" />
            )}
            <p className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
              {model.healthy ? 'Headroom target protected' : 'Fanout capacity is overloaded'}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              {model.healthy
                ? `${shards} shards keep modeled utilization at or below 70%, leaving retry and failure headroom.`
                : `Provision at least ${model.requiredShards} shards, reduce peak admission, or batch destinations before queue age violates delivery latency.`}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Operate on oldest queue age, not depth alone.
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
