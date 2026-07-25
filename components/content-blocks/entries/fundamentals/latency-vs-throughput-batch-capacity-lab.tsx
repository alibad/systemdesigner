'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, Clock3, UsersRound } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Workload = 'interactive' | 'background';

const workloads: Record<Workload, { label: string; detail: string; deadlineMs: number; accent: 'blue' | 'violet' }> = {
  interactive: {
    label: 'Interactive API',
    detail: 'A user waits for the result. Keep the end-to-end budget at 200 ms.',
    deadlineMs: 200,
    accent: 'blue',
  },
  background: {
    label: 'Background job',
    detail: 'A worker can wait for efficiency. Use a 2 second batch-age budget.',
    deadlineMs: 2000,
    accent: 'violet',
  },
};

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} s` : `${Math.round(value)} ms`;
}

export default function LatencyVsThroughputBatchCapacityLab() {
  const [workload, setWorkload] = useState<Workload>('interactive');
  const [batchSize, setBatchSize] = useState(10);
  const [workers, setWorkers] = useState(2);
  const [arrivalRate, setArrivalRate] = useState(250);

  const model = useMemo(() => {
    const fixedBatchOverheadMs = 12;
    const itemWorkMs = 3;
    const batchRunMs = fixedBatchOverheadMs + itemWorkMs * batchSize;
    const perWorkerRps = (1000 * batchSize) / batchRunMs;
    const capacityRps = perWorkerRps * workers;
    const stable = arrivalRate < capacityRps;
    const averageFillMs = (1000 * (batchSize - 1)) / (2 * arrivalRate);
    const estimatedLatencyMs = averageFillMs + batchRunMs;
    const deadlineMs = workloads[workload].deadlineMs;
    const meetsDeadline = stable && estimatedLatencyMs <= deadlineMs;

    return {
      batchRunMs,
      perWorkerRps,
      capacityRps,
      stable,
      averageFillMs,
      estimatedLatencyMs,
      deadlineMs,
      meetsDeadline,
      headline: !stable
        ? 'Workers cannot keep up with this arrival rate.'
        : meetsDeadline
          ? 'This shape meets the selected deadline.'
          : 'The batch is efficient, but too slow for the selected deadline.',
      explanation: !stable
        ? `Incoming work exceeds the estimated ${Math.round(capacityRps)} RPS capacity, so queued batches age without bound.`
        : meetsDeadline
          ? `Each batch amortizes ${fixedBatchOverheadMs} ms of fixed work while keeping average fill time inside the deadline.`
          : 'Reduce the batch size, add workers only if the downstream can absorb them, or route this work to an asynchronous path.',
    };
  }, [arrivalRate, batchSize, workers, workload]);

  const reset = () => {
    setWorkload('interactive');
    setBatchSize(10);
    setWorkers(2);
    setArrivalRate(250);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Batch and concurrency lab"
        title="Trade per-item latency for completed work"
        description="Each batch has 12 ms of fixed overhead plus 3 ms per item. The model exposes the cost of filling and processing a batch before every item completes."
        icon={Boxes}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload deadline</p>
              <div className="mt-3 space-y-2">
                {(Object.keys(workloads) as Workload[]).map((id) => (
                  <LabChoice
                    key={id}
                    selected={workload === id}
                    label={workloads[id].label}
                    detail={workloads[id].detail}
                    icon={id === 'interactive' ? Clock3 : Boxes}
                    accent={workloads[id].accent}
                    onClick={() => setWorkload(id)}
                  />
                ))}
              </div>
            </div>

            <LabRange
              label="Batch size"
              value={batchSize}
              output={`${batchSize} items`}
              min={1}
              max={100}
              step={1}
              accent="violet"
              lowLabel="1 item"
              highLabel="100 items"
              onChange={setBatchSize}
            />

            <LabRange
              label="Parallel workers"
              value={workers}
              output={`${workers} workers`}
              min={1}
              max={8}
              step={1}
              accent="blue"
              lowLabel="1 worker"
              highLabel="8 workers"
              onChange={setWorkers}
            />

            <LabRange
              label="Incoming items"
              value={arrivalRate}
              output={`${arrivalRate} items/s`}
              min={25}
              max={2000}
              step={25}
              accent="emerald"
              lowLabel="25 items/s"
              highLabel="2,000 items/s"
              onChange={setArrivalRate}
            />
          </div>
        }
      >
        <div className={`rounded-md border p-4 ${model.meetsDeadline ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`}>
          <div className="flex items-start gap-3">
            {model.meetsDeadline ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.headline}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{model.explanation}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric label="Batch run time" value={formatMs(model.batchRunMs)} detail="Fixed work plus per-item work" icon={Clock3} tone="violet" />
          <LabMetric label="Average fill wait" value={formatMs(model.averageFillMs)} detail="Earlier items wait longer" icon={UsersRound} tone="amber" />
          <LabMetric label="Capacity" value={`${Math.round(model.capacityRps)} items/s`} detail={`${Math.round(model.perWorkerRps)} per worker`} icon={Boxes} tone={model.stable ? 'emerald' : 'rose'} />
          <LabMetric label="Estimated item time" value={model.stable ? formatMs(model.estimatedLatencyMs) : 'Unbounded'} detail={`${formatMs(model.deadlineMs)} workload deadline`} icon={Clock3} tone={model.meetsDeadline ? 'emerald' : 'rose'} />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
          <p className="font-semibold text-neutral-950 dark:text-white">What this makes visible</p>
          <p className="mt-1">A larger batch increases items completed per fixed overhead, but it also increases run time and fill wait. More workers raise the model's capacity only while CPU, storage, and downstream limits have headroom. In production, cap both batch size and maximum batch age.</p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
