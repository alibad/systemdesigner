'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cpu,
  Gauge,
  Layers3,
  MemoryStick,
  Network,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/llm-fundamentals/data/architecture-compute-scaling-lab.json';

type Precision = {
  id: string;
  label: string;
  detail: string;
  weightBytes: number;
  kvBytes: number;
  qualityNote: string;
};
type LabData = {
  title: string;
  description: string;
  precisions: Precision[];
  defaults: {
    parametersBillions: number;
    sequenceLength: number;
    precision: string;
    architecture: 'dense' | 'moe';
    activeExperts: number;
    concurrency: number;
  };
  moe: { expertCount: number; sharedFraction: number; routingOverhead: number };
  worker: { memoryGb: number; reserveFraction: number };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.precisions) &&
      data.precisions.length > 0 &&
      data.defaults &&
      data.moe &&
      data.worker &&
      typeof data.worker.memoryGb === 'number',
  );
}

function formatGb(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)} GB`;
}

function formatFlops(value: number) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} EFLOP`;
  return `${value.toFixed(value < 10 ? 1 : 0)} PFLOP`;
}

export default function LlmFundamentalsArchitectureComputeScalingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parametersBillions, setParametersBillions] = useState(32);
  const [sequenceLength, setSequenceLength] = useState(4096);
  const [precisionId, setPrecisionId] = useState('bf16');
  const [architecture, setArchitecture] = useState<'dense' | 'moe'>('dense');
  const [activeExperts, setActiveExperts] = useState(2);
  const [concurrency, setConcurrency] = useState(8);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
        setParametersBillions(value.defaults.parametersBillions);
        setSequenceLength(value.defaults.sequenceLength);
        setPrecisionId(value.defaults.precision);
        setArchitecture(value.defaults.architecture);
        setActiveExperts(value.defaults.activeExperts);
        setConcurrency(value.defaults.concurrency);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const precision = data.precisions.find((item) => item.id === precisionId) ?? data.precisions[0];
    if (!precision) return null;
    const scale = Math.sqrt(parametersBillions / 7);
    const layers = Math.max(16, Math.round(32 * scale));
    const hiddenSize = Math.max(2048, Math.round((4096 * scale) / 256) * 256);
    const activeFraction = architecture === 'dense'
      ? 1
      : data.moe.sharedFraction + (1 - data.moe.sharedFraction) * (activeExperts / data.moe.expertCount);
    const activeParameters = parametersBillions * activeFraction;
    const weightMemoryGb = parametersBillions * precision.weightBytes;
    const kvPerSequenceGb = (sequenceLength * layers * hiddenSize * 2 * precision.kvBytes) / 1_000_000_000;
    const kvMemoryGb = kvPerSequenceGb * concurrency;
    const residentMemoryGb = weightMemoryGb + kvMemoryGb;
    const usableMemoryGb = data.worker.memoryGb * (1 - data.worker.reserveFraction);
    const maxConcurrency = weightMemoryGb >= usableMemoryGb || kvPerSequenceGb === 0
      ? 0
      : Math.max(0, Math.floor((usableMemoryGb - weightMemoryGb) / kvPerSequenceGb));
    const attentionPressure = concurrency * (sequenceLength / 4096) ** 2;
    const prefillFlops =
      (2 * activeParameters * 1_000_000_000 * sequenceLength * concurrency * (architecture === 'moe' ? data.moe.routingOverhead : 1)) /
      1_000_000_000_000_000;
    const relativeCost = (activeParameters * concurrency * sequenceLength) / (7 * 4096);
    const exceedsMemory = residentMemoryGb > usableMemoryGb;
    const memoryPressure = !exceedsMemory && residentMemoryGb / usableMemoryGb > 0.86;
    const attentionPressureHigh = attentionPressure > 24;
    const status = exceedsMemory
      ? 'Does not fit the planning budget'
      : memoryPressure
        ? 'Memory pressure needs a lower cap'
        : attentionPressureHigh
          ? 'Attention and prefill pressure dominate'
          : 'Feasible planning point';
    const tradeoff = exceedsMemory
      ? 'Reduce stored weights, sequence length, or concurrency before reserving this worker. Sparse activation alone does not solve resident-weight memory.'
      : architecture === 'moe'
        ? `MoE activates about ${activeParameters.toFixed(1)}B of ${parametersBillions}B stored parameters per token, but routing across ${data.moe.expertCount} experts can add imbalance and communication tail risk.`
        : `Dense serving activates all ${parametersBillions}B parameters per token. It is simpler to batch and profile, but compute rises directly with model size.`;
    return {
      precision,
      layers,
      hiddenSize,
      activeParameters,
      weightMemoryGb,
      kvPerSequenceGb,
      kvMemoryGb,
      residentMemoryGb,
      usableMemoryGb,
      maxConcurrency,
      attentionPressure,
      prefillFlops,
      relativeCost,
      exceedsMemory,
      memoryPressure,
      attentionPressureHigh,
      status,
      tradeoff,
    };
  }, [activeExperts, architecture, concurrency, data, parametersBillions, precisionId, sequenceLength]);

  const reset = () => {
    if (!data) return;
    setParametersBillions(data.defaults.parametersBillions);
    setSequenceLength(data.defaults.sequenceLength);
    setPrecisionId(data.defaults.precision);
    setArchitecture(data.defaults.architecture);
    setActiveExperts(data.defaults.activeExperts);
    setConcurrency(data.defaults.concurrency);
  };

  if (error) return <LabError detail={error} />;
  if (!data || !result) return <LabLoading />;

  const warning = result.exceedsMemory || result.memoryPressure || result.attentionPressureHigh;
  return (
    <div data-content-block="ml-systems/llm-fundamentals-architecture-compute-scaling-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Architecture and compute lab"
          title={data.title}
          description={data.description}
          icon={Cpu}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose the parameter path</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={architecture === 'dense'} label="Dense" detail="Every token activates the full stored parameter path." icon={Layers3} accent="cyan" onClick={() => setArchitecture('dense')} />
                  <LabChoice selected={architecture === 'moe'} label="Mixture of experts" detail={`Route each token through a subset of ${data.moe.expertCount} experts while storing the full expert pool.`} icon={Network} accent="violet" onClick={() => setArchitecture('moe')} />
                </div>
              </fieldset>
              <div className="space-y-6">
                <LabRange label="Stored parameters" value={parametersBillions} output={`${parametersBillions}B`} min={7} max={128} step={1} accent="cyan" lowLabel="Smaller model" highLabel="Large resident weights" onChange={setParametersBillions} />
                <LabRange label="Sequence length" value={sequenceLength} output={sequenceLength.toLocaleString()} min={512} max={16384} step={512} accent="amber" lowLabel="Short context" highLabel="Long prefill and cache" onChange={setSequenceLength} />
                <LabRange label="Concurrent sequences" value={concurrency} output={String(concurrency)} min={1} max={64} step={1} accent="rose" lowLabel="Low concurrency" highLabel="High cache pressure" onChange={setConcurrency} />
                {architecture === 'moe' ? <LabRange label="Activated experts per token" value={activeExperts} output={`${activeExperts} of ${data.moe.expertCount}`} min={1} max={Math.min(4, data.moe.expertCount)} step={1} accent="violet" lowLabel="Sparse path" highLabel="More active compute" onChange={setActiveExperts} /> : null}
              </div>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose numerical storage</legend>
                <div className="mt-3 space-y-2">
                  {data.precisions.map((precision) => <LabChoice key={precision.id} selected={precisionId === precision.id} label={precision.label} detail={precision.detail} icon={MemoryStick} accent={precision.id === 'bf16' ? 'emerald' : precision.id === 'fp8' ? 'amber' : 'rose'} onClick={() => setPrecisionId(precision.id)} />)}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className={`rounded-md border p-4 ${warning ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}>
              <div className="flex items-start gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-300" /><div><p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p><p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.tradeoff}</p></div></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Active parameters" value={`${result.activeParameters.toFixed(1)}B`} detail={architecture === 'moe' ? 'Per-token routed path, not total stored capacity' : 'All stored parameters are active per token'} icon={Layers3} tone={architecture === 'moe' ? 'violet' : 'cyan'} />
              <LabMetric label="Resident memory" value={formatGb(result.residentMemoryGb)} detail={`${formatGb(result.weightMemoryGb)} weights + ${formatGb(result.kvMemoryGb)} KV cache`} icon={MemoryStick} tone={result.exceedsMemory ? 'rose' : result.memoryPressure ? 'amber' : 'emerald'} />
              <LabMetric label="Capacity at this length" value={result.maxConcurrency === 0 ? '0 sequences' : `${result.maxConcurrency} sequences`} detail={`Estimated under ${data.worker.memoryGb} GB with ${Math.round(data.worker.reserveFraction * 100)}% reserve`} icon={Boxes} tone={result.maxConcurrency < concurrency ? 'rose' : 'emerald'} />
              <LabMetric label="Attention pressure" value={`${result.attentionPressure.toFixed(1)}x`} detail="Relative to one 4k-token sequence; a sequence-squared planning index" icon={Activity} tone={result.attentionPressureHigh ? 'rose' : 'amber'} />
              <LabMetric label="Prefill compute" value={formatFlops(result.prefillFlops)} detail="Approximate active-parameter work for this concurrent prefill; kernels and bandwidth excluded" icon={Cpu} tone="cyan" />
              <LabMetric label="Relative serving cost" value={`${result.relativeCost.toFixed(1)}x`} detail="Versus 7B dense, one 4k sequence; not a dollar estimate" icon={Gauge} tone="amber" />
            </div>
            <div className="mt-6 grid gap-4 text-sm leading-6 text-neutral-700 md:grid-cols-2 dark:text-neutral-300">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">What this model estimates</p><p className="mt-2">It derives about {result.layers} layers and a hidden size near {result.hiddenSize.toLocaleString()} from parameter count only to expose the direction of KV-cache growth. Real architectures vary, so profile the actual checkpoint and serving engine.</p></div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">Quality and cost decision</p><p className="mt-2">{result.precision.qualityNote} Parameter count, active experts, and precision do not predict task quality. Compare them with fixed prompts, long-context cases, safety slices, latency, and measured cost per successful task.</p></div>
            </div>
            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Planning assumptions: decimal GB; weight memory is total stored parameters times selected weight bytes; KV cache stores keys and values for every active sequence; attention is an index rather than an exact FLOP count. Production capacity also depends on tensor parallelism, allocator overhead, batching policy, cache reuse, bandwidth, and queueing.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return <div data-content-block="ml-systems/llm-fundamentals-architecture-compute-scaling-lab" className="not-prose my-7 min-h-[640px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading architecture and compute scaling lab" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block="ml-systems/llm-fundamentals-architecture-compute-scaling-lab" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{detail}</div>;
}
