'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Cpu,
  GitBranch,
  Layers3,
  Route,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/flashattention-kernel-dispatch-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/flashattention-memory-optimization/data/kernel-dispatch-matrix.json';

type DTypeId = 'fp16' | 'bf16' | 'fp32';
type MaskId = 'none' | 'causal' | 'dense-bias';
type ExecutionId = 'inference' | 'training' | 'training-dropout';

type Hardware = {
  id: string;
  label: string;
  detail: string;
  platform: 'cpu' | 'cuda' | 'rocm';
  architecture: string;
  directKernelId: string | null;
  supportedDtypes: DTypeId[];
  consumerGpu: boolean;
};

type Kernel = {
  id: string;
  label: string;
  detail: string;
  dtypes: DTypeId[];
  masks: MaskId[];
  maxHeadDimension: number;
  supportsTraining: boolean;
  supportsDropout: boolean;
  consumerHeadDim256Dropout: boolean;
};

type Option<T extends string> = {
  id: T;
  label: string;
  detail: string;
};

type DispatchData = {
  kind: 'attention-kernel-dispatch';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    hardwareId: string;
    dtypeId: DTypeId;
    headDimension: number;
    maskId: MaskId;
    executionId: ExecutionId;
  };
  headDimensions: number[];
  hardware: Hardware[];
  kernels: Kernel[];
  dtypes: Option<DTypeId>[];
  masks: Option<MaskId>[];
  executions: Array<Option<ExecutionId> & { training: boolean; dropout: number }>;
  fallback: {
    label: string;
    detail: string;
  };
  note: string;
};

type Gate = {
  id: string;
  label: string;
  detail: string;
  pass: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isDispatchData(value: unknown): value is DispatchData {
  if (
    !isRecord(value) ||
    value.kind !== 'attention-kernel-dispatch' ||
    value.blockId !== BLOCK_ID ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.note !== 'string' ||
    !isRecord(value.defaults) ||
    typeof value.defaults.hardwareId !== 'string' ||
    typeof value.defaults.dtypeId !== 'string' ||
    typeof value.defaults.headDimension !== 'number' ||
    typeof value.defaults.maskId !== 'string' ||
    typeof value.defaults.executionId !== 'string' ||
    !Array.isArray(value.headDimensions) ||
    !Array.isArray(value.hardware) ||
    !Array.isArray(value.kernels) ||
    !Array.isArray(value.dtypes) ||
    !Array.isArray(value.masks) ||
    !Array.isArray(value.executions) ||
    !isRecord(value.fallback) ||
    typeof value.fallback.label !== 'string' ||
    typeof value.fallback.detail !== 'string'
  ) {
    return false;
  }

  const hardwareValid = value.hardware.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.detail === 'string' &&
      (item.platform === 'cpu' || item.platform === 'cuda' || item.platform === 'rocm') &&
      typeof item.architecture === 'string' &&
      (typeof item.directKernelId === 'string' || item.directKernelId === null) &&
      Array.isArray(item.supportedDtypes) &&
      item.supportedDtypes.every((dtype) => typeof dtype === 'string') &&
      typeof item.consumerGpu === 'boolean',
  );
  const kernelsValid = value.kernels.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.detail === 'string' &&
      Array.isArray(item.dtypes) &&
      Array.isArray(item.masks) &&
      typeof item.maxHeadDimension === 'number' &&
      typeof item.supportsTraining === 'boolean' &&
      typeof item.supportsDropout === 'boolean' &&
      typeof item.consumerHeadDim256Dropout === 'boolean',
  );

  return hardwareValid && kernelsValid && value.hardware.length >= 4;
}

function LabState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[420px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : 'status'}
        aria-label={error ? 'Kernel dispatch lab unavailable' : 'Loading kernel dispatch lab'}
      >
        {error ? (
          <>
            <p className="font-semibold">Kernel dispatch lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function FlashAttentionKernelDispatchLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DispatchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDispatchData(payload)) {
          throw new Error('The kernel support matrix does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the dispatch lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabState error={error} />;
  if (!data) return <LabState />;
  return <KernelDispatchLab data={data} />;
}

function KernelDispatchLab({ data }: { data: DispatchData }) {
  const [hardwareId, setHardwareId] = useState(data.defaults.hardwareId);
  const [dtypeId, setDtypeId] = useState<DTypeId>(data.defaults.dtypeId);
  const [headDimension, setHeadDimension] = useState(data.defaults.headDimension);
  const [maskId, setMaskId] = useState<MaskId>(data.defaults.maskId);
  const [executionId, setExecutionId] = useState<ExecutionId>(
    data.defaults.executionId,
  );

  const result = useMemo(() => {
    const hardware =
      data.hardware.find((item) => item.id === hardwareId) ?? data.hardware[0];
    const dtype = data.dtypes.find((item) => item.id === dtypeId) ?? data.dtypes[0];
    const mask = data.masks.find((item) => item.id === maskId) ?? data.masks[0];
    const execution =
      data.executions.find((item) => item.id === executionId) ?? data.executions[0];
    if (!hardware || !dtype || !mask || !execution) return null;

    const kernel = hardware.directKernelId
      ? data.kernels.find((item) => item.id === hardware.directKernelId) ?? null
      : null;
    const deviceDtypePass = hardware.supportedDtypes.includes(dtype.id);
    const gates: Gate[] = [
      {
        id: 'hardware',
        label: 'Hardware family',
        detail: kernel
          ? `${hardware.architecture} maps to ${kernel.label}.`
          : `${hardware.architecture} has no direct FlashAttention-2 package candidate in this matrix.`,
        pass: Boolean(kernel),
      },
      {
        id: 'dtype',
        label: 'Input dtype',
        detail: kernel
          ? kernel.dtypes.includes(dtype.id)
            ? `${dtype.label} is in the direct kernel contract.`
            : `${kernel.label} accepts ${kernel.dtypes.join(' or ')}, not ${dtype.label}.`
          : `${dtype.label} is checked against the general device path.`,
        pass: Boolean(kernel?.dtypes.includes(dtype.id)),
      },
      {
        id: 'head-dimension',
        label: 'Head dimension',
        detail: kernel
          ? `d=${headDimension}; direct limit d<=${kernel.maxHeadDimension}.`
          : `d=${headDimension}; no direct kernel is selected.`,
        pass: Boolean(kernel && headDimension <= kernel.maxHeadDimension),
      },
      {
        id: 'mask',
        label: 'Mask shape',
        detail: kernel
          ? kernel.masks.includes(mask.id)
            ? `${mask.label} is represented by the direct kernel interface.`
            : `${mask.label} requires a broader SDPA path or a specialized kernel.`
          : `${mask.label} will be handled by the fallback implementation if supported.`,
        pass: Boolean(kernel?.masks.includes(mask.id)),
      },
      {
        id: 'execution',
        label: 'Forward/backward contract',
        detail: kernel
          ? execution.training && !kernel.supportsTraining
            ? 'This direct kernel profile does not provide a backward path.'
            : execution.dropout > 0 && !kernel.supportsDropout
              ? 'This direct kernel profile does not support dropout.'
              : hardware.consumerGpu &&
                  headDimension === 256 &&
                  execution.dropout > 0 &&
                  !kernel.consumerHeadDim256Dropout
                ? 'The official CUDA package documents consumer-GPU d=256 backward only without dropout.'
                : `${execution.label} is eligible for the direct kernel profile.`
          : `${execution.label} will use the general runtime contract.`,
        pass: Boolean(
          kernel &&
            (!execution.training || kernel.supportsTraining) &&
            (execution.dropout === 0 || kernel.supportsDropout) &&
            !(
              hardware.consumerGpu &&
              headDimension === 256 &&
              execution.dropout > 0 &&
              !kernel.consumerHeadDim256Dropout
            ),
        ),
      },
    ];
    const directEligible = gates.every((gate) => gate.pass);
    const rejected = !deviceDtypePass;
    const status = rejected
      ? 'Reject before execution'
      : directEligible
        ? `${kernel?.label} candidate`
        : data.fallback.label;
    const explanation = rejected
      ? `${hardware.label} does not advertise ${dtype.label} in this lesson's runtime matrix. Change dtype or hardware before benchmarking.`
      : directEligible
        ? `The static support checks pass for ${kernel?.label}. That makes it a candidate, not a performance guarantee: run correctness and target-shape benchmarks on the installed build.`
        : `${data.fallback.detail} Keep the math backend enabled unless the service is designed to fail closed when no fused kernel is available.`;

    return {
      directEligible,
      dtype,
      execution,
      explanation,
      gates,
      hardware,
      kernel,
      mask,
      rejected,
      status,
    };
  }, [data, dtypeId, executionId, hardwareId, headDimension, maskId]);

  if (!result) {
    return <LabState error="The selected hardware, dtype, mask, or execution mode is missing." />;
  }

  const reset = () => {
    setHardwareId(data.defaults.hardwareId);
    setDtypeId(data.defaults.dtypeId);
    setHeadDimension(data.defaults.headDimension);
    setMaskId(data.defaults.maskId);
    setExecutionId(data.defaults.executionId);
  };
  const ResultIcon = result.rejected
    ? XCircle
    : result.directEligible
      ? Zap
      : GitBranch;
  const resultTone = result.rejected
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : result.directEligible
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Kernel dispatch lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Target hardware
                </legend>
                <div className="mt-3 space-y-2">
                  {data.hardware.map((hardware) => (
                    <LabChoice
                      key={hardware.id}
                      selected={hardware.id === result.hardware.id}
                      label={hardware.label}
                      detail={hardware.detail}
                      icon={hardware.platform === 'cpu' ? Cpu : Zap}
                      accent="amber"
                      onClick={() => setHardwareId(hardware.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Tensor contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.dtypes.map((dtype) => (
                    <LabChoice
                      key={dtype.id}
                      selected={dtype.id === result.dtype.id}
                      label={dtype.label}
                      detail={dtype.detail}
                      icon={Layers3}
                      accent="violet"
                      onClick={() => setDtypeId(dtype.id)}
                    />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {data.headDimensions.map((dimension) => (
                    <button
                      key={dimension}
                      type="button"
                      aria-pressed={dimension === headDimension}
                      onClick={() => setHeadDimension(dimension)}
                      className={`h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        dimension === headDimension
                          ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      d={dimension}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Operation shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.masks.map((mask) => (
                    <LabChoice
                      key={mask.id}
                      selected={mask.id === result.mask.id}
                      label={mask.label}
                      detail={mask.detail}
                      icon={ShieldCheck}
                      accent="blue"
                      onClick={() => setMaskId(mask.id)}
                    />
                  ))}
                  {data.executions.map((execution) => (
                    <LabChoice
                      key={execution.id}
                      selected={execution.id === result.execution.id}
                      label={execution.label}
                      detail={execution.detail}
                      icon={GitBranch}
                      accent="cyan"
                      onClick={() => setExecutionId(execution.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Input contract
                </p>
                <p className="mt-2 font-semibold text-neutral-950 dark:text-white">
                  {result.hardware.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {result.dtype.label}, d={headDimension}, {result.mask.label},{' '}
                  {result.execution.label}
                </p>
              </div>
              <ArrowDown
                aria-hidden="true"
                className="mx-auto h-5 w-5 text-neutral-400 md:-rotate-90"
              />
              <div className={`rounded-md border p-4 ${resultTone}`}>
                <div className="flex items-start gap-3">
                  <ResultIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">
                      Dispatch result
                    </p>
                    <p className="mt-1 font-semibold">{result.status}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Direct-kernel eligibility
                </p>
              </div>
              <div className="divide-y divide-neutral-200 px-4 dark:divide-neutral-800">
                {result.gates.map((gate) => {
                  const Icon = gate.pass ? CheckCircle2 : AlertTriangle;
                  return (
                    <div key={gate.id} className="flex items-start gap-3 py-3">
                      <Icon
                        aria-hidden="true"
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          gate.pass
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-amber-600 dark:text-amber-300'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {gate.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          {gate.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`mt-5 rounded-md border p-4 ${resultTone}`}>
              <p className="text-sm font-semibold">What to do next</p>
              <p className="mt-1 text-sm leading-6">{result.explanation}</p>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.note}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
