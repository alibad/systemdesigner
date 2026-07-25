'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Gauge,
  Layers3,
  Timer,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_ARRIVAL_RATE = 420;
const DEFAULT_WORKERS = 10;
const DEFAULT_SERVICE_MS = 20;

type PressureState = 'healthy' | 'watch' | 'pressure' | 'overloaded';

function estimateQueue(arrivalRate: number, workers: number, serviceMs: number) {
  const perWorkerRate = 1000 / serviceMs;
  const capacity = workers * perWorkerRate;
  const utilization = arrivalRate / capacity;
  const overloaded = utilization >= 1;

  if (overloaded) {
    return {
      backlogAfterTenSeconds: (arrivalRate - capacity) * 10,
      capacity,
      expectedQueueLength: Number.POSITIVE_INFINITY,
      probabilityOfWaiting: 1,
      queueWaitMs: Number.POSITIVE_INFINITY,
      utilization,
    };
  }

  // Erlang C estimates queueing for independent arrivals and similar worker service times.
  const offeredLoad = arrivalRate / perWorkerRate;
  let term = 1;
  let finiteSum = 1;

  for (let index = 1; index < workers; index += 1) {
    term *= offeredLoad / index;
    finiteSum += term;
  }

  const finalTerm = term * (offeredLoad / workers);
  const tailTerm = finalTerm / (1 - utilization);
  const emptyProbability = 1 / (finiteSum + tailTerm);
  const probabilityOfWaiting = tailTerm * emptyProbability;
  const queueWaitSeconds = probabilityOfWaiting / (capacity - arrivalRate);

  return {
    backlogAfterTenSeconds: 0,
    capacity,
    expectedQueueLength: arrivalRate * queueWaitSeconds,
    probabilityOfWaiting,
    queueWaitMs: queueWaitSeconds * 1000,
    utilization,
  };
}

function getPressureState(utilization: number): PressureState {
  if (utilization >= 1) return 'overloaded';
  if (utilization >= 0.85) return 'pressure';
  if (utilization >= 0.7) return 'watch';
  return 'healthy';
}

function formatQueueWait(value: number) {
  if (!Number.isFinite(value)) return 'Unbounded';
  if (value < 1) return '<1 ms';
  return `${Math.round(value)} ms`;
}

const stateCopy: Record<PressureState, { label: string; summary: string }> = {
  healthy: {
    label: 'Measured headroom',
    summary: 'The model has room for ordinary variation, but production evidence still decides whether this is enough.',
  },
  watch: {
    label: 'Watch the tail',
    summary: 'Average capacity is available, while bursts or slower requests can still create a visible queue.',
  },
  pressure: {
    label: 'Queue pressure',
    summary: 'Small changes in demand or service time now cause a disproportionate increase in waiting.',
  },
  overloaded: {
    label: 'No steady state',
    summary: 'Arrivals exceed completions, so the queue grows until traffic falls, work is rejected, or capacity changes.',
  },
};

export default function BottleneckAnalysisQueuePressureLab() {
  const [arrivalRate, setArrivalRate] = useState(DEFAULT_ARRIVAL_RATE);
  const [workers, setWorkers] = useState(DEFAULT_WORKERS);
  const [serviceMs, setServiceMs] = useState(DEFAULT_SERVICE_MS);

  const model = useMemo(() => {
    const queue = estimateQueue(arrivalRate, workers, serviceMs);
    const pressureState = getPressureState(queue.utilization);
    const targetWorkers = Math.ceil((arrivalRate * serviceMs) / (1000 * 0.8));
    const headroom = queue.capacity - arrivalRate;

    return { ...queue, headroom, pressureState, targetWorkers };
  }, [arrivalRate, serviceMs, workers]);

  const copy = stateCopy[model.pressureState];
  const isOverloaded = model.pressureState === 'overloaded';
  const isPressured = model.pressureState === 'pressure';
  const utilizationPercent = model.utilization * 100;
  const utilizationWidth = Math.min(100, utilizationPercent);
  const tone = isOverloaded ? 'rose' : isPressured ? 'amber' : model.pressureState === 'watch' ? 'blue' : 'emerald';

  return (
    <div data-content-block="fundamentals/bottleneck-analysis-queue-pressure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Utilization and queue pressure"
          title="Make the capacity boundary visible"
          description="Change measured demand, concurrency, and average service time. The model shows why queueing rises nonlinearly before a worker pool is completely saturated."
          icon={Gauge}
          accent="cyan"
          onReset={() => {
            setArrivalRate(DEFAULT_ARRIVAL_RATE);
            setWorkers(DEFAULT_WORKERS);
            setServiceMs(DEFAULT_SERVICE_MS);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange
                label="Measured arrivals"
                value={arrivalRate}
                output={`${arrivalRate} req/s`}
                min={100}
                max={1000}
                step={20}
                accent="blue"
                lowLabel="quiet window"
                highLabel="peak window"
                onChange={setArrivalRate}
              />
              <LabRange
                label="Concurrent workers"
                value={workers}
                output={`${workers} workers`}
                min={4}
                max={32}
                accent="violet"
                lowLabel="small pool"
                highLabel="large pool"
                onChange={setWorkers}
              />
              <LabRange
                label="Average service time"
                value={serviceMs}
                output={`${serviceMs} ms`}
                min={10}
                max={100}
                step={5}
                accent="amber"
                lowLabel="short work"
                highLabel="slow work"
                onChange={setServiceMs}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Utilization"
                value={`${Math.round(utilizationPercent)}%`}
                detail={`${arrivalRate} arrivals / ${Math.round(model.capacity)} completions per second`}
                icon={Activity}
                tone={tone}
              />
              <LabMetric
                label="Queue consequence"
                value={isOverloaded ? `${Math.round(model.backlogAfterTenSeconds)} in 10s` : formatQueueWait(model.queueWaitMs)}
                detail={isOverloaded ? 'Estimated backlog growth if demand stays constant.' : `${Math.round(model.probabilityOfWaiting * 100)}% chance an arrival waits in this model.`}
                icon={Timer}
                tone={isOverloaded ? 'rose' : isPressured ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Capacity margin"
                value={`${model.headroom >= 0 ? '+' : ''}${Math.round(model.headroom)} req/s`}
                detail={`${model.targetWorkers} workers would provide about 20% planning headroom at this service time.`}
                icon={UsersRound}
                tone={model.headroom >= 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Worker-pool pressure</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The line at 100% is a hard capacity boundary. The earlier bands are investigation cues, not universal alert thresholds.</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{Math.round(utilizationPercent)}%</span>
              </div>
              <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                <div className="absolute inset-y-0 left-[70%] w-px bg-neutral-500/60" />
                <div className="absolute inset-y-0 left-[85%] w-px bg-neutral-500/60" />
                <div
                  className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                    isOverloaded ? 'bg-rose-500' : isPressured ? 'bg-amber-500' : model.pressureState === 'watch' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${utilizationWidth}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>0%</span>
                <span className="text-center">85% cue</span>
                <span className="text-right">100% limit</span>
              </div>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${
              isOverloaded
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                : isPressured
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
            }`}>
              <div className="flex items-start gap-3">
                {isOverloaded || isPressured ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">{copy.label}</p>
                  <p className="mt-2 text-sm font-semibold">{copy.summary}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {isOverloaded
                      ? `Collect a profile before choosing the fix. At the measured service time, ${model.targetWorkers} workers gives about 20% planning headroom; reducing work or shedding low-priority demand may be safer than increasing concurrency against a saturated dependency.`
                      : `The estimate has about ${Math.max(0, Math.round(model.headroom))} req/s of average headroom. Compare this with burst size, p95 service time, and the pool's real queue-age distribution before changing capacity.`}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <Layers3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              This is an Erlang C planning model: arrivals are independent, workers are equivalent, and work waits in one unbounded queue. Real bursts, retries, priorities, downstream limits, and bounded queues require measured distributions and load tests.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
