'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Check,
  CircleAlert,
  Database,
  FileStack,
  Fingerprint,
  LoaderCircle,
  RotateCcw,
  Scissors,
  Tags,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type DocumentShape = {
  id: string;
  label: string;
  detail: string;
  tokens: number;
  changedFractionPct: number;
  filterDimension: string;
};
type IngestionContractData = {
  title: string;
  description: string;
  defaults: {
    documentId: string;
    chunkSize: number;
    overlap: number;
    stableIds: boolean;
    metadata: boolean;
  };
  bounds: { chunkSize: Bound; overlap: Bound };
  documents: DocumentShape[];
};

const BLOCK_ID = 'technology/llamaindex-ingestion-contract-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isIngestionData(value: unknown): value is IngestionContractData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IngestionContractData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.documentId
      && typeof candidate.defaults.chunkSize === 'number'
      && typeof candidate.defaults.overlap === 'number'
      && typeof candidate.defaults.stableIds === 'boolean'
      && typeof candidate.defaults.metadata === 'boolean'
      && isBound(candidate.bounds?.chunkSize)
      && isBound(candidate.bounds?.overlap)
      && Array.isArray(candidate.documents)
      && candidate.documents.length > 0
      && candidate.documents.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.tokens === 'number'
        && typeof item.changedFractionPct === 'number'
        && typeof item.filterDimension === 'string'
      )),
  );
}

export default function LlamaIndexIngestionContractLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<IngestionContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No ingestion contract model was supplied.');
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
        if (!isIngestionData(payload)) throw new Error('The ingestion contract is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the ingestion lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <IngestionLab data={data} />;
}

function IngestionLab({ data }: { data: IngestionContractData }) {
  const [documentId, setDocumentId] = useState(data.defaults.documentId);
  const [chunkSize, setChunkSize] = useState(data.defaults.chunkSize);
  const [overlap, setOverlap] = useState(data.defaults.overlap);
  const [stableIds, setStableIds] = useState(data.defaults.stableIds);
  const [metadata, setMetadata] = useState(data.defaults.metadata);

  const document = data.documents.find((item) => item.id === documentId) ?? data.documents[0];

  const result = useMemo(() => {
    const boundedOverlap = Math.min(overlap, Math.max(0, chunkSize - 32));
    const stride = Math.max(32, chunkSize - boundedOverlap);
    const chunks = Math.max(1, Math.ceil(Math.max(0, document.tokens - boundedOverlap) / stride));
    const indexedTokens = document.tokens + boundedOverlap * Math.max(0, chunks - 1);
    const changedChunks = stableIds
      ? Math.max(1, Math.ceil(chunks * document.changedFractionPct / 100))
      : chunks;
    const rewritePct = Math.round(changedChunks / chunks * 100);
    const overlapPct = Math.round(boundedOverlap / chunkSize * 100);
    const identityVerdict = stableIds ? 'Incremental update' : 'Full rewrite risk';
    const granularity = chunkSize < 320
      ? 'Fine fragments'
      : chunkSize > 704
        ? 'Broad context'
        : 'Balanced units';
    const warning = overlap >= chunkSize
      ? 'Overlap cannot equal or exceed chunk size. The model caps it so the pipeline can still advance.'
      : overlapPct > 35
        ? 'Heavy overlap repeats a large share of source tokens. Prove that the retrieval gain justifies the extra indexing work.'
        : !stableIds
          ? 'Without stable source identity, an update cannot reliably replace or delete the previous nodes.'
          : !metadata
            ? `The source needs filters for ${document.filterDimension}, but those fields are not attached to each node.`
            : 'The contract supports targeted updates and structured eligibility filters. Retrieval quality still needs evaluation.';

    return {
      boundedOverlap,
      changedChunks,
      chunks,
      granularity,
      identityVerdict,
      indexedTokens,
      overlapPct,
      rewritePct,
      warning,
    };
  }, [chunkSize, document, metadata, overlap, stableIds]);

  function reset() {
    setDocumentId(data.defaults.documentId);
    setChunkSize(data.defaults.chunkSize);
    setOverlap(data.defaults.overlap);
    setStableIds(data.defaults.stableIds);
    setMetadata(data.defaults.metadata);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Ingestion boundary lab"
          title={data.title}
          description={data.description}
          icon={Scissors}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Source shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.documents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === document.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'support-tickets' ? FileStack : Database}
                      accent="violet"
                      onClick={() => setDocumentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Chunk size"
                value={chunkSize}
                output={`${chunkSize} tokens`}
                {...data.bounds.chunkSize}
                accent="blue"
                lowLabel="Precise fragments"
                highLabel="Broad context"
                onChange={setChunkSize}
              />
              <LabRange
                label="Chunk overlap"
                value={overlap}
                output={`${overlap} tokens`}
                {...data.bounds.overlap}
                accent="amber"
                lowLabel="No repetition"
                highLabel="More boundary context"
                onChange={setOverlap}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Update contract
                </legend>
                <div className="mt-3 grid gap-2">
                  <ContractToggle
                    checked={stableIds}
                    label="Stable document IDs"
                    detail="Anchor versions, replacement, deletion, and provenance."
                    icon={Fingerprint}
                    onChange={setStableIds}
                  />
                  <ContractToggle
                    checked={metadata}
                    label="Filterable metadata"
                    detail={`Attach ${document.filterDimension} to every derived node.`}
                    icon={Tags}
                    onChange={setMetadata}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Derived nodes"
                value={result.chunks.toLocaleString()}
                detail={`${document.tokens.toLocaleString()} source tokens`}
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Indexed tokens"
                value={result.indexedTokens.toLocaleString()}
                detail={`${result.overlapPct}% overlap per boundary`}
                icon={RotateCcw}
                tone={result.overlapPct > 35 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Update work"
                value={`${result.changedChunks} nodes`}
                detail={`${result.rewritePct}% of the index segment`}
                icon={Fingerprint}
                tone={stableIds ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Retrieval unit"
                value={result.granularity}
                detail={`${chunkSize - result.boundedOverlap} token stride`}
                icon={Scissors}
                tone="cyan"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.identityVerdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.warning}</p>
                </div>
              </div>
            </section>

            <section aria-label="Ingestion path" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible transformation path</p>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                <PipelineStage number="1" title="Document" detail={`${document.label}: ${document.tokens.toLocaleString()} tokens`} tone="blue" />
                <PipelineStage number="2" title="Transform" detail={`${chunkSize} size / ${result.boundedOverlap} overlap`} tone="violet" />
                <PipelineStage number="3" title="Nodes" detail={`${result.chunks} stable retrieval units`} tone={stableIds ? 'green' : 'rose'} />
                <PipelineStage number="4" title="Index" detail={metadata ? `Filter by ${document.filterDimension}` : 'No structured eligibility filter'} tone={metadata ? 'green' : 'amber'} />
              </ol>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ContractToggle({
  checked,
  label,
  detail,
  icon: Icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  icon: typeof Fingerprint;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${checked
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
        : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${checked ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
        {checked ? <Check aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
      </span>
    </button>
  );
}

function PipelineStage({
  number,
  title,
  detail,
  tone,
}: {
  number: string;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'green' | 'amber' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <li className={`relative min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <span className="text-xs font-semibold uppercase opacity-70">Stage {number}</span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 opacity-80">{detail}</p>
    </li>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading ingestion model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100">
      <p className="font-semibold">Ingestion lab unavailable</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
