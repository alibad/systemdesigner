'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Gauge,
  Layers3,
  Route,
  Server,
  ShieldCheck,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

interface WorkloadProfile {
  id: string;
  label: string;
  detail: string;
  meanServiceSeconds: number;
  averageInputTokens: number;
  averageOutputTokens: number;
}

interface CapacityModel {
  title: string;
  description: string;
  planningTargetUtilization: number;
  defaults: {
    profileId: string;
    requestRateRps: number;
    replicas: number;
    concurrencyPerReplica: number;
    tokenBudgetPerMinute: number;
  };
  profiles: WorkloadProfile[];
}

const BLOCK_ID = 'genai/production-deployment-capacity-envelope-lab';

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && typeof candidate.planningTargetUtilization === 'number'
      && candidate.planningTargetUtilization > 0
      && candidate.planningTargetUtilization < 1
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fixed = (value: number, digits = 1) => value.toFixed(digits);

export default function ProductionDeploymentCapacityEnvelopeLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No serving-capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) throw new Error('The serving-capacity model is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState status="error" detail={loadError} />;
  if (!data) return <LabState status="loading" detail="Loading the serving-capacity model..." />;

  return <CapacityEnvelopeLab data={data} />;
}

function CapacityEnvelopeLab({ data }: { data: CapacityModel }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [requestRateRps, setRequestRateRps] = useState(data.defaults.requestRateRps);
  const [replicas, setReplicas] = useState(data.defaults.replicas);
  const [concurrencyPerReplica, setConcurrencyPerReplica] = useState(
    data.defaults.concurrencyPerReplica,
  );
  const [tokenBudgetPerMinute, setTokenBudgetPerMinute] = useState(
    data.defaults.tokenBudgetPerMinute,
  );

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];

  const result = useMemo(() => {
    const tokensPerRequest = profile.averageInputTokens + profile.averageOutputTokens;
    const availableSlots = replicas * concurrencyPerReplica;
    const offeredConcurrency = requestRateRps * profile.meanServiceSeconds;
    const tokenDemandPerMinute = requestRateRps * tokensPerRequest * 60;
    const slotUtilization = offeredConcurrency / availableSlots;
    const tokenUtilization = tokenDemandPerMinute / tokenBudgetPerMinute;
    const slotSafeRate = (
      availableSlots * data.planningTargetUtilization
    ) / profile.meanServiceSeconds;
    const tokenSafeRate = (
      tokenBudgetPerMinute * data.planningTargetUtilization
    ) / (tokensPerRequest * 60);
    const safeAdmissionRate = Math.min(slotSafeRate, tokenSafeRate);
    const admittedRate = Math.min(requestRateRps, safeAdmissionRate);
    const overflowRate = Math.max(0, requestRateRps - safeAdmissionRate);
    const slotPressure = slotUtilization > data.planningTargetUtilization;
    const tokenPressure = tokenUtilization > data.planningTargetUtilization;
    const constrainedBy = slotSafeRate < tokenSafeRate ? 'replica slots' : 'token budget';

    let verdict = 'Envelope has operating headroom';
    let explanation = `Admit the offered ${fixed(requestRateRps)} requests/s and retain capacity for bursts.`;
    let tone: Tone = 'emerald';

    if (slotPressure && tokenPressure) {
      verdict = 'Both capacity boundaries are under pressure';
      explanation = 'Scale ready serving slots and reduce token demand or raise the upstream budget before widening traffic.';
      tone = 'rose';
    } else if (slotPressure) {
      verdict = 'Serving slots are the first bottleneck';
      explanation = 'More upstream quota will not create local concurrency. Add ready replicas, shorten measured service time, or shed load.';
      tone = 'amber';
    } else if (tokenPressure) {
      verdict = 'The token budget is the first bottleneck';
      explanation = 'More replicas will not raise the upstream allowance. Bound context and output, obtain budget, or shed load.';
      tone = 'violet';
    }

    return {
      admittedRate,
      availableSlots,
      constrainedBy,
      explanation,
      offeredConcurrency,
      overflowRate,
      safeAdmissionRate,
      slotSafeRate,
      slotUtilization,
      tokenDemandPerMinute,
      tokenSafeRate,
      tokenUtilization,
      tokensPerRequest,
      tone,
      verdict,
    };
  }, [
    concurrencyPerReplica,
    data.planningTargetUtilization,
    profile,
    replicas,
    requestRateRps,
    tokenBudgetPerMinute,
  ]);

  const reset = () => {
    setProfileId(data.defaults.profileId);
    setRequestRateRps(data.defaults.requestRateRps);
    setReplicas(data.defaults.replicas);
    setConcurrencyPerReplica(data.defaults.concurrencyPerReplica);
    setTokenBudgetPerMinute(data.defaults.tokenBudgetPerMinute);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Serving capacity lab"
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
                  1. Measured workload profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={profile.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Route}
                      accent="cyan"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Arrival rate"
                value={requestRateRps}
                output={`${requestRateRps} req/s`}
                min={4}
                max={160}
                step={4}
                accent="blue"
                lowLabel="Quiet"
                highLabel="Peak"
                onChange={setRequestRateRps}
              />

              <LabRange
                label="Ready replicas"
                value={replicas}
                output={`${replicas}`}
                min={2}
                max={24}
                step={1}
                accent="emerald"
                lowLabel="2"
                highLabel="24"
                onChange={setReplicas}
              />

              <LabRange
                label="Concurrency per replica"
                value={concurrencyPerReplica}
                output={`${concurrencyPerReplica} slots`}
                min={1}
                max={16}
                step={1}
                accent="amber"
                lowLabel="Measured limit"
                highLabel="16"
                onChange={setConcurrencyPerReplica}
              />

              <LabRange
                label="Upstream token budget"
                value={tokenBudgetPerMinute}
                output={`${compact.format(tokenBudgetPerMinute)} tok/min`}
                min={300000}
                max={12000000}
                step={300000}
                accent="violet"
                lowLabel="300K"
                highLabel="12M"
                onChange={setTokenBudgetPerMinute}
              />
            </div>
          )}
        >
          <div className="min-h-[650px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Offered concurrency"
                value={fixed(result.offeredConcurrency)}
                detail={`${requestRateRps} req/s x ${fixed(profile.meanServiceSeconds)} s mean service time`}
                icon={Activity}
                tone={result.slotUtilization <= data.planningTargetUtilization ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Ready slots"
                value={`${result.availableSlots}`}
                detail={`${replicas} replicas x ${concurrencyPerReplica} measured slots`}
                icon={Boxes}
                tone="emerald"
              />
              <LabMetric
                label="Token demand"
                value={`${compact.format(result.tokenDemandPerMinute)}/min`}
                detail={`${compact.format(result.tokensPerRequest)} tokens per request`}
                icon={Layers3}
                tone={result.tokenUtilization <= data.planningTargetUtilization ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Safe admission"
                value={`${fixed(result.safeAdmissionRate)} req/s`}
                detail={`First constrained by ${result.constrainedBy}`}
                icon={ShieldCheck}
                tone={result.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                Trace the capacity envelope
              </h4>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <PathNode
                  icon={Activity}
                  eyebrow="Demand"
                  title={`${requestRateRps} req/s arrive`}
                  detail={`${fixed(result.offeredConcurrency)} concurrent requests in steady state`}
                />
                <PathArrow />
                <PathNode
                  icon={Server}
                  eyebrow="Application"
                  title={`${result.availableSlots} ready slots`}
                  detail={`${fixed(result.slotSafeRate)} req/s at the ${(data.planningTargetUtilization * 100).toFixed(0)}% target`}
                />
                <PathArrow />
                <PathNode
                  icon={Layers3}
                  eyebrow="Upstream"
                  title={`${compact.format(tokenBudgetPerMinute)} tok/min`}
                  detail={`${fixed(result.tokenSafeRate)} req/s at the same target`}
                />
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <PressureBar
                label="Replica-slot utilization"
                value={result.slotUtilization}
                target={data.planningTargetUtilization}
                detail={`${fixed(result.offeredConcurrency)} offered / ${result.availableSlots} slots`}
              />
              <PressureBar
                label="Token-budget utilization"
                value={result.tokenUtilization}
                target={data.planningTargetUtilization}
                detail={`${compact.format(result.tokenDemandPerMinute)} demanded / ${compact.format(tokenBudgetPerMinute)} available`}
              />
            </div>

            <section
              className={`rounded-md border p-5 ${
                result.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : result.tone === 'rose'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
                    : result.tone === 'violet'
                      ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50'
                      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6">{result.explanation}</p>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    Admit {fixed(result.admittedRate)} req/s
                    {result.overflowRate > 0
                      ? `; ${fixed(result.overflowRate)} req/s must queue within a bound or be rejected.`
                      : '; no steady-state overflow is predicted by this envelope.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <Timer aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              This is a steady-state planning model using measured mean service time. It does not
              predict tail latency, burst behavior, warm-up delay, or provider performance.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-h-32 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
      <Icon aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {eyebrow}
      </p>
      <p className="mt-1 font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex h-5 items-center justify-center text-neutral-400 md:w-5" aria-hidden="true">
      <span className="rotate-90 text-lg md:rotate-0">→</span>
    </div>
  );
}

function PressureBar({
  label,
  value,
  target,
  detail,
}: {
  label: string;
  value: number;
  target: number;
  detail: string;
}) {
  const width = Math.min(100, value * 100);
  const pressured = value > target;

  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            pressured ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="relative mt-4 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full ${pressured ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${width}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
          style={{ left: `${target * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Planning target: {(target * 100).toFixed(0)}%
      </p>
    </div>
  );
}

function LabState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-44 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      role={status === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        {status === 'error' ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
        ) : (
          <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 text-cyan-600 dark:text-cyan-300" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {status === 'error' ? 'Capacity model unavailable' : 'Preparing the capacity lab'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
        </div>
      </div>
    </div>
  );
}
