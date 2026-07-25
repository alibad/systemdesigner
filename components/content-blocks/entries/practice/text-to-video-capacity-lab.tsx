'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Coins,
  Cpu,
  Film,
  Gauge,
  HardDrive,
  Layers3,
  RefreshCw,
  ServerCog,
  TriangleAlert,
} from 'lucide-react';

type ResolutionId = '480p' | '720p' | '1080p';

type Resolution = {
  id: ResolutionId;
  label: string;
  detail: string;
  gpuMinutesPerSecond: number;
  bitrateMbps: number;
};

const resolutions: Resolution[] = [
  {
    id: '480p',
    label: '480p',
    detail: 'Direction check',
    gpuMinutesPerSecond: 0.55,
    bitrateMbps: 8,
  },
  {
    id: '720p',
    label: '720p',
    detail: 'Standard delivery',
    gpuMinutesPerSecond: 1,
    bitrateMbps: 20,
  },
  {
    id: '1080p',
    label: '1080p',
    detail: 'Premium delivery',
    gpuMinutesPerSecond: 1.8,
    bitrateMbps: 40,
  },
];

const acceleratorCostPerHour = 3.25;
const peakFactor = 2.5;
const headroomFactor = 1.25;

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function TextToVideoCapacityLab() {
  const [resolutionId, setResolutionId] = useState<ResolutionId>('720p');
  const [durationSeconds, setDurationSeconds] = useState(18);
  const [dailyJobs, setDailyJobs] = useState(10_000);
  const [availableGpus, setAvailableGpus] = useState(380);
  const [previewFirst, setPreviewFirst] = useState(true);
  const [approvalRate, setApprovalRate] = useState(60);

  const model = useMemo(() => {
    const resolution = resolutions.find((item) => item.id === resolutionId) ?? resolutions[1];
    const finalGpuMinutes = durationSeconds * resolution.gpuMinutesPerSecond;
    const previewGpuMinutes = durationSeconds * 0.28;
    const approvalFraction = approvalRate / 100;
    const effectiveGpuMinutes = previewFirst
      ? previewGpuMinutes + finalGpuMinutes * approvalFraction
      : finalGpuMinutes;
    const finalJobs = dailyJobs * (previewFirst ? approvalFraction : 1);
    const dailyGpuHours = (dailyJobs * effectiveGpuMinutes) / 60;
    const peakJobsPerHour = (dailyJobs / 24) * peakFactor;
    const requiredGpus = Math.ceil(peakJobsPerHour * (effectiveGpuMinutes / 60) * headroomFactor);
    const capacityRatio = requiredGpus / availableGpus;
    const maxDailyJobs =
      (availableGpus / headroomFactor / Math.max(effectiveGpuMinutes / 60, 0.01)) *
      (24 / peakFactor);
    const storageGb = (finalJobs * durationSeconds * resolution.bitrateMbps) / 8 / 1000;
    const computeCost = dailyGpuHours * acceleratorCostPerHour;
    const costPerSubmittedJob = computeCost / dailyJobs;
    const minimumPrice = costPerSubmittedJob / 0.5;
    const noPreviewGpuMinutes = finalGpuMinutes;
    const savings = previewFirst
      ? ((noPreviewGpuMinutes - effectiveGpuMinutes) / noPreviewGpuMinutes) * 100
      : 0;
    const status = capacityRatio <= 1 ? 'Healthy headroom' : capacityRatio <= 1.1 ? 'Capacity at risk' : 'Queue overload';

    return {
      resolution,
      finalGpuMinutes,
      previewGpuMinutes,
      effectiveGpuMinutes,
      finalJobs,
      dailyGpuHours,
      requiredGpus,
      capacityRatio,
      maxDailyJobs,
      storageGb,
      computeCost,
      costPerSubmittedJob,
      minimumPrice,
      savings,
      status,
    };
  }, [approvalRate, availableGpus, dailyJobs, durationSeconds, previewFirst, resolutionId]);

  const reset = () => {
    setResolutionId('720p');
    setDurationSeconds(18);
    setDailyJobs(10_000);
    setAvailableGpus(380);
    setPreviewFirst(true);
    setApprovalRate(60);
  };

  const statusTone =
    model.status === 'Healthy headroom'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.status === 'Capacity at risk'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Generation capacity lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Fit the product promise to the GPU fleet</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Change clip demand and delivery quality. Then decide whether preview-first rendering saves enough work and whether the available fleet protects peak-hour deadlines.
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
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose final resolution</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {resolutions.map((resolution) => {
                const selected = resolution.id === resolutionId;
                return (
                  <button
                    key={resolution.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setResolutionId(resolution.id)}
                    className={`min-w-0 rounded-md border px-2 py-3 text-center transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{resolution.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">{resolution.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Clip duration</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{durationSeconds}s</output>
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>5s clip</span><span>60s clip</span></span>
          </label>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Submitted jobs per day</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{compactNumber(dailyJobs)}</output>
            </span>
            <input
              type="range"
              min="1000"
              max="30000"
              step="1000"
              value={dailyJobs}
              onChange={(event) => setDailyJobs(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
          </label>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Available accelerators</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{availableGpus}</output>
            </span>
            <input
              type="range"
              min="50"
              max="800"
              step="10"
              value={availableGpus}
              onChange={(event) => setAvailableGpus(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-cyan-500"
            />
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={previewFirst}
            onClick={() => setPreviewFirst((value) => !value)}
            className="mt-6 flex w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 text-left dark:border-neutral-800 dark:bg-neutral-950"
          >
            <span>
              <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Preview before final render</span>
              <span className="mt-1 block text-xs leading-5 text-neutral-500">Render final quality only after approval.</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${previewFirst ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
              <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${previewFirst ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>

          <label className={`mt-5 block ${previewFirst ? '' : 'opacity-50'}`}>
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Preview approval</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{approvalRate}%</output>
            </span>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={approvalRate}
              disabled={!previewFirst}
              onChange={(event) => setApprovalRate(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-500 disabled:cursor-not-allowed"
            />
          </label>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'GPU hours / day', value: compactNumber(model.dailyGpuHours), icon: Cpu, tone: 'text-violet-500' },
              { label: 'Fleet required', value: `${model.requiredGpus}`, icon: ServerCog, tone: model.capacityRatio <= 1 ? 'text-emerald-500' : 'text-rose-500' },
              { label: 'Output / day', value: model.storageGb >= 1000 ? `${(model.storageGb / 1000).toFixed(1)} TB` : `${Math.round(model.storageGb)} GB`, icon: HardDrive, tone: 'text-cyan-500' },
              { label: 'Compute / day', value: `$${compactNumber(model.computeCost)}`, icon: Coins, tone: 'text-amber-500' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <metric.icon aria-hidden="true" className={`h-4 w-4 ${metric.tone}`} />
                <p className="mt-3 break-words text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Peak fleet pressure</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Required capacity includes the 2.5x peak and 25% recovery headroom.</p>
              </div>
              <span className="rounded bg-neutral-200 px-2.5 py-1 text-xs font-bold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                {model.requiredGpus} / {availableGpus} GPUs
              </span>
            </div>

            <div className="mt-5 h-4 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-label={`Fleet demand is ${Math.round(model.capacityRatio * 100)} percent of available capacity`}>
              <div
                className={`h-full rounded transition-[width] duration-300 ${model.capacityRatio <= 1 ? 'bg-emerald-500' : model.capacityRatio <= 1.1 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, Math.max(2, model.capacityRatio * 100))}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between gap-4 text-[10px] text-neutral-500">
              <span>0</span>
              <span>Fleet limit</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/35">
                <Film aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{previewFirst ? 'Preview every job' : 'Skip preview'}</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{previewFirst ? `${model.previewGpuMinutes.toFixed(1)} GPU-min each` : '0 GPU-min charged'}</p>
              </div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/35">
                <Layers3 aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Approve direction</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{previewFirst ? approvalRate : 100}% continue</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/35">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Final render</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{compactNumber(model.finalJobs)} jobs at {model.finalGpuMinutes.toFixed(1)} GPU-min</p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${statusTone}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {model.status === 'Healthy headroom' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.status === 'Capacity at risk' ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Capacity decision</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{model.status}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  This fleet supports about {compactNumber(model.maxDailyJobs)} submitted jobs per day at the modeled peak. {previewFirst ? `Preview-first uses ${Math.abs(model.savings).toFixed(0)}% ${model.savings >= 0 ? 'less' : 'more'} expected compute than rendering every submission at final quality.` : 'Every submission pays final-render cost, so abandoned directions consume the same capacity as delivered videos.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <Clock3 aria-hidden="true" className="h-4 w-4 text-cyan-500" />
              <p className="mt-2 text-xs text-neutral-500">Compute per submission</p>
              <p className="mt-1 font-bold tabular-nums text-neutral-950 dark:text-white">{model.effectiveGpuMinutes.toFixed(1)} GPU-min</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <Coins aria-hidden="true" className="h-4 w-4 text-amber-500" />
              <p className="mt-2 text-xs text-neutral-500">Compute cost per submission</p>
              <p className="mt-1 font-bold tabular-nums text-neutral-950 dark:text-white">${model.costPerSubmittedJob.toFixed(2)}</p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <Gauge aria-hidden="true" className="h-4 w-4 text-violet-500" />
              <p className="mt-2 text-xs text-neutral-500">50% margin floor</p>
              <p className="mt-1 font-bold tabular-nums text-neutral-950 dark:text-white">${model.minimumPrice.toFixed(2)} / submission</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
