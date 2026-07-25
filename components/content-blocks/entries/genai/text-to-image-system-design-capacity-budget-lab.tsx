'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Gauge,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Server,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'emerald' | 'amber' | 'rose';

type Resolution = {
  id: string;
  label: string;
  detail: string;
  width: number;
  height: number;
};

type CapacityScenario = {
  id: string;
  label: string;
  detail: string;
  deadlineSeconds: number;
  arrivalImagesPerMinute: number;
  recommendedResolutionId: string;
  recommendedSteps: number;
  recommendedBatchSize: number;
  recommendedGpuCount: number;
};

type CapacityBudgetData = {
  title: string;
  description: string;
  calibration: {
    label: string;
    baselineWidth: number;
    baselineHeight: number;
    baselineSteps: number;
    baselineSecondsPerImage: number;
    batchIncrement: number;
    hourlyGpuCostUsd: number;
    targetUtilization: number;
  };
  defaults: {
    scenarioId: string;
    resolutionId: string;
    steps: number;
    batchSize: number;
    gpuCount: number;
    arrivalImagesPerMinute: number;
  };
  resolutions: Resolution[];
  scenarios: CapacityScenario[];
};

const BLOCK_ID = 'genai/text-to-image-system-design-capacity-budget-lab';

function isCapacityBudgetData(value: unknown): value is CapacityBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityBudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.calibration
      && candidate.defaults
      && Array.isArray(candidate.resolutions)
      && candidate.resolutions.length > 0
      && candidate.resolutions.every((item) => (
        typeof item.id === 'string'
        && typeof item.width === 'number'
        && typeof item.height === 'number'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function clampPercent(value: number) {
  return `${Math.max(3, Math.min(100, value))}%`;
}

function formatSeconds(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}s`;
}

export default function TextToImageSystemDesignCapacityBudgetLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityBudgetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No capacity calibration was supplied.');
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
        if (!isCapacityBudgetData(payload)) {
          throw new Error('Capacity calibration data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load capacity data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <CapacityBudgetLab data={data} /> : <LoadState />}
    </div>
  );
}

function CapacityBudgetLab({ data }: { data: CapacityBudgetData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [resolutionId, setResolutionId] = useState(data.defaults.resolutionId);
  const [steps, setSteps] = useState(data.defaults.steps);
  const [batchSize, setBatchSize] = useState(data.defaults.batchSize);
  const [gpuCount, setGpuCount] = useState(data.defaults.gpuCount);
  const [arrivalImagesPerMinute, setArrivalImagesPerMinute] = useState(
    data.defaults.arrivalImagesPerMinute,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const resolution = data.resolutions.find((item) => item.id === resolutionId)
    ?? data.resolutions[0];

  const result = useMemo(() => {
    const { calibration } = data;
    const pixelScale = (resolution.width * resolution.height)
      / (calibration.baselineWidth * calibration.baselineHeight);
    const stepScale = steps / calibration.baselineSteps;
    const batchScale = 1 + calibration.batchIncrement * (batchSize - 1);
    const batchSeconds = calibration.baselineSecondsPerImage
      * pixelScale
      * stepScale
      * batchScale;
    const imagesPerMinutePerGpu = (60 * batchSize) / batchSeconds;
    const poolCapacity = gpuCount * imagesPerMinutePerGpu;
    const utilization = arrivalImagesPerMinute / poolCapacity;
    const requiredGpus = Math.max(
      1,
      Math.ceil(
        arrivalImagesPerMinute
        / (imagesPerMinutePerGpu * calibration.targetUtilization),
      ),
    );
    const costPerImage = (
      batchSeconds / 3600
      * calibration.hourlyGpuCostUsd
      / batchSize
    );
    const latencyPass = batchSeconds <= scenario.deadlineSeconds;
    const headroomPass = utilization <= calibration.targetUtilization;
    const overloaded = utilization >= 1;
    const recommendedRecipe = resolution.id === scenario.recommendedResolutionId
      && steps === scenario.recommendedSteps
      && batchSize === scenario.recommendedBatchSize
      && gpuCount === scenario.recommendedGpuCount;

    let verdict = 'Ready: the pool fits the modeled envelope';
    let detail = `The recipe finishes within ${scenario.deadlineSeconds}s and leaves the modeled ${((1 - calibration.targetUtilization) * 100).toFixed(0)}% target headroom.`;
    let tone: Tone = 'emerald';

    if (overloaded) {
      verdict = 'Unstable: arrivals exceed service capacity';
      detail = `Demand is ${arrivalImagesPerMinute.toFixed(0)} images/min against ${poolCapacity.toFixed(1)} images/min of modeled capacity. Queue age will grow.`;
      tone = 'rose';
    } else if (!latencyPass) {
      verdict = 'The render recipe misses the job deadline';
      detail = `One compatible batch needs ${formatSeconds(batchSeconds)} before queueing, above the ${scenario.deadlineSeconds}s generation budget.`;
      tone = 'rose';
    } else if (!headroomPass) {
      verdict = 'Capacity fits only without operating headroom';
      detail = `${(utilization * 100).toFixed(0)}% utilization is below saturation but above the ${(calibration.targetUtilization * 100).toFixed(0)}% planning target.`;
      tone = 'amber';
    } else if (!recommendedRecipe) {
      verdict = 'Viable: validate this alternative at matched quality';
      detail = 'The capacity envelope fits, but this is not the scenario calibration default. Compare task-slice quality before promotion.';
      tone = 'amber';
    }

    return {
      batchSeconds,
      costPerImage,
      detail,
      headroomPass,
      imagesPerMinutePerGpu,
      latencyPass,
      overloaded,
      pixelScale,
      poolCapacity,
      requiredGpus,
      stepScale,
      tone,
      utilization,
      verdict,
    };
  }, [arrivalImagesPerMinute, batchSize, data, gpuCount, resolution, scenario, steps]);

  const chooseScenario = (next: CapacityScenario) => {
    setScenarioId(next.id);
    setResolutionId(next.recommendedResolutionId);
    setSteps(next.recommendedSteps);
    setBatchSize(next.recommendedBatchSize);
    setGpuCount(next.recommendedGpuCount);
    setArrivalImagesPerMinute(next.arrivalImagesPerMinute);
  };

  const reset = () => {
    setScenarioId(initialScenario.id);
    setResolutionId(data.defaults.resolutionId);
    setSteps(data.defaults.steps);
    setBatchSize(data.defaults.batchSize);
    setGpuCount(data.defaults.gpuCount);
    setArrivalImagesPerMinute(data.defaults.arrivalImagesPerMinute);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="GPU capacity lab"
        title={data.title}
        description={data.description}
        icon={Gauge}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload contract
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'campaign-batch' ? Boxes : item.id === 'premium-render' ? Sparkles : Clock3}
                    accent={item.id === 'campaign-batch' ? 'cyan' : item.id === 'premium-render' ? 'violet' : 'blue'}
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Spatial envelope
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {data.resolutions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === resolution.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ImageIcon}
                    accent="cyan"
                    onClick={() => setResolutionId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange label="Denoising steps" value={steps} output={`${steps}`} min={4} max={40} step={2} accent="violet" lowLabel="4 passes" highLabel="40 passes" onChange={setSteps} />
              <LabRange label="Batch size" value={batchSize} output={`${batchSize} images`} min={1} max={4} step={1} accent="blue" lowLabel="Single" highLabel="Four" onChange={setBatchSize} />
              <LabRange label="GPU workers" value={gpuCount} output={`${gpuCount}`} min={1} max={16} step={1} accent="emerald" lowLabel="One" highLabel="16" onChange={setGpuCount} />
              <LabRange label="Arrival rate" value={arrivalImagesPerMinute} output={`${arrivalImagesPerMinute} img/min`} min={5} max={80} step={1} accent="amber" lowLabel="Quiet" highLabel="Burst" onChange={setArrivalImagesPerMinute} />
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${statusClasses(result.tone)}`}>
            <div className="flex items-start gap-3">
              {result.tone === 'rose' ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{result.verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Batch service time" value={formatSeconds(result.batchSeconds)} detail={`${batchSize} image${batchSize === 1 ? '' : 's'} before queue delay`} icon={Clock3} tone={result.latencyPass ? 'violet' : 'rose'} />
            <LabMetric label="Pool capacity" value={`${result.poolCapacity.toFixed(1)}/min`} detail={`${result.imagesPerMinutePerGpu.toFixed(1)} images/min per calibrated worker`} icon={Server} tone="blue" />
            <LabMetric label="Utilization" value={`${(result.utilization * 100).toFixed(0)}%`} detail={`Plan for ${result.requiredGpus} workers at the target headroom`} icon={Gauge} tone={result.overloaded ? 'rose' : result.headroomPass ? 'emerald' : 'amber'} />
            <LabMetric label="Modeled GPU cost" value={`$${result.costPerImage.toFixed(3)}`} detail="Per generated image; excludes storage, review, retries, and egress" icon={Coins} tone="amber" />
          </div>

          <section aria-label="Capacity pressure model" className="border-y border-neutral-200 py-5 dark:border-neutral-800">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Measured work envelope</p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">See which lever creates pressure</h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{data.calibration.label}</p>
            </div>
            <div className="mt-5 space-y-4">
              <PressureBar label="Spatial work per pass" value={`${result.pixelScale.toFixed(2)}x baseline`} width={result.pixelScale * 100} color="bg-cyan-500 dark:bg-cyan-400" />
              <PressureBar label="Sequential denoiser passes" value={`${result.stepScale.toFixed(2)}x baseline`} width={result.stepScale * 100} color="bg-violet-500 dark:bg-violet-400" />
              <PressureBar label="Pool utilization" value={`${(result.utilization * 100).toFixed(0)}%`} width={result.utilization * 100} color={result.overloaded ? 'bg-rose-500 dark:bg-rose-400' : result.headroomPass ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'} />
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <PathStage icon={Layers3} eyebrow="Queue" title={`${arrivalImagesPerMinute} images/min`} detail={`${scenario.label}; ${scenario.deadlineSeconds}s generation budget.`} tone="amber" />
            <div aria-hidden="true" className="hidden h-px w-8 bg-neutral-300 md:block dark:bg-neutral-700" />
            <PathStage icon={Server} eyebrow="Worker pool" title={`${gpuCount} calibrated GPUs`} detail={`${batchSize} image batch, ${steps} denoising passes.`} tone="violet" />
            <div aria-hidden="true" className="hidden h-px w-8 bg-neutral-300 md:block dark:bg-neutral-700" />
            <PathStage icon={ImageIcon} eyebrow="Delivery" title={`${result.poolCapacity.toFixed(1)} images/min`} detail={result.headroomPass ? 'Capacity includes target headroom.' : 'Queue pressure needs a contract or capacity change.'} tone={result.headroomPass ? 'emerald' : 'rose'} />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PressureBar({
  label,
  value,
  width,
  color,
}: {
  label: string;
  value: string;
  width: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${color}`} style={{ width: clampPercent(width) }} />
      </div>
    </div>
  );
}

function PathStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: typeof Server;
  eyebrow: string;
  title: string;
  detail: string;
  tone: Tone | 'violet';
}) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  };
  return (
    <div className={`min-w-0 rounded-md border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75"><Icon aria-hidden="true" className="h-4 w-4" />{eyebrow}</div>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function statusClasses(tone: Tone) {
  if (tone === 'rose') return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50';
  if (tone === 'amber') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50';
  return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50';
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="GPU capacity lab" title="Loading capacity calibration" description="Preparing the measured worker-pool model." icon={Gauge} accent="violet" />
      <LearningLabBody><div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />Loading calibration...</div></LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="GPU capacity lab" title="Capacity calibration unavailable" description="The lesson could not load its local capacity model." icon={CircleAlert} accent="rose" />
      <LearningLabBody><p className="text-sm text-rose-700 dark:text-rose-300">{detail}</p></LearningLabBody>
    </LearningLab>
  );
}
