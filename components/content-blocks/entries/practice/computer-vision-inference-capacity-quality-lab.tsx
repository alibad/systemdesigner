'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Server,
  ShieldAlert,
  Video,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type TierId = 'fast' | 'balanced' | 'accurate';

const tiers: Record<TierId, {
  label: string;
  detail: string;
  framesPerSecond: number;
  baseP95Ms: number;
  qualityScore: number;
}> = {
  fast: {
    label: 'Fast detector',
    detail: 'High frame throughput, suitable only when the lower quality floor is acceptable.',
    framesPerSecond: 540,
    baseP95Ms: 42,
    qualityScore: 82,
  },
  balanced: {
    label: 'Balanced detector',
    detail: 'Default tier for live safety events with enough headroom for a zone failure.',
    framesPerSecond: 320,
    baseP95Ms: 62,
    qualityScore: 89,
  },
  accurate: {
    label: 'Accurate detector',
    detail: 'Higher recall for difficult scenes, but often needs batching or more replicas.',
    framesPerSecond: 180,
    baseP95Ms: 94,
    qualityScore: 94,
  },
};

const tierIds = Object.keys(tiers) as TierId[];

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function ComputerVisionInferenceCapacityQualityLab() {
  const [streams, setStreams] = useState(120);
  const [sampleRate, setSampleRate] = useState(8);
  const [tierId, setTierId] = useState<TierId>('balanced');
  const [replicas, setReplicas] = useState(6);
  const [zoneFailure, setZoneFailure] = useState(false);

  const model = useMemo(() => {
    const tier = tiers[tierId];
    const incomingFrames = streams * sampleRate;
    const liveReplicas = zoneFailure ? Math.max(1, Math.floor(replicas * (2 / 3))) : replicas;
    const capacity = liveReplicas * tier.framesPerSecond;
    const utilization = incomingFrames / capacity;
    const queuePenalty = utilization <= 0.65
      ? 0
      : Math.round(Math.min(420, Math.pow((utilization - 0.65) * 3.5, 2) * 180));
    const p95Ms = tier.baseP95Ms + queuePenalty;
    const requiredReplicas = Math.ceil(incomingFrames / (tier.framesPerSecond * 0.7));
    const qualityPass = tier.qualityScore >= 88;
    const capacityPass = utilization <= 0.7;
    const latencyPass = p95Ms <= 120;
    const ready = qualityPass && capacityPass && latencyPass;

    return {
      tier,
      incomingFrames,
      liveReplicas,
      capacity,
      utilization,
      p95Ms,
      requiredReplicas,
      qualityPass,
      capacityPass,
      latencyPass,
      ready,
    };
  }, [replicas, sampleRate, streams, tierId, zoneFailure]);

  const reset = () => {
    setStreams(120);
    setSampleRate(8);
    setTierId('balanced');
    setReplicas(6);
    setZoneFailure(false);
  };

  const recommendation = model.ready
    ? 'Live path accepted'
    : !model.qualityPass
      ? 'Quality floor missed'
      : !model.latencyPass
        ? 'Queue or add replicas'
        : 'Add failure headroom';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Inference capacity and quality lab"
        title="Fit a video fleet inside its latency and quality envelope"
        description="Change camera demand, sampling, model tier, replica count, and a zone-loss event. The release decision requires all three: adequate visual quality, p95 under 120 ms, and capacity held below 70%."
        icon={Video}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Concurrent camera streams"
              value={streams}
              output={streams.toLocaleString()}
              min={40}
              max={240}
              step={10}
              accent="cyan"
              lowLabel="40 cameras"
              highLabel="240 cameras"
              onChange={setStreams}
            />
            <LabRange
              label="Frames sampled per stream"
              value={sampleRate}
              output={`${sampleRate} FPS`}
              min={2}
              max={15}
              accent="violet"
              lowLabel="Event sampling"
              highLabel="Dense tracking"
              onChange={setSampleRate}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Serving tier</legend>
              <div className="mt-3 space-y-2">
                {tierIds.map((id) => {
                  const tier = tiers[id];
                  return (
                    <LabChoice
                      key={id}
                      selected={tierId === id}
                      label={`${tier.label} (${tier.qualityScore}% quality proxy)`}
                      detail={`${tier.framesPerSecond} frames/s per replica. ${tier.detail}`}
                      icon={Cpu}
                      accent={id === 'fast' ? 'amber' : id === 'balanced' ? 'cyan' : 'violet'}
                      onClick={() => setTierId(id)}
                    />
                  );
                })}
              </div>
            </fieldset>
            <LabRange
              label="Provisioned GPU replicas"
              value={replicas}
              output={replicas.toLocaleString()}
              min={2}
              max={24}
              step={1}
              accent="emerald"
              lowLabel="2 replicas"
              highLabel="24 replicas"
              onChange={setReplicas}
            />
            <button
              type="button"
              aria-pressed={zoneFailure}
              onClick={() => setZoneFailure((value) => !value)}
              className={`flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${zoneFailure
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                : 'border-neutral-200 bg-white text-neutral-800 hover:border-rose-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-rose-800'}`}
            >
              <span>
                <span className="block text-sm font-semibold">One serving zone unavailable</span>
                <span className="mt-1 block text-xs leading-5 opacity-75">Remove one third of replicas and test the same traffic.</span>
              </span>
              <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric label="Incoming frames" value={`${model.incomingFrames.toLocaleString()}/s`} detail="Streams x sample rate" icon={Activity} tone="blue" />
          <LabMetric label="Live capacity" value={`${model.capacity.toLocaleString()}/s`} detail={`${model.liveReplicas} replicas available`} icon={Server} tone={model.capacityPass ? 'emerald' : 'rose'} />
          <LabMetric label="Modeled p95" value={`${model.p95Ms} ms`} detail="120 ms real-time target" icon={Clock3} tone={model.latencyPass ? 'cyan' : 'rose'} />
          <LabMetric label="Quality proxy" value={`${model.tier.qualityScore}%`} detail="88% minimum release floor" icon={Gauge} tone={model.qualityPass ? 'violet' : 'amber'} />
        </div>

        <div className={`mt-5 rounded-md border p-4 ${model.ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}
        >
          <div className="flex items-start gap-3">
            {model.ready ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-semibold">{recommendation}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                Utilization is {percent(model.utilization)}. Provision {model.requiredReplicas} replicas for 70% steady-state utilization; this configuration has {replicas} provisioned.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Quality gate', pass: model.qualityPass, text: model.qualityPass ? 'Tier clears the 88% proxy floor.' : 'Fast tier is only safe for a separately approved low-risk lane.' },
            { label: 'Latency gate', pass: model.latencyPass, text: model.latencyPass ? 'Tail latency remains inside the live deadline.' : 'Queueing has consumed the real-time budget.' },
            { label: 'Capacity gate', pass: model.capacityPass, text: model.capacityPass ? 'The fleet preserves operational headroom.' : 'Demand exceeds the 70% headroom target.' },
          ].map((gate) => (
            <div key={gate.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                {gate.pass ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
                {gate.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{gate.text}</p>
            </div>
          ))}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
