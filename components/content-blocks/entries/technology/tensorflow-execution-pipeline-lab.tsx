'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Braces,
  Bug,
  CheckCircle2,
  Cpu,
  Database,
  LoaderCircle,
  Timer,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  recordsPerBatch: number;
  readMs: number;
  transformMs: number;
  deviceMs: number;
  shapeVariants: number;
  decodedCacheGb: number;
};
type ExecutionMode = {
  id: string;
  label: string;
  detail: string;
  computeFactor: number;
  traceMs: number;
  forcesSingleTrace: boolean;
  exportable: boolean;
};
type CacheMode = {
  id: string;
  label: string;
  detail: string;
  readFactor: number;
  transformFactor: number;
  memoryFactor: number;
};
type ExecutionPipelineData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    executionModeId: string;
    cacheModeId: string;
    mapWorkers: number;
    prefetchBatches: number;
    pythonBoundary: boolean;
  };
  bounds: { mapWorkers: Bounds; prefetchBatches: Bounds };
  workloads: Workload[];
  executionModes: ExecutionMode[];
  cacheModes: CacheMode[];
};

const BLOCK_ID = 'technology/tensorflow-execution-pipeline-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isExecutionPipelineData(value: unknown): value is ExecutionPipelineData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutionPipelineData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.executionModeId
      && candidate.defaults.cacheModeId
      && isNumber(candidate.defaults.mapWorkers)
      && isNumber(candidate.defaults.prefetchBatches)
      && typeof candidate.defaults.pythonBoundary === 'boolean'
      && isBounds(candidate.bounds?.mapWorkers)
      && isBounds(candidate.bounds?.prefetchBatches)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isNumber(item.recordsPerBatch)
        && isNumber(item.readMs)
        && isNumber(item.transformMs)
        && isNumber(item.deviceMs)
        && isNumber(item.shapeVariants)
        && isNumber(item.decodedCacheGb)
      ))
      && Array.isArray(candidate.executionModes)
      && candidate.executionModes.length > 0
      && candidate.executionModes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isNumber(item.computeFactor)
        && isNumber(item.traceMs)
        && typeof item.forcesSingleTrace === 'boolean'
        && typeof item.exportable === 'boolean'
      ))
      && Array.isArray(candidate.cacheModes)
      && candidate.cacheModes.length > 0
      && candidate.cacheModes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isNumber(item.readFactor)
        && isNumber(item.transformFactor)
        && isNumber(item.memoryFactor)
      )),
  );
}

export default function TensorFlowExecutionPipelineLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ExecutionPipelineData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No TensorFlow execution model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isExecutionPipelineData(payload)) {
          throw new Error('The TensorFlow execution model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the execution lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ExecutionPipelineLab data={data} />;
}

function ExecutionPipelineLab({ data }: { data: ExecutionPipelineData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [executionModeId, setExecutionModeId] = useState(data.defaults.executionModeId);
  const [cacheModeId, setCacheModeId] = useState(data.defaults.cacheModeId);
  const [mapWorkers, setMapWorkers] = useState(data.defaults.mapWorkers);
  const [prefetchBatches, setPrefetchBatches] = useState(data.defaults.prefetchBatches);
  const [pythonBoundary, setPythonBoundary] = useState(data.defaults.pythonBoundary);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const executionMode = data.executionModes.find((item) => item.id === executionModeId)
    ?? data.executionModes[0];
  const cacheMode = data.cacheModes.find((item) => item.id === cacheModeId) ?? data.cacheModes[0];

  const result = useMemo(() => {
    const effectiveWorkers = pythonBoundary ? 1 : mapWorkers;
    const parallelScale = 1 + Math.max(0, effectiveWorkers - 1) * 0.72;
    const readMs = workload.readMs * cacheMode.readFactor;
    const transformMs = (workload.transformMs * cacheMode.transformFactor) / parallelScale
      + Math.max(0, effectiveWorkers - 1) * 0.18;
    const inputMs = readMs + transformMs;
    const deviceMs = workload.deviceMs * executionMode.computeFactor;
    const overlaps = prefetchBatches > 0;
    const steadyStepMs = overlaps ? Math.max(inputMs, deviceMs) : inputMs + deviceMs;
    const idleMs = overlaps ? Math.max(0, inputMs - deviceMs) : inputMs;
    const idlePct = Math.round(idleMs / steadyStepMs * 100);
    const traces = executionMode.id === 'eager'
      ? 0
      : executionMode.forcesSingleTrace ? 1 : workload.shapeVariants;
    const firstPassMs = steadyStepMs + traces * executionMode.traceMs;
    const recordsPerSecond = Math.round(workload.recordsPerBatch * 1000 / steadyStepMs);
    const cacheGb = workload.decodedCacheGb * cacheMode.memoryFactor;
    const graphPortable = executionMode.exportable && !pythonBoundary;

    let status = 'Pipeline and device work overlap cleanly';
    let explanation = 'The modeled input stage is no slower than the device step, so steady-state prefetch can keep a batch ready.';
    if (pythonBoundary) {
      status = 'Python is now a pipeline and export boundary';
      explanation = 'This model serializes the map stage and marks the graph as non-portable. Replace the callback with TensorFlow operations or isolate it before export.';
    } else if (!overlaps) {
      status = 'The device waits between every batch';
      explanation = 'Without prefetch, input preparation and device compute are modeled in sequence. Add a small buffer, then measure memory and throughput.';
    } else if (inputMs > deviceMs) {
      status = 'The input pipeline limits steady-state throughput';
      explanation = 'Prefetch can overlap stages, but it cannot hide a producer that remains slower than the consumer. Profile reads and map work before adding more device capacity.';
    } else if (traces > 1) {
      status = 'Steady state is healthy, but tracing multiplies';
      explanation = 'Variable shapes create multiple concrete graphs in this mode. Bucket or pad inputs, or define an input signature that permits the intended variation.';
    } else if (cacheMode.id === 'decoded') {
      status = 'Fast pipeline with a large cache contract';
      explanation = 'Caching after decode reduces repeated CPU work, but the decoded footprint must fit and the cache key must change with preprocessing or source versions.';
    }

    return {
      cacheGb,
      deviceMs,
      effectiveWorkers,
      explanation,
      firstPassMs,
      graphPortable,
      idlePct,
      recordsPerSecond,
      status,
      steadyStepMs,
      traces,
      transformMs,
    };
  }, [cacheMode, executionMode, mapWorkers, prefetchBatches, pythonBoundary, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setExecutionModeId(data.defaults.executionModeId);
    setCacheModeId(data.defaults.cacheModeId);
    setMapWorkers(data.defaults.mapWorkers);
    setPrefetchBatches(data.defaults.prefetchBatches);
    setPythonBoundary(data.defaults.pythonBoundary);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="TensorFlow execution lab"
          title={data.title}
          description={data.description}
          icon={Workflow}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'tabular-batches' ? Database : Boxes}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Execution contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.executionModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === executionMode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'eager' ? Bug : Braces}
                      accent={item.id === 'eager' ? 'amber' : 'violet'}
                      onClick={() => setExecutionModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Parallel map workers"
                value={mapWorkers}
                output={`${mapWorkers}`}
                {...data.bounds.mapWorkers}
                accent="cyan"
                lowLabel="Sequential"
                highLabel="More CPU work"
                onChange={setMapWorkers}
              />

              <LabRange
                label="Prefetch buffer"
                value={prefetchBatches}
                output={`${prefetchBatches} batch${prefetchBatches === 1 ? '' : 'es'}`}
                {...data.bounds.prefetchBatches}
                accent="emerald"
                lowLabel="No overlap"
                highLabel="More buffered data"
                onChange={setPrefetchBatches}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Cache placement
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.cacheModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === cacheMode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Database}
                      accent="emerald"
                      onClick={() => setCacheModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                role="switch"
                aria-checked={pythonBoundary}
                onClick={() => setPythonBoundary((current) => !current)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${pythonBoundary
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50'
                  : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}
              >
                <Bug aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">Python callback in `map`</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Model a `tf.py_function` boundary that cannot be serialized with the graph.
                  </span>
                </span>
              </button>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Steady step"
                value={`${result.steadyStepMs.toFixed(1)} ms`}
                detail={`${result.recordsPerSecond.toLocaleString()} records/s in this model`}
                icon={Timer}
                tone="cyan"
              />
              <LabMetric
                label="Device idle"
                value={`${result.idlePct}%`}
                detail={prefetchBatches ? 'After warmup' : 'Input and compute are sequential'}
                icon={Cpu}
                tone={result.idlePct > 20 ? 'rose' : result.idlePct > 0 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Concrete traces"
                value={executionMode.id === 'eager' ? 'None' : `${result.traces}`}
                detail={`Modeled first pass: ${result.firstPassMs.toFixed(0)} ms`}
                icon={Braces}
                tone={result.traces > 1 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Cache footprint"
                value={result.cacheGb ? `${result.cacheGb.toFixed(1)} GB` : 'None'}
                detail={result.graphPortable ? 'Graph path remains exportable' : 'Graph export boundary present'}
                icon={Database}
                tone={result.cacheGb > 5 ? 'amber' : 'blue'}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.idlePct > 20 || pythonBoundary || result.traces > 1
              ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.idlePct > 20 || pythonBoundary || result.traces > 1
                  ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.explanation}</p>
                </div>
              </div>
            </section>

            <section aria-label="Modeled TensorFlow step" className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Steady-state path</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Assumptions are illustrative; profile the shipped host and dataset.
                </p>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                <PipelineStage number="1" label="Read" value={`${(workload.readMs * cacheMode.readFactor).toFixed(1)} ms`} detail={cacheMode.label} />
                <PipelineStage number="2" label="Map" value={`${result.transformMs.toFixed(1)} ms`} detail={`${result.effectiveWorkers} effective worker${result.effectiveWorkers === 1 ? '' : 's'}`} />
                <PipelineStage number="3" label="Prefetch" value={prefetchBatches ? 'Overlapped' : 'Disabled'} detail={prefetchBatches ? `${prefetchBatches} buffered batch${prefetchBatches === 1 ? '' : 'es'}` : 'Device waits for input'} />
                <PipelineStage number="4" label="Device step" value={`${result.deviceMs.toFixed(1)} ms`} detail={executionMode.label} />
              </ol>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PipelineStage({
  number,
  label,
  value,
  detail,
}: {
  number: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <li className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
          {number}
        </span>
        <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</span>
      </div>
      <p className="mt-3 break-words text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </li>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading TensorFlow execution model
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <p className="font-semibold">TensorFlow execution lab unavailable</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
