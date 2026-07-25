'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  Cpu,
  Gauge,
  HardDrive,
  Images,
  Network,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ProfileId = 'efficient' | 'balanced' | 'rich';

type DerivativeProfile = {
  id: ProfileId;
  label: string;
  detail: string;
  variants: number;
  derivativeMegabytes: number;
  secondsPerVariant: number;
};

const profiles: DerivativeProfile[] = [
  {
    id: 'efficient',
    label: 'Efficient',
    detail: 'Four common sizes with aggressive modern-format compression.',
    variants: 4,
    derivativeMegabytes: 0.9,
    secondsPerVariant: 0.18,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    detail: 'Six display and thumbnail variants for the normal device mix.',
    variants: 6,
    derivativeMegabytes: 1.8,
    secondsPerVariant: 0.24,
  },
  {
    id: 'rich',
    label: 'Rich compatibility',
    detail: 'Nine variants with extra formats and higher-resolution delivery.',
    variants: 9,
    derivativeMegabytes: 3.2,
    secondsPerVariant: 0.35,
  },
];

const secondsPerDay = 86_400;
const workerHeadroom = 1.25;
const durableCopies = 2;

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function storage(valueTerabytes: number) {
  return valueTerabytes >= 1_000
    ? `${(valueTerabytes / 1_000).toFixed(2)} PB`
    : `${Math.round(valueTerabytes).toLocaleString()} TB`;
}

export default function InstagramPhotosCapacityLab() {
  const [profileId, setProfileId] = useState<ProfileId>('balanced');
  const [uploadsPerDay, setUploadsPerDay] = useState(100_000_000);
  const [originalMegabytes, setOriginalMegabytes] = useState(4);
  const [peakMultiplier, setPeakMultiplier] = useState(3);
  const [workers, setWorkers] = useState(7_500);

  const model = useMemo(() => {
    const profile = profiles.find((item) => item.id === profileId) ?? profiles[1];
    const averageUploadsPerSecond = uploadsPerDay / secondsPerDay;
    const peakUploadsPerSecond = averageUploadsPerSecond * peakMultiplier;
    const peakIngressGbps = (peakUploadsPerSecond * originalMegabytes * 8) / 1_000;
    const originalTerabytesPerDay = (uploadsPerDay * originalMegabytes) / 1_000_000;
    const derivativeTerabytesPerDay =
      (uploadsPerDay * profile.derivativeMegabytes) / 1_000_000;
    const logicalTerabytesPerDay = originalTerabytesPerDay + derivativeTerabytesPerDay;
    const annualTwoCopyPetabytes =
      (logicalTerabytesPerDay * 365 * durableCopies) / 1_000;
    const derivativeJobsPerDay = uploadsPerDay * profile.variants;
    const peakDerivativeJobsPerSecond =
      (derivativeJobsPerDay / secondsPerDay) * peakMultiplier;
    const rawWorkerThroughput = workers / profile.secondsPerVariant;
    const requiredWorkers = Math.ceil(
      peakDerivativeJobsPerSecond * profile.secondsPerVariant * workerHeadroom,
    );
    const targetCoverage = workers / requiredWorkers;
    const backlogJobsPerMinute = Math.max(
      0,
      (peakDerivativeJobsPerSecond - rawWorkerThroughput) * 60,
    );
    const overloaded = rawWorkerThroughput < peakDerivativeJobsPerSecond;
    const tight = !overloaded && workers < requiredWorkers;

    return {
      profile,
      peakUploadsPerSecond,
      peakIngressGbps,
      originalTerabytesPerDay,
      derivativeTerabytesPerDay,
      logicalTerabytesPerDay,
      annualTwoCopyPetabytes,
      derivativeJobsPerDay,
      requiredWorkers,
      targetCoverage,
      backlogJobsPerMinute,
      overloaded,
      tight,
    };
  }, [originalMegabytes, peakMultiplier, profileId, uploadsPerDay, workers]);

  const reset = () => {
    setProfileId('balanced');
    setUploadsPerDay(100_000_000);
    setOriginalMegabytes(4);
    setPeakMultiplier(3);
    setWorkers(7_500);
  };

  const healthy = !model.overloaded && !model.tight;
  const verdict = model.overloaded
    ? 'Derivative backlog grows during the modeled peak'
    : model.tight
      ? 'The peak fits, but retry and worker-loss headroom is thin'
      : 'The derivative fleet covers the peak with 25% headroom';
  const consequence = model.overloaded
    ? `The fleet adds about ${compact(model.backlogJobsPerMinute)} variant jobs per peak minute. Keep uploads durable, report processing state honestly, and add workers or reduce the required profile before publishing incomplete media.`
    : model.tight
      ? `Raw throughput covers the selected peak, but the fleet is below the ${model.requiredWorkers.toLocaleString()}-worker planning target. A retry burst or worker loss can age the publication queue.`
      : `The selected fleet can absorb the modeled burst and reserve capacity for retries and placement gaps. Validate the ${model.profile.secondsPerVariant.toFixed(2)} seconds-per-variant assumption with production-shaped images.`;

  const originalShare =
    (model.originalTerabytesPerDay / model.logicalTerabytesPerDay) * 100;
  const derivativeShare = 100 - originalShare;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Media capacity model"
        title="Connect upload demand to storage and derivative pressure"
        description="Change one planning envelope. Every control updates peak ingest, logical storage, derivative work, annual durable footprint, and the worker consequence together."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose a derivative profile
              </legend>
              <div className="mt-3 space-y-2">
                {profiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={profile.id === profileId}
                    label={profile.label}
                    detail={profile.detail}
                    icon={Images}
                    accent={
                      profile.id === 'rich'
                        ? 'violet'
                        : profile.id === 'efficient'
                          ? 'emerald'
                          : 'cyan'
                    }
                    onClick={() => setProfileId(profile.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Accepted photos per day"
              value={uploadsPerDay}
              output={`${compact(uploadsPerDay)}/day`}
              min={25_000_000}
              max={200_000_000}
              step={25_000_000}
              lowLabel="25M"
              highLabel="200M"
              onChange={setUploadsPerDay}
            />
            <LabRange
              label="Average original size"
              value={originalMegabytes}
              output={`${originalMegabytes} MB`}
              min={2}
              max={10}
              step={1}
              accent="violet"
              lowLabel="2 MB"
              highLabel="10 MB"
              onChange={setOriginalMegabytes}
            />
            <LabRange
              label="Peak multiplier"
              value={peakMultiplier}
              output={`${peakMultiplier}x`}
              min={2}
              max={6}
              step={1}
              accent="amber"
              lowLabel="Steady"
              highLabel="Event burst"
              onChange={setPeakMultiplier}
            />
            <LabRange
              label="Derivative worker slots"
              value={workers}
              output={workers.toLocaleString()}
              min={2_000}
              max={20_000}
              step={500}
              accent="blue"
              lowLabel="2,000"
              highLabel="20,000"
              onChange={setWorkers}
            />
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The storage estimate uses decimal units and two durable regional copies.
              Real object stores may use erasure coding, so benchmark provider-specific
              physical overhead separately.
            </p>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Peak uploads"
            value={`${compact(model.peakUploadsPerSecond)}/s`}
            detail={`${model.peakIngressGbps.toFixed(0)} Gbps of original bytes`}
            icon={CloudUpload}
            tone="blue"
          />
          <LabMetric
            label="Logical media"
            value={`${storage(model.logicalTerabytesPerDay)}/day`}
            detail="Originals plus generated derivatives"
            icon={HardDrive}
            tone="violet"
          />
          <LabMetric
            label="Derivative jobs"
            value={`${compact(model.derivativeJobsPerDay)}/day`}
            detail={`${model.profile.variants} variants per accepted photo`}
            icon={Images}
            tone="amber"
          />
          <LabMetric
            label="Worker target"
            value={model.requiredWorkers.toLocaleString()}
            detail="Peak work plus 25% operating headroom"
            icon={Cpu}
            tone={model.overloaded ? 'rose' : model.tight ? 'amber' : 'emerald'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Daily logical storage mix
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {storage(model.originalTerabytesPerDay)} originals plus{' '}
                {storage(model.derivativeTerabytesPerDay)} derivatives
              </p>
            </div>
            <output className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {model.annualTwoCopyPetabytes.toFixed(0)} PB/year at two copies
            </output>
          </div>
          <div
            className="mt-4 flex h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
            role="img"
            aria-label={`${originalShare.toFixed(0)} percent originals and ${derivativeShare.toFixed(0)} percent derivatives`}
          >
            <div
              className="h-full bg-blue-500 transition-[width] duration-200"
              style={{ width: `${originalShare}%` }}
            />
            <div
              className="h-full bg-violet-500 transition-[width] duration-200"
              style={{ width: `${derivativeShare}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" aria-hidden="true" />
              Originals {originalShare.toFixed(0)}%
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" aria-hidden="true" />
              Derivatives {derivativeShare.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Worker coverage against the planning target
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Provisioned {workers.toLocaleString()} of {model.requiredWorkers.toLocaleString()} worker slots
              </p>
            </div>
            <output className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {(model.targetCoverage * 100).toFixed(0)}% covered
            </output>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
            role="progressbar"
            aria-label="Derivative worker coverage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(model.targetCoverage * 100))}
          >
            <div
              className={`h-full transition-[width] duration-200 ${
                model.overloaded
                  ? 'bg-rose-500'
                  : model.tight
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, model.targetCoverage * 100)}%` }}
            />
          </div>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.overloaded
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
              : model.tight
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {healthy ? (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
              />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  model.overloaded
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-amber-600 dark:text-amber-300'
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Publication consequence
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {verdict}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {consequence}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50">
          <Network aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          Storage and compute are coupled by the derivative policy, but neither changes
          the publication invariant: queue pressure may delay visibility, never justify
          an incomplete or unmoderated post.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
