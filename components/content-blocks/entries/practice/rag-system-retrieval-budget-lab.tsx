'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Database,
  FileSearch,
  Gauge,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

type RetrievalMode = 'sparse' | 'dense' | 'hybrid';

const modes: Array<{
  id: RetrievalMode;
  label: string;
  description: string;
  recallBase: number;
  latencyMs: number;
}> = [
  {
    id: 'sparse',
    label: 'Sparse',
    description: 'Fast exact-term matching; weaker on paraphrases.',
    recallBase: 68,
    latencyMs: 55,
  },
  {
    id: 'dense',
    label: 'Dense',
    description: 'Semantic matching; can miss identifiers and rare terms.',
    recallBase: 78,
    latencyMs: 125,
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Fuse exact and semantic candidates before reranking.',
    recallBase: 84,
    latencyMs: 205,
  },
];

const latencyTargetMs = 3000;

export default function RagSystemRetrievalBudgetLab() {
  const [modeId, setModeId] = useState<RetrievalMode>('hybrid');
  const [candidateCount, setCandidateCount] = useState(80);
  const [rerankCount, setRerankCount] = useState(20);
  const [promptChunks, setPromptChunks] = useState(6);

  const model = useMemo(() => {
    const mode = modes.find((item) => item.id === modeId) ?? modes[2];
    const candidateGain = Math.log2(candidateCount / 20 + 1) * 3.8;
    const rerankGain = Math.min(7, rerankCount * 0.28);
    const recall = Math.min(96, mode.recallBase + candidateGain + rerankGain);
    const contextTokens = promptChunks * 430 + 650;
    const contextPrecision = Math.max(62, 96 - Math.max(0, promptChunks - 6) * 5.5);
    const retrievalMs = mode.latencyMs + candidateCount * 1.2;
    const rerankMs = 65 + rerankCount * 11;
    const generationMs = 720 + contextTokens * 0.31;
    const stages = [
      { label: 'Gateway', value: 130, color: 'bg-cyan-500' },
      { label: 'Retrieve', value: retrievalMs, color: 'bg-blue-500' },
      { label: 'Rerank', value: rerankMs, color: 'bg-violet-500' },
      { label: 'Generate', value: generationMs, color: 'bg-amber-500' },
      { label: 'Validate', value: 190, color: 'bg-emerald-500' },
    ];
    const totalMs = stages.reduce((sum, stage) => sum + stage.value, 0);
    const costCents = 0.13 + contextTokens * 0.000075 + candidateCount * 0.00035 + rerankCount * 0.002;
    const passesRecall = recall >= 85;
    const passesLatency = totalMs <= latencyTargetMs;
    const passesPrecision = contextPrecision >= 80;

    let decision = 'Balanced serving path';
    let explanation = 'The design clears recall, context precision, and latency gates with measurable headroom.';
    if (!passesRecall) {
      decision = 'Retrieval is too narrow';
      explanation = 'Increase candidate breadth or combine sparse and dense retrieval before spending more tokens on generation.';
    } else if (!passesPrecision) {
      decision = 'The prompt is overloaded';
      explanation = 'Too many chunks dilute the strongest evidence. Tighten final selection instead of forwarding every plausible result.';
    } else if (!passesLatency) {
      decision = 'The path misses the SLA';
      explanation = 'Reduce reranking or context work, or route this query to a faster model tier before adding replicas.';
    }

    return {
      mode,
      recall,
      contextTokens,
      contextPrecision,
      stages,
      totalMs,
      costCents,
      passesRecall,
      passesLatency,
      passesPrecision,
      decision,
      explanation,
    };
  }, [candidateCount, modeId, promptChunks, rerankCount]);

  const healthy = model.passesRecall && model.passesLatency && model.passesPrecision;

  const reset = () => {
    setModeId('hybrid');
    setCandidateCount(80);
    setRerankCount(20);
    setPromptChunks(6);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Retrieval budget lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Spend a three-second answer budget</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Tune retrieval breadth, reranking, and prompt size. More evidence helps only until latency and context noise erase the gain.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[370px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 md:p-6 lg:border-b-0 lg:border-r dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose candidate generation</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {modes.map((mode) => {
                const selected = mode.id === modeId;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setModeId(mode.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{mode.label}</span>
                      {selected ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{mode.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <RangeControl
            label="Candidates retrieved"
            value={candidateCount}
            min={20}
            max={160}
            step={20}
            suffix=""
            lowLabel="Narrow"
            highLabel="Broad"
            onChange={setCandidateCount}
          />
          <RangeControl
            label="Candidates reranked"
            value={rerankCount}
            min={5}
            max={40}
            step={5}
            suffix=""
            lowLabel="Cheap"
            highLabel="Selective"
            onChange={setRerankCount}
          />
          <RangeControl
            label="Chunks sent to the model"
            value={promptChunks}
            min={3}
            max={12}
            step={1}
            suffix=""
            lowLabel="Focused"
            highLabel="Crowded"
            onChange={setPromptChunks}
          />
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric icon={FileSearch} label="Recall@10" value={`${model.recall.toFixed(1)}%`} tone={model.passesRecall ? 'text-emerald-500' : 'text-rose-500'} />
            <Metric icon={Sparkles} label="Context precision" value={`${model.contextPrecision.toFixed(0)}%`} tone={model.passesPrecision ? 'text-violet-500' : 'text-rose-500'} />
            <Metric icon={Clock3} label="Modeled p95" value={`${Math.round(model.totalMs)} ms`} tone={model.passesLatency ? 'text-blue-500' : 'text-rose-500'} />
            <Metric icon={Coins} label="Cost per query" value={`${model.costCents.toFixed(2)}¢`} tone="text-amber-500" />
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Critical-path allocation</p>
                <p className="mt-1 text-xs text-neutral-500">{model.contextTokens.toLocaleString()} prompt tokens from {promptChunks} chunks</p>
              </div>
              <span className={`rounded px-2.5 py-1 text-xs font-bold ${model.passesLatency ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
                {model.passesLatency ? `${Math.round(latencyTargetMs - model.totalMs)} ms headroom` : `${Math.round(model.totalMs - latencyTargetMs)} ms over`}
              </span>
            </div>
            <div className="mt-5 flex h-5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-label={`Modeled latency ${Math.round(model.totalMs)} milliseconds`}>
              {model.stages.map((stage) => (
                <span
                  key={stage.label}
                  title={`${stage.label}: ${Math.round(stage.value)} ms`}
                  className={stage.color}
                  style={{ width: `${Math.max(4, (stage.value / Math.max(latencyTargetMs, model.totalMs)) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {model.stages.map((stage) => (
                <div key={stage.label} className="min-w-0 text-xs text-neutral-600 dark:text-neutral-300">
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${stage.color}`} />
                  {stage.label}
                  <span className="mt-0.5 block pl-3.5 font-semibold tabular-nums text-neutral-950 dark:text-white">{Math.round(stage.value)} ms</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${healthy ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`}>
            <div className="flex items-start gap-3">
              {healthy ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Design verdict</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{model.decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Database aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              <strong>Interview move:</strong> widen candidate generation to improve recall, then spend reranker and prompt capacity only on the strongest evidence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  lowLabel,
  highLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  lowLabel: string;
  highLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-6 block">
      <span className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
        <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{value}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer accent-blue-600"
      />
      <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>{lowLabel}</span><span>{highLabel}</span></span>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className={`h-4 w-4 ${tone}`} />
      <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">{label}</p>
    </div>
  );
}
