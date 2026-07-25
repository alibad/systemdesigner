'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Layers3,
  LoaderCircle,
  TimerReset,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ServingScenario = {
  id: string;
  label: string;
  brief: string;
  promptTokens: number;
  outputTokens: number;
  reusablePrefixTokens: number;
  ttftSloMs: number;
  tpotSloMs: number;
  prefillTokensPerSecond: number;
  baselineTpotMs: number;
  baseThroughputTokensPerSecond: number;
  kvMibPer1kTokens: number;
  kvBudgetGib: number;
};

type ServingBudgetData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    batchWindowMs: number;
    activeSequences: number;
    prefixHitRate: number;
  };
  scenarios: ServingScenario[];
};

const BLOCK_ID = 'genai/llm-inference-optimization-serving-budget-lab';

function isServingBudgetData(value: unknown): value is ServingBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingBudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && scenario.promptTokens > 0
        && scenario.outputTokens > 0
        && scenario.kvBudgetGib > 0
      )),
  );
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function formatTokens(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function LlmInferenceOptimizationServingBudgetLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ServingBudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No serving-budget model was supplied.');
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
        if (!isServingBudgetData(payload)) {
          throw new Error('Serving-budget data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load serving data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ServingBudgetWorkbench data={data} />;
}

function ServingBudgetWorkbench({ data }: { data: ServingBudgetData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [batchWindowMs, setBatchWindowMs] = useState(data.defaults.batchWindowMs);
  const [activeSequences, setActiveSequences] = useState(data.defaults.activeSequences);
  const [prefixHitRate, setPrefixHitRate] = useState(data.defaults.prefixHitRate);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const reusableTokens = scenario.reusablePrefixTokens * (prefixHitRate / 100);
    const effectivePromptTokens = Math.max(0, scenario.promptTokens - reusableTokens);
    const concurrencyGain = Math.min(activeSequences / 96, 1.5) * 0.32;
    const windowGain = Math.min(batchWindowMs / 16, 1) * 0.1;
    const batchGain = 1 + concurrencyGain + windowGain;
    const prefillMs = effectivePromptTokens / (scenario.prefillTokensPerSecond * batchGain) * 1000;

    const kvGib = (
      activeSequences
      * (scenario.promptTokens + scenario.outputTokens)
      * scenario.kvMibPer1kTokens
      / 1000
      / 1024
    );
    const kvUtilization = kvGib / scenario.kvBudgetGib;
    const memoryPressure = Math.max(0, kvUtilization - 0.75);
    const overloadQueueMs = Math.max(0, activeSequences - 128) * 2.5;
    const fixedRoutingMs = 45;
    const queueMs = fixedRoutingMs + batchWindowMs + overloadQueueMs;
    const ttftMs = queueMs + prefillMs;
    const tpotMs = scenario.baselineTpotMs * (1 + memoryPressure * 1.3);
    const pressureFactor = Math.max(0.4, 1 - Math.max(0, kvUtilization - 0.7) * 0.8);
    const throughput = scenario.baseThroughputTokensPerSecond * batchGain * pressureFactor;

    const ttftPass = ttftMs <= scenario.ttftSloMs;
    const tpotPass = tpotMs <= scenario.tpotSloMs;
    const memoryPass = kvUtilization <= 1;
    const goodputRatio = Math.min(1, scenario.ttftSloMs / ttftMs)
      * Math.min(1, scenario.tpotSloMs / tpotMs)
      * (memoryPass ? 1 : Math.max(0.25, 1 / kvUtilization));

    let verdict = 'The serving envelope fits';
    let detail = 'The request starts and streams inside its targets with KV headroom.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!memoryPass) {
      verdict = 'KV demand exceeds the reservoir';
      detail = 'Expect preemption, recomputation, or admission failure unless concurrency or sequence length falls.';
      tone = 'rose';
    } else if (!ttftPass) {
      verdict = 'The first token misses its target';
      detail = batchWindowMs > scenario.ttftSloMs * 0.15
        ? 'Batch formation consumes too much of the TTFT budget before prefill begins.'
        : 'Uncached prompt work and queue pressure exceed the first-token budget.';
      tone = 'rose';
    } else if (!tpotPass) {
      verdict = 'The stream cadence is unstable';
      detail = 'High KV occupancy slows the modeled decode path even though the first token may arrive on time.';
      tone = 'rose';
    } else if (kvUtilization > 0.8) {
      verdict = 'The SLO passes with little memory headroom';
      detail = 'A modest context or concurrency burst can push this worker into preemption.';
      tone = 'amber';
    }

    return {
      batchGain,
      detail,
      effectivePromptTokens,
      goodputRatio,
      kvGib,
      kvUtilization,
      memoryPass,
      prefillMs,
      queueMs,
      reusedTokens: reusableTokens,
      throughput,
      tone,
      tpotMs,
      tpotPass,
      ttftMs,
      ttftPass,
      verdict,
    };
  }, [activeSequences, batchWindowMs, prefixHitRate, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setBatchWindowMs(data.defaults.batchWindowMs);
    setActiveSequences(data.defaults.activeSequences);
    setPrefixHitRate(data.defaults.prefixHitRate);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Serving budget lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={item.id === 'document-review' ? Layers3 : item.id === 'coding-agent' ? Activity : Zap}
                      accent={item.id === 'document-review' ? 'violet' : item.id === 'coding-agent' ? 'blue' : 'cyan'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Batch formation window"
                value={batchWindowMs}
                output={`${batchWindowMs}ms`}
                min={0}
                max={24}
                step={1}
                accent="amber"
                lowLabel="No wait"
                highLabel="24ms"
                onChange={setBatchWindowMs}
              />

              <LabRange
                label="Active sequences"
                value={activeSequences}
                output={`${activeSequences}`}
                min={8}
                max={192}
                step={8}
                accent="violet"
                lowLabel="8"
                highLabel="192"
                onChange={setActiveSequences}
              />

              <LabRange
                label="Measured prefix hit rate"
                value={prefixHitRate}
                output={`${prefixHitRate}%`}
                min={0}
                max={100}
                step={5}
                accent="cyan"
                lowLabel="No reuse"
                highLabel="All eligible"
                onChange={setPrefixHitRate}
              />

              <p className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                Model coefficients are lesson assumptions. Replace them with traces from the exact checkpoint, engine, and GPU.
              </p>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Time to first token"
                value={formatMs(result.ttftMs)}
                detail={`${formatMs(scenario.ttftSloMs)} target`}
                icon={Clock3}
                tone={result.ttftPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Time per output token"
                value={formatMs(result.tpotMs)}
                detail={`${formatMs(scenario.tpotSloMs)} target`}
                icon={TimerReset}
                tone={result.tpotPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled throughput"
                value={`${formatTokens(result.throughput)} tok/s`}
                detail={`${result.batchGain.toFixed(2)}x scheduling gain`}
                icon={Zap}
                tone="blue"
              />
              <LabMetric
                label="SLO goodput"
                value={`${Math.round(result.goodputRatio * 100)}%`}
                detail="Useful work inside latency and memory limits"
                icon={Activity}
                tone={result.tone}
              />
            </div>

            <RequestTimeline
              queueMs={result.queueMs}
              prefillMs={result.prefillMs}
              effectivePromptTokens={result.effectivePromptTokens}
              reusedTokens={result.reusedTokens}
              targetMs={scenario.ttftSloMs}
              pass={result.ttftPass}
            />

            <KvReservoir
              usedGib={result.kvGib}
              budgetGib={scenario.kvBudgetGib}
              activeSequences={activeSequences}
              pass={result.memoryPass}
            />

            <section className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`} />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RequestTimeline({
  queueMs,
  prefillMs,
  effectivePromptTokens,
  reusedTokens,
  targetMs,
  pass,
}: {
  queueMs: number;
  prefillMs: number;
  effectivePromptTokens: number;
  reusedTokens: number;
  targetMs: number;
  pass: boolean;
}) {
  const total = queueMs + prefillMs;
  const queueWidth = Math.min(78, Math.max(18, queueMs / total * 100));
  const prefillWidth = 100 - queueWidth;

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">First-token budget</p>
          <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Where the user waits</h4>
        </div>
        <span className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${pass ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
          {formatMs(total)} / {formatMs(targetMs)}
        </span>
      </div>
      <div className="mt-4 flex h-14 w-full overflow-hidden rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div
          className="flex min-w-0 items-center justify-center bg-amber-100 px-2 text-center text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100"
          style={{ width: `${queueWidth}%` }}
          title={`Admission and batching: ${formatMs(queueMs)}`}
        >
          <span className="truncate">Queue {formatMs(queueMs)}</span>
        </div>
        <div
          className="flex min-w-0 items-center justify-center bg-blue-100 px-2 text-center text-xs font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100"
          style={{ width: `${prefillWidth}%` }}
          title={`Uncached prefill: ${formatMs(prefillMs)}`}
        >
          <span className="truncate">Prefill {formatMs(prefillMs)}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
        <p><strong className="text-neutral-900 dark:text-white">Reused:</strong> {formatTokens(reusedTokens)} prefix tokens</p>
        <p><strong className="text-neutral-900 dark:text-white">Computed:</strong> {formatTokens(effectivePromptTokens)} prompt tokens</p>
      </div>
    </section>
  );
}

function KvReservoir({
  usedGib,
  budgetGib,
  activeSequences,
  pass,
}: {
  usedGib: number;
  budgetGib: number;
  activeSequences: number;
  pass: boolean;
}) {
  const utilization = usedGib / budgetGib;
  const width = Math.min(100, utilization * 100);

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Boxes aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">KV reservoir</p>
            <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{activeSequences} growing sequences</h4>
          </div>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${pass ? 'text-neutral-700 dark:text-neutral-200' : 'text-rose-700 dark:text-rose-300'}`}>
          {usedGib.toFixed(1)} / {budgetGib} GiB
        </span>
      </div>
      <div className="mt-4 h-5 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-label={`KV cache ${Math.round(utilization * 100)} percent full`}>
        <div
          className={`h-full transition-[width] motion-reduce:transition-none ${pass ? utilization > 0.8 ? 'bg-amber-500' : 'bg-violet-500' : 'bg-rose-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>Headroom</span>
        <span>{Math.round(utilization * 100)}% occupied</span>
      </div>
    </section>
  );
}

function LoadState() {
  return (
    <div className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading serving budget lab...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Serving budget lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
