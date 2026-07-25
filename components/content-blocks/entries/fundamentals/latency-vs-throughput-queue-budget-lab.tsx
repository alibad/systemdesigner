'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Timer, UsersRound } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Capacity = 100 | 150 | 250;
type Target = 200 | 300 | 500;

const capacities: { value: Capacity; label: string; detail: string }[] = [
  { value: 100, label: '100 RPS gate', detail: 'A small pool or one constrained dependency.' },
  { value: 150, label: '150 RPS gate', detail: 'The starting capacity with moderate headroom.' },
  { value: 250, label: '250 RPS gate', detail: 'More capacity, assuming the next dependency has headroom.' },
];

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

export default function LatencyVsThroughputQueueBudgetLab() {
  const [arrivalRate, setArrivalRate] = useState(80);
  const [capacity, setCapacity] = useState<Capacity>(150);
  const [target, setTarget] = useState<Target>(300);

  const model = useMemo(() => {
    const fixedPathMs = 55;
    const utilization = arrivalRate / capacity;
    const stable = utilization < 1;

    if (!stable) {
      return {
        fixedPathMs,
        utilization,
        stable,
        meanLatency: null,
        tailLatency: null,
        meetsTarget: false,
        headline: 'The gate cannot drain the incoming work.',
        explanation: `At ${arrivalRate} RPS in and ${capacity} RPS out, the queue gains ${arrivalRate - capacity} requests every second until requests are shed or time out.`,
      };
    }

    const meanGateMs = 1000 / (capacity - arrivalRate);
    const meanLatency = fixedPathMs + meanGateMs;
    const tailLatency = fixedPathMs + 4.6 * meanGateMs;
    const meetsTarget = tailLatency <= target;
    const fragile = utilization >= 0.85;

    return {
      fixedPathMs,
      utilization,
      stable,
      meanLatency,
      tailLatency,
      meetsTarget,
      headline: meetsTarget
        ? fragile
          ? 'The target holds, but the queue has little burst headroom.'
          : 'The target holds with measurable spare capacity.'
        : 'The queue is stable, but the estimated tail misses the target.',
      explanation: fragile
        ? 'A brief burst or slower dependency can push the tail past the budget because the capacity margin is small.'
        : meetsTarget
          ? 'The gate drains work faster than it arrives, leaving time for normal variation.'
          : 'Add capacity, lower arrivals, shorten the fixed path, or relax the product target deliberately.',
    };
  }, [arrivalRate, capacity, target]);

  const reset = () => {
    setArrivalRate(80);
    setCapacity(150);
    setTarget(300);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Latency budget lab"
        title="See queueing consume the tail-latency budget"
        description="This teaching model keeps 55 ms of fixed work and estimates one constrained service gate. It is useful for reasoning, not a substitute for a load test."
        icon={Timer}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Incoming request rate"
              value={arrivalRate}
              output={`${arrivalRate} RPS`}
              min={40}
              max={300}
              step={10}
              accent="blue"
              lowLabel="40 RPS"
              highLabel="300 RPS"
              onChange={setArrivalRate}
            />

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Effective gate capacity</p>
              <div className="mt-3 space-y-2">
                {capacities.map((option) => (
                  <LabChoice
                    key={option.value}
                    selected={capacity === option.value}
                    label={option.label}
                    detail={option.detail}
                    icon={Gauge}
                    accent={option.value === 100 ? 'amber' : option.value === 150 ? 'blue' : 'emerald'}
                    onClick={() => setCapacity(option.value)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Tail-latency target</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([200, 300, 500] as Target[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={target === option}
                    onClick={() => setTarget(option)}
                    className={`min-h-10 rounded-md border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      target === option
                        ? 'border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                    }`}
                  >
                    {option} ms
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      >
        <div className={`rounded-md border p-4 ${model.meetsTarget ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'}`}>
          <div className="flex items-start gap-3">
            {model.meetsTarget ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.headline}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{model.explanation}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LabMetric label="Gate utilization" value={`${Math.round(model.utilization * 100)}%`} detail={model.stable ? 'Below 100% is necessary, not sufficient.' : 'More work arrives than can complete.'} icon={Gauge} tone={model.stable && model.utilization < 0.85 ? 'emerald' : model.stable ? 'amber' : 'rose'} />
          <LabMetric label="Estimated mean" value={model.meanLatency ? formatMs(model.meanLatency) : 'Unbounded'} detail={model.meanLatency ? `${model.fixedPathMs} ms fixed path plus queueing` : 'No steady queue exists.'} icon={Timer} tone="blue" />
          <LabMetric label="Estimated tail" value={model.tailLatency ? formatMs(model.tailLatency) : 'Unbounded'} detail={model.tailLatency ? `Compared with ${target} ms target` : 'Tail latency grows with the queue.'} icon={UsersRound} tone={model.meetsTarget ? 'emerald' : 'rose'} />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
          <p className="font-semibold text-neutral-950 dark:text-white">Model used</p>
          <p className="mt-1">When arrivals are below capacity, estimated mean time at the constrained gate is `1 / (capacity - arrival rate)`. The displayed tail uses a 4.6x multiplier for an exponential-service approximation. Real paths have multiple queues and uneven service times, so measure them separately.</p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
