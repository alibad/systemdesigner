'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleAlert,
  Clock3,
  Gauge,
  GitBranch,
  HardDrive,
  ImageIcon,
  Layers3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Workload {
  id: string;
  label: string;
  detail: string;
  arrivalPerMinute: number;
  latencyBudgetMs: number;
  qualityFloor: number;
  memoryMultiplier: number;
}

interface RuntimeProfile {
  id: string;
  label: string;
  detail: string;
  jobsPerWorkerMinute: number;
  memoryPerJobGb: number;
  qualityScore: number;
  coldStartMs: number;
}

interface BatchPolicy {
  id: string;
  label: string;
  detail: string;
  batchSize: number;
  maxWaitMs: number;
  throughputMultiplier: number;
}

interface SafetyPolicy {
  id: string;
  label: string;
  detail: string;
  latencyMs: number;
  coverageScore: number;
  publishesWhenUnavailable: boolean;
}

interface RetryPolicy {
  id: string;
  label: string;
  detail: string;
  loadMultiplier: number;
  duplicatePublishRisk: boolean;
}

interface ServingControlData {
  title: string;
  description: string;
  notice: string;
  defaults: {
    workloadId: string;
    runtimeId: string;
    batchId: string;
    safetyId: string;
    retryId: string;
    rolloutPercent: number;
  };
  fleet: {
    workers: number;
    gpuMemoryGb: number;
    observationMinutes: number;
  };
  workloads: Workload[];
  runtimes: RuntimeProfile[];
  batchPolicies: BatchPolicy[];
  safetyPolicies: SafetyPolicy[];
  retryPolicies: RetryPolicy[];
}

interface StageStatus {
  id: string;
  label: string;
  owner: string;
  detail: string;
  state: 'healthy' | 'warning' | 'broken';
  status: string;
  icon: LucideIcon;
}

const BLOCK_ID = 'genai/diffusion-models-production-serving-control-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isServingControlData(value: unknown): value is ServingControlData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingControlData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.notice
      && candidate.defaults
      && candidate.fleet
      && isFiniteNumber(candidate.fleet.workers)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => item.id && item.label && isFiniteNumber(item.arrivalPerMinute) && isFiniteNumber(item.memoryMultiplier))
      && Array.isArray(candidate.runtimes)
      && candidate.runtimes.length > 0
      && candidate.runtimes.every((item) => item.id && item.label && isFiniteNumber(item.jobsPerWorkerMinute))
      && Array.isArray(candidate.batchPolicies)
      && candidate.batchPolicies.length > 0
      && Array.isArray(candidate.safetyPolicies)
      && candidate.safetyPolicies.length > 0
      && Array.isArray(candidate.retryPolicies)
      && candidate.retryPolicies.length > 0,
  );
}

function formatLatency(milliseconds: number) {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10000 ? 1 : 2)}s`;
}

const stageStyles: Record<StageStatus['state'], string> = {
  healthy:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  broken:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
};

export default function DiffusionModelsProductionServingControlLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ServingControlData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No serving control model was supplied.');
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
        if (!isServingControlData(payload)) {
          throw new Error('The serving control data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load serving data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ServingControlLab data={data} />;
}

function ServingControlLab({ data }: { data: ServingControlData }) {
  const initialWorkload = data.workloads.find((item) => item.id === data.defaults.workloadId)
    ?? data.workloads[0];
  const initialRuntime = data.runtimes.find((item) => item.id === data.defaults.runtimeId)
    ?? data.runtimes[0];
  const initialBatch = data.batchPolicies.find((item) => item.id === data.defaults.batchId)
    ?? data.batchPolicies[0];
  const initialSafety = data.safetyPolicies.find((item) => item.id === data.defaults.safetyId)
    ?? data.safetyPolicies[0];
  const initialRetry = data.retryPolicies.find((item) => item.id === data.defaults.retryId)
    ?? data.retryPolicies[0];

  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [runtimeId, setRuntimeId] = useState(initialRuntime.id);
  const [batchId, setBatchId] = useState(initialBatch.id);
  const [safetyId, setSafetyId] = useState(initialSafety.id);
  const [retryId, setRetryId] = useState(initialRetry.id);
  const [rolloutPercent, setRolloutPercent] = useState(data.defaults.rolloutPercent);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const runtime = data.runtimes.find((item) => item.id === runtimeId) ?? data.runtimes[0];
  const batch = data.batchPolicies.find((item) => item.id === batchId) ?? data.batchPolicies[0];
  const safety = data.safetyPolicies.find((item) => item.id === safetyId) ?? data.safetyPolicies[0];
  const retry = data.retryPolicies.find((item) => item.id === retryId) ?? data.retryPolicies[0];

  const result = useMemo(() => {
    const capacityPerMinute = runtime.jobsPerWorkerMinute
      * data.fleet.workers
      * batch.throughputMultiplier;
    const effectiveArrival = workload.arrivalPerMinute * retry.loadMultiplier;
    const queueGrowthPerMinute = Math.max(0, effectiveArrival - capacityPerMinute);
    const backlog = queueGrowthPerMinute * data.fleet.observationMinutes;
    const queueDelayMs = capacityPerMinute > 0
      ? Math.min(120000, backlog / capacityPerMinute * 60000)
      : 120000;
    const generationMs = 60000 / runtime.jobsPerWorkerMinute;
    const endToEndMs = batch.maxWaitMs + generationMs + safety.latencyMs + queueDelayMs;
    const batchMemoryGb = runtime.memoryPerJobGb
      * workload.memoryMultiplier
      * Math.pow(batch.batchSize, 0.82);
    const capacityPass = queueGrowthPerMinute === 0;
    const memoryPass = batchMemoryGb <= data.fleet.gpuMemoryGb;
    const qualityPass = runtime.qualityScore >= workload.qualityFloor;
    const latencyPass = endToEndMs <= workload.latencyBudgetMs;
    const safetyPass = safety.coverageScore >= 80 && !safety.publishesWhenUnavailable;
    const retryPass = !retry.duplicatePublishRisk;
    const canaryJobs = Math.round(
      workload.arrivalPerMinute
        * data.fleet.observationMinutes
        * rolloutPercent / 100,
    );
    const stable = capacityPass && memoryPass && qualityPass && latencyPass && safetyPass && retryPass;

    let verdict = 'The modeled serving path is bounded';
    let detail = 'Capacity, memory, quality, latency, publication policy, and retry identity all remain inside the selected envelope.';
    let tone: 'emerald' | 'amber' | 'rose' | 'violet' = 'emerald';

    if (!memoryPass) {
      verdict = 'The selected batch does not fit GPU memory';
      detail = `Modeled peak memory reaches ${batchMemoryGb.toFixed(1)}GB on a ${data.fleet.gpuMemoryGb}GB worker. Reduce compatible batch size or route the shape to a larger pool.`;
      tone = 'rose';
    } else if (!capacityPass) {
      verdict = 'The queue grows faster than the fleet can drain it';
      detail = `${queueGrowthPerMinute.toFixed(0)} jobs accumulate each minute, leaving ${backlog.toFixed(0)} jobs after the ${data.fleet.observationMinutes}-minute window.`;
      tone = 'rose';
    } else if (!safetyPass) {
      verdict = 'Availability bypasses the publication boundary';
      detail = safety.publishesWhenUnavailable
        ? 'A safety timeout can publish an unevaluated output. Route to review or fail closed instead.'
        : 'The selected policy leaves important admission or publication paths outside the modeled control boundary.';
      tone = 'violet';
    } else if (!retryPass) {
      verdict = 'Retries can duplicate expensive work or publication';
      detail = 'Reconcile unknown completion state and commit by job identity before another worker is allowed to publish.';
      tone = 'rose';
    } else if (!qualityPass) {
      verdict = 'The runtime misses this workload quality floor';
      detail = `The modeled runtime scores ${runtime.qualityScore}, below the ${workload.qualityFloor} release floor. Keep the canary bounded or choose another bundle.`;
      tone = 'amber';
    } else if (!latencyPass) {
      verdict = 'The path is stable but misses the user deadline';
      detail = `Modeled end-to-end latency is ${formatLatency(endToEndMs)} against ${formatLatency(workload.latencyBudgetMs)}. Separate this workload or reduce waiting and queue time.`;
      tone = 'amber';
    } else if (rolloutPercent > 25) {
      verdict = 'The configuration fits, but rollout exposure is broad';
      detail = `${canaryJobs} jobs receive the candidate bundle during the modeled window. Start smaller until quality and safety evidence is stable.`;
      tone = 'amber';
    }

    const stages: StageStatus[] = [
      {
        id: 'admission',
        label: 'Admit',
        owner: 'Request control',
        detail: `${workload.arrivalPerMinute} jobs/min · quality floor ${workload.qualityFloor}`,
        state: qualityPass ? 'healthy' : 'warning',
        status: qualityPass ? 'Profile allowed' : 'Quality mismatch',
        icon: Gauge,
      },
      {
        id: 'queue',
        label: 'Queue',
        owner: 'Capacity scheduler',
        detail: capacityPass
          ? `${capacityPerMinute.toFixed(0)} jobs/min modeled capacity`
          : `+${queueGrowthPerMinute.toFixed(0)} jobs/min backlog`,
        state: capacityPass ? 'healthy' : 'broken',
        status: capacityPass ? 'Draining' : 'Growing',
        icon: Layers3,
      },
      {
        id: 'generate',
        label: 'Generate',
        owner: `${batch.batchSize} job batch`,
        detail: `${batchMemoryGb.toFixed(1)}GB modeled peak · ${runtime.label}`,
        state: memoryPass ? 'healthy' : 'broken',
        status: memoryPass ? 'Fits worker' : 'Memory overflow',
        icon: Sparkles,
      },
      {
        id: 'safety',
        label: 'Evaluate',
        owner: 'Publication policy',
        detail: `${safety.coverageScore} modeled coverage · ${formatLatency(safety.latencyMs)}`,
        state: safetyPass ? 'healthy' : 'broken',
        status: safetyPass ? 'Fail closed' : 'Boundary open',
        icon: ShieldCheck,
      },
      {
        id: 'commit',
        label: 'Commit',
        owner: 'Durable job state',
        detail: `${retry.loadMultiplier.toFixed(2)}x retry-adjusted load`,
        state: retryPass ? 'healthy' : 'broken',
        status: retryPass ? 'Publish once' : 'Duplicate risk',
        icon: PackageCheck,
      },
    ];

    return {
      backlog,
      batchMemoryGb,
      canaryJobs,
      capacityPass,
      capacityPerMinute,
      effectiveArrival,
      endToEndMs,
      latencyPass,
      memoryPass,
      qualityPass,
      retryPass,
      safetyPass,
      stable,
      stages,
      tone,
      verdict,
      detail,
    };
  }, [batch, data.fleet, retry, rolloutPercent, runtime, safety, workload]);

  const reset = () => {
    setWorkloadId(initialWorkload.id);
    setRuntimeId(initialRuntime.id);
    setBatchId(initialBatch.id);
    setSafetyId(initialSafety.id);
    setRetryId(initialRetry.id);
    setRolloutPercent(data.defaults.rolloutPercent);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Diffusion serving control room"
          title={data.title}
          description={data.description}
          icon={Workflow}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Workload"
                items={data.workloads}
                selectedId={workload.id}
                icon={ImageIcon}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                legend="2. Model and precision"
                items={data.runtimes}
                selectedId={runtime.id}
                icon={HardDrive}
                accent="violet"
                onSelect={setRuntimeId}
              />
              <ChoiceGroup
                legend="3. Batch policy"
                items={data.batchPolicies}
                selectedId={batch.id}
                icon={Boxes}
                accent="cyan"
                onSelect={setBatchId}
              />
              <ChoiceGroup
                legend="4. Safety boundary"
                items={data.safetyPolicies}
                selectedId={safety.id}
                icon={ShieldCheck}
                accent="emerald"
                onSelect={setSafetyId}
              />
              <ChoiceGroup
                legend="5. Retry policy"
                items={data.retryPolicies}
                selectedId={retry.id}
                icon={RefreshCw}
                accent="amber"
                onSelect={setRetryId}
              />
              <LabRange
                label="Candidate rollout"
                value={rolloutPercent}
                output={`${rolloutPercent}%`}
                min={1}
                max={100}
                step={1}
                accent="rose"
                lowLabel="1% canary"
                highLabel="100% fleet"
                onChange={setRolloutPercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Effective arrival"
                value={`${result.effectiveArrival.toFixed(0)}/min`}
                detail={`${result.capacityPerMinute.toFixed(0)}/min modeled fleet capacity`}
                icon={Gauge}
                tone={result.capacityPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="End-to-end"
                value={formatLatency(result.endToEndMs)}
                detail={`${formatLatency(workload.latencyBudgetMs)} workload budget`}
                icon={Clock3}
                tone={result.latencyPass ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Batch memory"
                value={`${result.batchMemoryGb.toFixed(1)}GB`}
                detail={`${data.fleet.gpuMemoryGb}GB worker envelope`}
                icon={HardDrive}
                tone={result.memoryPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Canary exposure"
                value={`${result.canaryJobs} jobs`}
                detail={`${data.fleet.observationMinutes}-minute modeled window`}
                icon={GitBranch}
                tone={rolloutPercent <= 25 ? 'blue' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    One job through the serving boundary
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {workload.label} · {runtime.label}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {batch.label}, {safety.label.toLowerCase()}, and {retry.label.toLowerCase()}.
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${result.stable
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'}`}
                >
                  {result.stable ? 'Bounded path' : 'Boundary broken'}
                </span>
              </div>

              <ol className="relative mt-5 grid gap-3 xl:grid-cols-5">
                <div aria-hidden="true" className="absolute left-[8%] right-[8%] top-6 hidden h-px bg-neutral-300 xl:block dark:bg-neutral-700" />
                {result.stages.map((stage, index) => {
                  const StageIcon = stage.icon;
                  return (
                    <li key={stage.id} className={`relative min-w-0 rounded-md border p-4 ${stageStyles[stage.state]}`}>
                      <div className="flex items-start gap-3">
                        <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-neutral-950">
                          <StageIcon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase opacity-70">{index + 1}. {stage.label}</p>
                          <p className="mt-1 text-sm font-semibold">{stage.status}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-semibold opacity-75">{stage.owner}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">{stage.detail}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className={`rounded-md border p-5 ${result.capacityPass
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'}`}
              >
                <div className="flex items-center gap-2">
                  <Layers3 aria-hidden="true" className="h-5 w-5" />
                  <h4 className="font-semibold">Queue after {data.fleet.observationMinutes} minutes</h4>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">{result.backlog.toFixed(0)} jobs</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80 dark:bg-neutral-950/70">
                  <div
                    className={`h-full transition-[width] motion-reduce:transition-none ${result.capacityPass ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, result.backlog === 0 ? 4 : result.backlog / Math.max(1, workload.arrivalPerMinute) * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 opacity-80">
                  Retry work is charged to arrival demand. A queue that grows under steady traffic has no stable p95 latency.
                </p>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100">
                <div className="flex items-center gap-2">
                  <GitBranch aria-hidden="true" className="h-5 w-5" />
                  <h4 className="font-semibold">Candidate rollout exposure</h4>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">{rolloutPercent}%</p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80 dark:bg-neutral-950/70">
                  <div
                    className="h-full bg-blue-500 transition-[width] motion-reduce:transition-none dark:bg-blue-400"
                    style={{ width: `${rolloutPercent}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 opacity-80">
                  {result.canaryJobs} jobs exercise the selected model bundle during this window. Rollback must restore scheduler, precision, compiler, and policy together.
                </p>
              </div>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
              : result.tone === 'violet'
                ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.stable
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Serving consequence</p>
                  <p className="mt-2 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  legend,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  legend: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{legend}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading the serving control room...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Serving control room unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
