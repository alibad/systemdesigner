'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Filter,
  Layers3,
  ListFilter,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type RetrievalStrategy = {
  id: string;
  label: string;
  detail: string;
  lexicalWeight: number;
  semanticWeight: number;
  baseLatencyMs: number;
};

type RetrievalCandidate = {
  id: string;
  title: string;
  source: string;
  authorized: boolean;
  lexical: number;
  semantic: number;
  rerank: number;
  facts: string[];
};

type RetrievalScenario = {
  id: string;
  label: string;
  query: string;
  brief: string;
  requiredFacts: string[];
  candidates: RetrievalCandidate[];
};

type RetrievalWorkbenchData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
    topK: number;
    rerank: boolean;
  };
  strategies: RetrievalStrategy[];
  scenarios: RetrievalScenario[];
};

const BLOCK_ID = 'genai/rag-retrieval-workbench';

function isRetrievalWorkbenchData(value: unknown): value is RetrievalWorkbenchData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetrievalWorkbenchData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && typeof candidate.defaults.scenarioId === 'string'
      && typeof candidate.defaults.strategyId === 'string'
      && typeof candidate.defaults.topK === 'number'
      && typeof candidate.defaults.rerank === 'boolean'
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length > 0
      && candidate.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.lexicalWeight === 'number'
        && typeof item.semanticWeight === 'number'
        && typeof item.baseLatencyMs === 'number'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.query === 'string'
        && typeof scenario.brief === 'string'
        && Array.isArray(scenario.requiredFacts)
        && scenario.requiredFacts.every((fact) => typeof fact === 'string')
        && Array.isArray(scenario.candidates)
        && scenario.candidates.length > 0
        && scenario.candidates.every((item) => (
          typeof item.id === 'string'
          && typeof item.title === 'string'
          && typeof item.source === 'string'
          && typeof item.authorized === 'boolean'
          && typeof item.lexical === 'number'
          && typeof item.semantic === 'number'
          && typeof item.rerank === 'number'
          && Array.isArray(item.facts)
          && item.facts.every((fact) => typeof fact === 'string')
        ))
      )),
  );
}

export default function RagRetrievalWorkbench({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RetrievalWorkbenchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No retrieval scenario file was supplied.');
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
        if (!isRetrievalWorkbenchData(payload)) {
          throw new Error('Retrieval workbench data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the workbench.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState detail={error} />;
  if (!data) return <LoadState />;
  return <RetrievalWorkbench data={data} />;
}

function RetrievalWorkbench({ data }: { data: RetrievalWorkbenchData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialStrategy = data.strategies.find((item) => item.id === data.defaults.strategyId)
    ?? data.strategies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [strategyId, setStrategyId] = useState(initialStrategy.id);
  const [topK, setTopK] = useState(data.defaults.topK);
  const [rerank, setRerank] = useState(data.defaults.rerank);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const model = useMemo(() => {
    const blocked = scenario.candidates.filter((item) => !item.authorized);
    const ranked = scenario.candidates
      .filter((item) => item.authorized)
      .map((item) => {
        const firstStage = (
          item.lexical * strategy.lexicalWeight
          + item.semantic * strategy.semanticWeight
        );
        const finalScore = rerank ? firstStage * 0.35 + item.rerank * 0.65 : firstStage;
        return { ...item, finalScore, firstStage };
      })
      .sort((left, right) => right.finalScore - left.finalScore || left.id.localeCompare(right.id));
    const selected = ranked.slice(0, topK);
    const foundFacts = new Set(selected.flatMap((item) => item.facts));
    const useful = selected.filter((item) => item.facts.length > 0).length;
    const recall = scenario.requiredFacts.length === 0
      ? 1
      : scenario.requiredFacts.filter((fact) => foundFacts.has(fact)).length
        / scenario.requiredFacts.length;
    const precision = selected.length === 0 ? 0 : useful / selected.length;
    const latencyMs = Math.round(
      strategy.baseLatencyMs + topK * 3 + (rerank ? 21 + topK * 5 : 0),
    );
    return { blocked, foundFacts, latencyMs, precision, ranked, recall, selected };
  }, [rerank, scenario, strategy, topK]);

  function reset() {
    setScenarioId(initialScenario.id);
    setStrategyId(initialStrategy.id);
    setTopK(data.defaults.topK);
    setRerank(data.defaults.rerank);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retrieval workbench"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Query shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={Target}
                      accent="blue"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. First-stage retrieval
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ListFilter}
                      accent="violet"
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Candidate depth"
                value={topK}
                output={`top ${topK}`}
                min={1}
                max={Math.min(5, scenario.candidates.filter((item) => item.authorized).length)}
                lowLabel="Precise"
                highLabel="Broad recall"
                accent="cyan"
                onChange={setTopK}
              />

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-neutral-200 bg-white p-4 text-neutral-800 focus-within:ring-2 focus-within:ring-amber-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Pairwise reranker
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Spend more latency to rescore the candidate set against the full query.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={rerank}
                  onChange={(event) => setRerank(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-amber-500"
                />
              </label>
            </div>
          )}
        >
          <div className="space-y-5">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Search aria-hidden="true" className="h-4 w-4" />
                Query
              </div>
              <p className="mt-2 text-base font-semibold leading-6 text-neutral-950 dark:text-white">
                “{scenario.query}”
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scenario.requiredFacts.map((fact) => {
                  const found = model.foundFacts.has(fact);
                  return (
                    <span
                      key={fact}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        found
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                          : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                      }`}
                    >
                      {found ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />}
                      {fact.replaceAll('-', ' ')}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Evidence recall"
                value={`${Math.round(model.recall * 100)}%`}
                detail="Required facts represented"
                icon={Target}
                tone={model.recall === 1 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Precision"
                value={`${Math.round(model.precision * 100)}%`}
                detail="Selected chunks that help"
                icon={Filter}
                tone={model.precision >= 0.67 ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Search latency"
                value={`${model.latencyMs} ms`}
                detail={rerank ? 'Includes reranking' : 'First stage only'}
                icon={Clock3}
                tone="violet"
              />
              <LabMetric
                label="Policy blocked"
                value={String(model.blocked.length)}
                detail="Unauthorized before ranking"
                icon={LockKeyhole}
                tone="neutral"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Ranked candidates</h4>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {model.selected.length} enter the evidence stage
                </span>
              </div>
              <ol className="mt-3 space-y-2">
                {model.ranked.map((item, index) => {
                  const selected = index < topK;
                  return (
                    <li
                      key={item.id}
                      className={`rounded-md border p-4 ${
                        selected
                          ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/35'
                          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950' : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-neutral-950 dark:text-white">{item.title}</p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.source}</p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-200">
                              {item.finalScore.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                            <ScoreBar label="Lexical" value={item.lexical} tone="bg-blue-500" />
                            <ScoreBar label="Dense" value={item.semantic} tone="bg-violet-500" />
                            <ScoreBar label="Final" value={item.finalScore} tone="bg-cyan-500" />
                          </div>
                          <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {item.facts.length > 0
                              ? `Supports: ${item.facts.map((fact) => fact.replaceAll('-', ' ')).join(', ')}`
                              : 'Distractor: related language, but no required fact.'}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className={`flex items-start gap-3 rounded-md border p-4 ${model.recall === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'}`}>
              {model.recall === 1 ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">
                  {model.recall === 1 ? 'Candidate set can support the answer' : 'Required evidence is missing'}
                </p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {model.recall === 1
                    ? 'Pass the selected set to context assembly; generation still needs claim-level support checks.'
                    : 'Change retrieval or candidate depth. A generator cannot recover facts that never reached its context.'}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ScoreBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, value * 100)}%` }} />
      </div>
    </div>
  );
}

function LoadState({ detail }: { detail?: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-200">
        <Layers3 aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        <p className="text-sm font-semibold">{detail ?? 'Loading retrieval scenarios…'}</p>
      </div>
    </div>
  );
}
