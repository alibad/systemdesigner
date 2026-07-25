'use client';

import { useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2,
  Gauge,
  Globe2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type TaskId = 'completion' | 'explanation' | 'refactor';
type ModelId = 'fast' | 'balanced' | 'reasoning';
type ContextId = 'cursor' | 'file' | 'repository';
type NetworkId = 'edge' | 'regional' | 'congested';

type Choice<T extends string> = {
  id: T;
  label: string;
  detail: string;
};

const tasks: Array<Choice<TaskId> & { budget: number; generationMs: number; minQuality: number }> = [
  { id: 'completion', label: 'Inline completion', detail: 'Short ghost text while typing', budget: 100, generationMs: 8, minQuality: 66 },
  { id: 'explanation', label: 'Code explanation', detail: 'A response in the side panel', budget: 800, generationMs: 90, minQuality: 76 },
  { id: 'refactor', label: 'Multi-file refactor', detail: 'A reviewable asynchronous patch', budget: 1600, generationMs: 260, minQuality: 84 },
];

const models: Array<Choice<ModelId> & { baseMs: number; quality: number; capacity: number; cost: number; icon: LucideIcon }> = [
  { id: 'fast', label: 'Compact model', detail: 'Quantized for the interactive path', baseMs: 19, quality: 70, capacity: 420, cost: 1, icon: Zap },
  { id: 'balanced', label: 'Balanced model', detail: 'More reasoning at moderate cost', baseMs: 54, quality: 83, capacity: 180, cost: 2.4, icon: Sparkles },
  { id: 'reasoning', label: 'Reasoning model', detail: 'Best for complex, asynchronous edits', baseMs: 175, quality: 94, capacity: 48, cost: 7.2, icon: Braces },
];

const contexts: Array<Choice<ContextId> & { tokens: number; retrievalMs: number; qualityDelta: number }> = [
  { id: 'cursor', label: 'Cursor only', detail: 'Current function and nearby types', tokens: 256, retrievalMs: 2, qualityDelta: -9 },
  { id: 'file', label: 'Current file', detail: 'Imports, symbols, and diagnostics', tokens: 1200, retrievalMs: 10, qualityDelta: 0 },
  { id: 'repository', label: 'Repository retrieval', detail: 'Related APIs, tests, and docs', tokens: 4000, retrievalMs: 38, qualityDelta: 9 },
];

const networks: Array<Choice<NetworkId> & { ms: number }> = [
  { id: 'edge', label: 'Near edge', detail: '18 ms', ms: 18 },
  { id: 'regional', label: 'Regional', detail: '42 ms', ms: 42 },
  { id: 'congested', label: 'Congested', detail: '85 ms', ms: 85 },
];

export default function AiCodeAssistantContextBudgetLab() {
  const [taskId, setTaskId] = useState<TaskId>('completion');
  const [modelId, setModelId] = useState<ModelId>('fast');
  const [contextId, setContextId] = useState<ContextId>('file');
  const [networkId, setNetworkId] = useState<NetworkId>('edge');

  const result = useMemo(() => {
    const task = tasks.find((item) => item.id === taskId) ?? tasks[0];
    const model = models.find((item) => item.id === modelId) ?? models[0];
    const context = contexts.find((item) => item.id === contextId) ?? contexts[1];
    const network = networks.find((item) => item.id === networkId) ?? networks[0];
    const preparationMs = 6 + context.tokens / 400;
    const inferenceMs = model.baseMs * (1 + context.tokens / 8000) + task.generationMs;
    const safetyMs = 12;
    const renderMs = 6;
    const stages = [
      { label: 'Network', value: network.ms, color: 'bg-cyan-500' },
      { label: 'Retrieve', value: context.retrievalMs + preparationMs, color: 'bg-amber-500' },
      { label: 'Generate', value: inferenceMs, color: 'bg-violet-500' },
      { label: 'Validate', value: safetyMs + renderMs, color: 'bg-emerald-500' },
    ];
    const latency = stages.reduce((sum, stage) => sum + stage.value, 0);
    const quality = Math.min(100, Math.max(0, model.quality + context.qualityDelta));
    const latencyPass = latency <= task.budget;
    const qualityPass = quality >= task.minQuality;
    const decision = latencyPass && qualityPass
      ? task.id === 'refactor' ? 'Queue the reviewable patch' : 'Serve the response'
      : !latencyPass ? 'Degrade or return no suggestion' : 'Add context or choose a stronger model';
    return { task, model, context, network, stages, latency, quality, latencyPass, qualityPass, decision };
  }, [contextId, modelId, networkId, taskId]);

  const reset = () => {
    setTaskId('completion');
    setModelId('fast');
    setContextId('file');
    setNetworkId('edge');
  };

  return (
    <section aria-labelledby="code-budget-title" className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-300 text-neutral-950">
              <Clock3 aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-cyan-300">Context and latency lab</p>
              <h3 id="code-budget-title" className="mt-1 text-xl font-semibold text-white sm:text-2xl">Fit useful context inside the task deadline</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">Choose the task, context scope, model, and network. More context can improve relevance while consuming retrieval, token, and inference time.</p>
            </div>
          </div>
          <button type="button" onClick={reset} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 hover:border-neutral-500 hover:text-white">
            <RefreshCw aria-hidden="true" className="size-4" /> Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-6 border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50 sm:p-6 lg:border-b-0 lg:border-r">
          <ChoiceGroup label="1. Choose the user task" items={tasks} selected={taskId} onSelect={setTaskId} columns="grid-cols-1" />
          <ChoiceGroup label="2. Choose the context scope" items={contexts} selected={contextId} onSelect={setContextId} columns="grid-cols-1 sm:grid-cols-3 lg:grid-cols-1" />
          <ChoiceGroup label="3. Place the developer" items={networks} selected={networkId} onSelect={setNetworkId} columns="grid-cols-3" compact />
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">4. Route to a model tier</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {models.map((model) => {
                const Icon = model.icon;
                const selected = model.id === modelId;
                return (
                  <button key={model.id} type="button" aria-pressed={selected} onClick={() => setModelId(model.id)} className={selected
                    ? 'min-w-0 rounded-md border border-violet-600 bg-violet-50 p-3 text-left text-violet-950 ring-1 ring-violet-600 dark:border-violet-300 dark:bg-violet-950 dark:text-violet-50 dark:ring-violet-300'
                    : 'min-w-0 rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}>
                    <span className="flex items-center justify-between gap-2"><Icon aria-hidden="true" className="size-4" /><span className="text-[11px] font-semibold">{model.cost.toFixed(1)}x cost</span></span>
                    <span className="mt-3 block text-sm font-semibold">{model.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{model.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric icon={Gauge} label="Modeled p95" value={`${Math.round(result.latency)} ms`} tone={result.latencyPass ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'} />
            <Metric icon={Sparkles} label="Quality index" value={`${result.quality}/100`} tone={result.qualityPass ? 'text-violet-600 dark:text-violet-300' : 'text-amber-600 dark:text-amber-300'} />
            <Metric icon={Code2} label="Context" value={`${result.context.tokens.toLocaleString()} tokens`} tone="text-blue-600 dark:text-blue-300" />
            <Metric icon={Globe2} label="Replica capacity" value={`${result.model.capacity}/s`} tone="text-cyan-600 dark:text-cyan-300" />
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">One end-to-end deadline</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Budget: {result.task.budget.toLocaleString()} ms for {result.task.label.toLowerCase()}</p>
              </div>
              <span className={result.latencyPass ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-300' : 'text-sm font-semibold text-rose-700 dark:text-rose-300'}>{result.latencyPass ? 'Within budget' : 'Deadline missed'}</span>
            </div>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`Modeled latency ${Math.round(result.latency)} milliseconds of ${result.task.budget} milliseconds`}>
              {result.stages.map((stage) => <div key={stage.label} className={`${stage.color} min-w-1 transition-[width]`} style={{ width: `${Math.max(2, Math.min(100, stage.value / result.task.budget * 100))}%` }} />)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {result.stages.map((stage) => <div key={stage.label}><span className={`inline-block size-2 rounded-full ${stage.color}`} /><p className="mt-1 text-xs font-semibold">{stage.label}</p><p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{Math.round(stage.value)} ms</p></div>)}
            </div>
          </div>

          <div className={result.latencyPass && result.qualityPass
            ? 'mt-5 border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:border-emerald-300 dark:bg-emerald-950/60'
            : 'mt-5 border-l-4 border-amber-500 bg-amber-50 p-4 dark:border-amber-300 dark:bg-amber-950/60'}>
            <div className="flex items-start gap-3">
              {result.latencyPass && result.qualityPass ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-200" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-200" />}
              <div><p className="font-semibold">{result.decision}</p><p className="mt-1 text-sm leading-6 opacity-80">The correct route must pass both the user-visible deadline and the task's quality floor. A larger model is not automatically the better system decision.</p></div>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">{result.decision}. Modeled latency is {Math.round(result.latency)} milliseconds and quality is {result.quality} out of 100.</p>
        </div>
      </div>
    </section>
  );
}

function ChoiceGroup<T extends string>({ label, items, selected, onSelect, columns, compact = false }: { label: string; items: Array<Choice<T>>; selected: T; onSelect: (id: T) => void; columns: string; compact?: boolean }) {
  return <fieldset><legend className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</legend><div className={`mt-3 grid gap-2 ${columns}`}>{items.map((item) => { const active = item.id === selected; return <button key={item.id} type="button" aria-pressed={active} onClick={() => onSelect(item.id)} className={active ? 'rounded-md border border-cyan-600 bg-cyan-50 p-3 text-left text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-300 dark:bg-cyan-950 dark:text-cyan-50 dark:ring-cyan-300' : 'rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}><span className="block text-sm font-semibold">{item.label}</span>{!compact && <span className="mt-1 block text-xs leading-5 opacity-75">{item.detail}</span>}{compact && <span className="mt-1 block text-[11px] opacity-70">{item.detail}</span>}</button>; })}</div></fieldset>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"><Icon aria-hidden="true" className={`size-4 ${tone}`} /><p className="mt-3 break-words text-lg font-semibold tabular-nums sm:text-xl">{value}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{label}</p></div>;
}
