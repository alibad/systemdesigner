'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Dice5,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  ShieldQuestion,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Decoding = 'greedy' | 'sample';
type SourceStatus = 'verified' | 'unverified' | 'none';

type ContextScenario = {
  id: string;
  label: string;
  detail: string;
  sourceStatus: SourceStatus;
  sourceLabel: string;
  logits: Record<string, number>;
};

type Candidate = {
  id: string;
  token: string;
  continuation: string;
};

type NextTokenData = {
  title: string;
  description: string;
  prompt: string;
  defaults: {
    contextId: string;
    temperature: number;
    decoding: Decoding;
  };
  contexts: ContextScenario[];
  candidates: Candidate[];
};

const BLOCK_ID = 'genai/llm-intro-next-token-lab';
const SAMPLE_POINTS = [0.08, 0.62, 0.91, 0.31, 0.77, 0.47, 0.96, 0.18];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNextTokenData(value: unknown): value is NextTokenData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NextTokenData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.prompt
      && candidate.defaults
      && isFiniteNumber(candidate.defaults.temperature)
      && (candidate.defaults.decoding === 'greedy' || candidate.defaults.decoding === 'sample')
      && Array.isArray(candidate.contexts)
      && candidate.contexts.length > 0
      && candidate.contexts.every((context) => (
        context.id
        && context.label
        && context.logits
        && Object.values(context.logits).every(isFiniteNumber)
      ))
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0
      && candidate.candidates.every((item) => item.id && item.token && item.continuation),
  );
}

function distributionFor(
  context: ContextScenario,
  candidates: Candidate[],
  temperature: number,
) {
  const scaled = candidates.map((candidate) => ({
    ...candidate,
    score: (context.logits[candidate.id] ?? -10) / temperature,
  }));
  const maximum = Math.max(...scaled.map((candidate) => candidate.score));
  const weighted = scaled.map((candidate) => ({
    ...candidate,
    weight: Math.exp(candidate.score - maximum),
  }));
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  return weighted
    .map((candidate) => ({ ...candidate, probability: candidate.weight / total }))
    .sort((left, right) => right.probability - left.probability);
}

function sampledCandidate<T extends { probability: number }>(items: T[], point: number) {
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.probability;
    if (point <= cumulative) return item;
  }
  return items[items.length - 1];
}

function percent(value: number) {
  if (value >= 0.995) return '99.5%+';
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export default function LlmIntroNextTokenLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<NextTokenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No next-token scenario data was supplied.');
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
        if (!isNextTokenData(payload)) throw new Error('Next-token scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load next-token data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <NextTokenWorkbench data={data} /> : <LoadState />}
    </div>
  );
}

function NextTokenWorkbench({ data }: { data: NextTokenData }) {
  const initialContext = data.contexts.find((item) => item.id === data.defaults.contextId)
    ?? data.contexts[0];
  const [contextId, setContextId] = useState(initialContext.id);
  const [temperature, setTemperature] = useState(data.defaults.temperature);
  const [decoding, setDecoding] = useState<Decoding>(data.defaults.decoding);
  const [drawIndex, setDrawIndex] = useState(0);

  const context = data.contexts.find((item) => item.id === contextId) ?? data.contexts[0];
  const distribution = useMemo(
    () => distributionFor(context, data.candidates, temperature),
    [context, data.candidates, temperature],
  );
  const selected = decoding === 'greedy'
    ? distribution[0]
    : sampledCandidate(distribution, SAMPLE_POINTS[drawIndex % SAMPLE_POINTS.length]);
  const entropy = -distribution.reduce(
    (sum, candidate) => sum + candidate.probability * Math.log2(candidate.probability),
    0,
  );
  const support = outputSupport(context.sourceStatus, selected.id);

  const reset = () => {
    setContextId(initialContext.id);
    setTemperature(data.defaults.temperature);
    setDecoding(data.defaults.decoding);
    setDrawIndex(0);
  };

  const chooseContext = (id: string) => {
    setContextId(id);
    setDrawIndex(0);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Next-token workbench"
        title={data.title}
        description={data.description}
        icon={BrainCircuit}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Retained context
              </legend>
              <div className="mt-3 grid gap-2">
                {data.contexts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === context.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.sourceStatus === 'verified' ? BookOpenCheck : item.sourceStatus === 'unverified' ? ShieldQuestion : MessageSquareText}
                    accent={item.sourceStatus === 'verified' ? 'emerald' : item.sourceStatus === 'unverified' ? 'amber' : 'blue'}
                    onClick={() => chooseContext(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="2. Temperature"
              value={temperature}
              output={temperature.toFixed(1)}
              min={0.2}
              max={1.6}
              step={0.1}
              accent="violet"
              lowLabel="Concentrated"
              highLabel="More varied"
              onChange={(value) => {
                setTemperature(value);
                setDrawIndex(0);
              }}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Decoding rule
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <LabChoice
                  selected={decoding === 'greedy'}
                  label="Choose the top token"
                  detail="Repeatable for this fixed distribution."
                  icon={CheckCircle2}
                  accent="blue"
                  onClick={() => setDecoding('greedy')}
                />
                <LabChoice
                  selected={decoding === 'sample'}
                  label="Sample by probability"
                  detail="A lower-ranked token can be selected."
                  icon={Dice5}
                  accent="amber"
                  onClick={() => setDecoding('sample')}
                />
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => setDrawIndex((current) => current + 1)}
              disabled={decoding !== 'sample'}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
            >
              <Dice5 aria-hidden="true" className="h-4 w-4" />
              Draw another token
            </button>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="next-token-prompt-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible prefix</p>
            <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <h4 id="next-token-prompt-title" className="font-mono text-sm leading-6 text-neutral-800 dark:text-neutral-100">
                {data.prompt} <span className="inline-flex rounded bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{selected.token}</span>
              </h4>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Context state: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{context.sourceLabel}</span>
              </p>
            </div>
          </section>

          <section aria-labelledby="candidate-distribution-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Vocabulary slice</p>
                <h4 id="candidate-distribution-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Candidate probabilities</h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Toy scores for one teaching step</p>
            </div>
            <div className="mt-4 space-y-3">
              {distribution.map((candidate, index) => (
                <div key={candidate.id} className={`rounded-md border p-3 ${candidate.id === selected.id ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-neutral-900 dark:text-neutral-100">{candidate.token}</span>
                    <span className="shrink-0 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">{percent(candidate.probability)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="img" aria-label={`${candidate.token}: ${percent(candidate.probability)} probability`}>
                    <div
                      className={`h-full rounded-full motion-reduce:transition-none ${index === 0 ? 'bg-violet-600' : candidate.id === selected.id ? 'bg-amber-500' : 'bg-blue-400'} transition-[width] duration-200`}
                      style={{ width: `${Math.max(1, candidate.probability * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Selected token" value={selected.token} detail={decoding === 'greedy' ? 'Highest probability' : `Sample draw ${drawIndex + 1}`} icon={Sparkles} tone="violet" />
            <LabMetric label="Distribution spread" value={`${entropy.toFixed(2)} bits`} detail="Higher entropy means less concentrated probability." icon={Gauge} tone={entropy > 1.2 ? 'amber' : 'blue'} />
            <LabMetric label="Evidence status" value={support.label} detail={support.detail} icon={support.icon} tone={support.tone} />
          </div>

          <div className={`rounded-md border p-4 ${support.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50' : support.tone === 'rose' ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50'}`}>
            <p className="text-sm font-semibold">{selected.continuation}</p>
            <p className="mt-2 text-xs leading-5 opacity-80">
              Changing temperature or decoding changes selection. Only source verification changes whether this teaching system can call the claim supported.
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function outputSupport(sourceStatus: SourceStatus, candidateId: string): {
  label: string;
  detail: string;
  icon: typeof CheckCircle2;
  tone: 'emerald' | 'amber' | 'rose';
} {
  if (sourceStatus === 'verified' && candidateId === 'paris') {
    return { label: 'Supported', detail: 'Matches the current cited source.', icon: CheckCircle2, tone: 'emerald' };
  }
  if (sourceStatus === 'verified') {
    return { label: 'Contradicted', detail: 'Conflicts with retained verified evidence.', icon: CircleAlert, tone: 'rose' };
  }
  return {
    label: 'Unverified',
    detail: sourceStatus === 'none' ? 'No request-time evidence is attached.' : 'The retained passage has not been trusted.',
    icon: ShieldQuestion,
    tone: 'amber',
  };
}

function LoadState() {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading next-token workbench...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The next-token workbench could not load.</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
