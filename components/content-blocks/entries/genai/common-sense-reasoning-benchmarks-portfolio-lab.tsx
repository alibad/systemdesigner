'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FlaskConical,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ShieldAlert,
  Target,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Benchmark = {
  id: string;
  label: string;
  capability: string;
  chancePct: number;
  secondsPerItem: number;
};

type ProductProfile = {
  id: string;
  label: string;
  detail: string;
  criticalBenchmarkId: string;
  weights: Record<string, number>;
};

type PromptPolicy = {
  id: string;
  label: string;
  detail: string;
  comparable: boolean;
  promptTokensPerItem: number;
};

type PortfolioData = {
  defaultProductId: string;
  defaultPromptId: string;
  defaultItemBudget: number;
  minimumSliceItems: number;
  benchmarks: Benchmark[];
  products: ProductProfile[];
  promptPolicies: PromptPolicy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/common-sense-reasoning-benchmarks/data/benchmark-portfolio.json';

function isPortfolioData(value: unknown): value is PortfolioData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortfolioData>;
  return typeof candidate.defaultProductId === 'string'
    && typeof candidate.defaultPromptId === 'string'
    && typeof candidate.defaultItemBudget === 'number'
    && typeof candidate.minimumSliceItems === 'number'
    && Array.isArray(candidate.benchmarks)
    && candidate.benchmarks.length > 0
    && Array.isArray(candidate.products)
    && candidate.products.length > 0
    && Array.isArray(candidate.promptPolicies)
    && candidate.promptPolicies.length > 0;
}

function allocateItems(
  benchmarks: Benchmark[],
  weights: Record<string, number>,
  budget: number,
) {
  const provisional = benchmarks.map((benchmark) => {
    const exact = budget * ((weights[benchmark.id] ?? 0) / 100);
    return { benchmark, count: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remaining = budget - provisional.reduce((sum, item) => sum + item.count, 0);
  const priority = [...provisional].sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    priority[index % priority.length].count += 1;
  }
  return provisional;
}

function formatRuntime(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function CommonSenseReasoningBenchmarksPortfolioLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [productId, setProductId] = useState('');
  const [promptId, setPromptId] = useState('');
  const [itemBudget, setItemBudget] = useState(1200);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isPortfolioData(payload)) throw new Error('Benchmark portfolio data is incomplete.');
        if (!active) return;
        setData(payload);
        setProductId(payload.defaultProductId);
        setPromptId(payload.defaultPromptId);
        setItemBudget(payload.defaultItemBudget);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the portfolio.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const product = data?.products.find((item) => item.id === productId) ?? data?.products[0];
  const prompt = data?.promptPolicies.find((item) => item.id === promptId) ?? data?.promptPolicies[0];

  const model = useMemo(() => {
    if (!data || !product || !prompt) return null;
    const allocation = allocateItems(data.benchmarks, product.weights, itemBudget);
    const chanceCorrect = allocation.reduce(
      (sum, item) => sum + item.count * (item.benchmark.chancePct / 100),
      0,
    );
    const runtimeSeconds = allocation.reduce(
      (sum, item) => sum + item.count * item.benchmark.secondsPerItem,
      0,
    );
    const coveredWeight = allocation.reduce(
      (sum, item) => item.count >= data.minimumSliceItems
        ? sum + (product.weights[item.benchmark.id] ?? 0)
        : sum,
      0,
    );
    const critical = allocation.find(
      (item) => item.benchmark.id === product.criticalBenchmarkId,
    );
    const criticalCovered = Boolean(critical && critical.count >= data.minimumSliceItems);
    const blindSpots = allocation.filter((item) => item.count < data.minimumSliceItems);
    const promptTokens = itemBudget * prompt.promptTokensPerItem;

    let state: 'ready' | 'expand' | 'diagnostic';
    let decision: string;
    let explanation: string;
    if (!criticalCovered || coveredWeight < 80) {
      state = 'expand';
      decision = 'Expand the sampled portfolio';
      explanation = !criticalCovered
        ? `The critical ${critical?.benchmark.label ?? 'benchmark'} slice has fewer than ${data.minimumSliceItems} items.`
        : `Only ${coveredWeight}% of declared product weight has the minimum diagnostic sample.`;
    } else if (!prompt.comparable) {
      state = 'diagnostic';
      decision = 'Run as product diagnosis';
      explanation = 'The product prompt is relevant to deployment, but this score is not directly comparable to the frozen public protocol.';
    } else {
      state = 'ready';
      decision = 'Portfolio is ready to freeze';
      explanation = 'Critical coverage and breadth pass. Version the sample and protocol before collecting candidate results.';
    }

    return {
      allocation,
      blindSpots,
      chanceCorrect,
      coveredWeight,
      critical,
      decision,
      explanation,
      promptTokens,
      runtimeSeconds,
      state,
    };
  }, [data, itemBudget, product, prompt]);

  function reset() {
    if (!data) return;
    setProductId(data.defaultProductId);
    setPromptId(data.defaultPromptId);
    setItemBudget(data.defaultItemBudget);
  }

  return (
    <div data-content-block="genai/common-sense-reasoning-benchmarks-portfolio-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Portfolio allocation lab"
          title="Spend evaluation effort where failure matters"
          description="Choose a product and protocol, then resize the sample. The benchmark mix, chance baseline, coverage, runtime, and evidence status move together."
          icon={BrainCircuit}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !product || !prompt || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Intended product
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.products.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === product.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Target}
                        accent={item.id === 'home-helper' ? 'amber' : item.id === 'social-companion' ? 'rose' : item.id === 'science-tutor' ? 'emerald' : 'cyan'}
                        onClick={() => setProductId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Total evaluated items"
                  value={itemBudget}
                  output={itemBudget.toLocaleString()}
                  min={300}
                  max={2400}
                  step={100}
                  lowLabel="Fast diagnostic"
                  highLabel="Broader evidence"
                  accent="cyan"
                  onChange={setItemBudget}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Prompt contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.promptPolicies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === prompt.id}
                        label={item.label}
                        detail={item.detail}
                        icon={MessageSquareText}
                        accent={item.comparable ? 'blue' : 'amber'}
                        onClick={() => setPromptId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <LabMetric
                  label="Covered product weight"
                  value={`${model.coveredWeight}%`}
                  detail={`Slices need at least ${data.minimumSliceItems} items to count.`}
                  icon={BarChart3}
                  tone={model.coveredWeight >= 80 ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Expected correct by chance"
                  value={`~${Math.round(model.chanceCorrect)}`}
                  detail="Depends on the option count of every allocated item."
                  icon={FlaskConical}
                  tone="violet"
                />
                <LabMetric
                  label="Illustrative serial runtime"
                  value={formatRuntime(model.runtimeSeconds)}
                  detail="Use measured model latency for a real budget."
                  icon={Clock3}
                  tone="blue"
                />
                <LabMetric
                  label="Prompt input"
                  value={`~${Math.round(model.promptTokens / 1000)}k tokens`}
                  detail={prompt.comparable ? 'Frozen comparison protocol' : 'Product diagnostic protocol'}
                  icon={MessageSquareText}
                  tone={prompt.comparable ? 'cyan' : 'amber'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">{product.label} allocation</h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{product.detail}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Critical: {model.critical?.benchmark.label}
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {model.allocation.map((item) => {
                    const weight = product.weights[item.benchmark.id] ?? 0;
                    const covered = item.count >= data.minimumSliceItems;
                    const critical = item.benchmark.id === product.criticalBenchmarkId;
                    return (
                      <div key={item.benchmark.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.benchmark.label}
                            {critical ? <span className="ml-2 text-xs font-medium text-rose-600 dark:text-rose-300">Critical</span> : null}
                          </p>
                          <p className="tabular-nums text-neutral-600 dark:text-neutral-300">
                            {item.count} items · {weight}% · chance {item.benchmark.chancePct}%
                          </p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full ${covered ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-amber-500 dark:bg-amber-400'}`}
                            style={{ width: `${Math.max(3, weight)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {item.benchmark.capability}{covered ? '' : ` · below the ${data.minimumSliceItems}-item diagnostic minimum`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={`rounded-md border p-4 ${model.state === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : model.state === 'diagnostic' ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {model.state === 'ready' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : model.state === 'diagnostic' ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{model.decision}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{model.explanation}</p>
                    {model.blindSpots.length > 0 ? (
                      <p className="mt-2 text-xs leading-5 opacity-80">
                        Thin slices: {model.blindSpots.map((item) => item.benchmark.label).join(', ')}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                This teaching model plans a stratified sample. Runtime and token values are illustrative; measure them with the frozen candidate and evaluator before budgeting a real run.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Portfolio data could not load</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900">
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="text-center text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
          <p className="mt-3 text-sm">Loading benchmark portfolio...</p>
        </div>
      )}
    </div>
  );
}
