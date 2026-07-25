'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  GitMerge,
  ListOrdered,
  RefreshCw,
  Sigma,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RankedDocument = {
  id: string;
  title: string;
  source: string;
  facts: string[];
};

type RankedList = {
  id: string;
  label: string;
  detail: string;
  ranking: string[];
};

type FusionScenario = {
  id: string;
  label: string;
  query: string;
  brief: string;
  requiredFacts: string[];
  documents: RankedDocument[];
  lists: RankedList[];
};

type RankFusionData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    activeListIds: string[];
    rankDepth: number;
  };
  rrfConstant: number;
  scenarios: FusionScenario[];
};

type FusedDocument = RankedDocument & {
  score: number;
  ranks: Record<string, number>;
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/advanced-rag/data/rank-fusion-scenarios.json';
const BLOCK_ID = 'genai/advanced-rag-rank-fusion-lab';
const EVIDENCE_DEPTH = 3;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRankFusionData(value: unknown): value is RankFusionData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RankFusionData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && isStringArray(data.defaults.activeListIds)
      && typeof data.defaults.rankDepth === 'number'
      && typeof data.rrfConstant === 'number'
      && data.rrfConstant > 0
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.query === 'string'
        && typeof scenario.brief === 'string'
        && isStringArray(scenario.requiredFacts)
        && Array.isArray(scenario.documents)
        && scenario.documents.length > 0
        && scenario.documents.every((document) => (
          typeof document.id === 'string'
          && typeof document.title === 'string'
          && typeof document.source === 'string'
          && isStringArray(document.facts)
        ))
        && Array.isArray(scenario.lists)
        && scenario.lists.length > 0
        && scenario.lists.every((list) => (
          typeof list.id === 'string'
          && typeof list.label === 'string'
          && typeof list.detail === 'string'
          && isStringArray(list.ranking)
        ))
      )),
  );
}

export default function AdvancedRagRankFusionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RankFusionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        if (!isRankFusionData(payload)) {
          throw new Error('The rank-fusion scenarios are incomplete.');
        }
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the rank-fusion scenarios.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadState
          error={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : (
        <RankFusionLab data={data} />
      )}
    </div>
  );
}

function RankFusionLab({ data }: { data: RankFusionData }) {
  const initialScenario = data.scenarios.find(
    (item) => item.id === data.defaults.scenarioId,
  ) ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [activeListIds, setActiveListIds] = useState(data.defaults.activeListIds);
  const [rankDepth, setRankDepth] = useState(data.defaults.rankDepth);

  const scenario = data.scenarios.find((item) => item.id === scenarioId)
    ?? data.scenarios[0];
  const maximumDepth = Math.max(...scenario.lists.map((list) => list.ranking.length));

  const model = useMemo(() => {
    const activeLists = scenario.lists.filter((list) => activeListIds.includes(list.id));
    const scores = new Map<string, number>();
    const ranks = new Map<string, Record<string, number>>();

    for (const list of activeLists) {
      list.ranking.slice(0, rankDepth).forEach((documentId, index) => {
        const rank = index + 1;
        scores.set(
          documentId,
          (scores.get(documentId) ?? 0) + 1 / (data.rrfConstant + rank),
        );
        ranks.set(documentId, {
          ...(ranks.get(documentId) ?? {}),
          [list.id]: rank,
        });
      });
    }

    const fused = scenario.documents
      .filter((document) => scores.has(document.id))
      .map<FusedDocument>((document) => ({
        ...document,
        score: scores.get(document.id) ?? 0,
        ranks: ranks.get(document.id) ?? {},
      }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    const evidence = fused.slice(0, EVIDENCE_DEPTH);
    const coveredFacts = new Set(evidence.flatMap((document) => document.facts));
    const maximumScore = fused[0]?.score ?? 0;

    return {
      activeLists,
      coveredFacts,
      evidence,
      fused,
      maximumScore,
    };
  }, [activeListIds, data.rrfConstant, rankDepth, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setActiveListIds(data.defaults.activeListIds);
    setRankDepth(data.defaults.rankDepth);
  }

  function toggleList(listId: string) {
    setActiveListIds((current) => {
      if (current.includes(listId)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== listId);
      }
      return [...current, listId];
    });
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Rank-fusion lab"
        title={data.title}
        description={data.description}
        icon={GitMerge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Retrieval case
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.brief}
                    icon={FileSearch}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Ranked lists
              </legend>
              <div className="mt-3 space-y-2">
                {scenario.lists.map((list) => {
                  const active = activeListIds.includes(list.id);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleList(list.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        active
                          ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50 dark:ring-cyan-300'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            active
                              ? 'border-cyan-700 bg-cyan-700 text-white dark:border-cyan-300 dark:bg-cyan-300 dark:text-cyan-950'
                              : 'border-neutral-400 dark:border-neutral-600'
                          }`}
                        >
                          {active ? (
                            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{list.label}</span>
                          <span className="mt-1 block text-xs leading-5 opacity-75">
                            {list.detail}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Keep at least one list active. Turning a list off removes all of its
                rank contributions.
              </p>
            </fieldset>

            <LabRange
              label="Contributing depth"
              value={rankDepth}
              output={`top ${rankDepth} per list`}
              min={1}
              max={maximumDepth}
              lowLabel="Only leaders"
              highLabel="Deeper candidates"
              accent="cyan"
              onChange={setRankDepth}
            />

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Sigma aria-hidden="true" className="h-4 w-4" />
                Exact formula
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                score(d) = Σ 1 / ({data.rrfConstant} + rank)
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The constant is fixed at {data.rrfConstant}. The depth control changes
                which ranked documents contribute, not the formula.
              </p>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5">
          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <FileSearch aria-hidden="true" className="h-4 w-4" />
              Query
            </div>
            <p className="mt-2 text-base font-semibold leading-6 text-neutral-950 dark:text-white">
              “{scenario.query}”
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenario.requiredFacts.map((fact) => {
                const covered = model.coveredFacts.has(fact);
                return (
                  <span
                    key={fact}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      covered
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                        : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                    }`}
                  >
                    {covered ? (
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {fact.replaceAll('-', ' ')}
                  </span>
                );
              })}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Active lists"
              value={String(model.activeLists.length)}
              detail="Independent ranked inputs"
              icon={ListOrdered}
              tone="cyan"
            />
            <LabMetric
              label="Fused candidates"
              value={String(model.fused.length)}
              detail={`Visible inside top ${rankDepth}`}
              icon={GitMerge}
              tone="blue"
            />
            <LabMetric
              label="Fact coverage"
              value={`${scenario.requiredFacts.filter((fact) => model.coveredFacts.has(fact)).length} / ${scenario.requiredFacts.length}`}
              detail={`From fused top ${EVIDENCE_DEPTH}`}
              icon={CheckCircle2}
              tone={scenario.requiredFacts.every((fact) => model.coveredFacts.has(fact))
                ? 'emerald'
                : 'rose'}
            />
            <LabMetric
              label="Top result"
              value={model.fused[0]?.title ?? 'None'}
              detail="Ranked by fused contribution"
              icon={Calculator}
              tone="violet"
            />
          </div>

          <section aria-label="Source rankings">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Inputs
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Ranked lists before fusion
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Only highlighted ranks contribute
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {scenario.lists.map((list) => {
                const active = activeListIds.includes(list.id);
                return (
                  <article
                    key={list.id}
                    className={`min-w-0 rounded-md border p-4 ${
                      active
                        ? 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/25'
                        : 'border-neutral-200 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {list.label}
                      </h5>
                      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        {active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <ol className="mt-3 space-y-2">
                      {list.ranking.map((documentId, index) => {
                        const document = scenario.documents.find(
                          (item) => item.id === documentId,
                        );
                        if (!document) return null;
                        const contributes = active && index < rankDepth;
                        return (
                          <li
                            key={documentId}
                            className={`flex items-start gap-2 rounded p-2 text-xs ${
                              contributes
                                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100'
                                : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            <span className="w-5 shrink-0 font-mono font-semibold">
                              {index + 1}
                            </span>
                            <span className="min-w-0 leading-5">{document.title}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-label="Fused ranking">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Output
            </p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              Fused evidence order
            </h4>
            <ol className="mt-4 space-y-3">
              {model.fused.map((document, index) => (
                <li
                  key={document.id}
                  className={`rounded-md border p-4 ${
                    index < EVIDENCE_DEPTH
                      ? 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30'
                      : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {document.title}
                        </p>
                      </div>
                      <p className="mt-1 pl-8 text-xs text-neutral-500 dark:text-neutral-400">
                        {document.source}
                      </p>
                    </div>
                    <code className="shrink-0 text-xs font-semibold text-violet-800 dark:text-violet-200">
                      {document.score.toFixed(6)}
                    </code>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-violet-400"
                      style={{
                        width: `${model.maximumScore === 0 ? 0 : (document.score / model.maximumScore) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.activeLists.map((list) => {
                      const rank = document.ranks[list.id];
                      return (
                        <span
                          key={list.id}
                          className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                        >
                          {list.label}: {rank
                            ? `1/(${data.rrfConstant}+${rank})`
                            : 'outside depth'}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-live="polite"
            className={`rounded-md border p-5 ${
              scenario.requiredFacts.every((fact) => model.coveredFacts.has(fact))
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
            }`}
          >
            <div className="flex items-start gap-3">
              {scenario.requiredFacts.every((fact) => model.coveredFacts.has(fact)) ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
              ) : (
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300"
                />
              )}
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">
                  {scenario.requiredFacts.every((fact) => model.coveredFacts.has(fact))
                    ? `The fused top ${EVIDENCE_DEPTH} covers every synthetic fact`
                    : `The fused top ${EVIDENCE_DEPTH} is still missing required evidence`}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  RRF can promote agreement across ranked lists, but it cannot recover a
                  document that no active list retrieved within the contributing depth.
                </p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Rank-fusion lab"
        title="Loading ranked retrieval lists"
        description="The lesson computes every result from co-located synthetic rankings."
        icon={GitMerge}
        accent="cyan"
      />
      <LearningLabBody>
        <div
          className={`flex min-h-48 items-center justify-center rounded-md border p-6 text-center ${
            error
              ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
        >
          <div>
            {error ? (
              <CircleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-700 dark:text-rose-300"
              />
            ) : (
              <RefreshCw
                aria-hidden="true"
                className="mx-auto h-7 w-7 animate-spin text-cyan-700 motion-reduce:animate-none dark:text-cyan-300"
              />
            )}
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading fusion data...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:bg-white dark:text-neutral-950"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
