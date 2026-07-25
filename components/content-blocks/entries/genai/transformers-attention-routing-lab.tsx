'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Eye,
  Focus,
  Lock,
  Network,
  ScanSearch,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ModeId = 'bidirectional' | 'causal';
type HeadId = 'semantic' | 'local';

type AttentionMode = {
  id: ModeId;
  label: string;
  detail: string;
};

type AttentionHead = {
  id: HeadId;
  label: string;
  detail: string;
};

type Token = {
  id: string;
  label: string;
  position: number;
  role: string;
};

type AttentionLink = {
  tokenId: string;
  relation: string;
  score: number;
};

type Query = {
  tokenId: string;
  prompt: string;
  links: AttentionLink[];
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  requiredModeId: ModeId;
  contract: string;
  tokens: Token[];
  queries: Query[];
};

type AttentionModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    queryTokenId: string;
    headId: HeadId;
    modeId: ModeId;
    sharpness: number;
  };
  modes: AttentionMode[];
  heads: AttentionHead[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/transformers-attention-routing-lab';

function isAttentionModel(value: unknown): value is AttentionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AttentionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.modes)
      && candidate.modes.length === 2
      && Array.isArray(candidate.heads)
      && candidate.heads.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.every((scenario) => scenario.tokens?.length && scenario.queries?.length),
  );
}

function softmax(scores: number[]) {
  if (!scores.length) return [];
  const maximum = Math.max(...scores);
  const numerators = scores.map((score) => Math.exp(score - maximum));
  const denominator = numerators.reduce((sum, value) => sum + value, 0);
  return numerators.map((value) => value / denominator);
}

export default function TransformersAttentionRoutingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<AttentionModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No attention-routing model was supplied.');
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
        if (!isAttentionModel(payload)) throw new Error('Attention-routing data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load attention data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <AttentionLab data={data} /> : <LoadState />}
    </div>
  );
}

function AttentionLab({ data }: { data: AttentionModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [queryTokenId, setQueryTokenId] = useState(data.defaults.queryTokenId);
  const [headId, setHeadId] = useState<HeadId>(data.defaults.headId);
  const [modeId, setModeId] = useState<ModeId>(data.defaults.modeId);
  const [sharpness, setSharpness] = useState(data.defaults.sharpness);

  const result = useMemo(() => {
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const query = scenario.queries.find((item) => item.tokenId === queryTokenId) ?? scenario.queries[0];
    const queryToken = scenario.tokens.find((token) => token.id === query.tokenId) ?? scenario.tokens[0];
    const head = data.heads.find((item) => item.id === headId) ?? data.heads[0];
    const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];

    const scored = scenario.tokens.map((token) => {
      const blocked = mode.id === 'causal' && token.position > queryToken.position;
      const link = query.links.find((item) => item.tokenId === token.id);
      const distance = Math.abs(token.position - queryToken.position);
      const baseScore = head.id === 'semantic'
        ? link?.score ?? (token.id === queryToken.id ? 1.15 : 0.15)
        : token.id === queryToken.id
          ? 0.9
          : 3 / (distance + 1);
      return { token, blocked, link, score: baseScore * sharpness };
    });
    const visible = scored.filter((item) => !item.blocked);
    const weights = softmax(visible.map((item) => item.score));
    let visibleIndex = 0;
    const weighted = scored.map((item) => ({
      ...item,
      weight: item.blocked ? 0 : weights[visibleIndex++],
    }));
    const contextCandidates = weighted.filter(
      (item) => !item.blocked && item.token.id !== queryToken.id,
    );
    const strongest = contextCandidates.reduce(
      (current, item) => (item.weight > current.weight ? item : current),
      contextCandidates[0],
    );
    const futureWeight = weighted
      .filter((item) => item.token.position > queryToken.position)
      .reduce((sum, item) => sum + item.weight, 0);
    const modeMatches = mode.id === scenario.requiredModeId;
    const verdict = modeMatches
      ? mode.id === 'causal'
        ? 'Correct boundary: future targets are hidden'
        : 'Correct boundary: complete context is available'
      : scenario.requiredModeId === 'causal'
        ? 'Leakage: future targets influence this representation'
        : 'Context loss: useful right-side evidence is hidden';

    return {
      futureWeight,
      head,
      mode,
      modeMatches,
      query,
      queryToken,
      scenario,
      strongest,
      verdict,
      visibleCount: visible.length,
      weighted,
    };
  }, [data, headId, modeId, queryTokenId, scenarioId, sharpness]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setQueryTokenId(scenario.queries[0].tokenId);
    setModeId(scenario.requiredModeId);
  };

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setQueryTokenId(data.defaults.queryTokenId);
    setHeadId(data.defaults.headId);
    setModeId(data.defaults.modeId);
    setSharpness(data.defaults.sharpness);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Attention routing workbench"
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
                1. Choose the task
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((scenario) => (
                  <LabChoice
                    key={scenario.id}
                    selected={scenario.id === result.scenario.id}
                    label={scenario.label}
                    detail={scenario.brief}
                    icon={scenario.requiredModeId === 'causal' ? Lock : ScanSearch}
                    accent={scenario.requiredModeId === 'causal' ? 'amber' : 'blue'}
                    onClick={() => chooseScenario(scenario)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose the query token
              </legend>
              <div className="mt-3 space-y-2">
                {result.scenario.queries.map((query) => {
                  const token = result.scenario.tokens.find((item) => item.id === query.tokenId);
                  return (
                    <LabChoice
                      key={query.tokenId}
                      selected={query.tokenId === result.query.tokenId}
                      label={token ? `Token: ${token.label}` : query.tokenId}
                      detail={query.prompt}
                      icon={Focus}
                      accent="violet"
                      onClick={() => setQueryTokenId(query.tokenId)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose the score pattern
              </legend>
              <div className="mt-3 space-y-2">
                {data.heads.map((head) => (
                  <LabChoice
                    key={head.id}
                    selected={head.id === result.head.id}
                    label={head.label}
                    detail={head.detail}
                    icon={head.id === 'semantic' ? Sparkles : Network}
                    accent={head.id === 'semantic' ? 'violet' : 'cyan'}
                    onClick={() => setHeadId(head.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Set the visibility mask
              </legend>
              <div className="mt-3 space-y-2">
                {data.modes.map((mode) => (
                  <LabChoice
                    key={mode.id}
                    selected={mode.id === result.mode.id}
                    label={mode.label}
                    detail={mode.detail}
                    icon={mode.id === 'causal' ? Lock : Eye}
                    accent={mode.id === result.scenario.requiredModeId ? 'emerald' : 'rose'}
                    onClick={() => setModeId(mode.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Score multiplier"
              value={sharpness}
              output={`${sharpness.toFixed(1)}x`}
              min={0.5}
              max={2}
              step={0.1}
              accent="violet"
              lowLabel="Flatter blend"
              highLabel="Sharper blend"
              onChange={setSharpness}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Query"
            value={result.queryToken.label}
            detail={`Position ${result.queryToken.position + 1}: ${result.queryToken.role}.`}
            icon={Focus}
            tone="violet"
          />
          <LabMetric
            label="Visible keys"
            value={`${result.visibleCount}/${result.scenario.tokens.length}`}
            detail={result.mode.label}
            icon={result.mode.id === 'causal' ? Lock : Eye}
            tone={result.modeMatches ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Strongest context"
            value={result.strongest.token.label}
            detail={`${(result.strongest.weight * 100).toFixed(1)}% of the value blend.`}
            icon={Sparkles}
            tone="blue"
          />
          <LabMetric
            label="Future contribution"
            value={`${(result.futureWeight * 100).toFixed(1)}%`}
            detail={result.scenario.requiredModeId === 'causal' ? 'Must remain zero for this task.' : 'Allowed by this task contract.'}
            icon={result.futureWeight > 0 && result.scenario.requiredModeId === 'causal' ? TriangleAlert : CheckCircle2}
            tone={result.futureWeight > 0 && result.scenario.requiredModeId === 'causal' ? 'rose' : 'emerald'}
          />
        </div>

        <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="border-b border-neutral-200 px-4 py-4 md:px-5 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Normalized value contribution
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {result.query.prompt}
            </p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 md:p-5">
            {result.weighted.map((item) => {
              const isQuery = item.token.id === result.queryToken.id;
              const isFuture = item.token.position > result.queryToken.position;
              return (
                <div
                  key={item.token.id}
                  className={`min-w-0 rounded-md border p-3 ${
                    item.blocked
                      ? 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-500'
                      : isQuery
                        ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-300 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-100 dark:ring-violet-800'
                        : 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.token.position + 1}. {item.token.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs opacity-70">
                        {isQuery ? 'Query token' : item.link?.relation ?? item.token.role}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {item.blocked ? 'Masked' : `${(item.weight * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                        isQuery ? 'bg-violet-500' : isFuture ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: item.blocked ? '0%' : `${Math.max(2, item.weight * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div
          className={`mt-5 rounded-md border p-4 ${
            result.modeMatches
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            {result.modeMatches ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">{result.verdict}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{result.scenario.contract}</p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState() {
  return (
    <div className="my-7 min-h-56 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading attention routing lab" />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
      <p className="font-semibold">Attention routing lab unavailable</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
