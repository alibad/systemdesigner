'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Gauge,
  HardDrive,
  Layers3,
  MemoryStick,
  Network,
  Scale,
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

type Strategy = {
  id: string;
  label: string;
  shortLabel: string;
  kvHeads: number;
  detail: string;
  tradeoff: string;
};

type NumericRange = {
  min: number;
  max: number;
  step: number;
};

type MemoryModel = {
  title: string;
  description: string;
  model: {
    label: string;
    layers: number;
    hiddenDimension: number;
    queryHeads: number;
    headDimension: number;
    bytesPerElement: number;
  };
  defaults: {
    strategyId: string;
    contextTokens: number;
    concurrency: number;
    cacheBudgetGiB: number;
  };
  ranges: {
    contextTokens: NumericRange;
    concurrency: NumericRange;
    cacheBudgetGiB: NumericRange;
  };
  strategies: Strategy[];
};

const BLOCK_ID = 'genai/transformers-inference-memory-lab';
const GIB = 1024 ** 3;

function isMemoryModel(value: unknown): value is MemoryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MemoryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.model
      && candidate.defaults
      && candidate.ranges
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 3,
  );
}

function formatBytes(bytes: number) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes >= 10 * GIB ? 1 : 2)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
}

function formatPairs(pairs: number) {
  if (pairs >= 1e12) return `${(pairs / 1e12).toFixed(2)}T`;
  if (pairs >= 1e9) return `${(pairs / 1e9).toFixed(2)}B`;
  if (pairs >= 1e6) return `${(pairs / 1e6).toFixed(1)}M`;
  return pairs.toLocaleString();
}

export default function TransformersInferenceMemoryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<MemoryModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No inference-memory model was supplied.');
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
        if (!isMemoryModel(payload)) throw new Error('Inference-memory data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load memory data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <MemoryLab data={data} /> : <LoadState />}
    </div>
  );
}

function MemoryLab({ data }: { data: MemoryModel }) {
  const [strategyId, setStrategyId] = useState(data.defaults.strategyId);
  const [contextTokens, setContextTokens] = useState(data.defaults.contextTokens);
  const [concurrency, setConcurrency] = useState(data.defaults.concurrency);
  const [cacheBudgetGiB, setCacheBudgetGiB] = useState(data.defaults.cacheBudgetGiB);

  const result = useMemo(() => {
    const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
    const bytesPerSequence = 2
      * data.model.layers
      * contextTokens
      * strategy.kvHeads
      * data.model.headDimension
      * data.model.bytesPerElement;
    const totalBytes = bytesPerSequence * concurrency;
    const budgetBytes = cacheBudgetGiB * GIB;
    const budgetPercent = (totalBytes / budgetBytes) * 100;
    const maxConcurrency = Math.floor(budgetBytes / bytesPerSequence);
    const comparisons = data.strategies.map((item) => {
      const bytes = 2
        * data.model.layers
        * contextTokens
        * item.kvHeads
        * data.model.headDimension
        * data.model.bytesPerElement
        * concurrency;
      return { ...item, bytes, percent: (bytes / budgetBytes) * 100 };
    });
    const ready = totalBytes <= budgetBytes;
    const warning = ready && budgetPercent >= 80;
    const verdict = !ready
      ? `Over budget by ${formatBytes(totalBytes - budgetBytes)}`
      : warning
        ? 'Fits with little cache headroom'
        : 'Fits inside the declared cache budget';

    return {
      attentionPairs: contextTokens ** 2 * data.model.queryHeads,
      budgetBytes,
      budgetPercent,
      bytesPerSequence,
      comparisons,
      maxConcurrency,
      ready,
      strategy,
      totalBytes,
      verdict,
      warning,
    };
  }, [cacheBudgetGiB, concurrency, contextTokens, data, strategyId]);

  const reset = () => {
    setStrategyId(data.defaults.strategyId);
    setContextTokens(data.defaults.contextTokens);
    setConcurrency(data.defaults.concurrency);
    setCacheBudgetGiB(data.defaults.cacheBudgetGiB);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Inference capacity lab"
        title={data.title}
        description={data.description}
        icon={MemoryStick}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the KV architecture
              </legend>
              <div className="mt-3 space-y-2">
                {data.strategies.map((strategy) => (
                  <LabChoice
                    key={strategy.id}
                    selected={strategy.id === result.strategy.id}
                    label={`${strategy.shortLabel}: ${strategy.kvHeads} KV ${strategy.kvHeads === 1 ? 'head' : 'heads'}`}
                    detail={strategy.detail}
                    icon={strategy.id === 'mha' ? Network : strategy.id === 'gqa' ? Boxes : Layers3}
                    accent={strategy.id === 'mha' ? 'blue' : strategy.id === 'gqa' ? 'violet' : 'emerald'}
                    onClick={() => setStrategyId(strategy.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Cached context"
              value={contextTokens}
              output={`${contextTokens.toLocaleString()} tokens`}
              min={data.ranges.contextTokens.min}
              max={data.ranges.contextTokens.max}
              step={data.ranges.contextTokens.step}
              accent="violet"
              lowLabel="Short prompt"
              highLabel="Long prompt"
              onChange={setContextTokens}
            />
            <LabRange
              label="Active sequences"
              value={concurrency}
              output={`${concurrency} sequences`}
              min={data.ranges.concurrency.min}
              max={data.ranges.concurrency.max}
              step={data.ranges.concurrency.step}
              accent="blue"
              lowLabel="Single request"
              highLabel="High concurrency"
              onChange={setConcurrency}
            />
            <LabRange
              label="Cache memory budget"
              value={cacheBudgetGiB}
              output={`${cacheBudgetGiB} GiB`}
              min={data.ranges.cacheBudgetGiB.min}
              max={data.ranges.cacheBudgetGiB.max}
              step={data.ranges.cacheBudgetGiB.step}
              accent="amber"
              lowLabel="Tight partition"
              highLabel="Large partition"
              onChange={setCacheBudgetGiB}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="KV per sequence"
            value={formatBytes(result.bytesPerSequence)}
            detail={`${data.model.layers} layers at ${contextTokens.toLocaleString()} cached tokens.`}
            icon={HardDrive}
            tone="violet"
          />
          <LabMetric
            label="KV for active batch"
            value={formatBytes(result.totalBytes)}
            detail={`${result.budgetPercent.toFixed(1)}% of the declared budget.`}
            icon={MemoryStick}
            tone={!result.ready ? 'rose' : result.warning ? 'amber' : 'emerald'}
          />
          <LabMetric
            label="Cache-limited capacity"
            value={`${result.maxConcurrency} seq`}
            detail="Before allocator, page, and runtime overhead."
            icon={Gauge}
            tone={result.maxConcurrency >= concurrency ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Prefill score pairs"
            value={formatPairs(result.attentionPairs)}
            detail="Full-attention pairs across all query heads; not allocated bytes."
            icon={Scale}
            tone="blue"
          />
        </div>

        <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Same workload, different KV-head contracts
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                {concurrency} sequences x {contextTokens.toLocaleString()} cached tokens
              </h4>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Budget: {formatBytes(result.budgetBytes)}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {result.comparisons.map((item) => {
              const selected = item.id === result.strategy.id;
              const fits = item.bytes <= result.budgetBytes;
              return (
                <div key={item.id} className={`rounded-md border p-3 ${
                  selected
                    ? 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/35'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                }`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-neutral-950 dark:text-white">{item.shortLabel}</span>
                      {selected ? (
                        <span className="rounded-sm bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-violet-900 dark:bg-violet-900 dark:text-violet-100">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <span className={`shrink-0 font-semibold tabular-nums ${fits ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      {formatBytes(item.bytes)}
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${item.shortLabel} uses ${item.percent.toFixed(1)} percent of cache budget`}>
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${fits ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, item.percent)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    {item.kvHeads} KV {item.kvHeads === 1 ? 'head' : 'heads'}; {item.percent.toFixed(1)}% of budget.
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div
          className={`mt-5 rounded-md border p-4 ${
            !result.ready
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
              : result.warning
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            {result.ready && !result.warning ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">{result.verdict}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{result.strategy.tradeoff}</p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState() {
  return (
    <div className="my-7 min-h-56 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading inference memory lab" />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
      <p className="font-semibold">Inference memory lab unavailable</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
