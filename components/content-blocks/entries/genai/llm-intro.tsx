'use client';

import { useMemo, useState } from 'react';

type ModelPricing = {
  name: string;
  input: number;
  output: number;
  cachedInput?: number;
};

const MODELS: Record<string, ModelPricing> = {
  gpt5: { name: 'GPT-5', input: 1.25, output: 10, cachedInput: 0.125 },
  gpt5mini: { name: 'GPT-5 mini', input: 0.25, output: 2, cachedInput: 0.025 },
  gpt5nano: { name: 'GPT-5 nano', input: 0.05, output: 0.4, cachedInput: 0.005 },
  gpt4o: { name: 'GPT-4o', input: 5, output: 15 },
  gpt4omini: { name: 'GPT-4o mini', input: 0.6, output: 2.4 },
  claude35: { name: 'Claude 3.5 Sonnet', input: 3, output: 15, cachedInput: 0.3 },
  claudeSonnet4: { name: 'Claude Sonnet 4', input: 3, output: 15, cachedInput: 0.3 },
  claudeOpus: { name: 'Claude 3 Opus', input: 15, output: 75, cachedInput: 1.5 },
  gemini15pro: { name: 'Gemini 1.5 Pro', input: 3.5, output: 10.5 },
  llama31: { name: 'Llama 3.1 (70B), self-hosted', input: 0, output: 0 },
  llama31405b: { name: 'Llama 3.1 (405B), self-hosted', input: 0, output: 0 },
  mistral24b: { name: 'Mistral Small 3 (24B), self-hosted', input: 0, output: 0 },
  qwen3: { name: 'Qwen 3 (110B), self-hosted', input: 0, output: 0 },
  deepseek: { name: 'DeepSeek-R1 (671B MoE), self-hosted', input: 0, output: 0 },
  gemma27b: { name: 'Gemma 2 (27B), self-hosted', input: 0, output: 0 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function formatTime(days: number) {
  if (days < 1) return `${(days * 24).toFixed(1)} hours`;
  if (days < 365) return `${days.toFixed(1)} days`;
  return `${(days / 365).toFixed(1)} years`;
}

function formatCost(cost: number) {
  if (cost < 1_000) return `$${cost.toFixed(0)}`;
  if (cost < 1_000_000) return `$${(cost / 1_000).toFixed(1)}K`;
  return `$${(cost / 1_000_000).toFixed(1)}M`;
}

export default function LlmIntroCalculators() {
  const [modelId, setModelId] = useState('gpt5');
  const [tokenCount, setTokenCount] = useState(1000);
  const [inputShare, setInputShare] = useState(30);
  const [cachedShare, setCachedShare] = useState(0);
  const [verbosity, setVerbosity] = useState('medium');
  const [reasoningEffort, setReasoningEffort] = useState('standard');
  const [modelSize, setModelSize] = useState(7);
  const [trainingTokens, setTrainingTokens] = useState(1000);

  const model = MODELS[modelId];
  const tokenCost = useMemo(() => {
    const total = Math.max(0, tokenCount);
    const inputFraction = clamp(inputShare, 0, 100) / 100;
    const cacheFraction = model.cachedInput === undefined ? 0 : clamp(cachedShare, 0, 100) / 100;
    const inputRate = model.cachedInput === undefined
      ? model.input
      : cacheFraction * model.cachedInput + (1 - cacheFraction) * model.input;
    return (total * inputFraction * inputRate + total * (1 - inputFraction) * model.output) / 1_000_000;
  }, [cachedShare, inputShare, model, tokenCount]);

  const training = useMemo(() => {
    const flops = 6 * Math.max(0, modelSize) * 1e9 * Math.max(0, trainingTokens) * 1e9;
    const efficiency = 0.4;
    const hardware = [
      { name: 'NVIDIA H100', tflops: 1000, hourly: 5 },
      { name: 'NVIDIA A100', tflops: 312, hourly: 2.5 },
      { name: 'Mac Studio M2 Ultra', tflops: 27, hourly: 0 },
    ];
    return {
      flops,
      hardware: hardware.map((item) => {
        const seconds = flops / (item.tflops * 1e12 * efficiency);
        return { ...item, days: seconds / 86_400, cost: (seconds / 3600) * item.hourly };
      }),
    };
  }, [modelSize, trainingTokens]);

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-purple-200 bg-purple-50 p-5 dark:border-purple-800 dark:bg-purple-950/20">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Token cost calculator</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Model
            <select value={modelId} onChange={(event) => setModelId(event.target.value)} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900">
              {Object.entries(MODELS).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Total tokens
            <input type="number" min="0" value={tokenCount} onChange={(event) => setTokenCount(Number(event.target.value))} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900" />
          </label>
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Input share: {clamp(inputShare, 0, 100)}%
            <input type="range" min="0" max="100" value={inputShare} onChange={(event) => setInputShare(Number(event.target.value))} className="mt-2 block w-full" />
          </label>
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Cached input share: {model.cachedInput === undefined ? 'not available' : `${clamp(cachedShare, 0, 100)}%`}
            <input type="range" min="0" max="100" disabled={model.cachedInput === undefined} value={model.cachedInput === undefined ? 0 : cachedShare} onChange={(event) => setCachedShare(Number(event.target.value))} className="mt-2 block w-full disabled:opacity-40" />
          </label>
        </div>
        {modelId.startsWith('gpt5') && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Verbosity
              <select value={verbosity} onChange={(event) => setVerbosity(event.target.value)} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
            </label>
            <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Reasoning effort
              <select value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value)} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900"><option value="minimal">Minimal</option><option value="standard">Standard</option><option value="high">High</option></select>
            </label>
          </div>
        )}
        <div className="mt-4 rounded-md border border-purple-200 bg-white p-4 dark:border-purple-700 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Estimated API cost</p>
          <p className="text-2xl font-semibold text-purple-700 dark:text-purple-300">${tokenCost.toFixed(4)}</p>
          <p className="mt-1 text-xs text-neutral-500">Self-hosted entries show $0 API price but still incur infrastructure cost. Verbosity and reasoning effort affect latency and token use, not the listed per-token rate.</p>
        </div>
      </section>

      <section className="rounded-md border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/20">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Training cost calculator</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Uses the 6ND estimate and assumes 40% model FLOPs utilization.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Model size, billions of parameters
            <input type="number" min="0" value={modelSize} onChange={(event) => setModelSize(Number(event.target.value))} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900" />
          </label>
          <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Training tokens, billions
            <input type="number" min="0" value={trainingTokens} onChange={(event) => setTrainingTokens(Number(event.target.value))} className="mt-1 block w-full rounded-md border bg-white px-3 py-2 dark:bg-neutral-900" />
          </label>
        </div>
        <p className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">Total work: {(training.flops / 1e21).toFixed(1)} x 10^21 FLOPs</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {training.hardware.map((item) => (
            <div key={item.name} className="rounded-md border bg-white p-3 dark:bg-neutral-900">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{item.name}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.tflops} TFLOP/s peak</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300">{formatTime(item.days)}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.hourly ? `${formatCost(item.cost)} at $${item.hourly}/hour` : 'Owned hardware, about $7K upfront'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
