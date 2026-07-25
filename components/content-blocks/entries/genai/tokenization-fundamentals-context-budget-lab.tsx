'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Coins,
  FileText,
  Gauge,
  Languages,
  Layers3,
  LoaderCircle,
  Repeat2,
  Scissors,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Strategy = 'truncate' | 'chunk';

type TokenizerProfile = {
  id: string;
  label: string;
  detail: string;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  contentType: string;
  characters: number;
  fixedInputTokens: number;
  minimumChunkTokens: number;
  evidencePosition: number;
  tokenCounts: Record<string, number>;
};

type ContextBudgetModel = {
  title: string;
  description: string;
  disclaimer: string;
  defaults: {
    workloadId: string;
    profileId: string;
    contextWindow: number;
    outputReserve: number;
    strategy: Strategy;
    chunkSize: number;
    overlap: number;
  };
  priceCard: {
    inputPerMillion: number;
    outputPerMillion: number;
    currency: string;
  };
  profiles: TokenizerProfile[];
  workloads: Workload[];
};

const BLOCK_ID = 'genai/tokenization-fundamentals-context-budget-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isContextBudgetModel(value: unknown): value is ContextBudgetModel {
  if (
    !isRecord(value)
    || !isRecord(value.defaults)
    || !isRecord(value.priceCard)
  ) return false;

  return (
    typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.disclaimer === 'string'
    && typeof value.defaults.workloadId === 'string'
    && typeof value.defaults.profileId === 'string'
    && isFiniteNumber(value.defaults.contextWindow)
    && isFiniteNumber(value.defaults.outputReserve)
    && (value.defaults.strategy === 'truncate' || value.defaults.strategy === 'chunk')
    && isFiniteNumber(value.defaults.chunkSize)
    && isFiniteNumber(value.defaults.overlap)
    && isFiniteNumber(value.priceCard.inputPerMillion)
    && isFiniteNumber(value.priceCard.outputPerMillion)
    && typeof value.priceCard.currency === 'string'
    && Array.isArray(value.profiles)
    && value.profiles.length > 0
    && value.profiles.every((profile) => (
      isRecord(profile)
      && typeof profile.id === 'string'
      && typeof profile.label === 'string'
      && typeof profile.detail === 'string'
    ))
    && Array.isArray(value.workloads)
    && value.workloads.length > 0
    && value.workloads.every((workload) => (
      isRecord(workload)
      && typeof workload.id === 'string'
      && typeof workload.label === 'string'
      && typeof workload.detail === 'string'
      && typeof workload.contentType === 'string'
      && isFiniteNumber(workload.characters)
      && isFiniteNumber(workload.fixedInputTokens)
      && isFiniteNumber(workload.minimumChunkTokens)
      && isFiniteNumber(workload.evidencePosition)
      && isRecord(workload.tokenCounts)
      && Object.values(workload.tokenCounts).every(isFiniteNumber)
    ))
  );
}

export default function TokenizationFundamentalsContextBudgetLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ContextBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No context-budget fixture was supplied.');
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
        if (!isContextBudgetModel(payload)) {
          throw new Error('Context-budget fixture data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load budget data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <ContextBudgetLab data={data} /> : <LoadState />}
    </div>
  );
}

function ContextBudgetLab({ data }: { data: ContextBudgetModel }) {
  const initialWorkload = data.workloads.find(
    (workload) => workload.id === data.defaults.workloadId,
  ) ?? data.workloads[0];
  const initialProfile = data.profiles.find(
    (profile) => profile.id === data.defaults.profileId,
  ) ?? data.profiles[0];

  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [contextWindow, setContextWindow] = useState(data.defaults.contextWindow);
  const [outputReserve, setOutputReserve] = useState(data.defaults.outputReserve);
  const [strategy, setStrategy] = useState<Strategy>(data.defaults.strategy);
  const [chunkSize, setChunkSize] = useState(data.defaults.chunkSize);
  const [overlap, setOverlap] = useState(data.defaults.overlap);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const documentTokens = workload.tokenCounts[profile.id] ?? 0;

  const result = useMemo(() => {
    const protectedTokens = workload.fixedInputTokens + outputReserve;
    const capacityValid = protectedTokens <= contextWindow;
    const availableContent = Math.max(0, contextWindow - protectedTokens);
    const effectiveChunk = Math.min(chunkSize, availableContent);

    let requests = 1;
    let retainedTokens = Math.min(documentTokens, availableContent);
    let duplicatedTokens = 0;
    let billedDocumentTokens = retainedTokens;
    let evidenceRetained = retainedTokens / Math.max(1, documentTokens) >= workload.evidencePosition;
    let chunkValid = true;

    if (strategy === 'chunk') {
      chunkValid = capacityValid
        && effectiveChunk >= workload.minimumChunkTokens
        && effectiveChunk > overlap;
      if (chunkValid) {
        const stride = effectiveChunk - overlap;
        requests = documentTokens <= effectiveChunk
          ? 1
          : Math.ceil((documentTokens - effectiveChunk) / stride) + 1;
        duplicatedTokens = Math.min(
          overlap * Math.max(0, requests - 1),
          effectiveChunk * requests - documentTokens,
        );
        billedDocumentTokens = documentTokens + duplicatedTokens;
        retainedTokens = documentTokens;
        evidenceRetained = true;
      } else {
        requests = 0;
        retainedTokens = 0;
        billedDocumentTokens = 0;
        evidenceRetained = false;
      }
    }

    if (!capacityValid) {
      requests = 0;
      retainedTokens = 0;
      billedDocumentTokens = 0;
      evidenceRetained = false;
    }

    const billedInputTokens = requests * workload.fixedInputTokens + billedDocumentTokens;
    const billedOutputTokens = requests * outputReserve;
    const estimatedCost = (
      billedInputTokens * data.priceCard.inputPerMillion
      + billedOutputTokens * data.priceCard.outputPerMillion
    ) / 1_000_000;
    const droppedTokens = strategy === 'truncate'
      ? Math.max(0, documentTokens - retainedTokens)
      : 0;
    const requestContentTokens = strategy === 'chunk' ? effectiveChunk : retainedTokens;
    const representativeRequestTokens = capacityValid
      ? workload.fixedInputTokens + requestContentTokens + outputReserve
      : protectedTokens;

    let verdict = 'Fits in one request with the evidence retained';
    let explanation = 'The complete document and output reserve fit inside the selected window.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!capacityValid) {
      verdict = 'Reject: protected tokens exceed the context window';
      explanation = 'Reduce fixed instructions or the output reserve before admitting document content.';
      tone = 'rose';
    } else if (strategy === 'chunk' && !chunkValid) {
      verdict = 'Reject: the usable chunk is below the workload minimum';
      explanation = 'The remaining content allowance is too small or overlap consumes the stride.';
      tone = 'rose';
    } else if (strategy === 'chunk' && requests > 1) {
      verdict = `Chunked into ${requests} bounded requests`;
      explanation = `${duplicatedTokens.toLocaleString()} overlap tokens are processed more than once.`;
      tone = 'amber';
    } else if (!evidenceRetained) {
      verdict = 'Unsafe truncation: the decisive tail evidence is removed';
      explanation = 'The request fits syntactically, but the selected right-truncation policy drops the answer-bearing region.';
      tone = 'rose';
    } else if (droppedTokens > 0) {
      verdict = 'Partial fit: truncation removes non-decisive tail content';
      explanation = 'The marked evidence remains, but omitted content still needs explicit provenance and user-visible metadata.';
      tone = 'amber';
    }

    return {
      availableContent,
      billedInputTokens,
      billedOutputTokens,
      capacityValid,
      droppedTokens,
      duplicatedTokens,
      effectiveChunk,
      estimatedCost,
      evidenceRetained,
      explanation,
      representativeRequestTokens,
      requests,
      retainedTokens,
      tone,
      verdict,
    };
  }, [
    chunkSize,
    contextWindow,
    data.priceCard.inputPerMillion,
    data.priceCard.outputPerMillion,
    documentTokens,
    outputReserve,
    overlap,
    strategy,
    workload,
  ]);

  const reset = () => {
    setWorkloadId(initialWorkload.id);
    setProfileId(initialProfile.id);
    setContextWindow(data.defaults.contextWindow);
    setOutputReserve(data.defaults.outputReserve);
    setStrategy(data.defaults.strategy);
    setChunkSize(data.defaults.chunkSize);
    setOverlap(data.defaults.overlap);
  };

  const maximumProfileTokens = Math.max(
    ...data.profiles.map((item) => workload.tokenCounts[item.id] ?? 0),
    1,
  );

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Context and chunking lab"
        title={data.title}
        description={data.description}
        icon={Gauge}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload
              </legend>
              <div className="mt-3 grid gap-2">
                {data.workloads.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workload.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'arabic-support' ? Languages : FileText}
                    accent="blue"
                    onClick={() => setWorkloadId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Vocabulary profile
              </legend>
              <div className="mt-3 grid gap-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="3. Context window"
              value={contextWindow}
              output={`${contextWindow.toLocaleString()} tokens`}
              min={2048}
              max={8192}
              step={2048}
              accent="blue"
              lowLabel="2K"
              highLabel="8K"
              onChange={setContextWindow}
            />

            <LabRange
              label="4. Output reserve"
              value={outputReserve}
              output={`${outputReserve.toLocaleString()} tokens`}
              min={128}
              max={1024}
              step={128}
              accent="emerald"
              lowLabel="Short answer"
              highLabel="Long answer"
              onChange={setOutputReserve}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                5. Overflow policy
              </legend>
              <div className="mt-3 grid gap-2">
                <LabChoice
                  selected={strategy === 'truncate'}
                  label="Right truncate once"
                  detail="Keep the beginning and explicitly drop the tail."
                  icon={Scissors}
                  accent="rose"
                  onClick={() => setStrategy('truncate')}
                />
                <LabChoice
                  selected={strategy === 'chunk'}
                  label="Process bounded chunks"
                  detail="Keep all content across repeated requests."
                  icon={Repeat2}
                  accent="amber"
                  onClick={() => setStrategy('chunk')}
                />
              </div>
            </fieldset>

            {strategy === 'chunk' ? (
              <>
                <LabRange
                  label="6. Target chunk size"
                  value={chunkSize}
                  output={`${chunkSize.toLocaleString()} tokens`}
                  min={512}
                  max={2048}
                  step={256}
                  accent="amber"
                  lowLabel="More requests"
                  highLabel="More local context"
                  onChange={setChunkSize}
                />
                <LabRange
                  label="7. Chunk overlap"
                  value={overlap}
                  output={`${overlap.toLocaleString()} tokens`}
                  min={0}
                  max={256}
                  step={32}
                  accent="violet"
                  lowLabel="No duplication"
                  highLabel="More boundary context"
                  onChange={setOverlap}
                />
              </>
            ) : null}
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="profile-count-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Fixed fixture
                </p>
                <h4
                  id="profile-count-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Token count changes by vocabulary
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {workload.characters.toLocaleString()} characters · {workload.contentType}
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {data.profiles.map((item) => {
                const count = workload.tokenCounts[item.id] ?? 0;
                const selected = item.id === profile.id;
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className={`font-semibold ${selected ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-600 dark:text-neutral-300'}`}>
                        {item.label}
                      </span>
                      <span className="font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                        {count.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${selected ? 'bg-violet-600 dark:bg-violet-400' : 'bg-neutral-400 dark:bg-neutral-600'}`}
                        style={{ width: `${(count / maximumProfileTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="evidence-retention-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Information policy
                </p>
                <h4
                  id="evidence-retention-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Document coverage
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Decisive evidence at {Math.round(workload.evidencePosition * 100)}%
              </p>
            </div>
            <div className="relative mt-5 h-12 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
              <div
                className={`absolute inset-y-0 left-0 transition-[width] duration-200 motion-reduce:transition-none ${
                  result.evidenceRetained
                    ? 'bg-emerald-400/70 dark:bg-emerald-500/40'
                    : 'bg-rose-400/70 dark:bg-rose-500/40'
                }`}
                style={{
                  width: `${Math.min(100, result.retainedTokens / Math.max(1, documentTokens) * 100)}%`,
                }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                style={{ left: `${workload.evidencePosition * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between gap-3 px-3 text-xs font-semibold text-neutral-950 dark:text-white">
                <span>{result.retainedTokens.toLocaleString()} retained</span>
                <span>{result.droppedTokens.toLocaleString()} dropped</span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The vertical marker locates the answer-bearing region in the original document.
              Chunking retains the full document only when every request has a usable payload.
            </p>
          </section>

          <section aria-labelledby="request-envelope-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Representative request
                </p>
                <h4
                  id="request-envelope-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Context allocation
                </h4>
              </div>
              <p className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {result.representativeRequestTokens.toLocaleString()} / {contextWindow.toLocaleString()}
              </p>
            </div>
            <div
              className="mt-4 flex h-10 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
              role="img"
              aria-label={`Representative request uses ${result.representativeRequestTokens} of ${contextWindow} tokens`}
            >
              <BudgetSegment
                label="Fixed"
                value={workload.fixedInputTokens}
                total={contextWindow}
                className="bg-blue-500 text-white dark:bg-blue-500"
              />
              <BudgetSegment
                label={strategy === 'chunk' ? 'Chunk' : 'Content'}
                value={strategy === 'chunk' ? result.effectiveChunk : result.retainedTokens}
                total={contextWindow}
                className="bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950"
              />
              <BudgetSegment
                label="Output"
                value={outputReserve}
                total={contextWindow}
                className="bg-emerald-500 text-emerald-950 dark:bg-emerald-500 dark:text-emerald-950"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              <LegendSwatch className="bg-blue-500" label={`Fixed ${workload.fixedInputTokens}`} />
              <LegendSwatch
                className="bg-amber-400 dark:bg-amber-500"
                label={`${strategy === 'chunk' ? 'Chunk' : 'Content'} ${(strategy === 'chunk' ? result.effectiveChunk : result.retainedTokens).toLocaleString()}`}
              />
              <LegendSwatch className="bg-emerald-500" label={`Output ${outputReserve}`} />
              <span>
                Allowance {result.availableContent.toLocaleString()}
              </span>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Document tokens"
              value={documentTokens.toLocaleString()}
              detail={`${(workload.characters / Math.max(1, documentTokens)).toFixed(2)} characters per token`}
              icon={FileText}
              tone="violet"
            />
            <LabMetric
              label="Requests"
              value={result.requests.toLocaleString()}
              detail={strategy === 'chunk' ? 'One output reserve per chunk' : 'Single truncated attempt'}
              icon={Repeat2}
              tone={result.requests > 1 ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Repeated input"
              value={result.duplicatedTokens.toLocaleString()}
              detail="Overlap tokens processed more than once"
              icon={Layers3}
              tone={result.duplicatedTokens > 0 ? 'amber' : 'neutral'}
            />
            <LabMetric
              label="Planning cost"
              value={`${data.priceCard.currency} ${result.estimatedCost.toFixed(4)}`}
              detail={`${result.billedInputTokens.toLocaleString()} input + ${result.billedOutputTokens.toLocaleString()} output`}
              icon={Coins}
              tone="emerald"
            />
          </div>

          <div className={`rounded-md border p-4 ${
            result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
          }`}>
            <div className="flex items-start gap-3">
              {result.tone === 'emerald'
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.verdict}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">{result.explanation}</p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {data.disclaimer} Cost uses {data.priceCard.currency} {data.priceCard.inputPerMillion}
            {' '}per million input tokens and {data.priceCard.currency} {data.priceCard.outputPerMillion}
            {' '}per million output tokens.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function BudgetSegment({
  label,
  value,
  total,
  className,
}: {
  label: string;
  value: number;
  total: number;
  className: string;
}) {
  if (value <= 0) return null;
  const width = Math.min(100, value / Math.max(1, total) * 100);
  return (
    <div
      className={`flex min-w-0 items-center justify-center overflow-hidden px-1 text-[10px] font-semibold ${className}`}
      style={{ width: `${width}%` }}
      title={`${label}: ${value.toLocaleString()} tokens`}
    >
      <span className="truncate">{width >= 12 ? label : ''}</span>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function LoadState() {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading context-budget fixtures...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Context-budget lab unavailable</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
