'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  CloudCog,
  FileStack,
  Gauge,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Workload {
  id: string;
  label: string;
  detail: string;
  inputGiB: number;
  fileCount: number;
  complexityFactor: number;
}

interface WorkerProfile {
  id: string;
  label: string;
  detail: string;
  dpuPerWorker: number;
  throughputGiBPerHour: number;
}

interface CapacityData {
  title: string;
  description: string;
  assumptions: {
    dpuHourUsd: number;
    fileOpenSeconds: number;
    autoScalingAverageFraction: number;
    targetRuntimeMinutes: number;
  };
  defaults: {
    workloadId: string;
    workerId: string;
    maximumWorkers: number;
    runsPerDay: number;
  };
  workloads: Workload[];
  workers: WorkerProfile[];
}

const BLOCK_ID = 'technology/glue-cost';

function valid(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.assumptions &&
      candidate.defaults &&
      Array.isArray(candidate.workloads) &&
      candidate.workloads.length &&
      Array.isArray(candidate.workers) &&
      candidate.workers.length,
  );
}

export default function GlueCostCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No Glue planning assumptions were supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!valid(payload)) throw new Error('Glue planning assumptions are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load Glue planning assumptions.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Capacity lab unavailable" detail={error} />;
  if (!data) return <State title="Loading capacity lab" detail="Preparing Glue job assumptions..." />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [workerId, setWorkerId] = useState(data.defaults.workerId);
  const [maximumWorkers, setMaximumWorkers] = useState(data.defaults.maximumWorkers);
  const [runsPerDay, setRunsPerDay] = useState(data.defaults.runsPerDay);
  const [autoScaling, setAutoScaling] = useState(true);
  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const worker = data.workers.find((item) => item.id === workerId) ?? data.workers[0];

  const result = useMemo(() => {
    const averageWorkers = autoScaling
      ? Math.max(2, maximumWorkers * data.assumptions.autoScalingAverageFraction)
      : maximumWorkers;
    const scanHours =
      (workload.inputGiB * workload.complexityFactor) /
      Math.max(1, averageWorkers * worker.throughputGiBPerHour);
    const fileOpenHours =
      (workload.fileCount * data.assumptions.fileOpenSeconds) /
      Math.max(1, averageWorkers) /
      3600;
    const runtimeHours = scanHours + fileOpenHours;
    const dpuHours = averageWorkers * worker.dpuPerWorker * runtimeHours;
    const jobCost = dpuHours * data.assumptions.dpuHourUsd;
    const monthlyCompute = jobCost * runsPerDay * 30;
    const averageFileMiB = (workload.inputGiB * 1024) / workload.fileCount;
    const targetPass = runtimeHours * 60 <= data.assumptions.targetRuntimeMinutes;
    const tinyFileRisk = averageFileMiB < 32;

    return {
      averageFileMiB,
      averageWorkers,
      dpuHours,
      jobCost,
      monthlyCompute,
      runtimeHours,
      targetPass,
      tinyFileRisk,
    };
  }, [autoScaling, data.assumptions, maximumWorkers, runsPerDay, worker, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setWorkerId(data.defaults.workerId);
    setMaximumWorkers(data.defaults.maximumWorkers);
    setRunsPerDay(data.defaults.runsPerDay);
    setAutoScaling(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Glue job envelope lab" title={data.title} description={data.description} icon={CloudCog} accent="blue" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload shape</legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice key={item.id} selected={item.id === workload.id} label={item.label} detail={item.detail} icon={FileStack} accent="blue" onClick={() => setWorkloadId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Worker profile</legend>
                <div className="mt-3 grid gap-2">
                  {data.workers.map((item) => (
                    <LabChoice key={item.id} selected={item.id === worker.id} label={item.label} detail={item.detail} icon={Boxes} accent={item.id.includes('memory') ? 'violet' : 'cyan'} onClick={() => setWorkerId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Maximum workers" value={maximumWorkers} output={`${maximumWorkers}`} min={2} max={80} step={2} accent="cyan" lowLabel="2" highLabel="80 workers" onChange={setMaximumWorkers} />
              <LabRange label="Runs per day" value={runsPerDay} output={`${runsPerDay}`} min={1} max={24} accent="amber" lowLabel="Daily" highLabel="Hourly" onChange={setRunsPerDay} />
              <LabChoice selected={autoScaling} label="Auto Scaling" detail="Model average active workers below the configured maximum as stages expand and contract." icon={Scale} accent="emerald" onClick={() => setAutoScaling((value) => !value)} />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.targetPass && !result.tinyFileRisk ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.targetPass && !result.tinyFileRisk ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Planning verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {!result.targetPass
                      ? 'The modeled run misses its completion-time target'
                      : result.tinyFileRisk
                        ? 'File-open overhead dominates an otherwise adequate worker plan'
                        : 'The selected job has runtime and file-shape headroom'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    Throughput and unit price are explicit planning assumptions. Replace them with the deployed region, Glue version, worker type, Spark UI evidence, and measured DPU-seconds before approving spend.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Modeled runtime" value={`${Math.round(result.runtimeHours * 60)} min`} detail={`${data.assumptions.targetRuntimeMinutes}-minute target`} icon={Clock3} tone={result.targetPass ? 'emerald' : 'rose'} />
              <LabMetric label="DPU-hours" value={result.dpuHours.toFixed(1)} detail={`${result.averageWorkers.toFixed(1)} average active workers`} icon={Gauge} tone="cyan" />
              <LabMetric label="Compute per run" value={`$${result.jobCost.toFixed(2)}`} detail={`Example $${data.assumptions.dpuHourUsd.toFixed(2)} per DPU-hour`} icon={CircleDollarSign} tone="blue" />
              <LabMetric label="Monthly compute" value={`$${Math.round(result.monthlyCompute).toLocaleString()}`} detail={`${runsPerDay} runs/day; excludes adjacent services`} icon={BarChart3} tone="violet" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Input scan" value={`${workload.inputGiB.toLocaleString()} GiB`} detail={`${workload.complexityFactor.toFixed(1)}x transform complexity assumption`} />
              <Stage title="Object shape" value={`${workload.fileCount.toLocaleString()} files`} detail={`${result.averageFileMiB.toFixed(1)} MiB average; measure the distribution`} warning={result.tinyFileRisk} />
              <Stage title="Compute profile" value={`${worker.dpuPerWorker} DPU/worker`} detail={`${worker.throughputGiBPerHour} GiB/hour/worker benchmark assumption`} />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ title, value, detail, warning = false }: { title: string; value: string; detail: string; warning?: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${warning ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'}`}>
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function State({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p></div></LearningLabBody></LearningLab></div>;
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
