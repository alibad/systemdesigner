'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  Braces,
  CheckCircle2,
  Gauge,
  GitMerge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type CorpusWord = {
  text: string;
  count: number;
};

type CorpusFixture = {
  id: string;
  label: string;
  detail: string;
  decisionPrompt: string;
  words: CorpusWord[];
};

type MergeTrainingModel = {
  blockId: string;
  title: string;
  description: string;
  minimumPairFrequency: number;
  defaults: {
    corpusId: string;
    mergeBudget: number;
  };
  mergeBudget: {
    minimum: number;
    maximum: number;
  };
  corpora: CorpusFixture[];
};

type WordState = {
  text: string;
  count: number;
  symbols: string[];
};

type MergeStep = {
  pair: [string, string];
  merged: string;
  frequency: number;
  weightedTokens: number;
};

const BLOCK_ID = 'genai/bpe-algorithm-merge-training-lab';
const END_OF_WORD = '</w>';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTrainingModel(value: unknown): value is MergeTrainingModel {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MergeTrainingModel>;
  return Boolean(
    data.blockId === BLOCK_ID
      && typeof data.title === 'string'
      && typeof data.description === 'string'
      && isFiniteNumber(data.minimumPairFrequency)
      && typeof data.defaults?.corpusId === 'string'
      && isFiniteNumber(data.defaults?.mergeBudget)
      && isFiniteNumber(data.mergeBudget?.minimum)
      && isFiniteNumber(data.mergeBudget?.maximum)
      && Array.isArray(data.corpora)
      && data.corpora.length >= 2
      && data.corpora.every((corpus) => (
        typeof corpus.id === 'string'
          && typeof corpus.label === 'string'
          && typeof corpus.detail === 'string'
          && typeof corpus.decisionPrompt === 'string'
          && Array.isArray(corpus.words)
          && corpus.words.length >= 3
          && corpus.words.every((word) => (
            typeof word.text === 'string'
              && word.text.length > 0
              && isFiniteNumber(word.count)
              && word.count > 0
          ))
      )),
  );
}

function mergeSymbols(symbols: string[], pair: [string, string]) {
  const next: string[] = [];
  for (let index = 0; index < symbols.length;) {
    if (symbols[index] === pair[0] && symbols[index + 1] === pair[1]) {
      next.push(pair[0] + pair[1]);
      index += 2;
    } else {
      next.push(symbols[index]);
      index += 1;
    }
  }
  return next;
}

function runTraining(corpus: CorpusFixture, mergeBudget: number, minimumFrequency: number) {
  const initialWords: WordState[] = corpus.words.map((word) => ({
    ...word,
    symbols: [...word.text, END_OF_WORD],
  }));
  const initialWeightedTokens = initialWords.reduce(
    (total, word) => total + word.count * word.symbols.length,
    0,
  );
  const vocabulary = new Set(initialWords.flatMap((word) => word.symbols));
  let words = initialWords;
  const steps: MergeStep[] = [];

  for (let step = 0; step < mergeBudget; step += 1) {
    const counts = new Map<string, { pair: [string, string]; frequency: number }>();
    words.forEach((word) => {
      for (let index = 0; index < word.symbols.length - 1; index += 1) {
        const pair: [string, string] = [word.symbols[index], word.symbols[index + 1]];
        const key = JSON.stringify(pair);
        const current = counts.get(key) ?? { pair, frequency: 0 };
        current.frequency += word.count;
        counts.set(key, current);
      }
    });

    const winner = [...counts.entries()]
      .sort((left, right) => (
        right[1].frequency - left[1].frequency || left[0].localeCompare(right[0])
      ))[0]?.[1];
    if (!winner || winner.frequency < minimumFrequency) break;

    const merged = winner.pair[0] + winner.pair[1];
    words = words.map((word) => ({
      ...word,
      symbols: mergeSymbols(word.symbols, winner.pair),
    }));
    vocabulary.add(merged);
    steps.push({
      pair: winner.pair,
      merged,
      frequency: winner.frequency,
      weightedTokens: words.reduce(
        (total, word) => total + word.count * word.symbols.length,
        0,
      ),
    });
  }

  const finalWeightedTokens = words.reduce(
    (total, word) => total + word.count * word.symbols.length,
    0,
  );
  return {
    finalWeightedTokens,
    initialWeightedTokens,
    steps,
    vocabularySize: vocabulary.size,
    words,
  };
}

export default function BpeAlgorithmMergeTrainingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MergeTrainingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No merge-training model was supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTrainingModel(payload)) throw new Error('The merge-training model is incomplete.');
        setData(payload);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the training lab.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LoadState status="error" detail={loadError} />;
  if (!data) return <LoadState status="loading" detail="Loading weighted corpus evidence..." />;
  return <TrainingLab data={data} />;
}

function TrainingLab({ data }: { data: MergeTrainingModel }) {
  const [corpusId, setCorpusId] = useState(data.defaults.corpusId);
  const [mergeBudget, setMergeBudget] = useState(data.defaults.mergeBudget);
  const corpus = data.corpora.find((item) => item.id === corpusId) ?? data.corpora[0];
  const result = useMemo(
    () => runTraining(corpus, mergeBudget, data.minimumPairFrequency),
    [corpus, data.minimumPairFrequency, mergeBudget],
  );
  const compression = result.initialWeightedTokens / Math.max(1, result.finalWeightedTokens);
  const reduction = (
    (result.initialWeightedTokens - result.finalWeightedTokens)
    / result.initialWeightedTokens
    * 100
  );
  const lastFrequency = result.steps.at(-1)?.frequency ?? 0;
  const evidenceTone = lastFrequency >= 5 ? 'emerald' : lastFrequency >= 3 ? 'amber' : 'neutral';

  function reset() {
    setCorpusId(data.defaults.corpusId);
    setMergeBudget(data.defaults.mergeBudget);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Merge training lab"
          title={data.title}
          description={data.description}
          icon={GitMerge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Training slice
                </legend>
                <div className="mt-3 space-y-2">
                  {data.corpora.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === corpus.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'identifiers' ? Braces : Binary}
                      accent={item.id === 'support' ? 'amber' : item.id === 'identifiers' ? 'cyan' : 'violet'}
                      onClick={() => setCorpusId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Merge budget"
                value={mergeBudget}
                output={`${mergeBudget} steps`}
                min={data.mergeBudget.minimum}
                max={data.mergeBudget.maximum}
                accent="violet"
                lowLabel="base symbols"
                highLabel="more specific pieces"
                onChange={setMergeBudget}
              />
              <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                <p className="font-semibold text-neutral-950 dark:text-white">Decision lens</p>
                <p className="mt-1">{corpus.decisionPrompt}</p>
              </div>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Learned merges"
              value={`${result.steps.length}`}
              detail={`${mergeBudget - result.steps.length} unused budget`}
              icon={Layers3}
              tone="violet"
            />
            <LabMetric
              label="Weighted tokens"
              value={`${result.finalWeightedTokens}`}
              detail={`from ${result.initialWeightedTokens}`}
              icon={Gauge}
              tone="blue"
            />
            <LabMetric
              label="Compression"
              value={`${compression.toFixed(2)}x`}
              detail={`${reduction.toFixed(1)}% fewer positions`}
              icon={Sparkles}
              tone="emerald"
            />
            <LabMetric
              label="Vocabulary"
              value={`${result.vocabularySize}`}
              detail="base plus learned symbols"
              icon={Binary}
              tone={evidenceTone}
            />
          </div>

          <section className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Learned merge program
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  Frequency is recomputed after every step
                </h4>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                min count {data.minimumPairFrequency}
              </span>
            </div>
            {result.steps.length ? (
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {result.steps.map((step, index) => (
                  <li
                    key={`${step.merged}-${index}`}
                    className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        Rank {index + 1}
                      </span>
                      <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                        count {step.frequency}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                      {displayToken(step.pair[0])} + {displayToken(step.pair[1])} = {displayToken(step.merged)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                Set a merge budget above zero to promote the first repeated pair.
              </div>
            )}
          </section>

          <section className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Current corpus segmentation
            </p>
            <div className="mt-3 space-y-2">
              {result.words.map((word) => (
                <div
                  key={word.text}
                  className="grid gap-2 rounded-md border border-neutral-200 p-3 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center dark:border-neutral-800"
                >
                  <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {word.count}x {word.text}
                  </span>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {word.symbols.map((symbol, index) => (
                      <span
                        key={`${symbol}-${index}`}
                        className="max-w-full break-all rounded bg-violet-100 px-2 py-1 font-mono text-xs font-semibold text-violet-950 dark:bg-violet-950/70 dark:text-violet-100"
                      >
                        {displayToken(symbol)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              This trace proves compression only for the selected weighted slice. Keep a held-out,
              slice-aware corpus before deciding whether the last merges deserve model capacity.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function displayToken(token: string) {
  return token.replaceAll(END_OF_WORD, '<end>');
}

function LoadState({ status, detail }: { status: 'loading' | 'error'; detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div>
        {status === 'loading' ? (
          <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-violet-500" />
        ) : (
          <RefreshCw aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
        )}
        <p className="mt-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{detail}</p>
      </div>
    </div>
  );
}
