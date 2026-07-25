'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers3,
  MemoryStick,
  Network,
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

interface Strategy {
  id: string;
  label: string;
  detail: string;
  replicatedBytesPerParameter: number;
  shardedBytesPerParameter: number;
  communication: string;
  tradeoff: string;
}

interface CapacityModel {
  title: string;
  description: string;
  defaultModelParametersBillions: number;
  defaultGpuCount: number;
  defaultGpuMemoryGb: number;
  defaultActivationReserveGb: number;
  gpuMemoryOptionsGb: number[];
  strategies: Strategy[];
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/distributed-training-advanced/data/parallelism-capacity-model.json';

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;

  return (
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.defaultModelParametersBillions === 'number' &&
    typeof candidate.defaultGpuCount === 'number' &&
    typeof candidate.defaultGpuMemoryGb === 'number' &&
    typeof candidate.defaultActivationReserveGb === 'number' &&
    Array.isArray(candidate.gpuMemoryOptionsGb) &&
    candidate.gpuMemoryOptionsGb.every((item) => typeof item === 'number' && item > 0) &&
    Array.isArray(candidate.strategies) &&
    candidate.strategies.length > 0 &&
    candidate.strategies.every(
      (strategy) =>
        strategy &&
        typeof strategy.id === 'string' &&
        typeof strategy.label === 'string' &&
        typeof strategy.detail === 'string' &&
        typeof strategy.replicatedBytesPerParameter === 'number' &&
        typeof strategy.shardedBytesPerParameter === 'number' &&
        typeof strategy.communication === 'string' &&
        typeof strategy.tradeoff === 'string'
    )
  );
}

function formatGb(value: number) {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} GB`;
}

export default function DistributedTrainingAdvancedCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [modelParameters, setModelParameters] = useState(70);
  const [gpuCount, setGpuCount] = useState(32);
  const [gpuMemory, setGpuMemory] = useState(80);
  const [activationReserve, setActivationReserve] = useState(18);
  const [strategyId, setStrategyId] = useState('fsdp-full-shard');

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) throw new Error('Capacity model is invalid');
        setModel(payload);
        setModelParameters(payload.defaultModelParametersBillions);
        setGpuCount(payload.defaultGpuCount);
        setGpuMemory(payload.defaultGpuMemoryGb);
        setActivationReserve(payload.defaultActivationReserveGb);
        setStrategyId(payload.strategies[0].id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const strategy = model?.strategies.find((item) => item.id === strategyId) ?? model?.strategies[0];
  const result = useMemo(() => {
    if (!strategy) return null;
    const replicatedState = modelParameters * strategy.replicatedBytesPerParameter;
    const shardedState = (modelParameters * strategy.shardedBytesPerParameter) / gpuCount;
    const modelState = replicatedState + shardedState;
    const requiredMemory = modelState + activationReserve;
    const spareMemory = gpuMemory - requiredMemory;
    const utilization = (requiredMemory / gpuMemory) * 100;

    return {
      replicatedState,
      shardedState,
      modelState,
      requiredMemory,
      spareMemory,
      utilization,
      fits: spareMemory >= 0,
    };
  }, [activationReserve, gpuCount, gpuMemory, modelParameters, strategy]);

  const reset = () => {
    if (!model) return;
    setModelParameters(model.defaultModelParametersBillions);
    setGpuCount(model.defaultGpuCount);
    setGpuMemory(model.defaultGpuMemoryGb);
    setActivationReserve(model.defaultActivationReserveGb);
    setStrategyId(model.strategies[0].id);
  };

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        The distributed-training capacity model could not be loaded.
      </div>
    );
  }

  if (!model || !strategy || !result) {
    return (
      <div className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-32 animate-pulse bg-neutral-950" />
        <div className="h-[520px] animate-pulse bg-neutral-100 dark:bg-neutral-900" />
      </div>
    );
  }

  const memoryWidth = Math.min(result.utilization, 100);
  const statusTone = result.fits ? 'emerald' : 'rose';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Parallelism capacity lab"
        title={model.title}
        description={model.description}
        icon={Boxes}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Model parameters"
              value={modelParameters}
              output={`${modelParameters}B`}
              min={1}
              max={405}
              step={1}
              accent="violet"
              lowLabel="1B"
              highLabel="405B"
              onChange={setModelParameters}
            />
            <LabRange
              label="Training GPUs"
              value={gpuCount}
              output={gpuCount.toLocaleString()}
              min={1}
              max={256}
              step={1}
              accent="cyan"
              lowLabel="1"
              highLabel="256"
              onChange={setGpuCount}
            />
            <LabRange
              label="Activation + buffer reserve"
              value={activationReserve}
              output={`${activationReserve} GB`}
              min={4}
              max={64}
              step={1}
              accent="amber"
              lowLabel="4 GB"
              highLabel="64 GB"
              onChange={setActivationReserve}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Memory per GPU
              </legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {model.gpuMemoryOptionsGb.map((option) => {
                  const selected = option === gpuMemory;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setGpuMemory(option)}
                      className={`h-10 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        selected
                          ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-300 dark:bg-violet-300 dark:text-neutral-950'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                      }`}
                    >
                      {option} GB
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        }
      >
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Choose the model-state partition
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {model.strategies.map((item) => (
              <LabChoice
                key={item.id}
                selected={item.id === strategy.id}
                label={item.label}
                detail={item.detail}
                icon={Layers3}
                accent={item.id === 'ddp' ? 'blue' : item.id === 'fsdp-full-shard' ? 'emerald' : 'violet'}
                onClick={() => setStrategyId(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Model state / GPU"
            value={formatGb(result.modelState)}
            detail="Parameters, gradients, master weights, and Adam moments"
            icon={MemoryStick}
            tone="violet"
          />
          <LabMetric
            label="Total requirement"
            value={formatGb(result.requiredMemory)}
            detail={`Includes ${activationReserve} GB reserved for activations and temporary buffers`}
            icon={Cpu}
            tone="amber"
          />
          <LabMetric
            label="Memory margin"
            value={`${result.spareMemory >= 0 ? '+' : ''}${formatGb(result.spareMemory)}`}
            detail={result.fits ? 'Fits the selected memory envelope' : 'Exceeds the selected memory envelope'}
            icon={result.fits ? CheckCircle2 : TriangleAlert}
            tone={statusTone}
          />
          <LabMetric
            label="Estimated utilization"
            value={`${Math.round(result.utilization)}%`}
            detail="A planning estimate, not a profiler measurement"
            icon={Gauge}
            tone={result.utilization > 90 ? 'rose' : 'cyan'}
          />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Per-GPU memory envelope</p>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {formatGb(result.replicatedState)} replicated + {formatGb(result.shardedState)} sharded +{' '}
                {activationReserve} GB reserve
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                result.fits
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
              }`}
            >
              {result.fits ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}
              {result.fits ? 'Capacity available' : 'Does not fit'}
            </span>
          </div>
          <div className="mt-4 h-4 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
            <div
              className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                result.fits ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${memoryWidth}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>0 GB</span>
            <span>{gpuMemory} GB limit</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase">
              <Network aria-hidden="true" className="h-4 w-4" />
              Collective consequence
            </div>
            <p className="mt-2 text-sm leading-6">{strategy.communication}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase">
              <TriangleAlert aria-hidden="true" className="h-4 w-4" />
              Decision boundary
            </div>
            <p className="mt-2 text-sm leading-6">{strategy.tradeoff}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
