'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Database,
  FileStack,
  Gauge,
  Layers3,
  LoaderCircle,
  Search,
  ShieldCheck,
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

interface Workload {
  id: string;
  label: string;
  detail: string;
  documents: number;
  averageDocumentTokens: number;
}

interface CapacityData {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    chunkSize: number;
    overlapPercent: number;
    embeddingDimensions: number;
    candidatePool: number;
    evidencePassages: number;
    contextBudget: number;
  };
  workloads: Workload[];
  embeddingDimensionOptions: number[];
  guardrails: {
    vectorBytesPerDimension: number;
    maxModeledRerankCandidates: number;
    contextWarningPercent: number;
  };
}

type ResultTone = 'emerald' | 'amber' | 'rose';

const BLOCK_ID = 'genai/rag-architecture-deep-dive';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.guardrails
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.documents === 'number'
        && typeof workload.averageDocumentTokens === 'number'
      ))
      && Array.isArray(candidate.embeddingDimensionOptions)
      && candidate.embeddingDimensionOptions.length > 0,
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: 'compact' }).format(value);
}

function formatGiB(value: number) {
  if (value < 0.1) return `${(value * 1024).toFixed(0)} MiB`;
  if (value < 100) return `${value.toFixed(1)} GiB`;
  return `${formatCount(value)} GiB`;
}

export default function RagArchitectureCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityData }) {
  const initialWorkload = data.workloads.find((item) => item.id === data.defaults.workloadId)
    ?? data.workloads[0];
  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [chunkSize, setChunkSize] = useState(data.defaults.chunkSize);
  const [overlapPercent, setOverlapPercent] = useState(data.defaults.overlapPercent);
  const [embeddingDimensions, setEmbeddingDimensions] = useState(data.defaults.embeddingDimensions);
  const [candidatePool, setCandidatePool] = useState(data.defaults.candidatePool);
  const [evidencePassages, setEvidencePassages] = useState(data.defaults.evidencePassages);
  const [contextBudget, setContextBudget] = useState(data.defaults.contextBudget);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const model = useMemo(() => {
    const overlapTokens = Math.round(chunkSize * overlapPercent / 100);
    const stride = Math.max(1, chunkSize - overlapTokens);
    const chunksPerDocument = workload.averageDocumentTokens <= chunkSize
      ? 1
      : 1 + Math.ceil((workload.averageDocumentTokens - chunkSize) / stride);
    const totalChunks = workload.documents * chunksPerDocument;
    const vectorBytes = totalChunks * embeddingDimensions * data.guardrails.vectorBytesPerDimension;
    const rawVectorGiB = vectorBytes / 1024 ** 3;
    const evidenceTokens = evidencePassages * chunkSize;
    const contextUsePercent = Math.round(evidenceTokens / contextBudget * 100);
    const candidateAmplification = candidatePool / Math.max(1, evidencePassages);
    const evidenceFitsCandidates = evidencePassages <= candidatePool;
    const contextFits = evidenceTokens <= contextBudget;
    const contextTight = contextUsePercent >= data.guardrails.contextWarningPercent;
    const rerankPressure = candidatePool > data.guardrails.maxModeledRerankCandidates;

    let title = 'The envelope has healthy headroom';
    let detail = 'The evidence packet fits, and the modeled reranker stays inside its candidate ceiling.';
    let tone: ResultTone = 'emerald';

    if (!evidenceFitsCandidates) {
      title = 'The evidence request exceeds the candidate pool';
      detail = 'Initial retrieval cannot select more passages than it returns. Increase candidates or reduce final evidence.';
      tone = 'rose';
    } else if (!contextFits) {
      title = 'Retrieved evidence overfills the context budget';
      detail = 'The model would have no room for instructions and the answer. Reduce passages or chunk size, or reserve a larger evidence budget.';
      tone = 'rose';
    } else if (rerankPressure) {
      title = 'The reranking stage is under pressure';
      detail = `The lab ceiling is ${data.guardrails.maxModeledRerankCandidates} candidates. Measure latency and cost before increasing this pool.`;
      tone = 'amber';
    } else if (contextTight) {
      title = 'The context budget is too tight for safe assembly';
      detail = `Evidence consumes ${contextUsePercent}% of the budget before instructions, citations, or answer tokens are added.`;
      tone = 'amber';
    }

    return {
      candidateAmplification,
      chunksPerDocument,
      contextFits,
      contextTight,
      contextUsePercent,
      detail,
      evidenceFitsCandidates,
      evidenceTokens,
      overlapTokens,
      rawVectorGiB,
      rerankPressure,
      stride,
      title,
      tone,
      totalChunks,
    };
  }, [
    candidatePool,
    chunkSize,
    contextBudget,
    data.guardrails,
    embeddingDimensions,
    evidencePassages,
    overlapPercent,
    workload,
  ]);

  const reset = () => {
    setWorkloadId(initialWorkload.id);
    setChunkSize(data.defaults.chunkSize);
    setOverlapPercent(data.defaults.overlapPercent);
    setEmbeddingDimensions(data.defaults.embeddingDimensions);
    setCandidatePool(data.defaults.candidatePool);
    setEvidencePassages(data.defaults.evidencePassages);
    setContextBudget(data.defaults.contextBudget);
  };

  const verdictStyle: Record<ResultTone, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and context lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Corpus shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={workload.id === item.id}
                      label={item.label}
                      detail={`${item.documents.toLocaleString()} documents · ${item.averageDocumentTokens.toLocaleString()} tokens each`}
                      icon={item.id === 'support' ? FileStack : item.id === 'engineering' ? Boxes : Database}
                      accent={item.id === 'support' ? 'cyan' : item.id === 'engineering' ? 'violet' : 'amber'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Chunk size"
                  value={chunkSize}
                  output={`${chunkSize} tokens`}
                  min={256}
                  max={1024}
                  step={128}
                  accent="cyan"
                  lowLabel="256"
                  highLabel="1,024"
                  onChange={setChunkSize}
                />
                <LabRange
                  label="Chunk overlap"
                  value={overlapPercent}
                  output={`${overlapPercent}%`}
                  min={0}
                  max={40}
                  step={5}
                  accent="violet"
                  lowLabel="None"
                  highLabel="40%"
                  onChange={setOverlapPercent}
                />
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Embedding dimensions
                  </span>
                  <select
                    value={embeddingDimensions}
                    onChange={(event) => setEmbeddingDimensions(Number(event.target.value))}
                    className="mt-3 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {data.embeddingDimensionOptions.map((value) => (
                      <option key={value} value={value}>{value.toLocaleString()} dimensions</option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="space-y-6">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Query envelope
                </legend>
                <LabRange
                  label="Candidate pool"
                  value={candidatePool}
                  output={`${candidatePool} chunks`}
                  min={10}
                  max={100}
                  step={10}
                  accent="blue"
                  lowLabel="10"
                  highLabel="100"
                  onChange={setCandidatePool}
                />
                <LabRange
                  label="Final evidence"
                  value={evidencePassages}
                  output={`${evidencePassages} passages`}
                  min={2}
                  max={12}
                  step={1}
                  accent="emerald"
                  lowLabel="2"
                  highLabel="12"
                  onChange={setEvidencePassages}
                />
                <LabRange
                  label="Evidence token budget"
                  value={contextBudget}
                  output={`${contextBudget.toLocaleString()} tokens`}
                  min={2048}
                  max={16384}
                  step={1024}
                  accent="amber"
                  lowLabel="2K"
                  highLabel="16K"
                  onChange={setContextBudget}
                />
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Index chunks"
                value={formatCount(model.totalChunks)}
                detail={`${model.chunksPerDocument} chunks per average document`}
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Raw vectors"
                value={formatGiB(model.rawVectorGiB)}
                detail="Float32 values only; excludes index and replicas"
                icon={Database}
                tone="violet"
              />
              <LabMetric
                label="Evidence budget"
                value={`${model.contextUsePercent}%`}
                detail={`${model.evidenceTokens.toLocaleString()} of ${contextBudget.toLocaleString()} tokens`}
                icon={Gauge}
                tone={!model.contextFits ? 'rose' : model.contextTight ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Candidate funnel"
                value={`${model.candidateAmplification.toFixed(1)}×`}
                detail={`${candidatePool} retrieved → ${evidencePassages} selected`}
                icon={Search}
                tone={model.rerankPressure ? 'amber' : 'cyan'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Offline index shape
              </p>
              <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                Overlap trades boundary coverage for more index work
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <EnvelopeFact label="Chunk window" value={`${chunkSize} tokens`} detail={`${model.overlapTokens} repeated`} />
                <EnvelopeFact label="Effective stride" value={`${model.stride} tokens`} detail="New text per chunk" />
                <EnvelopeFact label="Average expansion" value={`${model.chunksPerDocument}×`} detail="Chunks per document" />
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Online evidence funnel
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Retrieval may be broad; the prompt must stay selective
                </h4>
              </div>
              <ol className="grid gap-0 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <FunnelStage label="Retrieve" value={`${candidatePool} candidates`} detail="Optimize candidate recall" icon={Search} />
                <FlowArrow />
                <FunnelStage label="Rerank" value={`${evidencePassages} passages`} detail="Select distinct evidence" icon={ShieldCheck} />
                <FlowArrow />
                <FunnelStage label="Assemble" value={`${model.evidenceTokens.toLocaleString()} tokens`} detail="Preserve answer headroom" icon={Layers3} />
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${verdictStyle[model.tone]}`}>
              <div className="flex items-start gap-3">
                {model.tone === 'emerald'
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="font-semibold">{model.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{model.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EnvelopeFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function FunnelStage({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Search;
}) {
  return (
    <li className="min-w-0 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </li>
  );
}

function FlowArrow() {
  return (
    <li aria-hidden="true" className="flex items-center justify-center border-y border-neutral-200 py-2 md:border-x md:border-y-0 md:px-2 md:py-0 dark:border-neutral-800">
      <ArrowRight className="h-4 w-4 rotate-90 text-neutral-400 md:rotate-0" />
    </li>
  );
}

function LabLoading() {
  return (
    <div className="my-7 flex min-h-52 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
      Loading the RAG capacity model…
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div className="my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The RAG capacity model could not load</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
