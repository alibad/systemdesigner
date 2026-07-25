'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Gauge,
  Layers3,
  MemoryStick,
  Rows3,
  ScanLine,
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

type Workload = {
  id: string;
  label: string;
  detail: string;
  defaultDocumentMiB: number;
  maximumDocumentMiB: number;
  recordMiB: number;
  requiresRandomAccess: boolean;
  accessReason: string;
};

type ParseMode = {
  id: 'tree' | 'stream';
  label: string;
  detail: string;
  allowsRandomAccess: boolean;
};

type WorkloadModel = {
  title: string;
  description: string;
  assumptions: {
    treeExpansionFactor: number;
    streamWindowMiB: number;
    streamRecordFactor: number;
    workerBudgetMiB: number;
  };
  defaults: {
    workloadId: string;
    modeId: ParseMode['id'];
    concurrentWorkers: number;
  };
  workloads: Workload[];
  modes: ParseMode[];
};

const BLOCK_ID = 'technology/lxml-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/lxml/data/workload-envelope.json';

function isWorkloadModel(value: unknown): value is WorkloadModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.assumptions
      && candidate.defaults
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.defaultDocumentMiB === 'number'
        && typeof workload.maximumDocumentMiB === 'number'
        && typeof workload.recordMiB === 'number'
        && typeof workload.requiresRandomAccess === 'boolean'
      ))
      && Array.isArray(candidate.modes)
      && candidate.modes.length === 2,
  );
}

export default function LxmlPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<WorkloadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isWorkloadModel(payload)) throw new Error('The workload model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the workload model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        title="Workload planner unavailable"
        detail={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  if (!data) {
    return <LoadState title="Loading workload planner" detail="Preparing the memory-envelope assumptions..." />;
  }

  return <WorkloadPlanner data={data} />;
}

function WorkloadPlanner({ data }: { data: WorkloadModel }) {
  const defaultWorkload = data.workloads.find((item) => item.id === data.defaults.workloadId)
    ?? data.workloads[0];
  const [workloadId, setWorkloadId] = useState(defaultWorkload.id);
  const [modeId, setModeId] = useState<ParseMode['id']>(data.defaults.modeId);
  const [documentMiB, setDocumentMiB] = useState(defaultWorkload.defaultDocumentMiB);
  const [concurrentWorkers, setConcurrentWorkers] = useState(data.defaults.concurrentWorkers);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];

  const result = useMemo(() => {
    const treePerWorkerMiB = documentMiB * data.assumptions.treeExpansionFactor;
    const streamPerWorkerMiB = data.assumptions.streamWindowMiB
      + workload.recordMiB * data.assumptions.streamRecordFactor;
    const selectedPerWorkerMiB = mode.id === 'tree' ? treePerWorkerMiB : streamPerWorkerMiB;
    const selectedFleetMiB = selectedPerWorkerMiB * concurrentWorkers;
    const budgetMiB = data.assumptions.workerBudgetMiB * concurrentWorkers;
    const fitsBudget = selectedFleetMiB <= budgetMiB;
    const satisfiesAccess = mode.allowsRandomAccess || !workload.requiresRandomAccess;
    const reduction = Math.max(0, 1 - streamPerWorkerMiB / treePerWorkerMiB);

    return {
      budgetMiB,
      fitsBudget,
      reduction,
      satisfiesAccess,
      selectedFleetMiB,
      selectedPerWorkerMiB,
      streamPerWorkerMiB,
      treePerWorkerMiB,
    };
  }, [concurrentWorkers, data.assumptions, documentMiB, mode, workload]);

  const healthy = result.fitsBudget && result.satisfiesAccess;
  const status = !result.satisfiesAccess
    ? {
        title: 'The mode cannot satisfy this access pattern by itself',
        detail: workload.accessReason,
        Icon: CircleAlert,
        style: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
      }
    : !result.fitsBudget
      ? {
          title: 'The modeled worker set exceeds its memory envelope',
          detail: 'Reduce concurrency, choose streaming when the algorithm permits it, or measure and provision a larger worker budget.',
          Icon: TriangleAlert,
          style: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
        }
      : {
          title: 'The mode fits the modeled access and memory constraints',
          detail: 'Treat this as a design hypothesis. Benchmark representative documents and include Python objects, output buffers, and application state in the real memory limit.',
          Icon: CheckCircle2,
          style: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
        };

  const reset = () => {
    setWorkloadId(defaultWorkload.id);
    setModeId(data.defaults.modeId);
    setDocumentMiB(defaultWorkload.defaultDocumentMiB);
    setConcurrentWorkers(data.defaults.concurrentWorkers);
  };

  function chooseWorkload(next: Workload) {
    setWorkloadId(next.id);
    setDocumentMiB(next.defaultDocumentMiB);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Tree or stream lab"
          title={data.title}
          description={data.description}
          icon={FileSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.requiresRandomAccess ? Layers3 : Rows3}
                      accent={item.requiresRandomAccess ? 'violet' : 'cyan'}
                      onClick={() => chooseWorkload(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Processing mode
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.modes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'tree' ? Layers3 : ScanLine}
                      accent={item.id === 'tree' ? 'violet' : 'emerald'}
                      onClick={() => setModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Document size"
                value={documentMiB}
                output={`${documentMiB} MiB`}
                min={1}
                max={workload.maximumDocumentMiB}
                step={1}
                accent="cyan"
                lowLabel="1 MiB"
                highLabel={`${workload.maximumDocumentMiB} MiB`}
                onChange={setDocumentMiB}
              />
              <LabRange
                label="Concurrent workers"
                value={concurrentWorkers}
                output={`${concurrentWorkers}`}
                min={1}
                max={16}
                step={1}
                accent="amber"
                lowLabel="1"
                highLabel="16 workers"
                onChange={setConcurrentWorkers}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <section className={`rounded-md border p-5 ${status.style}`}>
              <div className="flex items-start gap-3">
                <status.Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Planning verdict</p>
                  <h4 className="mt-1 text-lg font-semibold">{status.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{status.detail}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Selected mode"
                value={mode.id === 'tree' ? 'Full tree' : 'Stream records'}
                detail={workload.requiresRandomAccess ? 'Workload needs cross-tree access' : 'Records can be handled independently'}
                icon={mode.id === 'tree' ? Layers3 : Rows3}
                tone={result.satisfiesAccess ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Per worker"
                value={`${Math.round(result.selectedPerWorkerMiB)} MiB`}
                detail={`${data.assumptions.workerBudgetMiB} MiB planning budget`}
                icon={MemoryStick}
                tone={result.fitsBudget ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Worker set"
                value={`${Math.round(result.selectedFleetMiB)} MiB`}
                detail={`${Math.round(result.budgetMiB)} MiB combined envelope`}
                icon={Boxes}
                tone={healthy ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Stream delta"
                value={`${Math.round(result.reduction * 100)}% lower`}
                detail="Model comparison against retaining the full tree"
                icon={Gauge}
                tone="violet"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <EnvelopeBar
                label="Full-tree model"
                valueMiB={result.treePerWorkerMiB}
                maximumMiB={Math.max(result.treePerWorkerMiB, data.assumptions.workerBudgetMiB)}
                detail={`${documentMiB} MiB input x ${data.assumptions.treeExpansionFactor}x teaching factor`}
                tone="violet"
              />
              <EnvelopeBar
                label="Streaming model"
                valueMiB={result.streamPerWorkerMiB}
                maximumMiB={Math.max(result.treePerWorkerMiB, data.assumptions.workerBudgetMiB)}
                detail={`${data.assumptions.streamWindowMiB} MiB parser window + one modeled record`}
                tone="emerald"
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">What this model does and does not say</p>
              <p className="mt-2">
                The factors are visible lesson assumptions, not lxml benchmark results. The useful decision is whether the algorithm needs retained-tree access and whether measured peak memory stays inside the worker envelope.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EnvelopeBar({
  label,
  valueMiB,
  maximumMiB,
  detail,
  tone,
}: {
  label: string;
  valueMiB: number;
  maximumMiB: number;
  detail: string;
  tone: 'violet' | 'emerald';
}) {
  const width = Math.min(100, Math.max(4, (valueMiB / maximumMiB) * 100));
  const barClass = tone === 'violet' ? 'bg-violet-500' : 'bg-emerald-500';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
          {Math.round(valueMiB)} MiB
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${barClass}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-5 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <FileSearch aria-hidden="true" className="h-7 w-7 text-cyan-600 dark:text-cyan-300" />
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-950"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
