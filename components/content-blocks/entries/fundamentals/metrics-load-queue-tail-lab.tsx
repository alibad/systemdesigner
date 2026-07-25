'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Gauge, Server } from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

export default function PerformanceMetricsLoadQueueTailLab() {
  const [arrivalRate, setArrivalRate] = useState(720);
  const [replicas, setReplicas] = useState(6);
  const [tailTarget, setTailTarget] = useState(350);

  const model = useMemo(() => {
    const serviceRatePerReplica = 240;
    const capacity = replicas * serviceRatePerReplica;
    const utilization = arrivalRate / capacity;
    const stable = utilization < 1;

    if (!stable) {
      return {
        capacity,
        utilization,
        stable,
        queueDelay: null,
        p50: null,
        p95: null,
        p99: null,
        meetsTarget: false,
        message: `The queue grows by ${arrivalRate - capacity} requests per second. A percentile is no longer a stable promise.`,
      };
    }

    const queueDelay = Math.min(2_500, 1_000 / (capacity - arrivalRate));
    const p50 = 55 + queueDelay * 0.35;
    const p95 = 78 + queueDelay * 2.5;
    const p99 = 105 + queueDelay * 4.6;
    const meetsTarget = p99 <= tailTarget && utilization <= 0.75;

    return {
      capacity,
      utilization,
      stable,
      queueDelay,
      p50,
      p95,
      p99,
      meetsTarget,
      message: meetsTarget
        ? 'The tail target has headroom for ordinary variation.'
        : p99 > tailTarget
          ? 'The queue is stable, but its tail already misses the user-facing target.'
          : 'The percentile fits today, but sustained utilization leaves too little room for a burst or slower dependency.',
    };
  }, [arrivalRate, replicas, tailTarget]);

  const reset = () => {
    setArrivalRate(720);
    setReplicas(6);
    setTailTarget(350);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Load, queue, and tail-latency lab"
        title="Keep the queue from consuming the tail budget"
        description="Change incoming work, replica count, and the P99 objective. This single-gate model exposes why an average can remain calm while queued work makes the tail fragile."
        icon={Activity}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Incoming request rate"
              value={arrivalRate}
              output={`${arrivalRate.toLocaleString()} RPS`}
              min={240}
              max={1_800}
              step={60}
              accent="blue"
              lowLabel="240 RPS"
              highLabel="1,800 RPS"
              onChange={setArrivalRate}
            />
            <LabRange
              label="Service replicas"
              value={replicas}
              output={replicas.toLocaleString()}
              min={2}
              max={10}
              step={1}
              accent="emerald"
              lowLabel="2 replicas"
              highLabel="10 replicas"
              onChange={setReplicas}
            />
            <LabRange
              label="P99 objective"
              value={tailTarget}
              output={`${tailTarget} ms`}
              min={200}
              max={800}
              step={50}
              accent="violet"
              lowLabel="Interactive API"
              highLabel="Tolerant workflow"
              onChange={setTailTarget}
            />
            <p className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              Each replica completes 240 requests per second. Fixed application work is 55 ms; queueing is estimated from the remaining service margin.
            </p>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className={`rounded-md border p-4 ${model.meetsTarget ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {model.meetsTarget ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="font-semibold">{model.meetsTarget ? 'Tail budget protected' : 'Tail budget at risk'}</p>
                <p className="mt-1 text-sm leading-6 opacity-90">{model.message}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Sustainable capacity" value={`${model.capacity.toLocaleString()} RPS`} detail={`${replicas} replicas x 240 RPS`} icon={Server} tone="blue" />
            <LabMetric label="Utilization" value={`${Math.round(model.utilization * 100)}%`} detail={model.stable ? 'Below 100% is necessary, not enough.' : 'Arrivals exceed completions.'} icon={Gauge} tone={model.utilization <= 0.75 ? 'emerald' : model.stable ? 'amber' : 'rose'} />
            <LabMetric label="Estimated P50 / P95" value={model.p50 == null ? 'Unbounded' : `${formatMs(model.p50)} / ${formatMs(model.p95 ?? 0)}`} detail="Typical versus a slower minority" icon={Clock3} tone="cyan" />
            <LabMetric label="Estimated P99" value={model.p99 == null ? 'Unbounded' : formatMs(model.p99)} detail={`${tailTarget} ms objective`} icon={Clock3} tone={model.p99 != null && model.p99 <= tailTarget ? 'violet' : 'rose'} />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            <p className="font-semibold text-neutral-950 dark:text-white">Read the model as a measurement hypothesis</p>
            <p className="mt-1">Inspect arrival rate, completed RPS, queue age, and P50/P95/P99 together. If arrivals rise while completions flatten and queue age grows, add or protect the constrained capacity before extending timeouts. A real service has multiple queues, variable work, and retries, so verify this direction with a representative load test.</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
