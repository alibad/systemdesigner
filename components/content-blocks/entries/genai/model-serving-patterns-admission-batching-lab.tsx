'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

interface WorkloadProfile {
  id: string;
  label: string;
  detail: string;
  arrivalRps: number;
  burstMultiplier: number;
  latencySloMs: number;
  baseServiceMs: number;
  baseCapacityRpsPerReplica: number;
  fallbackCapacityRps: number;
}

interface AdmissionPolicy {
  id: 'queue-all' | 'deadline-shed' | 'fallback-route';
  label: string;
  detail: string;
}

interface AdmissionBatchingData {
  title: string;
  description: string;
  defaultProfileId: string;
  defaultPolicyId: AdmissionPolicy['id'];
  defaults: {
    batchWindowMs: number;
    maxBatchSize: number;
    replicas: number;
  };
  profiles: WorkloadProfile[];
  policies: AdmissionPolicy[];
}

const BLOCK_ID = 'genai/model-serving-patterns-admission-batching-lab';

function isAdmissionBatchingData(value: unknown): value is AdmissionBatchingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdmissionBatchingData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaultProfileId === 'string'
      && typeof candidate.defaultPolicyId === 'string'
      && candidate.defaults
      && typeof candidate.defaults.batchWindowMs === 'number'
      && typeof candidate.defaults.maxBatchSize === 'number'
      && typeof candidate.defaults.replicas === 'number'
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && typeof profile.arrivalRps === 'number'
        && typeof profile.burstMultiplier === 'number'
        && typeof profile.latencySloMs === 'number'
        && typeof profile.baseServiceMs === 'number'
        && typeof profile.baseCapacityRpsPerReplica === 'number'
        && typeof profile.fallbackCapacityRps === 'number'
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        ['queue-all', 'deadline-shed', 'fallback-route'].includes(policy.id)
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
      )),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRps(value: number) {
  return `${Math.round(value).toLocaleString()} rps`;
}

export default function ModelServingPatternsAdmissionBatchingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AdmissionBatchingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No admission and batching data file was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAdmissionBatchingData(payload)) {
          throw new Error('Admission and batching data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabFailure detail={error} />;
  if (!data) return <LabLoading />;
  return <AdmissionBatchingLab data={data} />;
}

function AdmissionBatchingLab({ data }: { data: AdmissionBatchingData }) {
  const initialProfile = data.profiles.find((profile) => profile.id === data.defaultProfileId)
    ?? data.profiles[0];
  const initialPolicy = data.policies.find((policy) => policy.id === data.defaultPolicyId)
    ?? data.policies[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [policyId, setPolicyId] = useState<AdmissionPolicy['id']>(initialPolicy.id);
  const [batchWindowMs, setBatchWindowMs] = useState(data.defaults.batchWindowMs);
  const [maxBatchSize, setMaxBatchSize] = useState(data.defaults.maxBatchSize);
  const [replicas, setReplicas] = useState(data.defaults.replicas);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const model = useMemo(() => {
    const demandRps = profile.arrivalRps * profile.burstMultiplier;
    const effectiveBatch = Math.min(
      maxBatchSize,
      Math.max(1, 1 + demandRps * batchWindowMs / 1000),
    );
    const batchGain = 1 + 0.32 * Math.log2(effectiveBatch);
    const capacityRps = replicas * profile.baseCapacityRpsPerReplica * batchGain;
    const executionMs = profile.baseServiceMs * (1 + 0.025 * (effectiveBatch - 1));
    const rawUtilization = demandRps / Math.max(capacityRps, 0.001);
    const rawQueueMs = batchWindowMs / 2
      + Math.max(0, rawUtilization - 0.72) * profile.latencySloMs * 2.2
      + Math.max(0, rawUtilization - 1) * profile.latencySloMs * 3.5;

    let primaryRps = demandRps;
    let fallbackRps = 0;
    let rejectedRps = 0;
    let queueMs = rawQueueMs;

    if (policy.id === 'deadline-shed') {
      primaryRps = Math.min(demandRps, capacityRps * 0.90);
      rejectedRps = Math.max(0, demandRps - primaryRps);
      const admittedUtilization = primaryRps / Math.max(capacityRps, 0.001);
      queueMs = batchWindowMs / 2
        + Math.max(0, admittedUtilization - 0.72) * profile.latencySloMs * 1.2;
    }

    if (policy.id === 'fallback-route') {
      primaryRps = Math.min(demandRps, capacityRps * 0.88);
      const overflowRps = Math.max(0, demandRps - primaryRps);
      fallbackRps = Math.min(overflowRps, profile.fallbackCapacityRps);
      rejectedRps = Math.max(0, overflowRps - fallbackRps);
      const admittedUtilization = primaryRps / Math.max(capacityRps, 0.001);
      queueMs = batchWindowMs / 2
        + Math.max(0, admittedUtilization - 0.72) * profile.latencySloMs;
    }

    const completedPrimaryRps = Math.min(primaryRps, capacityRps);
    const predictedP99Ms = executionMs + queueMs + (fallbackRps > 0 ? 55 : 0);
    const completedRps = completedPrimaryRps + fallbackRps;
    const goodputFactor = predictedP99Ms <= profile.latencySloMs
      ? 1
      : clamp(profile.latencySloMs / predictedP99Ms, 0.08, 1);
    const goodputRps = completedRps * goodputFactor;
    const acceptedRps = primaryRps + fallbackRps;
    const utilizationPct = 100 * primaryRps / Math.max(capacityRps, 0.001);
    const deadlineHealthy = predictedP99Ms <= profile.latencySloMs;
    const capacityHealthy = rejectedRps === 0 && primaryRps <= capacityRps;
    const state = deadlineHealthy && capacityHealthy
      ? 'healthy'
      : deadlineHealthy && goodputRps >= demandRps * 0.82
        ? 'protected'
        : 'overloaded';

    return {
      acceptedRps,
      batchGain,
      capacityRps,
      completedRps,
      demandRps,
      effectiveBatch,
      fallbackRps,
      goodputRps,
      predictedP99Ms,
      queueMs,
      rejectedRps,
      state,
      utilizationPct,
    };
  }, [batchWindowMs, maxBatchSize, policy.id, profile, replicas]);

  function reset() {
    setProfileId(initialProfile.id);
    setPolicyId(initialPolicy.id);
    setBatchWindowMs(data.defaults.batchWindowMs);
    setMaxBatchSize(data.defaults.maxBatchSize);
    setReplicas(data.defaults.replicas);
  }

  const status = model.state === 'healthy'
    ? {
      title: 'The burst fits the contract',
      detail: 'The modeled fleet finishes the accepted burst inside the latency target without a forced rejection.',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
      icon: CheckCircle2,
    }
    : model.state === 'protected'
      ? {
        title: 'The policy protects useful work',
        detail: 'Some traffic takes the fallback or is rejected early so admitted requests can still finish near the target.',
        classes: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
        icon: ShieldCheck,
      }
      : {
        title: 'The queue has become overload storage',
        detail: 'Tail latency exceeds the contract or too much accepted work cannot complete. Add warm capacity, spend less time batching, or shed earlier.',
        classes: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
        icon: TriangleAlert,
      };
  const StatusIcon = status.icon;
  const maxFlow = Math.max(model.demandRps, model.capacityRps, 1);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity decision lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'interactive-ranking' ? Clock3 : item.id === 'mixed-generation' ? Activity : Boxes}
                      accent={item.id === 'interactive-ranking' ? 'blue' : item.id === 'mixed-generation' ? 'violet' : 'emerald'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Overload policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'queue-all' ? Layers3 : item.id === 'deadline-shed' ? ShieldCheck : Activity}
                      accent={item.id === 'queue-all' ? 'rose' : item.id === 'deadline-shed' ? 'emerald' : 'amber'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <LabRange
                  label="Batch window"
                  value={batchWindowMs}
                  output={`${batchWindowMs} ms`}
                  min={0}
                  max={40}
                  step={2}
                  lowLabel="Dispatch now"
                  highLabel="Wait for density"
                  accent="cyan"
                  onChange={setBatchWindowMs}
                />
                <LabRange
                  label="Maximum batch"
                  value={maxBatchSize}
                  output={`${maxBatchSize} requests`}
                  min={1}
                  max={16}
                  step={1}
                  lowLabel="One at a time"
                  highLabel="Large batch"
                  accent="violet"
                  onChange={setMaxBatchSize}
                />
                <LabRange
                  label="Warm replicas"
                  value={replicas}
                  output={`${replicas}`}
                  min={1}
                  max={10}
                  step={1}
                  lowLabel="Thin pool"
                  highLabel="More headroom"
                  accent="emerald"
                  onChange={setReplicas}
                />
              </div>
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Burst demand"
                value={formatRps(model.demandRps)}
                detail={`${profile.arrivalRps} baseline x ${profile.burstMultiplier.toFixed(2)} burst`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Modeled capacity"
                value={formatRps(model.capacityRps)}
                detail={`${model.batchGain.toFixed(2)}x modeled batch gain across ${replicas} replicas`}
                icon={Gauge}
                tone={model.utilizationPct <= 100 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Predicted p99"
                value={`${Math.round(model.predictedP99Ms)} ms`}
                detail={`${profile.latencySloMs} ms target; ${Math.round(model.queueMs)} ms modeled queue`}
                icon={Clock3}
                tone={model.predictedP99Ms <= profile.latencySloMs ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Useful goodput"
                value={formatRps(model.goodputRps)}
                detail={`${formatRps(model.completedRps)} completed before applying the SLO`}
                icon={ShieldCheck}
                tone="violet"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Batch forming now
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {model.effectiveBatch.toFixed(1)} of {maxBatchSize} compatible slots expected
                  </h4>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {batchWindowMs === 0 ? 'No intentional wait' : `${batchWindowMs} ms maximum wait`}
                </span>
              </div>
              <div
                className="mt-4 grid grid-cols-8 gap-2 sm:grid-cols-[repeat(16,minmax(0,1fr))]"
                aria-label="Batch slot occupancy"
              >
                {Array.from({ length: maxBatchSize }, (_, index) => {
                  const filled = index < Math.ceil(model.effectiveBatch);
                  return (
                    <span
                      key={index}
                      title={filled ? `Slot ${index + 1} expected to fill` : `Slot ${index + 1} remains empty`}
                      className={`aspect-square rounded-sm border ${
                        filled
                          ? 'border-cyan-500 bg-cyan-500 dark:border-cyan-400 dark:bg-cyan-400'
                          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                      }`}
                    />
                  );
                })}
              </div>
            </section>

            <section aria-label="Admission flow" className="space-y-4">
              <FlowBar
                label="Burst arrives"
                value={model.demandRps}
                maximum={maxFlow}
                valueLabel={formatRps(model.demandRps)}
                tone="blue"
              />
              <FlowBar
                label="Primary pool accepts"
                value={Math.max(0, model.acceptedRps - model.fallbackRps)}
                maximum={maxFlow}
                valueLabel={formatRps(Math.max(0, model.acceptedRps - model.fallbackRps))}
                tone="violet"
              />
              <FlowBar
                label="Fallback carries"
                value={model.fallbackRps}
                maximum={maxFlow}
                valueLabel={formatRps(model.fallbackRps)}
                tone="amber"
              />
              <FlowBar
                label="Rejected early"
                value={model.rejectedRps}
                maximum={maxFlow}
                valueLabel={formatRps(model.rejectedRps)}
                tone="rose"
              />
            </section>

            <section className={`rounded-md border p-4 ${status.classes}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{status.title}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{status.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowBar({
  label,
  value,
  maximum,
  valueLabel,
  tone,
}: {
  label: string;
  value: number;
  maximum: number;
  valueLabel: string;
  tone: 'blue' | 'violet' | 'amber' | 'rose';
}) {
  const widths = clamp(100 * value / maximum, value > 0 ? 2 : 0, 100);
  const tones = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
    rose: 'bg-rose-500 dark:bg-rose-400',
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
          {valueLabel}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${tones[tone]}`} style={{ width: `${widths}%` }} />
      </div>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading admission model...
      </div>
    </div>
  );
}

function LabFailure({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Admission lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
