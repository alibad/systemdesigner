'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Clock3,
  Gauge,
  ImageIcon,
  Layers3,
  LoaderCircle,
  Route,
  Sparkles,
  WandSparkles,
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
  latencyBudgetMs: number;
  qualityTarget: number;
}

interface Sampler {
  id: string;
  label: string;
  detail: string;
  fixedMs: number;
  stepMs: number;
  qualityFloor: number;
  qualityCeiling: number;
  saturationSteps: number;
  recommendedMin: number;
  recommendedMax: number;
  stochastic: boolean;
}

interface GuidanceModel {
  enabledThreshold: number;
  preferredMin: number;
  preferredMax: number;
  artifactThreshold: number;
  computeMultiplier: number;
}

interface Phase {
  id: string;
  label: string;
  detail: string;
  tone: 'violet' | 'blue' | 'cyan' | 'emerald';
}

interface DenoisingBudgetData {
  title: string;
  description: string;
  notice: string;
  defaults: {
    workloadId: string;
    samplerId: string;
    steps: number;
    guidance: number;
  };
  workloads: Workload[];
  samplers: Sampler[];
  guidance: GuidanceModel;
  phases: Phase[];
}

const BLOCK_ID = 'genai/diffusion-models-production-denoising-budget-lab';

const phaseStyles: Record<Phase['tone'], string> = {
  violet:
    'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
};

const phaseDotStyles: Record<Phase['tone'], string> = {
  violet: 'bg-violet-500 dark:bg-violet-400',
  blue: 'bg-blue-500 dark:bg-blue-400',
  cyan: 'bg-cyan-500 dark:bg-cyan-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDenoisingBudgetData(value: unknown): value is DenoisingBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DenoisingBudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.notice
      && candidate.defaults
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => item.id && item.label && isFiniteNumber(item.latencyBudgetMs))
      && Array.isArray(candidate.samplers)
      && candidate.samplers.length > 0
      && candidate.samplers.every((item) => item.id && item.label && isFiniteNumber(item.stepMs))
      && candidate.guidance
      && isFiniteNumber(candidate.guidance.computeMultiplier)
      && Array.isArray(candidate.phases)
      && candidate.phases.length === 4,
  );
}

function formatLatency(milliseconds: number) {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10000 ? 1 : 2)}s`;
}

export default function DiffusionModelsProductionDenoisingBudgetLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DenoisingBudgetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No denoising budget model was supplied.');
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
        if (!isDenoisingBudgetData(payload)) {
          throw new Error('The denoising budget data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the budget model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <DenoisingBudgetLab data={data} />;
}

function DenoisingBudgetLab({ data }: { data: DenoisingBudgetData }) {
  const initialWorkload = data.workloads.find((item) => item.id === data.defaults.workloadId)
    ?? data.workloads[0];
  const initialSampler = data.samplers.find((item) => item.id === data.defaults.samplerId)
    ?? data.samplers[0];
  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [samplerId, setSamplerId] = useState(initialSampler.id);
  const [steps, setSteps] = useState(data.defaults.steps);
  const [guidance, setGuidance] = useState(data.defaults.guidance);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const sampler = data.samplers.find((item) => item.id === samplerId) ?? data.samplers[0];

  const result = useMemo(() => {
    const guidanceEnabled = guidance > data.guidance.enabledThreshold;
    const cfgMultiplier = guidanceEnabled ? data.guidance.computeMultiplier : 1;
    const latencyMs = sampler.fixedMs + sampler.stepMs * steps * cfgMultiplier;
    const stepQuality = sampler.qualityFloor
      + (sampler.qualityCeiling - sampler.qualityFloor)
      * (1 - Math.exp(-steps / sampler.saturationSteps));

    let guidanceDelta = 1.5;
    if (guidance < data.guidance.preferredMin) {
      guidanceDelta = -2.2 * (data.guidance.preferredMin - guidance);
    } else if (guidance > data.guidance.preferredMax) {
      guidanceDelta = 1.5 - 1.25 * (guidance - data.guidance.preferredMax);
    }

    const quality = Math.max(0, Math.min(100, stepQuality + guidanceDelta));
    const diversity = Math.max(30, 96 - guidance * 4.8);
    const marginalGain = Math.max(
      0,
      ((sampler.qualityCeiling - sampler.qualityFloor) / sampler.saturationSteps)
        * Math.exp(-steps / sampler.saturationSteps),
    );
    const latencyPass = latencyMs <= workload.latencyBudgetMs;
    const qualityPass = quality >= workload.qualityTarget;
    const rangePass = steps >= sampler.recommendedMin && steps <= sampler.recommendedMax;
    const underConditioned = guidance < data.guidance.preferredMin;
    const artifactRisk = guidance >= data.guidance.artifactThreshold
      ? 'High'
      : guidance > data.guidance.preferredMax
        ? 'Elevated'
        : 'Bounded';

    let verdict = 'Profile fits the modeled request envelope';
    let detail = 'The route clears latency and quality targets without crossing the modeled artifact threshold.';
    let tone: 'emerald' | 'amber' | 'rose' | 'violet' = rangePass ? 'emerald' : 'amber';

    if (!latencyPass) {
      verdict = 'The sampling path misses the latency budget';
      detail = `Modeled generation needs ${formatLatency(latencyMs)}, ${formatLatency(latencyMs - workload.latencyBudgetMs)} beyond the workload budget.`;
      tone = 'rose';
    } else if (!qualityPass) {
      verdict = 'The route returns before the quality floor';
      detail = `Modeled quality reaches ${quality.toFixed(1)}, below the ${workload.qualityTarget} target. Change the measured profile instead of hiding the miss.`;
      tone = 'amber';
    } else if (artifactRisk === 'High') {
      verdict = 'Prompt pressure crosses the artifact boundary';
      detail = 'More guidance does not buy more denoising evaluations; it overweights conditioning and reduces the modeled diversity margin.';
      tone = 'violet';
    } else if (!rangePass) {
      verdict = 'The profile works outside its measured default range';
      detail = `Validate this choice explicitly; the teaching profile was characterized at ${sampler.recommendedMin}-${sampler.recommendedMax} steps.`;
    } else if (underConditioned) {
      verdict = 'Latency fits, but prompt adherence is under pressure';
      detail = 'Weak guidance preserves diversity but may fail prompt-critical requirements on difficult slices.';
      tone = 'amber';
    }

    const phaseCounts = data.phases.map((_, index) => {
      const base = Math.floor(steps / data.phases.length);
      return base + (index < steps % data.phases.length ? 1 : 0);
    });

    return {
      artifactRisk,
      cfgMultiplier,
      detail,
      diversity,
      guidanceEnabled,
      latencyMs,
      latencyPass,
      marginalGain,
      phaseCounts,
      quality,
      qualityPass,
      tone,
      verdict,
    };
  }, [data, guidance, sampler, steps, workload]);

  const reset = () => {
    setWorkloadId(initialWorkload.id);
    setSamplerId(initialSampler.id);
    setSteps(data.defaults.steps);
    setGuidance(data.defaults.guidance);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Denoising budget lab"
          title={data.title}
          description={data.description}
          icon={WandSparkles}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Request profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={workload.id === item.id}
                      label={item.label}
                      detail={`${item.detail} ${formatLatency(item.latencyBudgetMs)} / quality ${item.qualityTarget}.`}
                      icon={item.id === 'preview' ? Sparkles : item.id === 'premium' ? ImageIcon : Layers3}
                      accent={item.id === 'preview' ? 'cyan' : item.id === 'premium' ? 'violet' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Sampler profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.samplers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={sampler.id === item.id}
                      label={item.label}
                      detail={`${item.detail} Measured range: ${item.recommendedMin}-${item.recommendedMax} steps.`}
                      icon={item.stochastic ? Sparkles : Route}
                      accent={item.stochastic ? 'violet' : item.id === 'multistep' ? 'emerald' : 'blue'}
                      onClick={() => setSamplerId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Denoising evaluations"
                value={steps}
                output={`${steps} steps`}
                min={4}
                max={60}
                step={1}
                accent="violet"
                lowLabel="4 · fast"
                highLabel="60 · expensive"
                onChange={setSteps}
              />

              <LabRange
                label="Guidance scale"
                value={guidance}
                output={guidance.toFixed(1)}
                min={1}
                max={14}
                step={0.5}
                accent="cyan"
                lowLabel="1 · no CFG"
                highLabel="14 · high pressure"
                onChange={setGuidance}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled latency"
                value={formatLatency(result.latencyMs)}
                detail={`${formatLatency(workload.latencyBudgetMs)} request budget`}
                icon={Clock3}
                tone={result.latencyPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Quality proxy"
                value={result.quality.toFixed(1)}
                detail={`${workload.qualityTarget} workload floor`}
                icon={ImageIcon}
                tone={result.qualityPass ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Diversity index"
                value={result.diversity.toFixed(0)}
                detail="Falls as modeled guidance pressure rises"
                icon={Activity}
                tone={result.diversity >= 55 ? 'cyan' : 'violet'}
              />
              <LabMetric
                label="Next-step gain"
                value={`${result.marginalGain.toFixed(2)} pts`}
                detail="Modeled marginal quality, not a benchmark"
                icon={Gauge}
                tone={result.marginalGain >= 0.5 ? 'blue' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Conceptual denoising trajectory
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {sampler.label} · {steps} scheduled evaluations
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {result.guidanceEnabled
                      ? `Conditional and unconditional paths are active (${result.cfgMultiplier.toFixed(2)}x modeled step cost).`
                      : 'Guidance is disabled; one modeled prediction path is active.'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${result.artifactRisk === 'High'
                  ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                  : result.artifactRisk === 'Elevated'
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'}`}
                >
                  {result.artifactRisk} artifact pressure
                </span>
              </div>

              <ol className="relative mt-5 grid gap-3 md:grid-cols-4">
                <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-5 hidden h-px bg-neutral-300 md:block dark:bg-neutral-700" />
                {data.phases.map((phase, index) => (
                  <li key={phase.id} className={`relative min-w-0 rounded-md border p-4 ${phaseStyles[phase.tone]}`}>
                    <div className="flex items-center gap-3">
                      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${phaseDotStyles[phase.tone]}`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{phase.label}</p>
                        <p className="text-xs opacity-75">{result.phaseCounts[index]} evaluations</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 opacity-80">{phase.detail}</p>
                    <div className="mt-3 flex min-h-4 flex-wrap gap-1" aria-label={`${result.phaseCounts[index]} modeled evaluations in ${phase.label}`}>
                      {Array.from({ length: Math.min(result.phaseCounts[index], 15) }, (_, dotIndex) => (
                        <span key={dotIndex} className={`h-2 w-2 rounded-sm ${phaseDotStyles[phase.tone]}`} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The four phases explain the coarse-to-fine tendency; an actual scheduler selects numerical noise levels, not four equal semantic buckets.
              </p>
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
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Budget consequence</p>
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

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading the denoising budget...
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
          <p className="font-semibold">Denoising budget unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
