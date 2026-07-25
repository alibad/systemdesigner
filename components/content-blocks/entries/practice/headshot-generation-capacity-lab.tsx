'use client';

import { useMemo, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Cpu, Gauge, Image, Layers3, Timer } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TierId = 'economy' | 'standard' | 'studio';

type Tier = {
  id: TierId;
  label: string;
  detail: string;
  previewSeconds: number;
  finalSeconds: number;
  finalMegabytes: number;
  quality: number;
};

const tiers: Tier[] = [
  {
    id: 'economy',
    label: 'Economy',
    detail: 'Smaller previews and a 2048 px final for a constrained budget.',
    previewSeconds: 7,
    finalSeconds: 30,
    finalMegabytes: 5,
    quality: 78,
  },
  {
    id: 'standard',
    label: 'Standard',
    detail: 'Balanced quality for the normal interactive path.',
    previewSeconds: 10,
    finalSeconds: 45,
    finalMegabytes: 8,
    quality: 88,
  },
  {
    id: 'studio',
    label: 'Studio',
    detail: 'More denoising and refinement for premium final output.',
    previewSeconds: 14,
    finalSeconds: 68,
    finalMegabytes: 16,
    quality: 95,
  },
];

const secondsPerDay = 86_400;
const targetSeconds = 60;
const headroom = 1.25;
const previewMegabytes = 1.5;

export default function HeadshotGenerationCapacityLab() {
  const [tierId, setTierId] = useState<TierId>('standard');
  const [finalImagesPerDay, setFinalImagesPerDay] = useState(50_000);
  const [previewsPerFinal, setPreviewsPerFinal] = useState(2.5);
  const [peakMultiplier, setPeakMultiplier] = useState(3);
  const [fleetSize, setFleetSize] = useState(130);

  const model = useMemo(() => {
    const tier = tiers.find((item) => item.id === tierId) ?? tiers[1];
    const previewJobs = finalImagesPerDay * previewsPerFinal;
    const totalAcceleratorSeconds = previewJobs * tier.previewSeconds + finalImagesPerDay * tier.finalSeconds;
    const averageAccelerators = totalAcceleratorSeconds / secondsPerDay;
    const requiredAccelerators = Math.ceil(averageAccelerators * peakMultiplier * headroom);
    const coverage = fleetSize / requiredAccelerators;
    const peakWorkPerSecond = (totalAcceleratorSeconds / secondsPerDay) * peakMultiplier;
    const peakCapacity = fleetSize / headroom;
    const fiveMinuteBacklog = Math.max(0, Math.round((peakWorkPerSecond - peakCapacity) * 300));
    const retentionTerabytes =
      (previewJobs * previewMegabytes + finalImagesPerDay * tier.finalMegabytes) / 1_000_000;
    const latencyPass = tier.finalSeconds <= targetSeconds;
    const capacityPass = fleetSize >= requiredAccelerators;

    return {
      tier,
      previewJobs,
      requiredAccelerators,
      coverage,
      fiveMinuteBacklog,
      retentionTerabytes,
      latencyPass,
      capacityPass,
    };
  }, [finalImagesPerDay, fleetSize, peakMultiplier, previewsPerFinal, tierId]);

  const reset = () => {
    setTierId('standard');
    setFinalImagesPerDay(50_000);
    setPreviewsPerFinal(2.5);
    setPeakMultiplier(3);
    setFleetSize(130);
  };

  const decision = !model.latencyPass
    ? 'Final tier misses the interactive target'
    : !model.capacityPass
      ? 'Fleet is short for the modeled peak'
      : 'Plan covers the modeled peak with headroom';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity decision lab"
        title="Fit preview and final work into the accelerator fleet"
        description="Choose a render tier and demand shape. The model recomputes preview work, fleet need, queue pressure, and retained media together."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose a render tier
              </legend>
              <div className="mt-3 space-y-2">
                {tiers.map((tier) => (
                  <LabChoice
                    key={tier.id}
                    selected={tier.id === tierId}
                    label={tier.label}
                    detail={tier.detail}
                    icon={Image}
                    accent={tier.id === 'studio' ? 'violet' : tier.id === 'economy' ? 'amber' : 'cyan'}
                    onClick={() => setTierId(tier.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Final images per day"
              value={finalImagesPerDay}
              output={finalImagesPerDay.toLocaleString()}
              min={20_000}
              max={100_000}
              step={10_000}
              lowLabel="20K"
              highLabel="100K"
              onChange={setFinalImagesPerDay}
            />
            <LabRange
              label="Preview candidates per final"
              value={previewsPerFinal}
              output={`${previewsPerFinal.toFixed(1)}x`}
              min={1}
              max={4}
              step={0.5}
              accent="violet"
              lowLabel="One direction"
              highLabel="Many reruns"
              onChange={setPreviewsPerFinal}
            />
            <LabRange
              label="Peak multiplier"
              value={peakMultiplier}
              output={`${peakMultiplier}x`}
              min={2}
              max={5}
              accent="amber"
              lowLabel="Steady demand"
              highLabel="Business-hour burst"
              onChange={setPeakMultiplier}
            />
            <LabRange
              label="Provisioned accelerators"
              value={fleetSize}
              output={fleetSize.toLocaleString()}
              min={50}
              max={350}
              step={10}
              accent="blue"
              lowLabel="50"
              highLabel="350"
              onChange={setFleetSize}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Preview jobs"
            value={model.previewJobs.toLocaleString()}
            detail="Per day before final rendering"
            icon={Layers3}
            tone="violet"
          />
          <LabMetric
            label="Fleet required"
            value={model.requiredAccelerators.toLocaleString()}
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
            label="Media retained"
            value={`${model.retentionTerabytes.toFixed(2)} TB`}
            detail="One day of previews and finals"
            icon={Image}
            tone="amber"
          />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Peak fleet coverage</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The target includes a 25% reserve for retries, worker loss, and placement gaps.
              </p>
            </div>
            <output className="rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {(model.coverage * 100).toFixed(0)}% covered
            </output>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
            <div
              className={`h-full transition-[width] duration-200 ${model.capacityPass ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, model.coverage * 100)}%` }}
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
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Capacity consequence</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{decision}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {!model.latencyPass
                  ? `${model.tier.label} finals take ${model.tier.finalSeconds} seconds before queueing, above the ${targetSeconds}-second target. Keep this tier for an asynchronous premium path or change the service promise.`
                  : !model.capacityPass
                    ? `A five-minute peak would add about ${model.fiveMinuteBacklog.toLocaleString()} accelerator-seconds of queued work. Provision capacity, reduce preview reruns, or apply admission control before relaxing release checks.`
                    : `The modeled fleet supports the chosen preview and final mix. Validate the seconds-per-job assumptions with production-shaped benchmarks at the chosen resolution, model version, and batch size.`}
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
