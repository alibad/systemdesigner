'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Network,
  RadioTower,
  Server,
  Video,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeConfig {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface QualityProfile {
  id: string;
  label: string;
  detail: string;
  speakerMbps: number;
  thumbnailMbps: number;
  thumbnailStreams: number;
  publishMbps: number;
}

interface CapacityData {
  title: string;
  description: string;
  participants: RangeConfig;
  sfus: RangeConfig;
  activeCameraShare: number;
  activeAudioStreams: number;
  audioMbps: number;
  perSfuEgressGbps: number;
  targetUtilization: number;
  defaultProfileId: string;
  profiles: QualityProfile[];
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRangeConfig(value: unknown): value is RangeConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeConfig>;
  return (
    isPositiveNumber(candidate.default) &&
    isPositiveNumber(candidate.min) &&
    isPositiveNumber(candidate.max) &&
    isPositiveNumber(candidate.step) &&
    candidate.min <= candidate.default &&
    candidate.default <= candidate.max
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  if (
    typeof candidate.title !== 'string' ||
    typeof candidate.description !== 'string' ||
    !isRangeConfig(candidate.participants) ||
    !isRangeConfig(candidate.sfus) ||
    !isPositiveNumber(candidate.activeCameraShare) ||
    candidate.activeCameraShare > 1 ||
    !isPositiveNumber(candidate.activeAudioStreams) ||
    !isPositiveNumber(candidate.audioMbps) ||
    !isPositiveNumber(candidate.perSfuEgressGbps) ||
    !isPositiveNumber(candidate.targetUtilization) ||
    candidate.targetUtilization > 1 ||
    typeof candidate.defaultProfileId !== 'string' ||
    !Array.isArray(candidate.profiles) ||
    candidate.profiles.length < 2
  ) {
    return false;
  }

  const profilesValid = candidate.profiles.every((profile) =>
    Boolean(
      profile &&
        typeof profile.id === 'string' &&
        typeof profile.label === 'string' &&
        typeof profile.detail === 'string' &&
        isPositiveNumber(profile.speakerMbps) &&
        isPositiveNumber(profile.thumbnailMbps) &&
        isPositiveNumber(profile.thumbnailStreams) &&
        isPositiveNumber(profile.publishMbps),
    ),
  );

  return (
    profilesValid &&
    candidate.profiles.some((profile) => profile.id === candidate.defaultProfileId)
  );
}

function formatGbps(value: number) {
  return value < 1 ? `${Math.round(value * 1000)} Mbps` : `${value.toFixed(2)} Gbps`;
}

function formatMbps(value: number) {
  return `${value.toFixed(2)} Mbps`;
}

export default function ZoomVideoMediaCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [participants, setParticipants] = useState(600);
  const [sfus, setSfus] = useState(2);
  const [profileId, setProfileId] = useState('balanced');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity model data is invalid');
        setData(payload);
        setParticipants(payload.participants.default);
        setSfus(payload.sfus.default);
        setProfileId(payload.defaultProfileId);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
    const videoPublishers = Math.ceil(participants * data.activeCameraShare);
    const thumbnails = Math.min(profile.thumbnailStreams, Math.max(0, videoPublishers - 1));
    const audioStreams = Math.min(data.activeAudioStreams, Math.max(0, participants - 1));
    const perReceiverMbps =
      profile.speakerMbps + thumbnails * profile.thumbnailMbps + audioStreams * data.audioMbps;
    const ingressGbps =
      (videoPublishers * profile.publishMbps + audioStreams * data.audioMbps) / 1000;
    const outboundGbps = (participants * perReceiverMbps) / 1000;
    const targetCapacityGbps = sfus * data.perSfuEgressGbps * data.targetUtilization;
    const targetPressure = (outboundGbps / targetCapacityGbps) * 100;
    const minimumSfus = Math.ceil(
      outboundGbps / (data.perSfuEgressGbps * data.targetUtilization),
    );
    const survivingTargetGbps =
      Math.max(0, sfus - 1) * data.perSfuEgressGbps * data.targetUtilization;
    const afterLossPressure =
      survivingTargetGbps > 0 ? (outboundGbps / survivingTargetGbps) * 100 : Number.POSITIVE_INFINITY;
    const overloaded = targetPressure > 100;
    const tight = !overloaded && targetPressure >= 85;

    return {
      profile,
      videoPublishers,
      thumbnails,
      audioStreams,
      perReceiverMbps,
      ingressGbps,
      outboundGbps,
      targetCapacityGbps,
      targetPressure,
      minimumSfus,
      afterLossPressure,
      overloaded,
      tight,
    };
  }, [data, participants, profileId, sfus]);

  if (loadError) {
    return (
      <div className="flex min-h-44 items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        The SFU capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div className="min-h-[520px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
    );
  }

  const reset = () => {
    setParticipants(data.participants.default);
    setSfus(data.sfus.default);
    setProfileId(data.defaultProfileId);
  };
  const healthy = !model.overloaded && !model.tight;
  const verdict = model.overloaded
    ? 'Allocated SFU egress exceeds the operating target'
    : model.tight
      ? 'The meeting fits, but burst and recovery headroom are thin'
      : 'The meeting fits inside the modeled operating target';
  const consequence = model.overloaded
    ? `Provision at least ${model.minimumSfus} SFUs at this profile or reduce forwarded video. Continued pressure creates SFU queues, packet loss, freezes, and eventually audio gaps.`
    : model.tight
      ? `Normal load fits, but a speaker change, retransmission burst, or uneven subscription mix can cross the target. The model needs at least ${model.minimumSfus} SFUs before adding N-1 reserve.`
      : Number.isFinite(model.afterLossPressure) && model.afterLossPressure <= 100
        ? `The allocation also stays within the 65% target after one SFU loss at ${model.afterLossPressure.toFixed(0)}% pressure. Reconnect capacity and state rebuild still need a load test.`
        : 'Normal load fits, but losing one allocated SFU would exhaust the target. Add recovery reserve or begin reconnections in a lower video profile.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Media fan-out capacity lab"
        title={data.title}
        description={data.description}
        icon={RadioTower}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Meeting participants"
              value={participants}
              output={participants.toLocaleString()}
              min={data.participants.min}
              max={data.participants.max}
              step={data.participants.step}
              lowLabel={data.participants.min.toLocaleString()}
              highLabel={data.participants.max.toLocaleString()}
              onChange={setParticipants}
            />
            <LabRange
              label="Allocated SFUs"
              value={sfus}
              output={sfus.toLocaleString()}
              min={data.sfus.min}
              max={data.sfus.max}
              step={data.sfus.step}
              accent="blue"
              lowLabel={`${data.sfus.min} SFU`}
              highLabel={`${data.sfus.max} SFUs`}
              onChange={setSfus}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Receiver quality mix
              </legend>
              <div className="mt-3 space-y-2">
                {data.profiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={profile.id === model.profile.id}
                    label={profile.label}
                    detail={profile.detail}
                    icon={Video}
                    accent={profile.id === 'audio-priority' ? 'amber' : 'violet'}
                    onClick={() => setProfileId(profile.id)}
                  />
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Each SFU has {data.perSfuEgressGbps.toFixed(1)} Gbps raw egress in this
              model. The operating target uses only {Math.round(data.targetUtilization * 100)}%
              for normal assignment.
            </p>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Per receiver"
            value={formatMbps(model.perReceiverMbps)}
            detail={`1 speaker + ${model.thumbnails} thumbnails + ${model.audioStreams} audio streams`}
            icon={Video}
            tone="violet"
          />
          <LabMetric
            label="SFU ingress"
            value={formatGbps(model.ingressGbps)}
            detail={`${model.videoPublishers.toLocaleString()} active video publishers`}
            icon={Network}
            tone="blue"
          />
          <LabMetric
            label="SFU outbound"
            value={formatGbps(model.outboundGbps)}
            detail={`${participants.toLocaleString()} receiver-specific mixes`}
            icon={Activity}
            tone="amber"
          />
          <LabMetric
            label="Target capacity"
            value={formatGbps(model.targetCapacityGbps)}
            detail={`${sfus} x ${data.perSfuEgressGbps.toFixed(1)} Gbps x ${Math.round(data.targetUtilization * 100)}%`}
            icon={Server}
            tone={model.overloaded ? 'rose' : 'emerald'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Outbound pressure against the operating target
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {participants.toLocaleString()} receivers x {formatMbps(model.perReceiverMbps)} ={' '}
                {formatGbps(model.outboundGbps)}
              </p>
            </div>
            <output className="shrink-0 rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white">
              {model.targetPressure.toFixed(0)}% of target
            </output>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
            role="progressbar"
            aria-label="SFU outbound pressure against the operating target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(model.targetPressure))}
          >
            <div
              className={`h-full transition-[width] duration-200 ${
                model.overloaded ? 'bg-rose-500' : model.tight ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, model.targetPressure)}%` }}
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
                Operational consequence
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

        <div className="mt-5 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50">
          <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6">
            Minimum normal allocation: {model.minimumSfus} SFUs. This is a network model;
            CPU, transport count, packet rate, and uneven participant subscriptions can
            require more capacity.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
