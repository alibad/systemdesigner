'use client';

import { useMemo, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Coins, Cpu, Gauge, Image, Layers3, Timer } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TierId = 'preview-heavy' | 'standard' | 'quality';

type Tier = {
  id: TierId;
  label: string;
  detail: string;
  previewSeconds: number;
  finalSeconds: number;
  quality: number;
};

const tiers: Tier[] = [
  {
    id: 'preview-heavy',
    label: 'Preview-first',
    detail: 'Fast direction finding before a lower-cost standard final.',
    previewSeconds: 8,
    finalSeconds: 26,
    quality: 78,
  },
  {
    id: 'standard',
    label: 'Standard',
    detail: 'Balanced quality and latency for the normal portrait path.',
    previewSeconds: 13,
    finalSeconds: 38,
    quality: 88,
  },
  {
    id: 'quality',
    label: 'Quality',
    detail: 'Extra denoising and refinement for a premium asynchronous path.',
    previewSeconds: 20,
    finalSeconds: 62,
    quality: 95,
  },
];

const secondsPerDay = 86_400;
const hourlyAcceleratorCost = 2.5;
const monthlyHours = 730;
const headroom = 1.25;
const p95TargetSeconds = 45;

export default function FaceGenerationCapacityCostLab() {
  const [tierId, setTierId] = useState<TierId>('standard');
  const [finalsPerDay, setFinalsPerDay] = useState(120_000);
  const [previewsPerFinal, setPreviewsPerFinal] = useState(1.5);
  const [peakMultiplier, setPeakMultiplier] = useState(3);
  const [fleetSize, setFleetSize] = useState(320);

  const model = useMemo(() => {
    const tier = tiers.find((item) => item.id === tierId) ?? tiers[1];
    const previewJobs = finalsPerDay * previewsPerFinal;
    const acceleratorSeconds = previewJobs * tier.previewSeconds + finalsPerDay * tier.finalSeconds;
    const averageGpus = acceleratorSeconds / secondsPerDay;
    const requiredGpus = Math.ceil(averageGpus * peakMultiplier * headroom);
    const fleetCoverage = fleetSize / requiredGpus;
    const peakGpuSecondsPerSecond = averageGpus * peakMultiplier;
    const usableFleet = fleetSize / headroom;
    const fiveMinuteBacklog = Math.max(0, Math.round((peakGpuSecondsPerSecond - usableFleet) * 300));
    const monthlyFleetCost = fleetSize * hourlyAcceleratorCost * monthlyHours;
    const monthlyReleasedImages = finalsPerDay * 30;
    const gpuCostPerFinal = monthlyFleetCost / monthlyReleasedImages;

    return {
      tier,
      previewJobs,
      requiredGpus,
      fleetCoverage,
      fiveMinuteBacklog,
      monthlyFleetCost,
      gpuCostPerFinal,
      latencyPass: tier.finalSeconds <= p95TargetSeconds,
      capacityPass: fleetSize >= requiredGpus,
    };
  }, [finalsPerDay, fleetSize, peakMultiplier, previewsPerFinal, tierId]);

  const reset = () => {
    setTierId('standard');
    setFinalsPerDay(120_000);
    setPreviewsPerFinal(1.5);
    setPeakMultiplier(3);
    setFleetSize(320);
  };

  const decision = !model.latencyPass
    ? 'Keep this tier asynchronous'
    : !model.capacityPass
      ? 'Apply admission control or add fleet capacity'
      : 'The plan covers the modeled peak';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and cost lab"
        title="Fit portrait quality inside an accelerator budget"
        description="Change the render tier, demand shape, and fleet size. The model recomputes preview work, peak capacity, GPU cost, and queue pressure together."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Select a render tier
              </legend>
              <div className="mt-3 space-y-2">
                {tiers.map((tier) => (
                  <LabChoice
                    key={tier.id}
                    selected={tier.id === tierId}
                    label={tier.label}
                    detail={tier.detail}
                    icon={Image}
                    accent={tier.id === 'quality' ? 'violet' : tier.id === 'preview-heavy' ? 'amber' : 'cyan'}
                    onClick={() => setTierId(tier.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Final images per day"
              value={finalsPerDay}
              output={finalsPerDay.toLocaleString()}
              min={60_000}
              max={240_000}
              step={20_000}
              lowLabel="60K"
              highLabel="240K"
              onChange={setFinalsPerDay}
            />
            <LabRange
              label="Preview candidates per final"
              value={previewsPerFinal}
              output={`${previewsPerFinal.toFixed(1)}x`}
              min={0.5}
              max={3}
              step={0.5}
              accent="violet"
              lowLabel="Few reruns"
              highLabel="Many directions"
              onChange={setPreviewsPerFinal}
            />
            <LabRange
              label="Peak multiplier"
              value={peakMultiplier}
              output={`${peakMultiplier}x`}
              min={2}
              max={5}
              accent="amber"
              lowLabel="Steady"
              highLabel="Bursty"
              onChange={setPeakMultiplier}
            />
            <LabRange
              label="Provisioned accelerators"
              value={fleetSize}
              output={fleetSize.toLocaleString()}
              min={80}
              max={500}
              step={20}
              accent="blue"
              lowLabel="80"
              highLabel="500"
              onChange={setFleetSize}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Preview jobs"
            value={model.previewJobs.toLocaleString()}
            detail="Per day before final renders"
            icon={Layers3}
            tone="violet"
          />
          <LabMetric
            label="Fleet required"
            value={model.requiredGpus.toLocaleString()}
            detail="Peak demand plus 25% headroom"
            icon={Cpu}
            tone={model.capacityPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Final render"
            value={`${model.tier.finalSeconds}s`}
            detail={`${model.tier.quality}/100 modeled quality`}
            icon={Timer}
            tone={model.latencyPass ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="GPU cost per final"
            value={`$${model.gpuCostPerFinal.toFixed(2)}`}
            detail={`$${Math.round(model.monthlyFleetCost).toLocaleString()} fleet per month`}
            icon={Coins}
            tone="amber"
          />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Peak fleet coverage</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The capacity target reserves 25% for retries, worker loss, and placement gaps.
              </p>
            </div>
            <output className="rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {(model.fleetCoverage * 100).toFixed(0)}% covered
            </output>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
            <div
              className={`h-full transition-[width] duration-200 ${model.capacityPass ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, model.fleetCoverage * 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.latencyPass && model.capacityPass
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.latencyPass && model.capacityPass ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Operational consequence</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{decision}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {!model.latencyPass
                  ? `${model.tier.label} finals need ${model.tier.finalSeconds} seconds before queueing, above the ${p95TargetSeconds}-second target. Reserve it for a labeled premium path or change the product promise.`
                  : !model.capacityPass
                    ? `At the modeled peak, a five-minute burst adds about ${model.fiveMinuteBacklog.toLocaleString()} accelerator-seconds of queued work. Add capacity, reduce preview churn, or delay admission before relaxing any release gate.`
                    : 'This fleet covers the selected demand model. Validate the seconds-per-job assumptions with production-shaped benchmarks at the chosen model, resolution, safety stack, and batch policy.'}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          Queue age is the operational signal: high GPU utilization can be healthy, while an aging interactive queue means users are missing the product promise.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
