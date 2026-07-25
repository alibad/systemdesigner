'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  ListFilter,
  LoaderCircle,
  Network,
  ScanSearch,
  SearchX,
  TextCursorInput,
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
type Query = { id: string; label: string; prefix: string; detail: string };
type PrefixData = {
  title: string;
  description: string;
  words: string[];
  defaults: {
    queryId: string;
    dictionaryMultiplier: number;
    resultLimit: number;
  };
  bounds: {
    dictionaryMultiplier: Bound;
    resultLimit: Bound;
  };
  queries: Query[];
};

const BLOCK_ID = 'technology/trie-prefix-trace-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isPrefixData(value: unknown): value is PrefixData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PrefixData>;

  return Boolean(
    candidate.title
      && candidate.description
      && Array.isArray(candidate.words)
      && candidate.words.length >= 5
      && candidate.words.every((item) => typeof item === 'string')
      && candidate.defaults?.queryId
      && typeof candidate.defaults.dictionaryMultiplier === 'number'
      && typeof candidate.defaults.resultLimit === 'number'
      && isBound(candidate.bounds?.dictionaryMultiplier)
      && isBound(candidate.bounds?.resultLimit)
      && Array.isArray(candidate.queries)
      && candidate.queries.length >= 3
      && candidate.queries.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.prefix === 'string'
        && typeof item.detail === 'string'
      )),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export default function TriePrefixTraceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PrefixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No prefix-query model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPrefixData(payload)) throw new Error('The prefix-query model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the prefix lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <PrefixWorkbench data={data} />;
}

function PrefixWorkbench({ data }: { data: PrefixData }) {
  const [queryId, setQueryId] = useState(data.defaults.queryId);
  const [dictionaryMultiplier, setDictionaryMultiplier] = useState(data.defaults.dictionaryMultiplier);
  const [resultLimit, setResultLimit] = useState(data.defaults.resultLimit);
  const query = data.queries.find((item) => item.id === queryId) ?? data.queries[0];

  const result = useMemo(() => {
    const matches = data.words.filter((word) => word.startsWith(query.prefix)).sort();
    const visibleMatches = matches.slice(0, resultLimit);
    const pathFound = matches.length > 0;
    const dictionarySize = data.words.length * dictionaryMultiplier;
    const scaledMatchCount = matches.length * dictionaryMultiplier;
    const attemptedTransitions = pathFound ? query.prefix.length : 1;
    const scanCharacterChecks = dictionarySize * query.prefix.length;
    const uniqueVisitedPrefixes = new Set<string>();

    visibleMatches.forEach((word) => {
      for (let index = query.prefix.length + 1; index <= word.length; index += 1) {
        uniqueVisitedPrefixes.add(word.slice(0, index));
      }
    });

    const trieWork = attemptedTransitions + uniqueVisitedPrefixes.size;
    const avoidedWorkPct = scanCharacterChecks === 0
      ? 0
      : Math.max(0, (1 - trieWork / scanCharacterChecks) * 100);

    return {
      avoidedWorkPct,
      dictionarySize,
      matches,
      pathFound,
      scaledMatchCount,
      scanCharacterChecks,
      trieWork,
      uniqueVisitedPrefixes: uniqueVisitedPrefixes.size,
      visibleMatches,
    };
  }, [data.words, dictionaryMultiplier, query, resultLimit]);

  function reset() {
    setQueryId(data.defaults.queryId);
    setDictionaryMultiplier(data.defaults.dictionaryMultiplier);
    setResultLimit(data.defaults.resultLimit);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Prefix traversal lab"
          title={data.title}
          description={data.description}
          icon={ScanSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Prefix query
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.queries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === query.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'missing-z' ? SearchX : TextCursorInput}
                      accent={item.id === 'missing-z' ? 'rose' : 'cyan'}
                      onClick={() => setQueryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="space-y-6">
                <LabRange
                  label="Dictionary multiplier"
                  value={dictionaryMultiplier}
                  output={`${dictionaryMultiplier}x (${compactNumber(result.dictionarySize)} keys)`}
                  {...data.bounds.dictionaryMultiplier}
                  lowLabel="Sample"
                  highLabel="Large corpus"
                  accent="violet"
                  onChange={setDictionaryMultiplier}
                />
                <LabRange
                  label="Result limit"
                  value={resultLimit}
                  output={`${resultLimit} suggestions`}
                  {...data.bounds.resultLimit}
                  lowLabel="Tight response"
                  highLabel="More expansion"
                  accent="cyan"
                  onChange={setResultLimit}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Prefix transitions"
                value={`${result.pathFound ? query.prefix.length : result.trieWork} hops`}
                detail={result.pathFound ? 'Independent of dictionary size' : 'Stopped at the first missing edge'}
                icon={GitBranch}
                tone={result.pathFound ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Matching keys"
                value={compactNumber(result.scaledMatchCount)}
                detail="Estimated keys below this prefix"
                icon={Network}
                tone={result.scaledMatchCount > 5000 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Expansion work"
                value={`${result.uniqueVisitedPrefixes} nodes`}
                detail={`For the first ${result.visibleMatches.length} sample suggestions`}
                icon={ListFilter}
                tone={result.uniqueVisitedPrefixes > 20 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Scan work avoided"
                value={`${result.avoidedWorkPct.toFixed(1)}%`}
                detail={`Compared with about ${compactNumber(result.scanCharacterChecks)} character checks`}
                icon={CheckCircle2}
                tone={result.pathFound ? 'emerald' : 'blue'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Shared path</p>
              </div>
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-xs font-bold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  root
                </span>
                {query.prefix.split('').map((character, index) => (
                  <div className="contents" key={`${character}-${index}`}>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-base font-bold ${result.pathFound
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100'
                      : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'}`}
                    >
                      {character}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate frontier</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.pathFound ? `Suggestions below "${query.prefix}"` : `No branch starts with "${query.prefix}"`}
                  </h4>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                  limit {resultLimit}
                </span>
              </div>
              {result.visibleMatches.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {result.visibleMatches.map((word) => (
                    <div key={word} className="rounded-md border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-sm font-semibold text-neutral-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-neutral-100">
                      <span className="text-cyan-700 dark:text-cyan-300">{query.prefix}</span>
                      <span>{word.slice(query.prefix.length)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                  <SearchX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    Traversal fails immediately. No unrelated subtree is scanned and no candidate ranking runs.
                  </p>
                </div>
              )}
            </section>

            <section className={`rounded-md border p-5 ${!result.pathFound
              ? 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
              : result.scaledMatchCount > resultLimit * 100
                ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.pathFound && result.scaledMatchCount <= resultLimit * 100
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.pathFound ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`} />}
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    {!result.pathFound
                      ? 'A missing edge is a complete negative answer'
                      : result.scaledMatchCount > resultLimit * 100
                        ? 'The prefix is cheap; the candidate frontier is not'
                        : 'The result budget keeps expansion bounded'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {!result.pathFound
                      ? 'Cost remains tied to the attempted prefix, even as the dictionary grows.'
                      : result.scaledMatchCount > resultLimit * 100
                        ? 'Store top-k summaries or use a ranking frontier so a popular prefix does not enumerate its full subtree.'
                        : 'Traversal and returned output remain predictable under the current limit.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Prefix traversal lab"
          title="Loading the prefix-query model"
          description="The lab validates its dictionary and query scenarios before rendering the path."
          icon={LoaderCircle}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            {error ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" /> : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-600 motion-reduce:animate-none dark:text-cyan-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading prefix data...'}</p>
            {error ? (
              <button type="button" onClick={onRetry} className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900">
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
