'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  BrainCircuit,
  Database,
  Gauge,
  LoaderCircle,
  Sparkles,
  Tags,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/discriminative-vs-generative/data/model-selection-tasks.json';
const BLOCK_ID = 'ml-systems/discriminative-vs-generative-calculator';

type TaskProfile = {
  id: string;
  label: string;
  detail: string;
  requiredOutput: string;
  needsGeneration: boolean;
  needsMissingEvidence: boolean;
  predictionOnly: boolean;
};

type LabData = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    taskId: string;
    labeledPercent: number;
    latencyBudgetMs: number;
  };
  tasks: TaskProfile[];
};

function isTask(value: unknown): value is TaskProfile {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<TaskProfile>;
  return Boolean(
    typeof task.id === 'string' &&
      typeof task.label === 'string' &&
      typeof task.detail === 'string' &&
      typeof task.requiredOutput === 'string' &&
      typeof task.needsGeneration === 'boolean' &&
      typeof task.needsMissingEvidence === 'boolean' &&
      typeof task.predictionOnly === 'boolean',
  );
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.notice === 'string' &&
      data.defaults &&
      typeof data.defaults.taskId === 'string' &&
      typeof data.defaults.labeledPercent === 'number' &&
      typeof data.defaults.latencyBudgetMs === 'number' &&
      Array.isArray(data.tasks) &&
      data.tasks.length >= 3 &&
      data.tasks.every(isTask),
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function DiscriminativeVsGenerativeCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState('fraud-triage');
  const [labeledPercent, setLabeledPercent] = useState(80);
  const [latencyBudgetMs, setLatencyBudgetMs] = useState(75);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Model-selection data is incomplete.');
        setData(payload);
        setTaskId(payload.defaults.taskId);
        setLabeledPercent(payload.defaults.labeledPercent);
        setLatencyBudgetMs(payload.defaults.latencyBudgetMs);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const task = data?.tasks.find((item) => item.id === taskId) ?? data?.tasks[0];

  const result = useMemo(() => {
    if (!task) return null;

    const labelSignal = labeledPercent * 0.32;
    const latencyPressure = Math.max(0, (120 - latencyBudgetMs) * 0.22);
    const discriminativeFit = clamp(
      42 +
        labelSignal +
        (task.predictionOnly ? 24 : -8) -
        (task.needsGeneration ? 70 : 0) -
        (task.needsMissingEvidence ? 9 : 0) +
        latencyPressure,
    );
    const generativeFit = clamp(
      40 +
        (100 - labeledPercent) * 0.2 +
        (task.needsGeneration ? 48 : 0) +
        (task.needsMissingEvidence ? 20 : 0) -
        (task.predictionOnly ? 8 : 0) -
        latencyPressure * 0.8,
    );
    const recommendation = discriminativeFit >= generativeFit ? 'Discriminative' : 'Generative';
    const margin = Math.abs(discriminativeFit - generativeFit);
    const rationale = task.needsGeneration
      ? 'The product must create or reconstruct data, so a direct predictor cannot satisfy the output contract by itself.'
      : task.needsMissingEvidence && labeledPercent < 45
        ? 'Sparse labels and missing evidence favor an explicit data model, provided its assumptions survive validation.'
        : task.predictionOnly && latencyBudgetMs < 120
          ? 'The product only needs a prediction and has a tight serving budget, so model the decision directly.'
          : recommendation === 'Discriminative'
            ? 'Representative labels make direct prediction the narrower, easier-to-operate objective.'
            : 'The broader distributional objective earns its cost because the task needs structure beyond a label.';

    return {
      discriminativeFit,
      generativeFit,
      margin,
      rationale,
      recommendation,
    };
  }, [labeledPercent, latencyBudgetMs, task]);

  function reset() {
    if (!data) return;
    setTaskId(data.defaults.taskId);
    setLabeledPercent(data.defaults.labeledPercent);
    setLatencyBudgetMs(data.defaults.latencyBudgetMs);
  }

  if (!data || !task || !result) {
    return <LoadState error={error} />;
  }

  const recommendsDiscriminative = result.recommendation === 'Discriminative';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Objective selection lab"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the product contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.tasks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === task.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.needsGeneration ? Sparkles : item.needsMissingEvidence ? Database : Tags}
                      accent={item.needsGeneration ? 'violet' : item.needsMissingEvidence ? 'cyan' : 'blue'}
                      onClick={() => setTaskId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Training records with trusted labels"
                value={labeledPercent}
                output={`${labeledPercent}%`}
                min={5}
                max={100}
                step={5}
                accent="blue"
                lowLabel="Mostly unlabeled"
                highLabel="Mostly labeled"
                onChange={setLabeledPercent}
              />

              <LabRange
                label="3. Online latency budget"
                value={latencyBudgetMs}
                output={`${latencyBudgetMs} ms`}
                min={25}
                max={500}
                step={25}
                accent="amber"
                lowLabel="Tight"
                highLabel="Flexible"
                onChange={setLatencyBudgetMs}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required output
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {task.requiredOutput}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  recommendsDiscriminative
                    ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-100'
                    : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-100'
                }`}
              >
                {recommendsDiscriminative ? <Binary aria-hidden="true" className="h-4 w-4" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
                Start with a {result.recommendation.toLowerCase()} objective
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric
                label="Discriminative fit"
                value={`${result.discriminativeFit} / 100`}
                detail="Direct prediction, label fit, and serving pressure"
                icon={Binary}
                tone={recommendsDiscriminative ? 'blue' : 'neutral'}
              />
              <LabMetric
                label="Generative fit"
                value={`${result.generativeFit} / 100`}
                detail="Distributional capability, sparse labels, and missing evidence"
                icon={Sparkles}
                tone={!recommendsDiscriminative ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Decision margin"
                value={`${result.margin} points`}
                detail={result.margin < 12 ? 'Close call: prototype both formulations' : 'One objective fits materially better'}
                icon={Gauge}
                tone={result.margin < 12 ? 'amber' : 'emerald'}
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <ModelBoundary
                active={recommendsDiscriminative}
                eyebrow="Learn P(y | x)"
                title="Decision boundary"
                detail="Spend capacity on the label, score, or rank the product consumes."
                icon={Binary}
                tone="blue"
              />
              <div className="hidden items-center justify-center md:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-[10px] font-bold uppercase text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  or
                </span>
              </div>
              <ModelBoundary
                active={!recommendsDiscriminative}
                eyebrow="Learn P(x, y) or P(x | y)"
                title="Data distribution"
                detail="Spend capacity on sampling, reconstruction, latent structure, or missing evidence."
                icon={Sparkles}
                tone="violet"
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Why this starting point?</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.rationale}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ModelBoundary({
  active,
  eyebrow,
  title,
  detail,
  icon: Icon,
  tone,
}: {
  active: boolean;
  eyebrow: string;
  title: string;
  detail: string;
  icon: typeof Binary;
  tone: 'blue' | 'violet';
}) {
  const activeStyles = tone === 'blue'
    ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/35'
    : 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/35';
  const iconStyles = tone === 'blue'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
    : 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200';

  return (
    <div className={`rounded-md border p-4 ${active ? activeStyles : 'border-neutral-200 bg-white opacity-65 dark:border-neutral-800 dark:bg-neutral-950'}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${iconStyles}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{eyebrow}</p>
      <p className="mt-1 font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Objective selection lab"
          title="Choose the learning target before the architecture"
          description="Loading the model-selection contract..."
          icon={BrainCircuit}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center">
            {error ? (
              <div role="alert" className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
                <div className="flex items-start gap-3">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Model-selection lab unavailable</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                Loading objective choices...
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
