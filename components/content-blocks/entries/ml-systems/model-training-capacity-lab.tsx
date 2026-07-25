'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Cpu,
  Gauge,
  Layers3,
  MemoryStick,
  Timer,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/model-training/data/training-capacity-lab.json';

type Workload = {
  id: string;
  label: string;
  detail: string;
  defaultExamples: number;
  defaultSize: number;
  defaultLearningRate: number;
  modelMemoryGb: number;
  activationGbPerUnit: number;
  flopsPerUnit: number;
  maxLearningRate: number;
};
type Accelerator = {
  id: string;
  label: string;
  detail: string;
  tflops: number;
  memoryGb: number;
  costPerHour: number;
};
type Precision = {
  id: string;
  label: string;
  detail: string;
  speedFactor: number;
  memoryFactor: number;
  stabilityFactor: number;
};
type LabData = {
  title: string;
  description: string;
  workloads: Workload[];
  accelerators: Accelerator[];
  precisions: Precision[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.workloads) &&
      data.workloads.length > 0 &&
      Array.isArray(data.accelerators) &&
      data.accelerators.length > 0 &&
      Array.isArray(data.precisions) &&
      data.precisions.length > 0,
  );
}

function formatHours(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

function formatCompute(flops: number) {
  if (flops >= 1e18) return `${(flops / 1e18).toFixed(2)} EFLOP`;
  return `${(flops / 1e15).toFixed(0)} PFLOP`;
}

function formatLearningRate(value: number) {
  return value.toExponential(1).replace('+', '');
}

export default function ModelTrainingCapacityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState('vision');
  const [acceleratorId, setAcceleratorId] = useState('a100');
  const [precisionId, setPrecisionId] = useState('bf16');
  const [examplesThousands, setExamplesThousands] = useState(1200);
  const [epochs, setEpochs] = useState(5);
  const [batchSize, setBatchSize] = useState(64);
  const [inputSize, setInputSize] = useState(1024);
  const [learningRateExponent, setLearningRateExponent] = useState(-3.5);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const accelerator =
      data.accelerators.find((item) => item.id === acceleratorId) ?? data.accelerators[0];
    const precision = data.precisions.find((item) => item.id === precisionId) ?? data.precisions[0];
    const examples = examplesThousands * 1000;
    const learningRate = 10 ** learningRateExponent;
    const steps = Math.ceil(examples / batchSize) * epochs;
    const compute = examples * epochs * inputSize * workload.flopsPerUnit;
    const utilization = Math.min(0.82, 0.47 + Math.log2(batchSize / 8) * 0.075);
    const effectiveTflops = accelerator.tflops * precision.speedFactor * utilization;
    const wallHours = compute / (effectiveTflops * 1e12 * 3600) + (steps * 0.0025) / 3600;
    const memoryGb =
      1.5 +
      workload.modelMemoryGb * precision.memoryFactor +
      batchSize * inputSize * workload.activationGbPerUnit * precision.memoryFactor;
    const memoryPercent = (memoryGb / accelerator.memoryGb) * 100;
    const computeCost = wallHours * accelerator.costPerHour;
    const rateLimit = workload.maxLearningRate * precision.stabilityFactor;
    const outOfMemory = memoryGb > accelerator.memoryGb;
    const memoryPressure = !outOfMemory && memoryPercent > 88;
    const unstableRate = learningRate > rateLimit;
    const fp16Risk = precision.id === 'fp16' && workload.id === 'sft';
    const warning = outOfMemory
      ? `Predicted memory exceeds ${accelerator.label}'s ${accelerator.memoryGb} GB. Reduce microbatch or sequence size before reserving capacity.`
      : unstableRate
        ? `The selected learning rate is above this workload's planning ceiling for ${precision.label}. Start with a short loss-scale and gradient-norm sweep.`
        : fp16Risk
          ? 'FP16 on long instruction sequences needs explicit loss-scale, overflow, and checkpoint-replay checks.'
          : memoryPressure
            ? 'Memory is close to the device limit. Leave room for allocator fragmentation, evaluation, and checkpointing.'
            : 'No immediate planning warning. Validate this estimate with a short profiling run before scaling out.';
    const status = outOfMemory || unstableRate ? 'High risk' : memoryPressure || fp16Risk ? 'Review required' : 'Ready to profile';
    return {
      workload,
      accelerator,
      precision,
      examples,
      learningRate,
      steps,
      compute,
      effectiveTflops,
      wallHours,
      memoryGb,
      memoryPercent,
      computeCost,
      warning,
      status,
      risk: outOfMemory || unstableRate,
      review: memoryPressure || fp16Risk,
    };
  }, [acceleratorId, batchSize, data, epochs, examplesThousands, inputSize, learningRateExponent, precisionId, workloadId]);

  const chooseWorkload = (workload: Workload) => {
    setWorkloadId(workload.id);
    setExamplesThousands(workload.defaultExamples / 1000);
    setInputSize(workload.defaultSize);
    setLearningRateExponent(Math.log10(workload.defaultLearningRate));
  };

  const reset = () => {
    setWorkloadId('vision');
    setAcceleratorId('a100');
    setPrecisionId('bf16');
    setExamplesThousands(1200);
    setEpochs(5);
    setBatchSize(64);
    setInputSize(1024);
    setLearningRateExponent(-3.5);
  };

  if (error) {
    return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>;
  }
  if (!data || !result) {
    return <div className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading training capacity lab" />;
  }

  const warningTone = result.risk ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35' : result.review ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35';
  const warningIcon = result.risk || result.review ? AlertTriangle : Gauge;
  const WarningIcon = warningIcon;

  return (
    <div data-content-block="ml-systems/model-training-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and optimization lab"
          title={data.title}
          description={data.description}
          icon={Cpu}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose a workload example</legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice key={workload.id} selected={workloadId === workload.id} label={workload.label} detail={workload.detail} icon={Layers3} accent="cyan" onClick={() => chooseWorkload(workload)} />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Set the training plan</legend>
                <LabRange label="Examples" value={examplesThousands} output={`${examplesThousands.toLocaleString()}k`} min={100} max={15000} step={100} accent="cyan" lowLabel="Small control" highLabel="Large corpus" onChange={setExamplesThousands} />
                <LabRange label="Epochs" value={epochs} output={String(epochs)} min={1} max={20} accent="violet" lowLabel="One pass" highLabel="Repeated passes" onChange={setEpochs} />
                <LabRange label="Microbatch size" value={batchSize} output={String(batchSize)} min={8} max={128} step={8} accent="emerald" lowLabel="Lower memory" highLabel="Higher utilization" onChange={setBatchSize} />
                <LabRange label={result.workload.id === 'vision' || result.workload.id === 'tabular' ? 'Features per example' : 'Tokens per sequence'} value={inputSize} output={inputSize.toLocaleString()} min={64} max={4096} step={64} accent="amber" lowLabel="Short or compact" highLabel="Long or wide" onChange={setInputSize} />
                <LabRange label="Learning rate" value={learningRateExponent} output={formatLearningRate(result.learningRate)} min={-5} max={-3} step={0.25} accent="rose" lowLabel="Conservative" highLabel="Aggressive" onChange={setLearningRateExponent} />
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Pick capacity and numerics</legend>
                <div className="mt-3 space-y-2">
                  {data.accelerators.map((accelerator) => (
                    <LabChoice key={accelerator.id} selected={acceleratorId === accelerator.id} label={accelerator.label} detail={accelerator.detail} icon={Cpu} accent="violet" onClick={() => setAcceleratorId(accelerator.id)} />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {data.precisions.map((precision) => (
                    <LabChoice key={precision.id} selected={precisionId === precision.id} label={precision.label} detail={precision.detail} icon={Zap} accent="amber" onClick={() => setPrecisionId(precision.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Projected single-accelerator run</p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{result.workload.label} on {result.accelerator.label} at {result.precision.label}</h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${result.risk ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200' : result.review ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
                <WarningIcon aria-hidden="true" className="h-4 w-4" />
                {result.status}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Optimizer steps" value={result.steps.toLocaleString()} detail={`${result.examples.toLocaleString()} examples across ${epochs} epochs`} icon={Boxes} tone="cyan" />
              <LabMetric label="Wall time" value={formatHours(result.wallHours)} detail={`${result.effectiveTflops.toFixed(0)} effective TFLOP/s after utilization`} icon={Timer} tone="violet" />
              <LabMetric label="Memory per accelerator" value={`${result.memoryGb.toFixed(1)} GB`} detail={`${result.memoryPercent.toFixed(0)}% of ${result.accelerator.memoryGb} GB`} icon={MemoryStick} tone={result.memoryPercent > 88 ? 'rose' : 'emerald'} />
              <LabMetric label="Training compute" value={formatCompute(result.compute)} detail="Forward, backward, and optimizer work are approximated from the workload model" icon={Cpu} tone="blue" />
              <LabMetric label="Compute cost" value={`$${result.computeCost.toFixed(result.computeCost < 10 ? 2 : 0)}`} detail={`At $${result.accelerator.costPerHour.toFixed(2)}/accelerator-hour; storage and orchestration excluded`} icon={Gauge} tone="amber" />
            </div>
            <div className={`mt-6 rounded-md border p-4 ${warningTone}`}>
              <div className="flex items-start gap-3">
                <WarningIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-300" />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Stability and operating check</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.warning}</p>
                </div>
              </div>
            </div>
            <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              <li>Run a small deterministic profile with the same input shape, precision, optimizer, and checkpoint configuration.</li>
              <li>Measure actual tokens or examples per second, peak allocated memory, gradient norms, and evaluation cadence.</li>
              <li>Only then extrapolate to more accelerators; synchronization, input stalls, and checkpoint I/O change the result.</li>
            </ol>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
