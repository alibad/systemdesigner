'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Braces,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  History,
  Layers3,
  MessageSquareText,
  PackageCheck,
  Scissors,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Policy = {
  id: string;
  label: string;
  detail: string;
  rule: string;
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  contextWindow: number;
  fixedTokens: number;
  currentInputTokens: number;
  tokensPerHistoryTurn: number;
  tokensPerRetrievedChunk: number;
  minimumOutputTokens: number;
  maximumOutputTokens: number;
  essentialEvidenceChunks: number;
  recommendedPolicyId: string;
  successCondition: string;
};

type ContextBudgetModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
    historyTurns: number;
    retrievedChunks: number;
    outputReserve: number;
  };
  policies: Policy[];
  scenarios: Scenario[];
};

type Segment = {
  id: string;
  label: string;
  value: number;
  className: string;
};

const BLOCK_ID = 'genai/token-management-context-budget-lab';

function isContextBudgetModel(value: unknown): value is ContextBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContextBudgetModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function TokenManagementContextBudgetLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ContextBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No context-budget model was supplied.');
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
          throw new Error('Context-budget data is incomplete.');
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
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [historyTurns, setHistoryTurns] = useState(data.defaults.historyTurns);
  const [retrievedChunks, setRetrievedChunks] = useState(data.defaults.retrievedChunks);
  const [outputReserve, setOutputReserve] = useState(data.defaults.outputReserve);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const protectedTokens = scenario.fixedTokens + scenario.currentInputTokens + outputReserve;
    const rawHistoryTokens = historyTurns * scenario.tokensPerHistoryTurn;
    const historyDemand = policy.id === 'summarize-history' && historyTurns > 0
      ? Math.min(rawHistoryTokens, 480 + historyTurns * 24)
      : rawHistoryTokens;
    const retrievalDemand = retrievedChunks * scenario.tokensPerRetrievedChunk;
    let available = Math.max(0, scenario.contextWindow - protectedTokens);
    let historyTokens = 0;
    let retrievalTokens = 0;

    if (policy.id === 'recent-first') {
      historyTokens = Math.min(historyDemand, available);
      available -= historyTokens;
      retrievalTokens = Math.min(retrievalDemand, available);
    } else {
      retrievalTokens = Math.min(retrievalDemand, available);
      available -= retrievalTokens;
      historyTokens = Math.min(historyDemand, available);
    }

    const retainedChunks = Math.min(
      retrievedChunks,
      Math.floor(retrievalTokens / scenario.tokensPerRetrievedChunk),
    );
    const retainedHistoryTurns = policy.id === 'summarize-history' && historyTokens === historyDemand
      ? historyTurns
      : Math.min(historyTurns, Math.floor(historyTokens / scenario.tokensPerHistoryTurn));
    const usedTokens = protectedTokens + historyTokens + retrievalTokens;
    const requestedTokens = protectedTokens + historyDemand + retrievalDemand;
    const capacityFits = protectedTokens <= scenario.contextWindow;
    const outputFits = outputReserve >= scenario.minimumOutputTokens;
    const evidenceFits = retainedChunks >= Math.min(
      scenario.essentialEvidenceChunks,
      retrievedChunks,
    );
    const policyRecommended = policy.id === scenario.recommendedPolicyId;
    const ready = capacityFits && outputFits && evidenceFits;
    const overflow = Math.max(0, requestedTokens - scenario.contextWindow);
    const compressedTokens = Math.max(0, rawHistoryTokens - historyDemand);

    let verdict = 'Ready: the request keeps its protected decision inputs';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (!capacityFits) {
      verdict = 'Reject: protected content and answer reserve do not fit';
      tone = 'rose';
    } else if (!outputFits) {
      verdict = 'Unsafe: the answer reserve is below the task contract';
      tone = 'rose';
    } else if (!evidenceFits) {
      verdict = 'Under-supported: essential evidence was displaced';
      tone = 'rose';
    } else if (!policyRecommended) {
      verdict = 'Fits, but the policy does not match this task shape';
      tone = 'amber';
    } else if (overflow > 0 || compressedTokens > 0) {
      verdict = 'Ready with explicit selection and information loss';
      tone = 'amber';
    }

    const segments: Segment[] = [
      {
        id: 'policy',
        label: 'Policy + tools',
        value: scenario.fixedTokens,
        className: 'bg-blue-500 dark:bg-blue-400',
      },
      {
        id: 'question',
        label: 'Current input',
        value: scenario.currentInputTokens,
        className: 'bg-cyan-500 dark:bg-cyan-400',
      },
      {
        id: 'evidence',
        label: 'Evidence',
        value: retrievalTokens,
        className: 'bg-amber-500 dark:bg-amber-400',
      },
      {
        id: 'history',
        label: policy.id === 'summarize-history' ? 'History summary' : 'History',
        value: historyTokens,
        className: 'bg-violet-500 dark:bg-violet-400',
      },
      {
        id: 'answer',
        label: 'Answer reserve',
        value: outputReserve,
        className: 'bg-emerald-500 dark:bg-emerald-400',
      },
    ];

    return {
      compressedTokens,
      evidenceFits,
      historyDemand,
      overflow,
      policyRecommended,
      ready,
      retainedChunks,
      retainedHistoryTurns,
      segments,
      tone,
      unusedTokens: Math.max(0, scenario.contextWindow - usedTokens),
      usedTokens: Math.min(usedTokens, scenario.contextWindow),
      verdict,
    };
  }, [historyTurns, outputReserve, policy, retrievedChunks, scenario]);

  const chooseScenario = (next: Scenario) => {
    setScenarioId(next.id);
    setPolicyId(next.recommendedPolicyId);
    setHistoryTurns(data.defaults.historyTurns);
    setRetrievedChunks(Math.max(next.essentialEvidenceChunks, data.defaults.retrievedChunks));
    setOutputReserve(Math.max(next.minimumOutputTokens, data.defaults.outputReserve));
  };

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setPolicyId(data.defaults.policyId);
    setHistoryTurns(data.defaults.historyTurns);
    setRetrievedChunks(data.defaults.retrievedChunks);
    setOutputReserve(data.defaults.outputReserve);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Context allocation lab"
        title={data.title}
        description={data.description}
        icon={Layers3}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the task
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.brief}
                    icon={MessageSquareText}
                    accent="blue"
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose the overflow policy
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'summarize-history' ? Scissors : item.id === 'evidence-first' ? FileSearch : History}
                    accent={item.id === 'evidence-first' ? 'amber' : 'violet'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="History turns requested"
                value={historyTurns}
                output={`${historyTurns} turns`}
                min={0}
                max={20}
                step={1}
                accent="violet"
                lowLabel="None"
                highLabel="20 turns"
                onChange={setHistoryTurns}
              />
              <LabRange
                label="Retrieved chunks"
                value={retrievedChunks}
                output={`${retrievedChunks} chunks`}
                min={0}
                max={10}
                step={1}
                accent="amber"
                lowLabel="None"
                highLabel="10 chunks"
                onChange={setRetrievedChunks}
              />
              <LabRange
                label="Output reserve"
                value={outputReserve}
                output={`${formatTokens(outputReserve)} tokens`}
                min={400}
                max={scenario.maximumOutputTokens}
                step={100}
                accent="emerald"
                lowLabel="400"
                highLabel={formatTokens(scenario.maximumOutputTokens)}
                onChange={setOutputReserve}
              />
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${statusClasses(result.tone)}`}>
            <div className="flex items-start gap-3">
              {result.ready ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{result.verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{policy.rule}</p>
              </div>
            </div>
          </div>

          <section aria-label="Allocated context window">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Context ledger
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {formatTokens(result.usedTokens)} of {formatTokens(scenario.contextWindow)} tokens admitted
                </h4>
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                {formatTokens(result.unusedTokens)} unallocated
              </p>
            </div>

            <div className="mt-4 flex h-14 w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
              {result.segments.map((segment) => (
                segment.value > 0 ? (
                  <div
                    key={segment.id}
                    className={`${segment.className} min-w-[3px] border-r border-white/50 last:border-r-0 dark:border-neutral-950/40`}
                    style={{ width: `${(segment.value / scenario.contextWindow) * 100}%` }}
                    title={`${segment.label}: ${segment.value.toLocaleString()} tokens`}
                  />
                ) : null
              ))}
              {result.unusedTokens > 0 ? (
                <div
                  className="bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(115,115,115,0.12)_6px,rgba(115,115,115,0.12)_12px)]"
                  style={{ width: `${(result.unusedTokens / scenario.contextWindow) * 100}%` }}
                  title={`${result.unusedTokens.toLocaleString()} unallocated tokens`}
                />
              ) : null}
            </div>

            <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.segments.map((segment) => (
                <div key={segment.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-neutral-600 dark:text-neutral-300">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${segment.className}`} />
                    <span className="truncate">{segment.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {formatTokens(segment.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {result.overflow > 0 ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Scissors aria-hidden="true" className="h-4 w-4" />
                {formatTokens(result.overflow)} requested tokens did not fit
              </p>
              <p className="mt-2 text-sm leading-6 opacity-80">
                The policy selected what to retain. The provider should never discover this overflow accidentally.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <DecisionRow
              label="Evidence retained"
              value={`${result.retainedChunks} / ${retrievedChunks} chunks`}
              good={result.evidenceFits}
              detail={`Task minimum: ${scenario.essentialEvidenceChunks} chunks.`}
              icon={FileSearch}
            />
            <DecisionRow
              label="History retained"
              value={policy.id === 'summarize-history'
                ? `${result.retainedHistoryTurns} turns represented`
                : `${result.retainedHistoryTurns} / ${historyTurns} turns`}
              good={result.retainedHistoryTurns === historyTurns}
              detail={result.compressedTokens > 0
                ? `${formatTokens(result.compressedTokens)} tokens replaced by a summary contract.`
                : 'No history compaction applied.'}
              icon={History}
            />
            <DecisionRow
              label="Policy fit"
              value={result.policyRecommended ? 'Matches task' : 'Alternative policy'}
              good={result.policyRecommended}
              detail={`Recommended: ${data.policies.find((item) => item.id === scenario.recommendedPolicyId)?.label ?? scenario.recommendedPolicyId}.`}
              icon={ShieldCheck}
            />
            <DecisionRow
              label="Output contract"
              value={`${formatTokens(outputReserve)} reserved`}
              good={outputReserve >= scenario.minimumOutputTokens}
              detail={`Minimum: ${formatTokens(scenario.minimumOutputTokens)} tokens.`}
              icon={Braces}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
              <PackageCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Success contract
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {scenario.successCondition}
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionRow({
  label,
  value,
  good,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  good: boolean;
  detail: string;
  icon: typeof BookOpenCheck;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <span className={`rounded-md p-2 ${good ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 break-words font-semibold text-neutral-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function statusClasses(tone: 'emerald' | 'amber' | 'rose') {
  if (tone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  }
  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  }
  return 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
}

function formatTokens(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)}k`;
  return value.toLocaleString();
}

function LoadState() {
  return (
    <LearningLab>
      <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-500 dark:text-neutral-400">
        Loading context allocation lab...
      </div>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <div className="m-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
        <p className="flex items-center gap-2 font-semibold">
          <CircleAlert aria-hidden="true" className="h-4 w-4" />
          Context allocation lab unavailable
        </p>
        <p className="mt-2 text-sm opacity-80">{detail}</p>
      </div>
    </LearningLab>
  );
}
