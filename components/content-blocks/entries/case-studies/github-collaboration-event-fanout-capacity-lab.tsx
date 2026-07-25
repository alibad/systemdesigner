'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Network,
  RadioTower,
  Server,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const deliveriesPerWorkerSecond = 700;
const targetUtilization = 0.7;

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

function formatBandwidth(mbps: number) {
  return mbps >= 1_000 ? `${(mbps / 1_000).toFixed(1)} Gbps` : `${Math.round(mbps)} Mbps`;
}

export default function GitHubCollaborationEventFanoutCapacityLab() {
  const [eventsPerSecond, setEventsPerSecond] = useState(18_000);
  const [subscribersPerEvent, setSubscribersPerEvent] = useState(12);
  const [payloadKilobytes, setPayloadKilobytes] = useState(2);
  const [workers, setWorkers] = useState(650);

  const model = useMemo(() => {
    const deliveryAttempts = eventsPerSecond * subscribersPerEvent;
    const rawCapacity = workers * deliveriesPerWorkerSecond;
    const plannedCapacity = rawCapacity * targetUtilization;
    const targetPressure = (deliveryAttempts / plannedCapacity) * 100;
    const backlogPerMinute = Math.max(0, (deliveryAttempts - plannedCapacity) * 60);
    const egressMbps = (deliveryAttempts * payloadKilobytes * 8) / 1_000;
    const overloaded = deliveryAttempts > plannedCapacity;
    const tight = !overloaded && targetPressure >= 85;

    return {
      deliveryAttempts,
      rawCapacity,
      plannedCapacity,
      targetPressure,
      backlogPerMinute,
      egressMbps,
      overloaded,
      tight,
    };
  }, [eventsPerSecond, payloadKilobytes, subscribersPerEvent, workers]);

  const reset = () => {
    setEventsPerSecond(18_000);
    setSubscribersPerEvent(12);
    setPayloadKilobytes(2);
    setWorkers(650);
  };

  const healthy = !model.overloaded && !model.tight;
  const verdict = model.overloaded
    ? 'The delivery queue grows continuously'
    : model.tight
      ? 'The normal load fits, but failure headroom is thin'
      : 'The modeled fan-out fits inside the operating target';
  const consequence = model.overloaded
    ? `The queue adds ${compact(model.backlogPerMinute)} delivery attempts each minute. Webhooks and derived indexes become stale unless the platform sheds optional work, adds consumers, or reduces amplification.`
    : model.tight
      ? 'A retry burst or worker loss can cross the target. Add capacity before promising the same freshness during a zone or consumer failure.'
      : 'Workers remain below the 70% planning ceiling, leaving room for retries, skewed repositories, and a bounded worker failure without coupling fan-out to the repository write.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Event and fan-out capacity lab"
        title="Turn repository activity into delivery pressure"
        description="Change the source event rate, average subscriber count, payload size, and worker fleet. The model multiplies one durable event into downstream delivery attempts and exposes queue and network consequences."
        icon={RadioTower}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Repository events"
              value={eventsPerSecond}
              output={`${compact(eventsPerSecond)}/s`}
              min={5_000}
              max={50_000}
              step={1_000}
              lowLabel="5K/s"
              highLabel="50K/s"
              onChange={setEventsPerSecond}
            />
            <LabRange
              label="Average subscribers per event"
              value={subscribersPerEvent}
              output={`${subscribersPerEvent}`}
              min={4}
              max={40}
              step={1}
              accent="violet"
              lowLabel="Targeted"
              highLabel="Wide fan-out"
              onChange={setSubscribersPerEvent}
            />
            <LabRange
              label="Event payload"
              value={payloadKilobytes}
              output={`${payloadKilobytes} KB`}
              min={1}
              max={8}
              step={1}
              accent="amber"
              lowLabel="Reference only"
              highLabel="Rich envelope"
              onChange={setPayloadKilobytes}
            />
            <LabRange
              label="Delivery workers"
              value={workers}
              output={workers.toLocaleString()}
              min={100}
              max={1_200}
              step={50}
              accent="blue"
              lowLabel="100"
              highLabel="1,200"
              onChange={setWorkers}
            />
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Assumption: one worker sustains {deliveriesPerWorkerSecond} delivery attempts per second. The operating target reserves 30% of raw capacity for retries, skew, and worker loss.
            </p>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Source events"
            value={`${compact(eventsPerSecond)}/s`}
            detail="Durably accepted once"
            icon={Activity}
            tone="blue"
          />
          <LabMetric
            label="Delivery attempts"
            value={`${compact(model.deliveryAttempts)}/s`}
            detail={`${subscribersPerEvent} subscribers per event`}
            icon={BellRing}
            tone="violet"
          />
          <LabMetric
            label="Event egress"
            value={formatBandwidth(model.egressMbps)}
            detail={`${payloadKilobytes} KB per delivery envelope`}
            icon={Network}
            tone="amber"
          />
          <LabMetric
            label="Planned capacity"
            value={`${compact(model.plannedCapacity)}/s`}
            detail={`${compact(model.rawCapacity)}/s raw fleet ceiling`}
            icon={Server}
            tone={model.overloaded ? 'rose' : 'emerald'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Fan-out amplification</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {compact(eventsPerSecond)} events/s x {subscribersPerEvent} subscribers = {compact(model.deliveryAttempts)} delivery attempts/s
              </p>
            </div>
            <output className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {model.targetPressure.toFixed(0)}% of target
            </output>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
            role="progressbar"
            aria-label="Delivery pressure against the operating target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(model.targetPressure))}
          >
            <div
              className={`h-full transition-[width] duration-200 ${
                model.overloaded ? 'bg-rose-500' : model.tight ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, model.targetPressure)}%` }}
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
            {healthy ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  model.overloaded ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'
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

        <div className="mt-5 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50">
          <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6">
            Capacity is not the merge invariant. The repository write can complete after one durable event append; fan-out freshness is measured and recovered independently.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
