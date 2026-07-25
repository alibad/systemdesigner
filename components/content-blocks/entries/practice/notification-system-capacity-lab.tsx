'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type QueueMode = 'pooled' | 'reserved';

const BLOCK_ID = 'practice/notification-system-capacity-lab';
const SECONDS_PER_DAY = 86_400;
const CRITICAL_SHARE = 0.15;
const CRITICAL_RESERVATION = 0.25;
const TARGET_UTILIZATION = 0.7;

function compact(value: number) {
  if (!Number.isFinite(value)) return 'Unbounded';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}


function duration(seconds: number) {
  if (!Number.isFinite(seconds)) return 'Cannot drain';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  if (seconds < 3_600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3_600).toFixed(1)} hr`;
}

export default function NotificationSystemCapacityLab() {
  const [dailyMillions, setDailyMillions] = useState(100);
  const [peakMultiplier, setPeakMultiplier] = useState(40);
  const [channelsPerIntent, setChannelsPerIntent] = useState(1.4);
  const [dispatchCapacityThousands, setDispatchCapacityThousands] = useState(100);
  const [burstMinutes, setBurstMinutes] = useState(10);
  const [queueMode, setQueueMode] = useState<QueueMode>('reserved');

  const model = useMemo(() => {
    const dailyIntents = dailyMillions * 1_000_000;
    const averageIntents = dailyIntents / SECONDS_PER_DAY;
    const peakIntents = averageIntents * peakMultiplier;
    const averageAttempts = averageIntents * channelsPerIntent;
    const peakAttempts = peakIntents * channelsPerIntent;
    const dispatchCapacity = dispatchCapacityThousands * 1_000;
    const utilization = (peakAttempts / dispatchCapacity) * 100;
    const burstSeconds = burstMinutes * 60;

    let criticalCapacity = dispatchCapacity;
    let normalCapacity = dispatchCapacity;
    if (queueMode === 'reserved') {
      criticalCapacity = dispatchCapacity * CRITICAL_RESERVATION;
      normalCapacity = dispatchCapacity - criticalCapacity;
    }

    const criticalArrival = peakAttempts * CRITICAL_SHARE;
    const normalArrival = peakAttempts - criticalArrival;
    const criticalBacklog = queueMode === 'reserved'
      ? Math.max(0, criticalArrival - criticalCapacity) * burstSeconds
      : Math.max(0, peakAttempts - dispatchCapacity) * burstSeconds * CRITICAL_SHARE;
    const normalBacklog = queueMode === 'reserved'
      ? Math.max(0, normalArrival - normalCapacity) * burstSeconds
      : Math.max(0, peakAttempts - dispatchCapacity) * burstSeconds * (1 - CRITICAL_SHARE);
    const backlog = criticalBacklog + normalBacklog;
    const postBurstHeadroom = dispatchCapacity - averageAttempts;
    const drainSeconds = backlog === 0
      ? 0
      : postBurstHeadroom > 0
        ? backlog / postBurstHeadroom
        : Number.POSITIVE_INFINITY;
    const criticalQueueAge = queueMode === 'reserved'
      ? criticalBacklog / Math.max(criticalCapacity, 1)
      : backlog / Math.max(dispatchCapacity, 1);
    const requiredCapacity = Math.ceil(peakAttempts / TARGET_UTILIZATION / 1_000) * 1_000;
    const healthy = utilization <= TARGET_UTILIZATION * 100;
    const criticalProtected = criticalQueueAge < 1;

    return {
      averageIntents,
      peakIntents,
      peakAttempts,
      dispatchCapacity,
      utilization,
      backlog,
      drainSeconds,
      criticalQueueAge,
      requiredCapacity,
      healthy,
      criticalProtected,
      criticalArrival,
      normalArrival,
      criticalCapacity,
      normalCapacity,
    };
  }, [burstMinutes, channelsPerIntent, dailyMillions, dispatchCapacityThousands, peakMultiplier, queueMode]);

  const reset = () => {
    setDailyMillions(100);
    setPeakMultiplier(40);
    setChannelsPerIntent(1.4);
    setDispatchCapacityThousands(100);
    setBurstMinutes(10);
    setQueueMode('reserved');
  };

  const criticalWidth = Math.min(100, (model.criticalArrival / Math.max(model.criticalCapacity, 1)) * 100);
  const normalWidth = Math.min(100, (model.normalArrival / Math.max(model.normalCapacity, 1)) * 100);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Burst and fanout lab"
          title="Size delivery work, not only accepted intents"
          description="Change the workload, average channel fanout, burst duration, and dispatch capacity. The model shows when a fast ingestion path creates a delivery backlog and whether critical traffic remains isolated."
          icon={BellRing}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <LabRange
                label="Daily notification intents"
                value={dailyMillions}
                output={`${dailyMillions}M`}
                min={25}
                max={250}
                step={25}
                lowLabel="25M"
                highLabel="250M"
                onChange={setDailyMillions}
              />
              <LabRange
                label="Peak multiplier"
                value={peakMultiplier}
                output={`${peakMultiplier}x`}
                min={5}
                max={50}
                step={5}
                lowLabel="Routine"
                highLabel="Campaign burst"
                onChange={setPeakMultiplier}
              />
              <LabRange
                label="Channels per intent"
                value={channelsPerIntent}
                output={channelsPerIntent.toFixed(1)}
                min={1}
                max={2.5}
                step={0.1}
                lowLabel="One channel"
                highLabel="Fallback-heavy"
                onChange={setChannelsPerIntent}
              />
              <LabRange
                label="Dispatch capacity"
                value={dispatchCapacityThousands}
                output={`${dispatchCapacityThousands}K/s`}
                min={20}
                max={200}
                step={10}
                lowLabel="20K/s"
                highLabel="200K/s"
                onChange={setDispatchCapacityThousands}
              />
              <LabRange
                label="Burst duration"
                value={burstMinutes}
                output={`${burstMinutes} min`}
                min={1}
                max={30}
                lowLabel="1 min"
                highLabel="30 min"
                onChange={setBurstMinutes}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Queue isolation
                </legend>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={queueMode === 'pooled'}
                    label="One pooled FIFO lane"
                    detail="All channels and priorities compete for the same dispatch slots."
                    icon={Layers3}
                    accent="amber"
                    onClick={() => setQueueMode('pooled')}
                  />
                  <LabChoice
                    selected={queueMode === 'reserved'}
                    label="Reserve 25% for critical work"
                    detail="Critical attempts use an isolated lane; normal traffic uses the remaining capacity."
                    icon={ShieldCheck}
                    accent="cyan"
                    onClick={() => setQueueMode('reserved')}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Peak intents"
              value={`${compact(model.peakIntents)}/s`}
              detail={`${compact(model.averageIntents)}/s daily average`}
              icon={BellRing}
              tone="blue"
            />
            <LabMetric
              label="Provider attempts"
              value={`${compact(model.peakAttempts)}/s`}
              detail={`${channelsPerIntent.toFixed(1)} channels per accepted intent`}
              icon={Activity}
              tone="violet"
            />
            <LabMetric
              label="Dispatch utilization"
              value={`${model.utilization.toFixed(0)}%`}
              detail={`70% target; ${compact(model.requiredCapacity)}/s required`}
              icon={Gauge}
              tone={model.healthy ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Queued attempts"
              value={compact(model.backlog)}
              detail={model.backlog === 0 ? 'No modeled burst backlog' : `Drain in ${duration(model.drainSeconds)}`}
              icon={TimerReset}
              tone={model.backlog === 0 ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Lane pressure at peak
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  Critical work is modeled as 15% of attempts. Capacity bars fill at 100%; labels retain the exact rate.
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                {compact(model.dispatchCapacity)}/s total
              </span>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">Critical lane</span>
                  <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                    {compact(model.criticalArrival)}/s arriving, {compact(model.criticalCapacity)}/s capacity
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                      model.criticalProtected ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-rose-600 dark:bg-rose-400'
                    }`}
                    style={{ width: `${criticalWidth}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">Normal lane</span>
                  <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                    {compact(model.normalArrival)}/s arriving, {compact(model.normalCapacity)}/s capacity
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                      normalWidth < 100 ? 'bg-cyan-600 dark:bg-cyan-400' : 'bg-amber-600 dark:bg-amber-400'
                    }`}
                    style={{ width: `${normalWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mt-5 rounded-md border p-5 ${
              model.criticalProtected
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {model.criticalProtected ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold text-neutral-950 dark:text-white">
                  {model.criticalProtected ? 'Critical queue stays current' : 'Critical delivery SLO is at risk'}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.criticalProtected
                    ? model.healthy
                      ? 'The modeled burst remains below the fleet headroom target, so retries and a worker loss have room to recover.'
                      : 'Priority isolation protects critical work, but normal work accumulates. Admission control and queue-age alerts are still required.'
                    : `Critical queue age reaches about ${duration(model.criticalQueueAge)}. Add reserved capacity, reduce admitted burst traffic, or use a channel with available quota.`}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
