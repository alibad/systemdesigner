'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Blend,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileSearch,
  Filter,
  KeyRound,
  LoaderCircle,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WholeWord,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RetrievalMode = 'lexical' | 'vector' | 'hybrid';
type VerdictTone = 'emerald' | 'amber' | 'rose';

interface RetrievalDocument {
  id: string;
  label: string;
  summary: string;
  keywordScore: number;
  semanticScore: number;
  rerankScore: number;
  authorized: boolean;
  fresh: boolean;
  factIds: string[];
}

interface RetrievalScenario {
  id: string;
  label: string;
  detail: string;
  query: string;
  requiredFactIds: string[];
  documents: RetrievalDocument[];
}

interface RetrievalLabData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    mode: RetrievalMode;
    authorizationFilter: boolean;
    freshnessFilter: boolean;
    reranking: boolean;
  };
  evidenceLimit: number;
  scenarios: RetrievalScenario[];
}

interface RankedDocument extends RetrievalDocument {
  baseScore: number;
  finalScore: number;
}

const BLOCK_ID = 'genai/rag-architecture-deep-dive-retrieval-failure-lab';

const retrievalModes: Array<{
  id: RetrievalMode;
  label: string;
  detail: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'cyan';
}> = [
  {
    id: 'lexical',
    label: 'Lexical',
    detail: 'Prioritize exact terms and identifiers.',
    icon: WholeWord,
    accent: 'blue',
  },
  {
    id: 'vector',
    label: 'Vector',
    detail: 'Prioritize semantic similarity.',
    icon: Sparkles,
    accent: 'violet',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    detail: 'Fuse both candidate signals.',
    icon: Blend,
    accent: 'cyan',
  },
];

function isRetrievalLabData(value: unknown): value is RetrievalLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetrievalLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && typeof candidate.evidenceLimit === 'number'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && Array.isArray(scenario.requiredFactIds)
        && Array.isArray(scenario.documents)
        && scenario.documents.length > 0
        && scenario.documents.every((document) => (
          typeof document.id === 'string'
          && typeof document.keywordScore === 'number'
          && typeof document.semanticScore === 'number'
          && typeof document.rerankScore === 'number'
          && Array.isArray(document.factIds)
        ))
      )),
  );
}

export default function RagRetrievalFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RetrievalLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No retrieval scenario data was supplied.');
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
        if (!isRetrievalLabData(payload)) throw new Error('The retrieval scenarios are incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the retrieval scenarios.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <RetrievalFailureLab data={data} />;
}

function RetrievalFailureLab({ data }: { data: RetrievalLabData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [mode, setMode] = useState<RetrievalMode>(data.defaults.mode);
  const [authorizationFilter, setAuthorizationFilter] = useState(data.defaults.authorizationFilter);
  const [freshnessFilter, setFreshnessFilter] = useState(data.defaults.freshnessFilter);
  const [reranking, setReranking] = useState(data.defaults.reranking);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const model = useMemo(() => {
    const eligible = scenario.documents.filter((document) => (
      (!authorizationFilter || document.authorized)
      && (!freshnessFilter || document.fresh)
    ));

    const ranked: RankedDocument[] = eligible
      .map((document) => {
        const baseScore = mode === 'lexical'
          ? document.keywordScore
          : mode === 'vector'
            ? document.semanticScore
            : (document.keywordScore + document.semanticScore) / 2;
        const finalScore = reranking
          ? baseScore * 0.35 + document.rerankScore * 0.65
          : baseScore;
        return { ...document, baseScore, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore);

    const evidence = ranked.slice(0, data.evidenceLimit);
    const observedFacts = new Set(evidence.flatMap((document) => document.factIds));
    const coveredFacts = scenario.requiredFactIds.filter((factId) => observedFacts.has(factId));
    const coveragePercent = Math.round(coveredFacts.length / scenario.requiredFactIds.length * 100);
    const unauthorizedCount = evidence.filter((document) => !document.authorized).length;
    const staleCount = evidence.filter((document) => !document.fresh).length;

    let title = 'Evidence can proceed to grounded generation';
    let detail = `The top ${data.evidenceLimit} passages are authorized, current, and cover every required fact.`;
    let tone: VerdictTone = 'emerald';

    if (unauthorizedCount > 0) {
      title = 'Release blocked: unauthorized evidence entered context';
      detail = 'Re-enable identity and tenant filtering before retrieval. Final-response filtering is too late.';
      tone = 'rose';
    } else if (staleCount > 0) {
      title = 'Release blocked: stale evidence can change the answer';
      detail = 'Apply effective-time or source-version filtering and rerun retrieval against the approved record.';
      tone = 'rose';
    } else if (coveragePercent < 100) {
      const missingCount = scenario.requiredFactIds.length - coveredFacts.length;
      title = 'Evidence is incomplete';
      detail = `${missingCount} required fact${missingCount === 1 ? ' is' : 's are'} missing. Change the retrieval plan or return an insufficient-evidence response.`;
      tone = 'amber';
    }

    return {
      coveragePercent,
      detail,
      eligible,
      evidence,
      ranked,
      staleCount,
      title,
      tone,
      unauthorizedCount,
    };
  }, [authorizationFilter, data.evidenceLimit, freshnessFilter, mode, reranking, scenario]);

  const reset = () => {
    setScenarioId(initialScenario.id);
    setMode(data.defaults.mode);
    setAuthorizationFilter(data.defaults.authorizationFilter);
    setFreshnessFilter(data.defaults.freshnessFilter);
    setReranking(data.defaults.reranking);
  };

  const verdictStyle: Record<VerdictTone, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retrieval failure lab"
          title={data.title}
          description={data.description}
          icon={ScanSearch}
          accent="violet"
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
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'incident-code' ? KeyRound : item.id === 'policy-paraphrase' ? BookOpenCheck : FileSearch}
                      accent={item.id === 'incident-code' ? 'blue' : item.id === 'policy-paraphrase' ? 'violet' : 'cyan'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate retrieval
                </legend>
                <div className="mt-3 grid gap-2">
                  {retrievalModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={mode === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.icon}
                      accent={item.accent}
                      onClick={() => setMode(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Evidence controls
                </legend>
                <div className="mt-3 space-y-2">
                  <PolicyToggle
                    label="Authorization filter"
                    detail="Remove passages outside the user's tenant and groups."
                    checked={authorizationFilter}
                    icon={ShieldCheck}
                    onChange={setAuthorizationFilter}
                  />
                  <PolicyToggle
                    label="Freshness filter"
                    detail="Remove expired or superseded source versions."
                    checked={freshnessFilter}
                    icon={Clock3}
                    onChange={setFreshnessFilter}
                  />
                  <PolicyToggle
                    label="Reranking"
                    detail="Reorder the eligible candidate set for query relevance."
                    checked={reranking}
                    icon={Filter}
                    onChange={setReranking}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">User question</p>
              <p className="mt-2 text-lg font-semibold leading-7 text-neutral-950 dark:text-white">
                “{scenario.query}”
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Required evidence: {scenario.requiredFactIds.join(' + ')}
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Fact coverage"
                value={`${model.coveragePercent}%`}
                detail={`${scenario.requiredFactIds.length} required fact${scenario.requiredFactIds.length === 1 ? '' : 's'}`}
                icon={BookOpenCheck}
                tone={model.coveragePercent === 100 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Eligible pool"
                value={`${model.eligible.length}/${scenario.documents.length}`}
                detail="Candidates remaining after hard filters"
                icon={Filter}
                tone="blue"
              />
              <LabMetric
                label="Unauthorized"
                value={String(model.unauthorizedCount)}
                detail="Forbidden passages in final evidence"
                icon={ShieldAlert}
                tone={model.unauthorizedCount === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Stale"
                value={String(model.staleCount)}
                detail="Expired passages in final evidence"
                icon={Clock3}
                tone={model.staleCount === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Ranked candidate set</p>
                    <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                      {modeLabel(mode)} {reranking ? 'with reranking' : 'without reranking'}
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Top {data.evidenceLimit} become prompt evidence
                  </p>
                </div>
              </div>

              {model.ranked.length > 0 ? (
                <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {model.ranked.map((document, index) => (
                    <RankedCandidate
                      key={document.id}
                      document={document}
                      index={index}
                      selected={index < data.evidenceLimit}
                      mode={mode}
                      reranking={reranking}
                    />
                  ))}
                </ol>
              ) : (
                <div className="p-6 text-center text-sm text-neutral-600 dark:text-neutral-300">
                  No candidates survive the current filters. Return insufficient evidence rather than bypassing policy.
                </div>
              )}
            </section>

            <section className={`rounded-md border p-5 ${verdictStyle[model.tone]}`}>
              <div className="flex items-start gap-3">
                {model.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : model.tone === 'rose'
                    ? <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
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

function modeLabel(mode: RetrievalMode) {
  if (mode === 'lexical') return 'Lexical retrieval';
  if (mode === 'vector') return 'Vector retrieval';
  return 'Hybrid retrieval';
}

function PolicyToggle({
  label,
  detail,
  checked,
  icon: Icon,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  icon: LucideIcon;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-neutral-800 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-violet-600"
      />
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</span>
      </span>
    </label>
  );
}

function RankedCandidate({
  document,
  index,
  selected,
  mode,
  reranking,
}: {
  document: RankedDocument;
  index: number;
  selected: boolean;
  mode: RetrievalMode;
  reranking: boolean;
}) {
  return (
    <li className={`p-5 ${selected ? 'bg-violet-50/70 dark:bg-violet-950/20' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${selected
            ? 'bg-violet-700 text-white dark:bg-violet-400 dark:text-violet-950'
            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-neutral-950 dark:text-white">{document.label}</p>
              {selected ? <StatusBadge label="Evidence" tone="violet" /> : null}
              {!document.authorized ? <StatusBadge label="Unauthorized" tone="rose" /> : null}
              {!document.fresh ? <StatusBadge label="Stale" tone="amber" /> : null}
              {document.factIds.length > 0 ? <StatusBadge label={`${document.factIds.length} fact${document.factIds.length === 1 ? '' : 's'}`} tone="emerald" /> : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{document.summary}</p>
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Lab score</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
            {document.finalScore.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SignalBar label="Exact term" value={document.keywordScore} active={mode !== 'vector'} tone="blue" />
        <SignalBar label="Semantic" value={document.semanticScore} active={mode !== 'lexical'} tone="violet" />
        <SignalBar label="Reranker" value={document.rerankScore} active={reranking} tone="emerald" />
      </div>
    </li>
  );
}

function SignalBar({
  label,
  value,
  active,
  tone,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: 'blue' | 'violet' | 'emerald';
}) {
  const barStyle = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
    emerald: 'bg-emerald-500 dark:bg-emerald-400',
  }[tone];

  return (
    <div className={active ? '' : 'opacity-35'}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${barStyle}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'violet' | 'rose' | 'amber' | 'emerald' }) {
  const styles = {
    violet: 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    rose: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
    amber: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    emerald: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase ${styles}`}>{label}</span>;
}

function LabLoading() {
  return (
    <div className="my-7 flex min-h-52 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
      Loading retrieval scenarios…
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div className="my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The retrieval failure lab could not load</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
