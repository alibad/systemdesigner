'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Calculator,
  Check,
  CircleAlert,
  Clock3,
  Cpu,
  DollarSign,
  Film,
  Gauge,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Server,
  ShieldCheck,
  Signature,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Profile = {
  id: string;
  label: string;
  detail: string;
  width: number;
  height: number;
  baselineSeconds: number;
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  promptAlignment: number;
  temporalScore: number;
  identityScore: number;
  safetyRisk: number;
  rightsComplete: boolean;
  provenanceValid: boolean;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  destination: string;
  promptFloor: number;
  temporalFloor: number;
  identityFloor: number;
  safetyCeiling: number;
  requireRights: boolean;
  requireProvenance: boolean;
  targetUtilization: number;
};

type ProductionGateData = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    candidateId: string;
    policyId: string;
    durationSeconds: number;
    generatedFps: number;
    samplingSteps: number;
    jobsPerHour: number;
    availableGpus: number;
    gpuHourlyPrice: number;
  };
  profiles: Profile[];
  candidates: Candidate[];
  policies: Policy[];
};

type Gate = {
  id: string;
  label: string;
  detail: string;
  pass: boolean;
  icon: typeof ShieldCheck;
};

const BLOCK_ID = 'genai/video-generation-production-gate-lab';

function isProductionGateData(value: unknown): value is ProductionGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProductionGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && candidate.profiles.every((item) => (
        typeof item.id === 'string'
        && typeof item.width === 'number'
        && typeof item.height === 'number'
        && typeof item.baselineSeconds === 'number'
      ))
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0,
  );
}

export default function VideoGenerationProductionGateLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ProductionGateData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No production-gate data was supplied.');
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
        if (!isProductionGateData(payload)) {
          throw new Error('Production-gate data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load production-gate data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <ProductionGateLab data={data} /> : <LoadState />}
    </div>
  );
}

function ProductionGateLab({ data }: { data: ProductionGateData }) {
  const initialProfile = data.profiles.find((item) => item.id === data.defaults.profileId)
    ?? data.profiles[0];
  const initialCandidate = data.candidates.find((item) => item.id === data.defaults.candidateId)
    ?? data.candidates[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [candidateId, setCandidateId] = useState(initialCandidate.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [durationSeconds, setDurationSeconds] = useState(data.defaults.durationSeconds);
  const [generatedFps, setGeneratedFps] = useState(data.defaults.generatedFps);
  const [samplingSteps, setSamplingSteps] = useState(data.defaults.samplingSteps);
  const [jobsPerHour, setJobsPerHour] = useState(data.defaults.jobsPerHour);
  const [availableGpus, setAvailableGpus] = useState(data.defaults.availableGpus);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const candidate = data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const frameCount = durationSeconds * generatedFps;
    const pixelRatio = (profile.width * profile.height) / (1280 * 720);
    const frameRatio = frameCount / (6 * 12);
    const stepRatio = samplingSteps / 30;
    const serviceSeconds = profile.baselineSeconds * pixelRatio * frameRatio * stepRatio;
    const requiredGpus = Math.ceil(
      jobsPerHour * serviceSeconds / (3600 * policy.targetUtilization),
    );
    const rawCapacity = availableGpus * 3600 * policy.targetUtilization / serviceSeconds;
    const utilization = rawCapacity > 0 ? jobsPerHour / rawCapacity : 1;
    const capacityPass = availableGpus >= requiredGpus;
    const queueMultiplier = utilization <= 0.65
      ? 0.12
      : utilization <= 0.9
        ? 0.35 + (utilization - 0.65) * 3
        : 1.1 + Math.min(4, (utilization - 0.9) * 16);
    const p95Latency = serviceSeconds * (1.2 + queueMultiplier) + 18;
    const computeCost = serviceSeconds / 3600 * data.defaults.gpuHourlyPrice;
    const evaluationCost = frameCount * 0.00008 + 0.018;
    const costPerJob = computeCost + evaluationCost;

    const gates: Gate[] = [
      {
        id: 'prompt',
        label: 'Prompt alignment',
        detail: `${candidate.promptAlignment} score / ${policy.promptFloor} floor`,
        pass: candidate.promptAlignment >= policy.promptFloor,
        icon: ImageIcon,
      },
      {
        id: 'temporal',
        label: 'Temporal quality',
        detail: `${candidate.temporalScore} score / ${policy.temporalFloor} floor`,
        pass: candidate.temporalScore >= policy.temporalFloor,
        icon: Film,
      },
      {
        id: 'identity',
        label: 'Identity consistency',
        detail: `${candidate.identityScore} score / ${policy.identityFloor} floor`,
        pass: candidate.identityScore >= policy.identityFloor,
        icon: BadgeCheck,
      },
      {
        id: 'safety',
        label: 'Safety risk',
        detail: `${candidate.safetyRisk} risk / ${policy.safetyCeiling} ceiling`,
        pass: candidate.safetyRisk <= policy.safetyCeiling,
        icon: ShieldCheck,
      },
      {
        id: 'rights',
        label: 'Rights lineage',
        detail: policy.requireRights ? 'Required for this destination' : 'Not required by this policy',
        pass: !policy.requireRights || candidate.rightsComplete,
        icon: LockKeyhole,
      },
      {
        id: 'provenance',
        label: 'Provenance validation',
        detail: policy.requireProvenance ? 'Required through delivery' : 'Optional for this destination',
        pass: !policy.requireProvenance || candidate.provenanceValid,
        icon: Signature,
      },
      {
        id: 'capacity',
        label: 'Peak serving capacity',
        detail: `${availableGpus} available / ${requiredGpus} required GPUs`,
        pass: capacityPass,
        icon: Server,
      },
    ];
    const failed = gates.filter((gate) => !gate.pass);
    const releasable = failed.length === 0;

    return {
      capacityPass,
      computeCost,
      costPerJob,
      failed,
      frameCount,
      gates,
      p95Latency,
      rawCapacity,
      releasable,
      requiredGpus,
      serviceSeconds,
      utilization,
    };
  }, [
    availableGpus,
    candidate,
    data.defaults.gpuHourlyPrice,
    durationSeconds,
    generatedFps,
    jobsPerHour,
    policy,
    profile,
    samplingSteps,
  ]);

  const reset = () => {
    setProfileId(initialProfile.id);
    setCandidateId(initialCandidate.id);
    setPolicyId(initialPolicy.id);
    setDurationSeconds(data.defaults.durationSeconds);
    setGeneratedFps(data.defaults.generatedFps);
    setSamplingSteps(data.defaults.samplingSteps);
    setJobsPerHour(data.defaults.jobsPerHour);
    setAvailableGpus(data.defaults.availableGpus);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Production gate lab"
        title={data.title}
        description={data.description}
        icon={Calculator}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                1. Generation profile
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ImageIcon}
                    accent="blue"
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Duration"
              value={durationSeconds}
              output={`${durationSeconds}s`}
              min={4}
              max={20}
              step={1}
              accent="violet"
              lowLabel="Short clip"
              highLabel="Long clip"
              onChange={setDurationSeconds}
            />
            <LabRange
              label="Generated frame rate"
              value={generatedFps}
              output={`${generatedFps} fps`}
              min={8}
              max={24}
              step={4}
              accent="violet"
              lowLabel="Fewer frames"
              highLabel="More frames"
              onChange={setGeneratedFps}
            />
            <LabRange
              label="Sampling steps"
              value={samplingSteps}
              output={`${samplingSteps}`}
              min={20}
              max={50}
              step={5}
              accent="cyan"
              lowLabel="Less work"
              highLabel="More work"
              onChange={setSamplingSteps}
            />
            <LabRange
              label="Arrivals per hour"
              value={jobsPerHour}
              output={`${jobsPerHour}`}
              min={60}
              max={1200}
              step={30}
              accent="amber"
              lowLabel="Quiet"
              highLabel="Peak"
              onChange={setJobsPerHour}
            />
            <LabRange
              label="Available GPUs"
              value={availableGpus}
              output={`${availableGpus}`}
              min={2}
              max={48}
              step={1}
              accent="emerald"
              lowLabel="Small pool"
              highLabel="Reserved pool"
              onChange={setAvailableGpus}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                2. Candidate evidence
              </legend>
              <div className="mt-3 grid gap-2">
                {data.candidates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === candidate.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'unverified-likeness' ? TriangleAlert : Film}
                    accent={item.id === 'unverified-likeness' ? 'rose' : 'cyan'}
                    onClick={() => setCandidateId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                3. Release destination
              </legend>
              <div className="mt-3 grid gap-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ShieldCheck}
                    accent="emerald"
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="serving-envelope-title">
            <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Serving envelope</p>
            <h4 id="serving-envelope-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              {result.frameCount} generated frames at {profile.detail}
            </h4>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              This planning model scales a measured profile. Benchmark data should replace its linear approximation before launch.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="GPU service"
                value={formatDuration(result.serviceSeconds)}
                detail="Generation estimate per job"
                icon={Cpu}
                tone="blue"
              />
              <LabMetric
                label="Required fleet"
                value={`${result.requiredGpus} GPUs`}
                detail={`${Math.floor(result.rawCapacity)} jobs/hour capacity`}
                icon={Server}
                tone={result.capacityPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled p95"
                value={formatDuration(result.p95Latency)}
                detail={`${Math.round(result.utilization * 100)}% target-pool load`}
                icon={Clock3}
                tone={latencyTone(result.utilization)}
              />
              <LabMetric
                label="Estimated cost"
                value={`$${result.costPerJob.toFixed(2)}`}
                detail={`$${result.computeCost.toFixed(2)} generation plus evaluation`}
                icon={DollarSign}
                tone="neutral"
              />
            </div>
          </section>

          <section aria-labelledby="release-evidence-title">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Release evidence</p>
                <h4 id="release-evidence-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {policy.destination}
                </h4>
              </div>
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {result.gates.length - result.failed.length} / {result.gates.length} gates pass
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {result.gates.map((gate) => {
                const Icon = gate.icon;
                return (
                  <div
                    key={gate.id}
                    className={`rounded-md border p-4 ${gate.pass
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-current/30">
                        {gate.pass ? <Check aria-hidden="true" className="h-4 w-4" /> : <Ban aria-hidden="true" className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                          <p className="text-sm font-semibold">{gate.label}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 opacity-80">{gate.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className={`rounded-md border p-5 ${result.releasable
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'}`}
            aria-labelledby="production-decision-title"
          >
            <div className="flex items-start gap-3">
              {result.releasable ? (
                <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              ) : (
                <Ban aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Decision</p>
                <h4 id="production-decision-title" className="mt-1 text-lg font-semibold">
                  {result.releasable ? `Eligible for ${policy.destination.toLowerCase()}` : 'Hold this job or release'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {result.releasable
                    ? 'The measured serving envelope and every destination-specific evidence gate pass. Continue with a bounded canary and rollback monitoring.'
                    : `Failed gates: ${result.failed.map((gate) => gate.label).join(', ')}. An aggregate score cannot override a required gate.`}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                Capacity lesson
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                Keep utilization below saturation. Longer clips consume both more service time and more evaluator work, so queue delay rises before the fleet reaches a nominal 100%.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Release lesson
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                The destination sets the evidence contract. Internal isolation, public creator release, and a reviewed campaign should not share one vague threshold.
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function latencyTone(utilization: number): 'emerald' | 'amber' | 'rose' {
  if (utilization <= 0.7) return 'emerald';
  if (utilization <= 0.9) return 'amber';
  return 'rose';
}

function LoadState() {
  return (
    <div className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950" role="status">
      <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-300" />
      <span className="ml-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">Loading production gate...</span>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Production gate unavailable</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
