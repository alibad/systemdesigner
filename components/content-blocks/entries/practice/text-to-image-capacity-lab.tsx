'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Cpu,
  Gauge,
  Image as ImageIcon,
  Layers3,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

type VariantId = 'preview' | 'standard' | 'quality';

type Variant = {
  id: VariantId;
  label: string;
  detail: string;
  resolution: string;
  steps: number;
  baseLatency: number;
  quality: number;
  selectedClass: string;
};

const variants: Variant[] = [
  {
    id: 'preview',
    label: 'Preview',
    detail: 'Fast composition checks before a final render.',
    resolution: '512 px',
    steps: 12,
    baseLatency: 4.5,
    quality: 72,
    selectedClass:
      'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50',
  },
  {
    id: 'standard',
    label: 'Standard',
    detail: 'The default quality and latency compromise.',
    resolution: '1024 px',
    steps: 28,
    baseLatency: 13,
    quality: 86,
    selectedClass:
      'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50',
  },
  {
    id: 'quality',
    label: 'Quality',
    detail: 'More denoising work for demanding final images.',
    resolution: '1024 px',
    steps: 50,
    baseLatency: 21,
    quality: 94,
    selectedClass:
      'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50',
  },
];

const batchSizes = [1, 2, 4, 8];
const secondsPerMonth = 30 * 24 * 60 * 60;
const latencyTargetSeconds = 25;
const acceleratorHourlyCost = 2.5;

export default function TextToImageCapacityLab() {
  const [variantId, setVariantId] = useState<VariantId>('standard');
  const [monthlyMillions, setMonthlyMillions] = useState(100);
  const [peakMultiplier, setPeakMultiplier] = useState(4);
  const [batchSize, setBatchSize] = useState(2);
  const [fleetSize, setFleetSize] = useState(1800);

  const model = useMemo(() => {
    const variant = variants.find((item) => item.id === variantId) ?? variants[1];
    const averageQps = (monthlyMillions * 1_000_000) / secondsPerMonth;
    const peakQps = averageQps * peakMultiplier;
    const latency = variant.baseLatency * (1 + (batchSize - 1) * 0.07);
    const perGpuQps = (batchSize / latency) * 0.82;
    const neededGpus = Math.ceil((peakQps * 1.25) / perGpuQps);
    const fleetCapacity = fleetSize * perGpuQps;
    const capacityRatio = fleetCapacity / (peakQps * 1.25);
    const burstDeficit = Math.max(0, peakQps - fleetCapacity);
    const fiveMinuteBacklog = Math.round(burstDeficit * 300);
    const monthlyFleetCost = fleetSize * acceleratorHourlyCost * 730;
    const unitCost = monthlyFleetCost / (monthlyMillions * 1_000_000);
    const latencyPass = latency <= latencyTargetSeconds;
    const capacityPass = fleetSize >= neededGpus;

    return {
      variant,
      averageQps,
      peakQps,
      latency,
      perGpuQps,
      neededGpus,
      fleetCapacity,
      capacityRatio,
      fiveMinuteBacklog,
      monthlyFleetCost,
      unitCost,
      latencyPass,
      capacityPass,
    };
  }, [batchSize, fleetSize, monthlyMillions, peakMultiplier, variantId]);

  const decision = !model.latencyPass
    ? 'Misses the generation SLA'
    : !model.capacityPass
      ? 'Queue grows during the peak'
      : 'Capacity plan holds with headroom';

  const reset = () => {
    setVariantId('standard');
    setMonthlyMillions(100);
    setPeakMultiplier(4);
    setBatchSize(2);
    setFleetSize(1800);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Accelerator capacity lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Fit image quality inside the peak budget</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Change the render tier, demand shape, batching, and fleet size. The model updates latency, queue pressure, and cost together.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[370px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose a render tier</legend>
            <div className="mt-3 space-y-2">
              {variants.map((variant) => {
                const selected = variant.id === variantId;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setVariantId(variant.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? variant.selectedClass
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded ${selected ? 'bg-white/70 dark:bg-black/20' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                        <ImageIcon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{variant.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{variant.resolution}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{variant.detail}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Monthly generations</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{monthlyMillions}M</output>
            </span>
            <input
              type="range"
              min="25"
              max="250"
              step="25"
              value={monthlyMillions}
              onChange={(event) => setMonthlyMillions(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-cyan-500"
            />
          </label>

          <label className="mt-5 block">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Peak multiplier</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{peakMultiplier}x</output>
            </span>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={peakMultiplier}
              onChange={(event) => setPeakMultiplier(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-amber-500"
            />
          </label>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Batch per accelerator</legend>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {batchSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={size === batchSize}
                  onClick={() => setBatchSize(size)}
                  className={`h-10 rounded-md border text-sm font-semibold transition-colors ${
                    size === batchSize
                      ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                      : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Provisioned fleet</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{fleetSize.toLocaleString()} GPUs</output>
            </span>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={fleetSize}
              onChange={(event) => setFleetSize(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-blue-500"
            />
          </label>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Peak demand', value: `${model.peakQps.toFixed(0)}/s`, icon: Activity, tone: 'text-cyan-500' },
              { label: 'Modeled latency', value: `${model.latency.toFixed(1)}s`, icon: Clock3, tone: model.latencyPass ? 'text-emerald-500' : 'text-rose-500' },
              { label: 'Fleet required', value: model.neededGpus.toLocaleString(), icon: Cpu, tone: model.capacityPass ? 'text-blue-500' : 'text-rose-500' },
              { label: 'Unit capacity cost', value: `$${model.unitCost.toFixed(3)}`, icon: Coins, tone: 'text-amber-500' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <metric.icon aria-hidden="true" className={`h-4 w-4 ${metric.tone}`} />
                <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Peak capacity envelope</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Includes 25% failure and regional headroom.</p>
              </div>
              <span className={`rounded px-2.5 py-1 text-xs font-bold tabular-nums ${model.capacityPass ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
                {(model.capacityRatio * 100).toFixed(0)}% covered
              </span>
            </div>

            <div className="mt-5 h-4 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-label={`${(model.capacityRatio * 100).toFixed(0)} percent of peak capacity covered`}>
              <div
                className={`h-full rounded transition-[width] duration-300 ${model.capacityPass ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, model.capacityRatio * 100)}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <Layers3 aria-hidden="true" className="h-4 w-4 text-violet-500" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Batch {batchSize}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{model.perGpuQps.toFixed(2)} images/s per GPU</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-amber-500" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Quality {model.variant.quality}/100</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{model.variant.steps} denoising steps</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <Boxes aria-hidden="true" className="h-4 w-4 text-blue-500" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{model.fleetCapacity.toFixed(0)} images/s</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Provisioned peak throughput</p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${model.latencyPass && model.capacityPass ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`}>
            <div className="flex items-start gap-3">
              {model.latencyPass && model.capacityPass ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Capacity decision</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {!model.latencyPass
                    ? `${model.variant.label} rendering with batch ${batchSize} takes ${model.latency.toFixed(1)} seconds, above the ${latencyTargetSeconds}-second generation target. Route interactive traffic to fewer steps or a smaller batch.`
                    : !model.capacityPass
                      ? `A five-minute peak would add roughly ${model.fiveMinuteBacklog.toLocaleString()} queued jobs. Provision more capacity, admit less traffic, or offer the preview tier before skipping policy checks.`
                      : `The fleet covers the modeled peak and headroom at about $${(model.monthlyFleetCost / 1_000_000).toFixed(1)}M per month. Validate these assumptions with accelerator benchmarks and production-shaped load tests.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Cpu aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6"><strong>Capacity rule:</strong> benchmark images per accelerator at the target resolution, steps, batch, and p95. Concurrency by itself is not a throughput number.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
