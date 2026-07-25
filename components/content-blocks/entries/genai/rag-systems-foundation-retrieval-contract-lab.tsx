'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  FileKey2,
  FileText,
  Gauge,
  Layers3,
  ListFilter,
  Search,
  Tags,
  Timer,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RetrievalMode = {
  id: string;
  label: string;
  detail: string;
  lexicalFit: number;
  semanticFit: number;
  basePrecision: number;
  baseLatencyMs: number;
  candidateLatencyMs: number;
};

type RerankPlan = {
  id: string;
  label: string;
  detail: string;
  depth: number;
  precisionLift: number;
  recallPenalty: number;
  latencyPerCandidateMs: number;
};

type RetrievalScenario = {
  id: string;
  label: string;
  detail: string;
  query: string;
  corpusTokens: number;
  answerSpanTokens: number;
  idealChunkTokens: number;
  relevantFacts: number;
  lexicalNeed: number;
  semanticNeed: number;
  recallFloor: number;
  p95BudgetMs: number;
  contractLabel: string;
};

type RetrievalContractData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    chunkTokens: number;
    overlapPercent: number;
    modeId: string;
    candidateCount: number;
    rerankId: string;
  };
  controls: {
    chunkTokens: { min: number; max: number; step: number };
    overlapPercent: { min: number; max: number; step: number };
    candidateCount: { min: number; max: number; step: number };
  };
  gates: {
    minPromptPrecision: number;
    maxIndexExpansionPercent: number;
  };
  modes: RetrievalMode[];
  rerankPlans: RerankPlan[];
  scenarios: RetrievalScenario[];
};

const BLOCK_ID = 'genai/rag-systems-foundation-retrieval-contract-lab';

function isRetrievalContractData(value: unknown): value is RetrievalContractData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetrievalContractData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.controls
      && candidate.gates
      && Array.isArray(candidate.modes)
      && candidate.modes.length > 0
      && Array.isArray(candidate.rerankPlans)
      && candidate.rerankPlans.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function RagSystemsFoundationRetrievalContractLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RetrievalContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No retrieval-contract model was supplied.');
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
        if (!isRetrievalContractData(payload)) {
          throw new Error('Retrieval-contract data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load retrieval data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RetrievalContractWorkbench data={data} />;
}

function RetrievalContractWorkbench({ data }: { data: RetrievalContractData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [chunkTokens, setChunkTokens] = useState(data.defaults.chunkTokens);
  const [overlapPercent, setOverlapPercent] = useState(data.defaults.overlapPercent);
  const [modeId, setModeId] = useState(data.defaults.modeId);
  const [candidateCount, setCandidateCount] = useState(data.defaults.candidateCount);
  const [rerankId, setRerankId] = useState(data.defaults.rerankId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];
  const rerank = data.rerankPlans.find((item) => item.id === rerankId) ?? data.rerankPlans[0];

  const result = useMemo(() => {
    const overlapRatio = overlapPercent / 100;
    const strideTokens = Math.max(1, chunkTokens * (1 - overlapRatio));
    const chunkCount = Math.max(
      1,
      Math.ceil(Math.max(0, scenario.corpusTokens - chunkTokens) / strideTokens) + 1,
    );
    const indexedTokens = chunkCount * chunkTokens;
    const indexExpansionPercent = Math.max(
      0,
      ((indexedTokens - scenario.corpusTokens) / scenario.corpusTokens) * 100,
    );

    const spanCoverage = clamp(
      (chunkTokens + chunkTokens * overlapRatio) / (scenario.answerSpanTokens * 1.18),
      0.32,
      1,
    );
    const focus = chunkTokens <= scenario.idealChunkTokens
      ? 1
      : clamp(scenario.idealChunkTokens / chunkTokens, 0.55, 1);
    const chunkQuality = 0.64 * spanCoverage + 0.36 * focus;
    const representationFit = scenario.lexicalNeed * mode.lexicalFit
      + scenario.semanticNeed * mode.semanticFit;
    const depthGain = 0.7 + 0.3 * (1 - Math.exp(-candidateCount / 12));
    const recall = clamp(
      representationFit * chunkQuality * depthGain
        + overlapRatio * 0.05
        - rerank.recallPenalty,
      0.15,
      0.99,
    );

    const rawPrecision = mode.basePrecision
      + (focus - 0.7) * 0.18
      - Math.max(0, candidateCount - 8) * 0.006;
    const promptPrecision = clamp(rawPrecision + rerank.precisionLift, 0.35, 0.97);
    const actualRerankDepth = Math.min(candidateCount, rerank.depth);
    const p95LatencyMs = mode.baseLatencyMs
      + candidateCount * mode.candidateLatencyMs
      + actualRerankDepth * rerank.latencyPerCandidateMs
      + Math.log10(chunkCount + 1) * 6;
    const factsFound = Math.min(
      scenario.relevantFacts,
      Math.max(0, Math.round(scenario.relevantFacts * recall)),
    );

    const recallPass = recall >= scenario.recallFloor;
    const precisionPass = promptPrecision >= data.gates.minPromptPrecision;
    const latencyPass = p95LatencyMs <= scenario.p95BudgetMs;
    const expansionPass = indexExpansionPercent <= data.gates.maxIndexExpansionPercent;
    const ready = recallPass && precisionPass && latencyPass && expansionPass;

    let verdict = 'Ready for labeled-query evaluation';
    let detail = 'The modeled operating point clears coverage, focus, index, and latency planning gates. Confirm it on production-shaped queries before release.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!recallPass) {
      verdict = 'Evidence coverage is below the floor';
      detail = spanCoverage < 0.75
        ? 'Chunks split the answer span. Increase chunk size or overlap before spending more on candidate depth.'
        : 'The representation or candidate pool misses required evidence. Change retrieval mode or inspect labeled misses.';
      tone = 'rose';
    } else if (!precisionPass) {
      verdict = 'Too much weak evidence reaches the prompt';
      detail = 'Reduce candidate pressure, improve first-stage filtering, or rerank a bounded pool before assembly.';
      tone = 'amber';
    } else if (!latencyPass) {
      verdict = 'Quality passes, but the latency budget does not';
      detail = 'Reduce candidate or rerank depth, then verify that the recall floor still holds.';
      tone = 'amber';
    } else if (!expansionPass) {
      verdict = 'Overlap creates excessive index expansion';
      detail = 'Reduce overlap or use structure-aware boundaries. Duplicate tokens consume embedding, storage, and refresh work.';
      tone = 'amber';
    }

    return {
      actualRerankDepth,
      chunkCount,
      detail,
      expansionPass,
      factsFound,
      indexExpansionPercent,
      latencyPass,
      p95LatencyMs,
      precisionPass,
      promptPrecision,
      ready,
      recall,
      recallPass,
      spanCoverage,
      strideTokens,
      tone,
      verdict,
    };
  }, [
    candidateCount,
    chunkTokens,
    data.gates,
    mode,
    overlapPercent,
    rerank,
    scenario,
  ]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setChunkTokens(data.defaults.chunkTokens);
    setOverlapPercent(data.defaults.overlapPercent);
    setModeId(data.defaults.modeId);
    setCandidateCount(data.defaults.candidateCount);
    setRerankId(data.defaults.rerankId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retrieval contract lab"
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
                  1. Evidence shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'exact-product-code' ? Tags : item.id === 'policy-paraphrase' ? FileText : Workflow}
                      accent={item.id === 'exact-product-code' ? 'blue' : item.id === 'policy-paraphrase' ? 'violet' : 'amber'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Chunk size"
                value={chunkTokens}
                output={`${chunkTokens} tokens`}
                min={data.controls.chunkTokens.min}
                max={data.controls.chunkTokens.max}
                step={data.controls.chunkTokens.step}
                accent="blue"
                lowLabel="Focused"
                highLabel="More continuity"
                onChange={setChunkTokens}
              />

              <LabRange
                label="Chunk overlap"
                value={overlapPercent}
                output={`${overlapPercent}%`}
                min={data.controls.overlapPercent.min}
                max={data.controls.overlapPercent.max}
                step={data.controls.overlapPercent.step}
                accent="violet"
                lowLabel="Less duplication"
                highLabel="More boundary cover"
                onChange={setOverlapPercent}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. First-stage retrieval
                </legend>
                <div className="mt-3 space-y-2">
                  {data.modes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'sparse' ? ListFilter : item.id === 'dense' ? Database : Layers3}
                      accent={item.id === 'sparse' ? 'amber' : item.id === 'dense' ? 'blue' : 'cyan'}
                      onClick={() => setModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Candidate depth"
                value={candidateCount}
                output={`top ${candidateCount}`}
                min={data.controls.candidateCount.min}
                max={data.controls.candidateCount.max}
                step={data.controls.candidateCount.step}
                accent="cyan"
                lowLabel="Fast"
                highLabel="More recall work"
                onChange={setCandidateCount}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Second-stage ranking
                </legend>
                <div className="mt-3 space-y-2">
                  {data.rerankPlans.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === rerank.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Gauge}
                      accent={item.id === 'none' ? 'amber' : 'emerald'}
                      onClick={() => setRerankId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[660px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled evidence recall"
                value={`${(result.recall * 100).toFixed(1)}%`}
                detail={`${(scenario.recallFloor * 100).toFixed(0)}% scenario floor`}
                icon={Search}
                tone={result.recallPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Prompt precision"
                value={`${(result.promptPrecision * 100).toFixed(1)}%`}
                detail={`${(data.gates.minPromptPrecision * 100).toFixed(0)}% planning floor`}
                icon={ListFilter}
                tone={result.precisionPass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Index expansion"
                value={`+${result.indexExpansionPercent.toFixed(1)}%`}
                detail={`${data.gates.maxIndexExpansionPercent}% planning ceiling`}
                icon={Database}
                tone={result.expansionPass ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Modeled retrieval p95"
                value={`${result.p95LatencyMs.toFixed(0)} ms`}
                detail={`${scenario.p95BudgetMs} ms scenario budget`}
                icon={Timer}
                tone={result.latencyPass ? 'blue' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Query trace
                  </p>
                  <h4 className="mt-1 break-words text-base font-semibold text-neutral-950 dark:text-white">
                    {scenario.query}
                  </h4>
                </div>
                <span className="max-w-full break-words rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  {scenario.contractLabel}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <TraceStep
                  label="Versioned source"
                  value={formatCompact(scenario.corpusTokens)}
                  detail="Source tokens in one published snapshot"
                  icon={FileKey2}
                />
                <TraceConnector />
                <TraceStep
                  label="Chunk index"
                  value={formatCompact(result.chunkCount)}
                  detail={`${result.strideTokens.toFixed(0)}-token stride; ${(result.spanCoverage * 100).toFixed(0)}% span coverage`}
                  icon={Layers3}
                  warning={!result.expansionPass || result.spanCoverage < 0.75}
                />
                <TraceConnector />
                <TraceStep
                  label="Candidates"
                  value={`${mode.label}: ${candidateCount}`}
                  detail={result.actualRerankDepth > 0 ? `${result.actualRerankDepth} reranked` : 'First-stage order retained'}
                  icon={Search}
                  warning={!result.recallPass}
                />
                <TraceConnector />
                <TraceStep
                  label="Prompt evidence"
                  value={`${result.factsFound} / ${scenario.relevantFacts} facts`}
                  detail="Only selected chunks should cross into assembly"
                  icon={CheckCircle2}
                  warning={!result.recallPass || !result.precisionPass}
                />
              </div>
            </section>

            <div className={`rounded-md border p-5 ${verdictStyles[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.ready ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Planning verdict</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The coefficients are synthetic and expose causal trade-offs. Replace them with labeled-query recall, measured index size, and tail latency from the chosen corpus and infrastructure.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const verdictStyles = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
};

function TraceStep({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  warning?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border bg-white p-3 dark:bg-neutral-950 ${warning ? 'border-rose-300 dark:border-rose-900' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <Icon aria-hidden="true" className={`h-4 w-4 ${warning ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function TraceConnector() {
  return (
    <div className="flex h-5 items-center justify-center text-neutral-400 md:h-auto" aria-hidden="true">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 min-h-96 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading the retrieval-contract model...</p>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <p className="font-semibold">Retrieval-contract model unavailable</p>
      <p className="mt-1 text-sm opacity-80">{detail}</p>
    </div>
  );
}
