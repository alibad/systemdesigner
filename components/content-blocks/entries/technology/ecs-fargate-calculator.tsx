'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Cpu,
  DollarSign,
  Gauge,
  Layers3,
  LoaderCircle,
  MemoryStick,
  TriangleAlert,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TaskSize = {
  cpuUnits: number;
  vcpu: number;
  memoryMiB: number[];
  note?: string;
};

type SizingModel = {
  title: string;
  description: string;
  defaults: {
    cpuUnits: number;
    memoryMiB: number;
    measuredCpuUnits: number;
    measuredMemoryMiB: number;
    taskCount: number;
    hoursPerMonth: number;
  };
  pricing: {
    label: string;
    vcpuHour: number;
    gbHour: number;
    currency: string;
    sourceUrl: string;
    exclusions: string;
  };
  taskSizes: TaskSize[];
};

const BLOCK_ID = 'technology/ecs-fargate-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/ecs-fargate/data/task-sizing-model.json';

function validModel(value: unknown): value is SizingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SizingModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.pricing
      && Number.isFinite(candidate.pricing.vcpuHour)
      && Number.isFinite(candidate.pricing.gbHour)
      && Array.isArray(candidate.taskSizes)
      && candidate.taskSizes.length >= 4
      && candidate.taskSizes.every((size) => (
        Number.isFinite(size.cpuUnits)
          && Number.isFinite(size.vcpu)
          && Array.isArray(size.memoryMiB)
          && size.memoryMiB.length > 0
          && size.memoryMiB.every(Number.isFinite)
      )),
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function ECSFargateCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SizingModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validModel(payload)) throw new Error('The Fargate sizing model is incomplete.');
        setModel(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setModel(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load task sizes.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Task sizing lab"
            title="Fit measured demand into a valid Fargate task"
            description="Loading valid task-level CPU and memory combinations."
            icon={Calculator}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <SizingLab model={model} />
      )}
    </div>
  );
}

function SizingLab({ model }: { model: SizingModel }) {
  const [cpuUnits, setCpuUnits] = useState(model.defaults.cpuUnits);
  const [memoryMiB, setMemoryMiB] = useState(model.defaults.memoryMiB);
  const [measuredCpuUnits, setMeasuredCpuUnits] = useState(model.defaults.measuredCpuUnits);
  const [measuredMemoryMiB, setMeasuredMemoryMiB] = useState(model.defaults.measuredMemoryMiB);
  const [taskCount, setTaskCount] = useState(model.defaults.taskCount);
  const [hoursPerMonth, setHoursPerMonth] = useState(model.defaults.hoursPerMonth);

  const selectedSize = model.taskSizes.find((size) => size.cpuUnits === cpuUnits)
    ?? model.taskSizes[0];

  const result = useMemo(() => {
    const vcpuHours = selectedSize.vcpu * taskCount * hoursPerMonth;
    const memoryGb = memoryMiB / 1024;
    const memoryGbHours = memoryGb * taskCount * hoursPerMonth;
    const computeCost = vcpuHours * model.pricing.vcpuHour;
    const memoryCost = memoryGbHours * model.pricing.gbHour;
    const cpuRatio = measuredCpuUnits / selectedSize.cpuUnits;
    const memoryRatio = measuredMemoryMiB / memoryMiB;
    const highestRatio = Math.max(cpuRatio, memoryRatio);
    const insufficient = highestRatio > 1;
    const tight = !insufficient && highestRatio > 0.8;
    const oversized = highestRatio < 0.45;

    return {
      computeCost,
      memoryCost,
      monthlyCost: computeCost + memoryCost,
      cpuRatio,
      memoryRatio,
      insufficient,
      tight,
      oversized,
      totalVcpu: selectedSize.vcpu * taskCount,
      totalMemoryGb: memoryGb * taskCount,
    };
  }, [hoursPerMonth, measuredCpuUnits, measuredMemoryMiB, memoryMiB, model.pricing, selectedSize, taskCount]);

  function chooseCpu(nextCpuUnits: number) {
    const nextSize = model.taskSizes.find((size) => size.cpuUnits === nextCpuUnits)
      ?? model.taskSizes[0];
    setCpuUnits(nextSize.cpuUnits);
    if (!nextSize.memoryMiB.includes(memoryMiB)) {
      setMemoryMiB(nextSize.memoryMiB[0]);
    }
  }

  function reset() {
    setCpuUnits(model.defaults.cpuUnits);
    setMemoryMiB(model.defaults.memoryMiB);
    setMeasuredCpuUnits(model.defaults.measuredCpuUnits);
    setMeasuredMemoryMiB(model.defaults.measuredMemoryMiB);
    setTaskCount(model.defaults.taskCount);
    setHoursPerMonth(model.defaults.hoursPerMonth);
  }

  const verdict = result.insufficient
    ? 'Measured demand does not fit inside the requested task envelope'
    : result.tight
      ? 'The task fits, but the modeled peak leaves little operating headroom'
      : result.oversized
        ? 'The task fits with a large reserve that should be justified by measurements'
        : 'The task fits with visible CPU and memory headroom';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Task sizing lab"
        title={model.title}
        description={model.description}
        icon={Calculator}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Requested task CPU
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {model.taskSizes.map((size) => {
                  const selected = size.cpuUnits === selectedSize.cpuUnits;
                  return (
                    <button
                      key={size.cpuUnits}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseCpu(size.cpuUnits)}
                      className={`min-h-14 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        selected
                          ? 'border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-400 dark:border-blue-500 dark:bg-blue-950/45 dark:text-blue-50'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{size.vcpu} vCPU</span>
                      <span className="mt-0.5 block text-xs opacity-70">{size.cpuUnits} CPU units</span>
                    </button>
                  );
                })}
              </div>
              {selectedSize.note ? (
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {selectedSize.note}
                </p>
              ) : null}
            </fieldset>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Requested task memory
              </span>
              <select
                value={memoryMiB}
                onChange={(event) => setMemoryMiB(Number(event.target.value))}
                className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {selectedSize.memoryMiB.map((value) => (
                  <option key={value} value={value}>{value / 1024} GiB</option>
                ))}
              </select>
            </label>

            <LabRange
              label="Measured CPU peak"
              value={measuredCpuUnits}
              output={`${measuredCpuUnits} units`}
              min={64}
              max={4096}
              step={64}
              accent="cyan"
              lowLabel="Light"
              highLabel="4 vCPU"
              onChange={setMeasuredCpuUnits}
            />
            <LabRange
              label="Measured memory peak"
              value={measuredMemoryMiB}
              output={`${measuredMemoryMiB} MiB`}
              min={256}
              max={8192}
              step={256}
              accent="violet"
              lowLabel="256 MiB"
              highLabel="8 GiB"
              onChange={setMeasuredMemoryMiB}
            />
            <LabRange
              label="Running task count"
              value={taskCount}
              output={`${taskCount} tasks`}
              min={1}
              max={40}
              accent="emerald"
              lowLabel="One task"
              highLabel="40 tasks"
              onChange={setTaskCount}
            />
            <LabRange
              label="Billed time per task"
              value={hoursPerMonth}
              output={`${hoursPerMonth} h/month`}
              min={60}
              max={730}
              step={10}
              accent="amber"
              lowLabel="Intermittent"
              highLabel="Always on"
              onChange={setHoursPerMonth}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${result.insufficient ? dangerClass : result.tight || result.oversized ? warningClass : healthyClass}`}>
            <div className="flex items-start gap-3">
              {result.insufficient ? (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Sizing verdict</p>
                <h4 className="mt-1 text-lg font-semibold">{verdict}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  Fargate validates the task-level pair. Your measurements still decide whether that valid pair is safe and economical for this workload.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Monthly compute"
              value={formatCurrency(result.monthlyCost, model.pricing.currency)}
              detail={`${formatCurrency(result.computeCost, model.pricing.currency)} CPU + ${formatCurrency(result.memoryCost, model.pricing.currency)} memory`}
              icon={DollarSign}
              tone="blue"
            />
            <LabMetric
              label="Fleet CPU"
              value={`${result.totalVcpu} vCPU`}
              detail={`${taskCount} identical task envelopes`}
              icon={Cpu}
              tone={result.cpuRatio > 1 ? 'rose' : 'cyan'}
            />
            <LabMetric
              label="Fleet memory"
              value={`${result.totalMemoryGb} GiB`}
              detail={`${memoryMiB / 1024} GiB requested per task`}
              icon={MemoryStick}
              tone={result.memoryRatio > 1 ? 'rose' : 'violet'}
            />
            <LabMetric
              label="Task shape"
              value={`${selectedSize.vcpu} / ${memoryMiB / 1024}`}
              detail="vCPU / GiB, one supported Fargate combination"
              icon={Layers3}
              tone="emerald"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Per-task pressure
            </p>
            <div className="mt-4 space-y-5">
              <PressureBar
                label="CPU"
                demand={`${measuredCpuUnits} measured units`}
                capacity={`${selectedSize.cpuUnits} requested units`}
                ratio={result.cpuRatio}
                tone="bg-cyan-500"
              />
              <PressureBar
                label="Memory"
                demand={`${measuredMemoryMiB} MiB measured peak`}
                capacity={`${memoryMiB} MiB requested`}
                ratio={result.memoryRatio}
                tone="bg-violet-500"
              />
            </div>
          </section>

          <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            <div className="flex items-start gap-3">
              <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">{model.pricing.label}</p>
                <p className="mt-1">{model.pricing.exclusions}</p>
                <a
                  href={model.pricing.sourceUrl}
                  className="mt-2 inline-block font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                >
                  Verify current AWS Fargate pricing
                </a>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PressureBar({
  label,
  demand,
  capacity,
  ratio,
  tone,
}: {
  label: string;
  demand: string;
  capacity: string;
  ratio: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-neutral-950 dark:text-white">{label}: {demand}</span>
        <span className={ratio > 1 ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-neutral-500 dark:text-neutral-400'}>
          {capacity}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${ratio > 1 ? 'bg-rose-500' : tone}`}
          style={{ width: `${clampPercent(ratio * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {Math.round(ratio * 100)}% of the requested envelope
      </p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className={`min-h-48 rounded-md border p-5 ${error ? dangerClass : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}>
        <div className="flex items-start gap-3">
          {error ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" />
          )}
          <div>
            <p className="font-semibold">{error ? 'Sizing model unavailable' : 'Loading sizing model'}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{error ?? 'Preparing valid task resource combinations.'}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </LearningLabBody>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100';
