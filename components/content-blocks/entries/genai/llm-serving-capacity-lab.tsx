'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, Gauge, MemoryStick, Timer, TriangleAlert, WalletCards, Workflow } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ModelOption = {
  id: string;
  label: string;
  precision: string;
  weightsGiB: number;
  runtimeGiB: number;
  kvGiBPerToken: number;
  quality: string;
};

type AcceleratorOption = {
  id: string;
  label: string;
  memoryGiB: number;
  prefillTokensPerSecond: number;
  decodeTokensPerSecond: number;
  hourlyCost: number;
};

type CapacityModel = {
  title: string;
  description: string;
  models: ModelOption[];
  accelerators: AcceleratorOption[];
  defaults: {
    model: string;
    accelerator: string;
    promptTokens: number;
    outputTokens: number;
    concurrency: number;
    cachePercent: number;
    arrivalRate: number;
    batchPolicy: 'static' | 'continuous';
  };
};

const BLOCK_ID = 'genai/llm-serving-capacity-lab';

export default function LlmServingCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No capacity model was supplied.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<CapacityModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the capacity model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityModel }) {
  const [modelId, setModelId] = useState(data.defaults.model);
  const [acceleratorId, setAcceleratorId] = useState(data.defaults.accelerator);
  const [promptTokens, setPromptTokens] = useState(data.defaults.promptTokens);
  const [outputTokens, setOutputTokens] = useState(data.defaults.outputTokens);
  const [concurrency, setConcurrency] = useState(data.defaults.concurrency);
  const [cachePercent, setCachePercent] = useState(data.defaults.cachePercent);
  const [arrivalRate, setArrivalRate] = useState(data.defaults.arrivalRate);
  const [batchPolicy, setBatchPolicy] = useState<'static' | 'continuous'>(data.defaults.batchPolicy);

  const result = useMemo(() => {
    const model = data.models.find((item) => item.id === modelId) ?? data.models[0];
    const accelerator = data.accelerators.find((item) => item.id === acceleratorId) ?? data.accelerators[0];
    const baseMemoryGiB = model.weightsGiB + model.runtimeGiB;
    const physicalCacheGiB = Math.max(0, accelerator.memoryGiB - baseMemoryGiB);
    const configuredCacheGiB = accelerator.memoryGiB * cachePercent / 100;
    const usableCacheGiB = Math.min(physicalCacheGiB, configuredCacheGiB);
    const requestCacheGiB = (promptTokens + outputTokens) * model.kvGiBPerToken;
    const cacheDemandGiB = concurrency * requestCacheGiB;
    const cacheSlots = requestCacheGiB > 0 ? Math.floor(usableCacheGiB / requestCacheGiB) : 0;
    const activeSequences = Math.min(concurrency, Math.max(0, cacheSlots));
    const batchMultiplier = batchPolicy === 'continuous' ? 1 : 0.72;
    const prefillMultiplier = batchPolicy === 'continuous' ? 0.92 : 0.76;
    const decodeThroughput = accelerator.decodeTokensPerSecond * batchMultiplier * Math.min(1, activeSequences / 8);
    const serviceRate = outputTokens > 0 ? decodeThroughput / outputTokens : 0;
    const utilization = serviceRate > 0 ? arrivalRate / serviceRate : Infinity;
    const memoryFits = baseMemoryGiB <= accelerator.memoryGiB && cacheDemandGiB <= usableCacheGiB;
    const queueDelayMs = !memoryFits
      ? Infinity
      : utilization >= 0.95
        ? 9_999
        : Math.round(35 + utilization / Math.max(0.01, serviceRate - arrivalRate) * 1_000 + (batchPolicy === 'static' ? 120 : 25));
    const ttftMs = !memoryFits
      ? Infinity
      : Math.round(queueDelayMs + 45 + promptTokens / (accelerator.prefillTokensPerSecond * prefillMultiplier) * 1_000);
    const costPerMillionOutput = decodeThroughput > 0 ? accelerator.hourlyCost / decodeThroughput * 1_000_000 / 3600 : Infinity;
    const state = !memoryFits
      ? { label: 'Memory admission blocked', tone: 'rose' as const, detail: 'The requested KV-cache reservation does not fit the configured cache budget.' }
      : utilization >= 1
        ? { label: 'Overloaded', tone: 'rose' as const, detail: 'Arrival rate exceeds modeled completion capacity. New work should be rejected or routed.' }
        : utilization >= 0.8
          ? { label: 'Queue pressure', tone: 'amber' as const, detail: 'Tail latency is fragile. Protect the interactive class before saturation.' }
          : { label: 'Within illustrative budget', tone: 'emerald' as const, detail: 'Calibrate this healthy-looking state with production traces and peak-memory measurements.' };

    return {
      accelerator,
      activeSequences,
      baseMemoryGiB,
      cacheDemandGiB,
      cacheSlots,
      configuredCacheGiB,
      costPerMillionOutput,
      decodeThroughput,
      memoryFits,
      model,
      queueDelayMs,
      requestCacheGiB,
      serviceRate,
      state,
      ttftMs,
      usableCacheGiB,
      utilization,
    };
  }, [acceleratorId, arrivalRate, batchPolicy, cachePercent, concurrency, data, modelId, outputTokens, promptTokens]);

  const reset = () => {
    setModelId(data.defaults.model);
    setAcceleratorId(data.defaults.accelerator);
    setPromptTokens(data.defaults.promptTokens);
    setOutputTokens(data.defaults.outputTokens);
    setConcurrency(data.defaults.concurrency);
    setCachePercent(data.defaults.cachePercent);
    setArrivalRate(data.defaults.arrivalRate);
    setBatchPolicy(data.defaults.batchPolicy);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Serving capacity lab" title={data.title} description={data.description} icon={Workflow} accent="cyan" onReset={reset} />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Pick a model and worker</legend>
                <div className="mt-3 space-y-2">
                  {data.models.map((option) => <LabChoice key={option.id} selected={modelId === option.id} label={`${option.label} (${option.precision})`} detail={option.quality} icon={MemoryStick} accent="cyan" onClick={() => setModelId(option.id)} />)}
                </div>
                <div className="mt-3 space-y-2">
                  {data.accelerators.map((option) => <LabChoice key={option.id} selected={acceleratorId === option.id} label={option.label} detail={`${option.decodeTokensPerSecond.toLocaleString()} modeled decode tokens/s`} icon={Gauge} accent="blue" onClick={() => setAcceleratorId(option.id)} />)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Shape the request and batch</legend>
                <div className="mt-3 space-y-5">
                  <LabRange label="Prompt tokens" value={promptTokens} output={promptTokens.toLocaleString()} min={200} max={12000} step={200} accent="cyan" lowLabel="Short" highLabel="Long context" onChange={setPromptTokens} />
                  <LabRange label="Output tokens" value={outputTokens} output={outputTokens.toLocaleString()} min={50} max={2000} step={50} accent="cyan" lowLabel="Brief" highLabel="Long generation" onChange={setOutputTokens} />
                  <LabRange label="Concurrent sequences" value={concurrency} output={concurrency.toString()} min={1} max={64} accent="violet" lowLabel="Few" highLabel="Many" onChange={setConcurrency} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <LabChoice selected={batchPolicy === 'static'} label="Static batch" detail="Wait for a group." icon={Database} accent="amber" onClick={() => setBatchPolicy('static')} />
                    <LabChoice selected={batchPolicy === 'continuous'} label="Continuous" detail="Admit between decode steps." icon={Workflow} accent="violet" onClick={() => setBatchPolicy('continuous')} />
                  </div>
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Reserve memory and set demand</legend>
                <div className="mt-3 space-y-5">
                  <LabRange label="Cache allocation" value={cachePercent} output={`${cachePercent}% of worker memory`} min={10} max={85} step={5} accent="amber" lowLabel="Weights first" highLabel="More sequences" onChange={setCachePercent} />
                  <LabRange label="Arrival rate" value={arrivalRate} output={`${arrivalRate.toFixed(1)} requests/s`} min={0.1} max={8} step={0.1} accent="rose" lowLabel="Light traffic" highLabel="Burst pressure" onChange={setArrivalRate} />
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Memory reservation" value={`${(result.baseMemoryGiB + result.cacheDemandGiB).toFixed(1)} / ${result.accelerator.memoryGiB} GiB`} detail={`Weights and runtime: ${result.baseMemoryGiB.toFixed(1)} GiB. Requested KV cache: ${result.cacheDemandGiB.toFixed(1)} GiB.`} icon={MemoryStick} tone={result.memoryFits ? 'cyan' : 'rose'} />
              <LabMetric label="Time to first token" value={Number.isFinite(result.ttftMs) ? `${result.ttftMs.toLocaleString()} ms` : 'Blocked'} detail={`Prefill plus modeled queue wait. ${result.model.label} uses ${result.model.precision}.`} icon={Timer} tone={result.state.tone} />
              <LabMetric label="Decode throughput" value={`${Math.round(result.decodeThroughput).toLocaleString()} tok/s`} detail={`${result.activeSequences}/${concurrency} sequences admitted; ${result.cacheSlots} cache slots modeled.`} icon={Gauge} tone="violet" />
              <LabMetric label="Queue delay" value={Number.isFinite(result.queueDelayMs) ? `${result.queueDelayMs.toLocaleString()} ms` : 'Blocked'} detail={`${result.serviceRate.toFixed(2)} modeled completions/s at this output length.`} icon={Timer} tone={result.state.tone} />
              <LabMetric label="Utilization" value={Number.isFinite(result.utilization) ? `${Math.round(result.utilization * 100)}%` : 'N/A'} detail={`${arrivalRate.toFixed(1)} arrivals/s divided by modeled completion capacity.`} icon={Workflow} tone={result.state.tone} />
              <LabMetric label="Output compute cost" value={Number.isFinite(result.costPerMillionOutput) ? `$${result.costPerMillionOutput.toFixed(2)} / 1M` : 'N/A'} detail="Accelerator-only modeled cost. Add idle capacity, networking, policy, and engineering cost." icon={WalletCards} tone="neutral" />
            </div>
            <section className={`rounded-md border p-4 ${result.state.tone === 'rose' ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.state.tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert aria-hidden="true" className="h-4 w-4" />{result.state.label}</div>
              <p className="mt-2 text-sm leading-6 opacity-90">{result.state.detail} Usable cache is {result.usableCacheGiB.toFixed(1)} GiB from a {result.configuredCacheGiB.toFixed(1)} GiB allocation; each sequence reserves about {result.requestCacheGiB.toFixed(2)} GiB.</p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[620px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading batching and KV-cache capacity lab" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">Batching and KV-cache capacity lab unavailable</p><p className="mt-2 opacity-80">{detail}</p></div>;
}
