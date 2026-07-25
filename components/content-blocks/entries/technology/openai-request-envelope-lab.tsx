'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  CircleAlert,
  Coins,
  FileSearch,
  Gauge,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Radio,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type Task = {
  id: string;
  label: string;
  detail: string;
  inputTokens: number;
  qualityFloorPct: number;
  latencyTargetMs: number;
  minimumEvidenceChunks: number;
  streamingUseful: boolean;
  qualityByTier: Record<string, number>;
};
type ModelTier = {
  id: string;
  label: string;
  detail: string;
  baseLatencyMs: number;
  inputCostFactor: number;
  outputCostFactor: number;
  outputTokensPerSecond: number;
};
type RequestEnvelopeData = {
  title: string;
  description: string;
  defaults: {
    taskId: string;
    modelTierId: string;
    retrievalChunks: number;
    maxOutputTokens: number;
    stream: boolean;
  };
  bounds: {
    retrievalChunks: Bounds;
    maxOutputTokens: Bounds;
  };
  applicationContextBudgetTokens: number;
  fixedInstructionTokens: number;
  averageChunkTokens: number;
  tasks: Task[];
  modelTiers: ModelTier[];
};

const BLOCK_ID = 'technology/openai-request-envelope-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isRequestEnvelopeData(value: unknown): value is RequestEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestEnvelopeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.taskId
      && candidate.defaults.modelTierId
      && isNumber(candidate.defaults.retrievalChunks)
      && isNumber(candidate.defaults.maxOutputTokens)
      && typeof candidate.defaults.stream === 'boolean'
      && isBounds(candidate.bounds?.retrievalChunks)
      && isBounds(candidate.bounds.maxOutputTokens)
      && isNumber(candidate.applicationContextBudgetTokens)
      && isNumber(candidate.fixedInstructionTokens)
      && isNumber(candidate.averageChunkTokens)
      && Array.isArray(candidate.tasks)
      && candidate.tasks.length > 0
      && candidate.tasks.every((task) => (
        typeof task.id === 'string'
        && typeof task.label === 'string'
        && typeof task.detail === 'string'
        && isNumber(task.inputTokens)
        && isNumber(task.qualityFloorPct)
        && isNumber(task.latencyTargetMs)
        && isNumber(task.minimumEvidenceChunks)
        && typeof task.streamingUseful === 'boolean'
        && task.qualityByTier
        && Object.values(task.qualityByTier).every(isNumber)
      ))
      && Array.isArray(candidate.modelTiers)
      && candidate.modelTiers.length > 0
      && candidate.modelTiers.every((tier) => (
        typeof tier.id === 'string'
        && typeof tier.label === 'string'
        && typeof tier.detail === 'string'
        && isNumber(tier.baseLatencyMs)
        && isNumber(tier.inputCostFactor)
        && isNumber(tier.outputCostFactor)
        && isNumber(tier.outputTokensPerSecond)
      )),
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function OpenAIRequestEnvelopeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RequestEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No request-envelope model was supplied.');
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
        if (!isRequestEnvelopeData(payload)) {
          throw new Error('The request-envelope model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the request lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RequestEnvelopeLab data={data} />;
}

function RequestEnvelopeLab({ data }: { data: RequestEnvelopeData }) {
  const [taskId, setTaskId] = useState(data.defaults.taskId);
  const [modelTierId, setModelTierId] = useState(data.defaults.modelTierId);
  const [retrievalChunks, setRetrievalChunks] = useState(data.defaults.retrievalChunks);
  const [maxOutputTokens, setMaxOutputTokens] = useState(data.defaults.maxOutputTokens);
  const [stream, setStream] = useState(data.defaults.stream);

  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const modelTier = data.modelTiers.find((item) => item.id === modelTierId) ?? data.modelTiers[0];

  const result = useMemo(() => {
    const evidenceShortfall = Math.max(0, task.minimumEvidenceChunks - retrievalChunks);
    const baseQuality = task.qualityByTier[modelTier.id] ?? 0;
    const qualityPct = clamp(baseQuality - evidenceShortfall * 4, 0, 99);
    const contextTokens = data.fixedInstructionTokens
      + task.inputTokens
      + retrievalChunks * data.averageChunkTokens;
    const contextPct = Math.round(
      contextTokens / data.applicationContextBudgetTokens * 100,
    );
    const timeToFirstTokenMs = Math.round(
      modelTier.baseLatencyMs + contextTokens * 0.08,
    );
    const generationMs = Math.round(
      maxOutputTokens / modelTier.outputTokensPerSecond * 1000,
    );
    const totalLatencyMs = timeToFirstTokenMs + generationMs;
    const perceivedWaitMs = stream ? timeToFirstTokenMs : totalLatencyMs;
    const costUnits = contextTokens / 1000 * modelTier.inputCostFactor
      + maxOutputTokens / 1000 * modelTier.outputCostFactor;
    const qualityPass = qualityPct >= task.qualityFloorPct;
    const contextPass = contextTokens <= data.applicationContextBudgetTokens;
    const latencyPass = totalLatencyMs <= task.latencyTargetMs;
    const suggestedTier = data.modelTiers.find((tier) => {
      const tierQuality = task.qualityByTier[tier.id] ?? 0;
      return tierQuality - evidenceShortfall * 4 >= task.qualityFloorPct;
    });

    let status = 'Request envelope meets the modeled contract';
    let verdict = 'Quality, context, and end-to-end latency stay inside the task thresholds. Confirm these modeled values with a representative eval and load test.';
    if (!contextPass) {
      status = 'Application context budget exceeded';
      verdict = 'Reduce retrieved chunks, trim conversation state, or raise the application budget only after checking model support and workload cost.';
    } else if (!qualityPass && evidenceShortfall > 0) {
      status = 'Required evidence is missing';
      verdict = `This task expects at least ${task.minimumEvidenceChunks} eligible chunks. Increasing model capability cannot recover facts that never entered context.`;
    } else if (!qualityPass) {
      status = 'Modeled task quality is below the release floor';
      verdict = 'Choose a more capable tier or improve the task contract, then rerun the real eval set before changing production traffic.';
    } else if (!latencyPass) {
      status = 'End-to-end latency exceeds the task target';
      verdict = 'Streaming may shorten perceived wait, but it does not make completion faster. Reduce output, context, requests, or model latency.';
    } else if (suggestedTier && suggestedTier.id !== modelTier.id) {
      status = 'A smaller tier may preserve the quality floor';
      verdict = `${suggestedTier.label} is the first modeled tier that passes. Treat that as an experiment to verify with the same eval cases, not an automatic route change.`;
    } else if (stream && !task.streamingUseful) {
      status = 'Streaming adds protocol work without task value';
      verdict = 'This short structured result should be validated as a complete object before display. Return one bounded response instead.';
    }

    return {
      contextPct,
      contextPass,
      contextTokens,
      costUnits,
      generationMs,
      latencyPass,
      perceivedWaitMs,
      qualityPass,
      qualityPct,
      status,
      suggestedTier,
      timeToFirstTokenMs,
      totalLatencyMs,
      verdict,
    };
  }, [
    data.applicationContextBudgetTokens,
    data.averageChunkTokens,
    data.fixedInstructionTokens,
    data.modelTiers,
    maxOutputTokens,
    modelTier,
    retrievalChunks,
    stream,
    task,
  ]);

  function reset() {
    setTaskId(data.defaults.taskId);
    setModelTierId(data.defaults.modelTierId);
    setRetrievalChunks(data.defaults.retrievalChunks);
    setMaxOutputTokens(data.defaults.maxOutputTokens);
    setStream(data.defaults.stream);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="OpenAI request lab"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product task
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.tasks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === task.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'ticket-extraction' ? MessageSquareText : item.id === 'policy-answer' ? FileSearch : BrainCircuit}
                      accent="blue"
                      onClick={() => setTaskId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Model tier
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.modelTiers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === modelTier.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'small-general' ? Zap : item.id === 'strong-general' ? Sparkles : BrainCircuit}
                      accent={item.id === 'small-general' ? 'emerald' : item.id === 'strong-general' ? 'blue' : 'violet'}
                      onClick={() => setModelTierId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Retrieved evidence"
                value={retrievalChunks}
                output={`${retrievalChunks} chunks`}
                {...data.bounds.retrievalChunks}
                accent="cyan"
                lowLabel="Less context"
                highLabel="More recall and cost"
                onChange={setRetrievalChunks}
              />

              <LabRange
                label="Maximum output"
                value={maxOutputTokens}
                output={`${maxOutputTokens} tokens`}
                {...data.bounds.maxOutputTokens}
                accent="violet"
                lowLabel="Bounded"
                highLabel="Long generation"
                onChange={setMaxOutputTokens}
              />

              <button
                type="button"
                role="switch"
                aria-checked={stream}
                onClick={() => setStream((current) => !current)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${stream
                  ? 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${stream ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                  {stream ? <Check aria-hidden="true" className="h-4 w-4" /> : <Radio aria-hidden="true" className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Stream response events</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Shorten perceived wait, while preserving the same total work and moderation trade-off.
                  </span>
                </span>
              </button>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Modeled quality"
                value={`${result.qualityPct}%`}
                detail={`Release floor ${task.qualityFloorPct}%`}
                icon={CheckCircle2}
                tone={result.qualityPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Context used"
                value={`${result.contextTokens.toLocaleString()} tokens`}
                detail={`${result.contextPct}% of application budget`}
                icon={Layers3}
                tone={result.contextPass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label={stream ? 'First visible output' : 'Visible completion'}
                value={`~${(result.perceivedWaitMs / 1000).toFixed(1)} s`}
                detail={`Full completion ~${(result.totalLatencyMs / 1000).toFixed(1)} s`}
                icon={Timer}
                tone={result.latencyPass ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Relative cost"
                value={`${result.costUnits.toFixed(2)} units`}
                detail="Modeled index, not live API pricing"
                icon={Coins}
                tone="violet"
              />
            </div>

            <section className={`rounded-md border p-4 ${result.qualityPass && result.contextPass && result.latencyPass
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.qualityPass && result.contextPass && result.latencyPass
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.verdict}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request budget</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{task.label} on {modelTier.label.toLowerCase()}</p>
                </div>
                <span className="w-fit rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  Target {task.latencyTargetMs.toLocaleString()} ms
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <BudgetBar
                  label="Instructions and task input"
                  value={data.fixedInstructionTokens + task.inputTokens}
                  total={data.applicationContextBudgetTokens}
                  tone="bg-blue-500"
                />
                <BudgetBar
                  label="Retrieved evidence"
                  value={retrievalChunks * data.averageChunkTokens}
                  total={data.applicationContextBudgetTokens}
                  tone="bg-cyan-500"
                />
                <BudgetBar
                  label="Reserved output"
                  value={maxOutputTokens}
                  total={data.applicationContextBudgetTokens}
                  tone="bg-violet-500"
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stage label="Time to first token" value={`~${result.timeToFirstTokenMs} ms`} icon={Gauge} />
                <Stage label="Generation" value={`~${result.generationMs} ms`} icon={Sparkles} />
                <Stage label="Delivery" value={stream ? 'Progressive events' : 'Complete result'} icon={Radio} />
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BudgetBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const width = clamp(value / total * 100, value > 0 ? 2 : 0, 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{value.toLocaleString()} tokens</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Stage({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Gauge }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <Icon aria-hidden="true" className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
      <p className="mt-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading request envelope...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Request lab unavailable</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
