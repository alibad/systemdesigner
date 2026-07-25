'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  GitFork,
  Route,
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

type CacheState = 'hit' | 'miss';
type Parallelism = 'parallel' | 'serial';

type Stage = {
  id: string;
  label: string;
  defaultP95Ms: number;
  minMs: number;
  maxMs: number;
  stepMs: number;
  required: boolean;
};

type RequestPathModel = {
  targetSlo: { defaultMs: number; minMs: number; maxMs: number; stepMs: number };
  stages: Stage[];
  defaults: { cacheState: CacheState; parallelism: Parallelism; includeRecommendations: boolean };
};

type StageValue = Stage & { value: number; detail: string; tone: string };

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

export default function LatenciesRequestPathBudgetLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RequestPathModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetSlo, setTargetSlo] = useState(300);
  const [cacheState, setCacheState] = useState<CacheState>('hit');
  const [parallelism, setParallelism] = useState<Parallelism>('parallel');
  const [includeRecommendations, setIncludeRecommendations] = useState(false);
  const [stageValues, setStageValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The request-path budget model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RequestPathModel>;
      })
      .then((model) => {
        setData(model);
        setTargetSlo(model.targetSlo.defaultMs);
        setCacheState(model.defaults.cacheState);
        setParallelism(model.defaults.parallelism);
        setIncludeRecommendations(model.defaults.includeRecommendations);
        setStageValues(Object.fromEntries(model.stages.map((stage) => [stage.id, stage.defaultP95Ms])));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the request-path budget model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const byId = Object.fromEntries(data.stages.map((stage) => [stage.id, stage]));
    const value = (id: string) => stageValues[id] ?? byId[id]?.defaultP95Ms ?? 0;
    const cache = cacheState === 'hit' ? byId.cacheHit : byId.cacheMiss;
    const parallelGroup = parallelism === 'parallel'
      ? Math.max(value('price'), value('availability'))
      : value('price') + value('availability');
    const stages: StageValue[] = [
      { ...byId.network, value: value('network'), detail: 'Required client-to-edge and response work', tone: 'bg-blue-500' },
      { ...byId.gateway, value: value('gateway'), detail: 'Required gateway and authorization work', tone: 'bg-violet-500' },
      {
        ...cache,
        value: value(cache.id),
        detail: cacheState === 'hit' ? 'The cache returns a usable response' : 'The miss reaches the authoritative store',
        tone: cacheState === 'hit' ? 'bg-emerald-500' : 'bg-rose-500',
      },
      {
        id: 'enrichment',
        label: parallelism === 'parallel' ? 'Price and availability in parallel' : 'Price then availability in sequence',
        defaultP95Ms: parallelGroup,
        minMs: 0,
        maxMs: 0,
        stepMs: 1,
        required: true,
        value: parallelGroup,
        detail: parallelism === 'parallel'
          ? `max(${formatMs(value('price'))}, ${formatMs(value('availability'))})`
          : `${formatMs(value('price'))} + ${formatMs(value('availability'))}`,
        tone: 'bg-amber-500',
      },
    ];

    if (includeRecommendations) {
      stages.push({
        ...byId.recommendations,
        value: value('recommendations'),
        detail: 'Optional product content made synchronous',
        tone: 'bg-fuchsia-500',
      });
    }

    const totalMs = stages.reduce((sum, stage) => sum + stage.value, 0);
    const dominant = stages.reduce((largest, stage) => stage.value > largest.value ? stage : largest, stages[0]);
    return { dominant, remainingMs: targetSlo - totalMs, stages, totalMs };
  }, [cacheState, data, includeRecommendations, parallelism, stageValues, targetSlo]);

  if (loadError) return <LabError title="Request-path budget lab unavailable" detail={loadError} />;
  if (!data || !model) return <LabLoading label="Loading request-path budget lab" />;

  const isOverBudget = model.remainingMs < 0;
  const hasThinMargin = !isOverBudget && model.remainingMs < targetSlo * 0.15;
  const warning = isOverBudget || hasThinMargin;
  const cacheStage = data.stages.find((stage) => stage.id === (cacheState === 'hit' ? 'cacheHit' : 'cacheMiss'));
  const reset = () => {
    setTargetSlo(data.targetSlo.defaultMs);
    setCacheState(data.defaults.cacheState);
    setParallelism(data.defaults.parallelism);
    setIncludeRecommendations(data.defaults.includeRecommendations);
    setStageValues(Object.fromEntries(data.stages.map((stage) => [stage.id, stage.defaultP95Ms])));
  };

  return (
    <div data-content-block="reference/latencies-request-path-budget-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Critical-path budget lab"
          title="Build a p95 path from required stages"
          description="This is a planning model, not a composed production percentile. Change the path shape and stage estimates to see which required wait consumes the user-facing deadline."
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange label="Target p95 SLO" value={targetSlo} output={formatMs(targetSlo)} min={data.targetSlo.minMs} max={data.targetSlo.maxMs} step={data.targetSlo.stepMs} accent="violet" lowLabel="tight interaction" highLabel="slower workflow" onChange={setTargetSlo} />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Cache outcome on this request</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={cacheState === 'hit'} label="Cache hit" detail="Use the short, safe cached read path." icon={CheckCircle2} accent="emerald" onClick={() => setCacheState('hit')} />
                  <LabChoice selected={cacheState === 'miss'} label="Cache miss" detail="Add the authoritative store to the synchronous path." icon={Database} accent="rose" onClick={() => setCacheState('miss')} />
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Required enrichment shape</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={parallelism === 'parallel'} label="Parallel reads" detail="Wait for the slower of price and availability." icon={GitFork} accent="amber" onClick={() => setParallelism('parallel')} />
                  <LabChoice selected={parallelism === 'serial'} label="Serial reads" detail="Wait for price, then wait again for availability." icon={Clock3} accent="rose" onClick={() => setParallelism('serial')} />
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                <input type="checkbox" checked={includeRecommendations} onChange={(event) => setIncludeRecommendations(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-500" />
                <span><span className="block font-semibold text-neutral-900 dark:text-white">Require recommendations before responding</span><span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Toggle an optional feature onto the synchronous critical path.</span></span>
              </label>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Stage p95 planning values</legend>
                <div className="mt-3 space-y-5">
                  {data.stages.filter((stage) => stage.id !== 'cacheHit' && stage.id !== 'cacheMiss').map((stage) => (
                    <LabRange key={stage.id} label={stage.label} value={stageValues[stage.id] ?? stage.defaultP95Ms} output={formatMs(stageValues[stage.id] ?? stage.defaultP95Ms)} min={stage.minMs} max={stage.maxMs} step={stage.stepMs} accent={stage.id === 'recommendations' ? 'violet' : 'cyan'} onChange={(value) => setStageValues((current) => ({ ...current, [stage.id]: value }))} />
                  ))}
                  {cacheStage ? <LabRange label={cacheStage.label} value={stageValues[cacheStage.id] ?? cacheStage.defaultP95Ms} output={formatMs(stageValues[cacheStage.id] ?? cacheStage.defaultP95Ms)} min={cacheStage.minMs} max={cacheStage.maxMs} step={cacheStage.stepMs} accent={cacheState === 'hit' ? 'emerald' : 'rose'} onChange={(value) => setStageValues((current) => ({ ...current, [cacheStage.id]: value }))} /> : null}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Modeled critical path" value={formatMs(model.totalMs)} detail="Sum of required serial stages and parallel maxima." icon={Route} tone={isOverBudget ? 'rose' : 'violet'} />
              <LabMetric label="Remaining SLO budget" value={isOverBudget ? `${formatMs(Math.abs(model.remainingMs))} over` : `${formatMs(model.remainingMs)} left`} detail="Headroom for variance, fallback, and response completion." icon={isOverBudget ? TriangleAlert : CheckCircle2} tone={warning ? 'amber' : 'emerald'} />
              <LabMetric label="Dominant contributor" value={formatMs(model.dominant.value)} detail={model.dominant.label} icon={Gauge} tone="amber" />
              <LabMetric label="Path state" value={isOverBudget ? 'Missed' : hasThinMargin ? 'Thin margin' : 'Has headroom'} detail={cacheState === 'miss' ? 'A cache miss is active.' : 'A cache hit is active.'} icon={isOverBudget ? TriangleAlert : CheckCircle2} tone={isOverBudget ? 'rose' : hasThinMargin ? 'amber' : 'emerald'} />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">Modeled required path</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Widths are relative to this simplified total. The parallel group contributes its maximum, not the sum.</p></div>
              <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {model.stages.map((stage) => <li key={stage.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_76px] sm:items-center sm:gap-4"><div className="min-w-0"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-neutral-900 dark:text-neutral-100">{stage.label}</span><span className="shrink-0 font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:hidden">{formatMs(stage.value)}</span></div><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{stage.detail}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className={`h-full rounded-full ${stage.tone}`} style={{ width: `${Math.max(4, (stage.value / model.totalMs) * 100)}%` }} /></div></div><span className="hidden text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">{formatMs(stage.value)}</span></li>)}
              </ol>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${isOverBudget ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : hasThinMargin ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Budget consequence</p>
              <p className="mt-2 text-lg font-semibold">{isOverBudget ? 'The required plan misses the selected p95 target.' : hasThinMargin ? 'The plan fits, but has too little headroom to trust without trace evidence.' : 'The model leaves explicit room for normal p95 variation and a bounded fallback.'}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{model.dominant.id === 'network' ? 'The client and edge leg dominates. Check user geography, connection reuse, payload size, caching, and whether the response can be served closer to the caller.' : model.dominant.id === 'cacheMiss' ? 'The authoritative read dominates. Protect the miss path with a query budget, coalesce repeated misses, and ensure the cache policy is safe for this data.' : model.dominant.id === 'enrichment' ? 'The required enrichment group dominates. Remove an unnecessary synchronous dependency or keep independent reads parallel while measuring their joint tail.' : 'Start with the named dominant stage, then remeasure the end-to-end distribution. Do not optimize a smaller term until the path changes.'}</p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading({ label }: { label: string }) {
  return <div data-content-block="reference/latencies-request-path-budget-lab"><div className="min-h-[560px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} /></div>;
}

function LabError({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block="reference/latencies-request-path-budget-lab"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
