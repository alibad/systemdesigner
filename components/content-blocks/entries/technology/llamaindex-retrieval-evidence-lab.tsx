'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Blend,
  Check,
  CheckCircle2,
  CircleAlert,
  Filter,
  Gauge,
  Layers3,
  ListFilter,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StrategyFit = { coveragePct: number; noisePct: number; reason: string };
type QueryShape = {
  id: string;
  label: string;
  detail: string;
  signal: string;
  needsMetadataFilter: boolean;
  fits: Record<string, StrategyFit>;
};
type Strategy = {
  id: string;
  label: string;
  detail: string;
  baseLatencyMs: number;
  supportsMetadataFilter: boolean;
};
type RetrievalEvidenceData = {
  title: string;
  description: string;
  defaults: { queryId: string; strategyId: string; topK: number; rerank: boolean };
  bounds: { topK: { min: number; max: number; step: number } };
  averageChunkTokens: number;
  queries: QueryShape[];
  strategies: Strategy[];
};

const BLOCK_ID = 'technology/llamaindex-retrieval-evidence-lab';

function isFit(value: unknown): value is StrategyFit {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StrategyFit>;
  return typeof candidate.coveragePct === 'number'
    && typeof candidate.noisePct === 'number'
    && typeof candidate.reason === 'string';
}

function isRetrievalData(value: unknown): value is RetrievalEvidenceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetrievalEvidenceData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.queryId
      && candidate.defaults.strategyId
      && typeof candidate.defaults.topK === 'number'
      && typeof candidate.defaults.rerank === 'boolean'
      && typeof candidate.bounds?.topK.min === 'number'
      && typeof candidate.bounds.topK.max === 'number'
      && typeof candidate.bounds.topK.step === 'number'
      && typeof candidate.averageChunkTokens === 'number'
      && Array.isArray(candidate.queries)
      && candidate.queries.length > 0
      && candidate.queries.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.signal === 'string'
        && typeof item.needsMetadataFilter === 'boolean'
        && item.fits
        && Object.values(item.fits).every(isFit)
      ))
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length > 0
      && candidate.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.baseLatencyMs === 'number'
        && typeof item.supportsMetadataFilter === 'boolean'
      )),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function LlamaIndexRetrievalEvidenceLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RetrievalEvidenceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No retrieval evidence model was supplied.');
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
        if (!isRetrievalData(payload)) throw new Error('The retrieval evidence model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the retrieval lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RetrievalLab data={data} />;
}

function RetrievalLab({ data }: { data: RetrievalEvidenceData }) {
  const [queryId, setQueryId] = useState(data.defaults.queryId);
  const [strategyId, setStrategyId] = useState(data.defaults.strategyId);
  const [topK, setTopK] = useState(data.defaults.topK);
  const [rerank, setRerank] = useState(data.defaults.rerank);

  const query = data.queries.find((item) => item.id === queryId) ?? data.queries[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
  const fit = query.fits[strategy.id] ?? Object.values(query.fits)[0];

  const result = useMemo(() => {
    const candidateDelta = topK - data.defaults.topK;
    const coveragePct = clamp(fit.coveragePct + candidateDelta * 3, 35, 99);
    const rawNoisePct = clamp(fit.noisePct + candidateDelta * 4, 4, 78);
    const noisePct = clamp(rawNoisePct - (rerank ? 18 : 0), 3, 78);
    const keptNodes = rerank ? Math.min(4, topK) : topK;
    const contextTokens = keptNodes * data.averageChunkTokens;
    const latencyMs = strategy.baseLatencyMs + topK * 4 + (rerank ? 95 : 0);
    const filterMismatch = query.needsMetadataFilter && !strategy.supportsMetadataFilter;
    const evidenceReady = coveragePct >= 82 && noisePct <= 30 && !filterMismatch;
    const status = filterMismatch
      ? 'Eligibility leak'
      : coveragePct < 82
        ? 'Missing evidence'
        : noisePct > 30
          ? 'Noisy context'
          : 'Evidence ready';
    const verdict = filterMismatch
      ? 'The query contains a structured eligibility rule, but this path ranks candidates without enforcing it. Old or out-of-scope sources can reach synthesis.'
      : coveragePct < 82
        ? 'The candidate set is too narrow for this query shape. Increase breadth or choose a retrieval signal that can find the missing source.'
        : noisePct > 30
          ? 'The expected source is present, but too many distractors remain. Filter, fuse, rerank, or lower the synthesis set after measuring recall.'
          : 'The modeled evidence set covers the query with bounded noise. Inspect source identities and scores before allowing response synthesis.';

    return {
      contextTokens,
      coveragePct,
      evidenceReady,
      filterMismatch,
      keptNodes,
      latencyMs,
      noisePct,
      status,
      verdict,
    };
  }, [data.averageChunkTokens, data.defaults.topK, fit, query.needsMetadataFilter, rerank, strategy, topK]);

  function reset() {
    setQueryId(data.defaults.queryId);
    setStrategyId(data.defaults.strategyId);
    setTopK(data.defaults.topK);
    setRerank(data.defaults.rerank);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retrieval evidence lab"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Query shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.queries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === query.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.needsMetadataFilter ? Filter : Search}
                      accent="cyan"
                      onClick={() => setQueryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate strategy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'hybrid' ? Blend : item.id === 'metadata-filtered' ? ListFilter : Sparkles}
                      accent={item.id === 'metadata-filtered' ? 'emerald' : item.id === 'hybrid' ? 'violet' : 'blue'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Candidate count"
                value={topK}
                output={`top ${topK}`}
                {...data.bounds.topK}
                accent="blue"
                lowLabel="Narrow and cheap"
                highLabel="Broad and noisy"
                onChange={setTopK}
              />

              <button
                type="button"
                role="switch"
                aria-checked={rerank}
                onClick={() => setRerank((value) => !value)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${rerank
                  ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-800 dark:bg-cyan-950/35 dark:text-cyan-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${rerank ? 'bg-cyan-600 text-white' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                  {rerank ? <Check aria-hidden="true" className="h-4 w-4" /> : <Layers3 aria-hidden="true" className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Rerank before synthesis</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">Spend extra latency to reduce the candidate set to the strongest evidence.</span>
                </span>
              </button>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Evidence coverage"
                value={`${result.coveragePct}%`}
                detail="Modeled expected-source recall"
                icon={ShieldCheck}
                tone={result.coveragePct >= 82 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Distractor share"
                value={`${result.noisePct}%`}
                detail={`${result.keptNodes} nodes reach synthesis`}
                icon={ListFilter}
                tone={result.noisePct <= 30 ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Context budget"
                value={`${result.contextTokens.toLocaleString()} tokens`}
                detail={`${data.averageChunkTokens} tokens per retained node`}
                icon={Layers3}
                tone="violet"
              />
              <LabMetric
                label="Retrieval latency"
                value={`~${result.latencyMs} ms`}
                detail={rerank ? 'Includes modeled reranker step' : 'Candidate retrieval only'}
                icon={Timer}
                tone="cyan"
              />
            </div>

            <section className={`rounded-md border p-4 ${result.evidenceReady
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.evidenceReady
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
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate evidence rail</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{query.signal}</p>
                </div>
                <span className="w-fit rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {strategy.label}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: topK }, (_, index) => {
                  const relevantCount = Math.round(topK * (100 - result.noisePct) / 100);
                  const retained = index < result.keptNodes;
                  const relevant = index < relevantCount;
                  return (
                    <div
                      key={index}
                      className={`min-w-0 rounded-md border p-2 text-center ${!retained
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-400 opacity-55 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500'
                        : relevant
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100'}`}
                    >
                      <p className="text-xs font-semibold">Node {index + 1}</p>
                      <p className="mt-1 text-[11px] leading-4">{!retained ? 'Reranked out' : relevant ? 'Evidence' : 'Distractor'}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{fit.reason}</p>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <ContractState label="Eligibility" value={result.filterMismatch ? 'Not enforced' : query.needsMetadataFilter ? 'Filtered first' : 'No hard filter'} healthy={!result.filterMismatch} />
              <ContractState label="Candidate set" value={`${topK} retrieved`} healthy={result.coveragePct >= 82} />
              <ContractState label="Synthesis set" value={`${result.keptNodes} retained`} healthy={result.noisePct <= 30} />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ContractState({ label, value, healthy }: { label: string; value: string; healthy: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      {healthy
        ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        : <Gauge aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading retrieval evidence model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100">
      <p className="font-semibold">Retrieval lab unavailable</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
