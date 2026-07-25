'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Cpu,
  HardDrive,
  Layers3,
  LoaderCircle,
  Repeat2,
  Scale,
  ShieldCheck,
  Sparkles,
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

type Workload = {
  id: string;
  label: string;
  brief: string;
  demandTokensPerSecond: number;
  batchSuitability: 'low' | 'high';
  qualityFocus: string;
};

type Precision = {
  id: string;
  label: string;
  detail: string;
  bitsPerWeight: number;
  packingOverhead: number;
  measuredSpeedFactor: number;
  qualityRisk: string;
};

type Decoder = {
  id: string;
  label: string;
  detail: string;
  draftTokens: number;
  draftMemoryGb: number;
  draftCostRatio: number;
};

type CapacityTradeoffData = {
  title: string;
  description: string;
  model: {
    label: string;
    parametersBillions: number;
    kvReserveGb: number;
    engineWorkspaceGb: number;
    baselineTokensPerSecond: number;
  };
  defaults: {
    workloadId: string;
    precisionId: string;
    decoderId: string;
    hbmPoolGb: number;
    acceptanceRate: number;
  };
  workloads: Workload[];
  precisions: Precision[];
  decoders: Decoder[];
};

const BLOCK_ID = 'genai/llm-inference-optimization-capacity-tradeoff-lab';

function isCapacityTradeoffData(value: unknown): value is CapacityTradeoffData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityTradeoffData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.model
      && candidate.model.parametersBillions > 0
      && candidate.defaults
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.precisions)
      && candidate.precisions.length > 0
      && Array.isArray(candidate.decoders)
      && candidate.decoders.length > 0,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function LlmInferenceOptimizationCapacityTradeoffLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityTradeoffData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No capacity-tradeoff model was supplied.');
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
        if (!isCapacityTradeoffData(payload)) {
          throw new Error('Capacity-tradeoff data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load capacity data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <CapacityTradeoffWorkbench data={data} />;
}

function CapacityTradeoffWorkbench({ data }: { data: CapacityTradeoffData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [precisionId, setPrecisionId] = useState(data.defaults.precisionId);
  const [decoderId, setDecoderId] = useState(data.defaults.decoderId);
  const [hbmPoolGb, setHbmPoolGb] = useState(data.defaults.hbmPoolGb);
  const [acceptanceRate, setAcceptanceRate] = useState(data.defaults.acceptanceRate);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const precision = data.precisions.find((item) => item.id === precisionId) ?? data.precisions[0];
  const decoder = data.decoders.find((item) => item.id === decoderId) ?? data.decoders[0];

  const result = useMemo(() => {
    const rawWeightsGb = data.model.parametersBillions * precision.bitsPerWeight / 8;
    const packedWeightsGb = rawWeightsGb * precision.packingOverhead;
    const replicaGb = packedWeightsGb
      + data.model.kvReserveGb
      + data.model.engineWorkspaceGb
      + decoder.draftMemoryGb;
    const replicas = Math.floor(hbmPoolGb / replicaGb);
    const usedPoolGb = replicas * replicaGb;
    const freePoolGb = Math.max(0, hbmPoolGb - usedPoolGb);

    const acceptance = acceptanceRate / 100;
    const acceptedDraftTokens = decoder.draftTokens * acceptance;
    const targetTokensPerPass = 1 + acceptedDraftTokens;
    const targetPassesPer100 = Math.ceil(100 / targetTokensPerPass);
    const rawSpeculativeFactor = targetTokensPerPass / (1 + decoder.draftCostRatio);
    const cappedSpeculativeFactor = decoder.draftTokens
      ? Math.max(0.8, Math.min(rawSpeculativeFactor, 2.4))
      : 1;
    const speculativeFactor = workload.batchSuitability === 'high' && decoder.draftTokens
      ? 1 + (cappedSpeculativeFactor - 1) * 0.35
      : cappedSpeculativeFactor;
    const capacityTokensPerSecond = replicas
      * data.model.baselineTokensPerSecond
      * precision.measuredSpeedFactor
      * speculativeFactor;
    const demandRatio = capacityTokensPerSecond / workload.demandTokensPerSecond;
    const capacityPass = demandRatio >= 1;
    const quantized = precision.id !== 'bf16';

    let verdict = 'Capacity and quality evidence are ready for a canary';
    let detail = 'The pool clears modeled demand, but the planning factors still require matched production benchmarks.';
    let tone: 'emerald' | 'amber' | 'rose' | 'violet' = quantized ? 'amber' : 'emerald';

    if (replicas < 1) {
      verdict = 'The selected replica does not fit';
      detail = 'The target weights, runtime workspace, KV reserve, and drafter exceed the HBM pool.';
      tone = 'rose';
    } else if (!capacityPass) {
      verdict = 'The pool misses modeled demand';
      detail = `Capacity covers ${Math.round(demandRatio * 100)}% of the requested token rate before burst headroom.`;
      tone = 'rose';
    } else if (decoder.draftTokens && acceptanceRate < 35) {
      verdict = 'Draft verification costs more than it returns';
      detail = 'Low measured acceptance leaves too few tokens per target pass to repay drafting overhead.';
      tone = 'rose';
    } else if (workload.batchSuitability === 'high' && decoder.draftTokens) {
      verdict = 'Speculation has limited value at this batch point';
      detail = 'The lab discounts speculative gain because a well-batched target already amortizes work across requests.';
      tone = 'violet';
    } else if (quantized) {
      verdict = 'Capacity passes; task quality is the release gate';
      detail = precision.qualityRisk;
      tone = 'amber';
    }

    return {
      acceptedDraftTokens,
      capacityPass,
      capacityTokensPerSecond,
      detail,
      freePoolGb,
      packedWeightsGb,
      replicaGb,
      replicas,
      speculativeFactor,
      targetPassesPer100,
      tone,
      verdict,
    };
  }, [acceptanceRate, data.model, decoder, hbmPoolGb, precision, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setPrecisionId(data.defaults.precisionId);
    setDecoderId(data.defaults.decoderId);
    setHbmPoolGb(data.defaults.hbmPoolGb);
    setAcceptanceRate(data.defaults.acceptanceRate);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Compression and drafting planner"
          title={data.title}
          description={data.description}
          icon={Scale}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Demand shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.brief}
                      icon={item.id === 'code-completion' ? Cpu : item.id === 'batch-extraction' ? Layers3 : Sparkles}
                      accent={item.batchSuitability === 'high' ? 'amber' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Weight precision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.precisions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === precision.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'bf16' ? BadgeCheck : Boxes}
                      accent={item.id === 'bf16' ? 'blue' : item.id === 'int8' ? 'cyan' : 'amber'}
                      onClick={() => setPrecisionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Decode policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.decoders.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === decoder.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'direct' ? BrainCircuit : Repeat2}
                      accent={item.id === 'direct' ? 'blue' : 'violet'}
                      onClick={() => setDecoderId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Total HBM pool"
                value={hbmPoolGb}
                output={`${hbmPoolGb} GB`}
                min={80}
                max={640}
                step={40}
                accent="blue"
                lowLabel="80 GB"
                highLabel="640 GB"
                onChange={setHbmPoolGb}
              />

              {decoder.draftTokens ? (
                <LabRange
                  label="Measured draft acceptance"
                  value={acceptanceRate}
                  output={`${acceptanceRate}%`}
                  min={10}
                  max={95}
                  step={5}
                  accent="violet"
                  lowLabel="10%"
                  highLabel="95%"
                  onChange={setAcceptanceRate}
                />
              ) : (
                <p className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  Direct decoding runs one target step per generated token. Choose a drafter to expose acceptance and verification behavior.
                </p>
              )}
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Replica footprint"
                value={`${result.replicaGb.toFixed(1)} GB`}
                detail={`${result.packedWeightsGb.toFixed(1)} GB packed target weights`}
                icon={HardDrive}
                tone={result.replicas ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Target passes"
                value={`${result.targetPassesPer100} / 100 tok`}
                detail={`${result.speculativeFactor.toFixed(2)}x decode planning factor`}
                icon={Repeat2}
                tone={decoder.draftTokens ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Pool capacity"
                value={`${formatNumber(result.capacityTokensPerSecond)} tok/s`}
                detail={`${formatNumber(workload.demandTokensPerSecond)} tok/s demand`}
                icon={Zap}
                tone={result.capacityPass ? 'emerald' : 'rose'}
              />
            </div>

            <MemoryPacking
              poolGb={hbmPoolGb}
              replicaGb={result.replicaGb}
              replicas={result.replicas}
              freeGb={result.freePoolGb}
              weightsGb={result.packedWeightsGb}
              kvGb={data.model.kvReserveGb}
              workspaceGb={data.model.engineWorkspaceGb}
              draftGb={decoder.draftMemoryGb}
            />

            <DecodeTrace
              decoder={decoder}
              acceptanceRate={acceptanceRate}
              acceptedDraftTokens={result.acceptedDraftTokens}
              targetPasses={result.targetPassesPer100}
              batchSuitability={workload.batchSuitability}
            />

            <section className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35' : result.tone === 'violet' ? 'border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-violet-700 dark:text-violet-300'}`} />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                  <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    Quality gate: {workload.qualityFocus}. {precision.qualityRisk}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function MemoryPacking({
  poolGb,
  replicaGb,
  replicas,
  freeGb,
  weightsGb,
  kvGb,
  workspaceGb,
  draftGb,
}: {
  poolGb: number;
  replicaGb: number;
  replicas: number;
  freeGb: number;
  weightsGb: number;
  kvGb: number;
  workspaceGb: number;
  draftGb: number;
}) {
  const parts = [
    { label: 'Target weights', value: weightsGb, className: 'bg-blue-500 dark:bg-blue-400' },
    { label: 'KV reserve', value: kvGb, className: 'bg-violet-500 dark:bg-violet-400' },
    { label: 'Workspace', value: workspaceGb, className: 'bg-cyan-500 dark:bg-cyan-400' },
    ...(draftGb ? [{ label: 'Draft model', value: draftGb, className: 'bg-amber-500 dark:bg-amber-400' }] : []),
  ];

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">HBM packing</p>
          <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{replicas} complete replica{replicas === 1 ? '' : 's'} fit</h4>
        </div>
        <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
          {freeGb.toFixed(1)} GB unallocated / {poolGb} GB
        </span>
      </div>

      {replicas ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: replicas }, (_, index) => (
            <div key={index} className="rounded-md border border-blue-200 bg-white p-3 text-center dark:border-blue-900 dark:bg-neutral-950">
              <Cpu aria-hidden="true" className="mx-auto h-4 w-4 text-blue-600 dark:text-blue-300" />
              <p className="mt-2 text-xs font-semibold text-neutral-900 dark:text-white">Replica {index + 1}</p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{replicaGb.toFixed(1)} GB</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          No complete serving replica fits in this pool.
        </div>
      )}

      <div className="mt-5 h-7 overflow-hidden rounded-sm border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="flex h-full" style={{ width: `${Math.min(100, replicaGb / poolGb * 100)}%` }}>
          {parts.map((part) => (
            <div
              key={part.label}
              className={part.className}
              style={{ width: `${part.value / replicaGb * 100}%` }}
              title={`${part.label}: ${part.value.toFixed(1)} GB`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-sm ${part.className}`} />
            {part.label} {part.value.toFixed(1)} GB
          </span>
        ))}
      </div>
    </section>
  );
}

function DecodeTrace({
  decoder,
  acceptanceRate,
  acceptedDraftTokens,
  targetPasses,
  batchSuitability,
}: {
  decoder: Decoder;
  acceptanceRate: number;
  acceptedDraftTokens: number;
  targetPasses: number;
  batchSuitability: 'low' | 'high';
}) {
  if (!decoder.draftTokens) {
    return (
      <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start gap-3">
          <BrainCircuit aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Decode path</p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">One sequential target step per token</h4>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex shrink-0 items-center gap-2">
              <span className="flex h-12 w-20 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                Target {index + 1}
              </span>
              {index < 4 ? <ChevronRight aria-hidden="true" className="h-4 w-4 text-neutral-400" /> : null}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">100 output tokens require about 100 sequential target passes in this simplified comparison.</p>
      </section>
    );
  }

  const visiblyAccepted = Math.round(acceptedDraftTokens);

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Repeat2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Draft and verify path</p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">One target pass checks several proposals</h4>
          </div>
        </div>
        <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          {targetPasses} target passes / 100 tokens
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Draft proposals</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: decoder.draftTokens }, (_, index) => {
              const accepted = index < visiblyAccepted;
              return (
                <span key={index} className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-xs font-semibold ${accepted ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'}`}>
                  d{index + 1}
                </span>
              );
            })}
          </div>
        </div>
        <ChevronRight aria-hidden="true" className="hidden h-5 w-5 text-neutral-400 md:block" />
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">Target verification</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-blue-800 dark:text-blue-200">
            Expected acceptance: {acceptanceRate}% ({acceptedDraftTokens.toFixed(1)} of {decoder.draftTokens} draft tokens).
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        {batchSuitability === 'high'
          ? 'This workload already forms large target batches, so the lab discounts the incremental benefit of speculation.'
          : 'This low-batch route can benefit when the drafter is cheap and measured acceptance stays high.'}
      </p>
    </section>
  );
}

function LoadState() {
  return (
    <div className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading capacity trade-off lab...
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
          <p className="font-semibold">Capacity trade-off lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
