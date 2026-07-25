'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Workload = {
  id: string;
  label: string;
  detail: string;
  defaultStreams: number;
  minStreams: number;
  maxStreams: number;
  defaultSampleRate: number;
  minSampleRate: number;
  maxSampleRate: number;
  complexityMultiplier: number;
  qualityReferenceFps: number;
  qualityPenaltyPerMissingFps: number;
};

type ModelProfile = {
  id: string;
  label: string;
  detail: string;
  framesPerSecondPerReplica: number;
  baseLatencyMs: number;
  qualityScore: number;
};

export type ComputerVisionCapacityLabData = {
  kind: 'capacity';
  blockId: string;
  title: string;
  description: string;
  targets: {
    latencyP95Ms: number;
    maxSteadyUtilizationPercent: number;
    minQualityScore: number;
    ingestOverheadMs: number;
    defaultReplicas: number;
    minReplicas: number;
    maxReplicas: number;
  };
  failure: {
    label: string;
    detail: string;
    replicaLossFraction: number;
  };
  workloads: Workload[];
  modelProfiles: ModelProfile[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function hasNumber(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'number' && Number.isFinite(record[key]);
}

function hasString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'string' && record[key].length > 0;
}

export function isComputerVisionCapacityLabData(
  value: unknown,
): value is ComputerVisionCapacityLabData {
  if (!isRecord(value) || value.kind !== 'capacity') return false;
  if (!hasString(value, 'blockId') || !hasString(value, 'title') || !hasString(value, 'description')) {
    return false;
  }
  if (!isRecord(value.targets) || !isRecord(value.failure)) return false;

  const targetKeys = [
    'latencyP95Ms',
    'maxSteadyUtilizationPercent',
    'minQualityScore',
    'ingestOverheadMs',
    'defaultReplicas',
    'minReplicas',
    'maxReplicas',
  ];
  if (!targetKeys.every((key) => hasNumber(value.targets as Record<string, unknown>, key))) {
    return false;
  }
  if (
    !hasString(value.failure, 'label') ||
    !hasString(value.failure, 'detail') ||
    !hasNumber(value.failure, 'replicaLossFraction')
  ) {
    return false;
  }

  const workloadsValid =
    Array.isArray(value.workloads) &&
    value.workloads.length > 0 &&
    value.workloads.every(
      (item) =>
        isRecord(item) &&
        ['id', 'label', 'detail'].every((key) => hasString(item, key)) &&
        [
          'defaultStreams',
          'minStreams',
          'maxStreams',
          'defaultSampleRate',
          'minSampleRate',
          'maxSampleRate',
          'complexityMultiplier',
          'qualityReferenceFps',
          'qualityPenaltyPerMissingFps',
        ].every((key) => hasNumber(item, key)),
    );
  const profilesValid =
    Array.isArray(value.modelProfiles) &&
    value.modelProfiles.length > 0 &&
    value.modelProfiles.every(
      (item) =>
        isRecord(item) &&
        ['id', 'label', 'detail'].every((key) => hasString(item, key)) &&
        ['framesPerSecondPerReplica', 'baseLatencyMs', 'qualityScore'].every((key) =>
          hasNumber(item, key),
        ),
    );

  return workloadsValid && profilesValid;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function ComputerVisionCapacityLab({
  data,
}: {
  data?: ComputerVisionCapacityLabData;
  dataFile?: string;
}) {
  if (!data) {
    return (
      <div
        data-content-block="ml-systems/computer-vision-systems-capacity-lab"
        className="not-prose my-7 rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        Load this lab through the computer-vision systems dispatcher with its capacity data file.
      </div>
    );
  }

  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: ComputerVisionCapacityLabData }) {
  const firstWorkload = data.workloads[0];
  const firstProfile = data.modelProfiles[0];
  const [workloadId, setWorkloadId] = useState(firstWorkload.id);
  const [profileId, setProfileId] = useState(firstProfile.id);
  const [streams, setStreams] = useState(firstWorkload.defaultStreams);
  const [sampleRate, setSampleRate] = useState(firstWorkload.defaultSampleRate);
  const [replicas, setReplicas] = useState(data.targets.defaultReplicas);
  const [zoneFailure, setZoneFailure] = useState(false);

  const model = useMemo(() => {
    const workload = data.workloads.find((item) => item.id === workloadId) ?? firstWorkload;
    const profile = data.modelProfiles.find((item) => item.id === profileId) ?? firstProfile;
    const lostReplicas = zoneFailure
      ? Math.max(1, Math.ceil(replicas * data.failure.replicaLossFraction))
      : 0;
    const liveReplicas = Math.max(1, replicas - lostReplicas);
    const incomingFrames = streams * sampleRate;
    const effectiveDemand = incomingFrames * workload.complexityMultiplier;
    const rawCapacity = liveReplicas * profile.framesPerSecondPerReplica;
    const utilization = effectiveDemand / Math.max(1, rawCapacity);
    const targetUtilization = data.targets.maxSteadyUtilizationPercent / 100;
    const safeFrameCapacity = Math.floor(
      (rawCapacity * targetUtilization) / workload.complexityMultiplier,
    );
    const requiredReplicas = Math.ceil(
      effectiveDemand / (profile.framesPerSecondPerReplica * targetUtilization),
    );
    const queuePenalty =
      utilization <= 0.5 ? utilization * 10 : 5 + (utilization - 0.5) * 220;
    const p95Ms = Math.round(
      Math.min(
        999,
        profile.baseLatencyMs +
          data.targets.ingestOverheadMs +
          queuePenalty +
          (zoneFailure ? 8 : 0),
      ),
    );
    const missingTemporalSamples = Math.max(0, workload.qualityReferenceFps - sampleRate);
    const qualityScore = Math.max(
      0,
      profile.qualityScore -
        missingTemporalSamples * workload.qualityPenaltyPerMissingFps,
    );
    const capacityPass = utilization <= targetUtilization;
    const latencyPass = p95Ms <= data.targets.latencyP95Ms;
    const qualityPass = qualityScore >= data.targets.minQualityScore;
    const ready = capacityPass && latencyPass && qualityPass;

    return {
      workload,
      profile,
      liveReplicas,
      incomingFrames,
      utilization,
      safeFrameCapacity,
      requiredReplicas,
      p95Ms,
      qualityScore,
      capacityPass,
      latencyPass,
      qualityPass,
      ready,
    };
  }, [
    data,
    firstProfile,
    firstWorkload,
    profileId,
    replicas,
    sampleRate,
    streams,
    workloadId,
    zoneFailure,
  ]);

  const chooseWorkload = (workload: Workload) => {
    setWorkloadId(workload.id);
    setStreams(workload.defaultStreams);
    setSampleRate(workload.defaultSampleRate);
  };

  const reset = () => {
    chooseWorkload(firstWorkload);
    setProfileId(firstProfile.id);
    setReplicas(data.targets.defaultReplicas);
    setZoneFailure(false);
  };

  const recommendation = !model.qualityPass
    ? 'The temporal quality floor fails. Sample more frames or choose a stronger model profile.'
    : !model.capacityPass || !model.latencyPass
      ? `The serving envelope fails. Provision at least ${model.requiredReplicas} live replicas or reduce admitted frames.`
      : zoneFailure
        ? 'The degraded fleet still meets latency, quality, and headroom targets.'
        : 'The steady-state fleet has room for traffic variance and queueing.';

  return (
    <div data-content-block={data.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and failure lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the visual workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={model.workload.id === workload.id}
                      label={workload.label}
                      detail={workload.detail}
                      icon={Camera}
                      accent="cyan"
                      onClick={() => chooseWorkload(workload)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Shape frame demand
                </legend>
                <LabRange
                  label="Concurrent streams"
                  value={streams}
                  output={streams.toLocaleString()}
                  min={model.workload.minStreams}
                  max={model.workload.maxStreams}
                  step={5}
                  accent="blue"
                  lowLabel={`${model.workload.minStreams} streams`}
                  highLabel={`${model.workload.maxStreams} streams`}
                  onChange={setStreams}
                />
                <LabRange
                  label="Sampled frames per stream"
                  value={sampleRate}
                  output={`${sampleRate} FPS`}
                  min={model.workload.minSampleRate}
                  max={model.workload.maxSampleRate}
                  accent="violet"
                  lowLabel="Sparse events"
                  highLabel="Dense motion"
                  onChange={setSampleRate}
                />
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose the model profile
                </legend>
                <div className="mt-3 space-y-2">
                  {data.modelProfiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={model.profile.id === profile.id}
                      label={`${profile.label} (${profile.qualityScore}% quality proxy)`}
                      detail={profile.detail}
                      icon={Cpu}
                      accent={profile.id === 'fast' ? 'amber' : profile.id === 'accurate' ? 'violet' : 'emerald'}
                      onClick={() => setProfileId(profile.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Provisioned GPU replicas"
                value={replicas}
                output={replicas.toLocaleString()}
                min={data.targets.minReplicas}
                max={data.targets.maxReplicas}
                accent="emerald"
                lowLabel={`${data.targets.minReplicas} replicas`}
                highLabel={`${data.targets.maxReplicas} replicas`}
                onChange={setReplicas}
              />
              <button
                type="button"
                aria-pressed={zoneFailure}
                onClick={() => setZoneFailure((current) => !current)}
                className={`flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  zoneFailure
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                    : 'border-neutral-200 bg-white text-neutral-800 hover:border-rose-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-rose-800'
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">{data.failure.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    {data.failure.detail}
                  </span>
                </span>
                <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
              </button>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Admitted frames"
                value={`${model.incomingFrames.toLocaleString()}/s`}
                detail="Streams x sampled FPS"
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Safe capacity"
                value={`${model.safeFrameCapacity.toLocaleString()}/s`}
                detail={`${model.liveReplicas} live replicas at ${data.targets.maxSteadyUtilizationPercent}% target`}
                icon={Server}
                tone={model.capacityPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled p95"
                value={`${model.p95Ms} ms`}
                detail={`${data.targets.latencyP95Ms} ms end-to-end target`}
                icon={Clock3}
                tone={model.latencyPass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Quality proxy"
                value={`${model.qualityScore.toFixed(1)}%`}
                detail={`${data.targets.minQualityScore}% minimum validated floor`}
                icon={Gauge}
                tone={model.qualityPass ? 'violet' : 'amber'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Accelerator pressure
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Effective utilization includes scene complexity and live replica loss.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {percent(model.utilization)} utilized
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    model.capacityPass ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, model.utilization * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>0%</span>
                <span>{data.targets.maxSteadyUtilizationPercent}% steady-state ceiling</span>
              </div>
            </div>

            <div
              className={`mt-5 rounded-md border p-4 ${
                model.ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {model.ready ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {model.ready ? 'Serving envelope passes' : 'Serving envelope fails'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{recommendation}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  label: 'Capacity gate',
                  pass: model.capacityPass,
                  text: model.capacityPass
                    ? 'Demand remains below the planned utilization ceiling.'
                    : `At least ${model.requiredReplicas} live replicas are required for headroom.`,
                },
                {
                  label: 'Latency gate',
                  pass: model.latencyPass,
                  text: model.latencyPass
                    ? 'Queueing stays inside the end-to-end deadline.'
                    : 'Queue pressure consumes the tail-latency budget.',
                },
                {
                  label: 'Quality gate',
                  pass: model.qualityPass,
                  text: model.qualityPass
                    ? 'The model and sample rate preserve the validated floor.'
                    : 'Sampling or model choice removes too much decision evidence.',
                },
              ].map((gate) => (
                <div key={gate.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    {gate.pass ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    )}
                    {gate.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    {gate.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
