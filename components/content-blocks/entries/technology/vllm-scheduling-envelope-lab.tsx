'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Blocks,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Layers3,
  LoaderCircle,
  MemoryStick,
  MessageSquare,
  ScrollText,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  averagePromptTokens: number;
  averageOutputTokens: number;
  requestsPerSecond: number;
  targetConcurrency: number;
  prefillCapacityTokensPerSecond: number;
  decodeCapacityTokensPerSecond: number;
  baseTtftMs: number;
  baseItlMs: number;
  ttftSloMs: number;
  itlSloMs: number;
  reusePotentialPct: number;
};
type SchedulingData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    maxNumSeqs: number;
    maxNumBatchedTokens: number;
    kvCacheGiB: number;
    prefixHitRatePct: number;
  };
  bounds: {
    maxNumSeqs: Bounds;
    maxNumBatchedTokens: Bounds;
    kvCacheGiB: Bounds;
    prefixHitRatePct: Bounds;
  };
  model: {
    blockSizeTokens: number;
    kvMiBPerThousandTokens: number;
  };
  workloads: Workload[];
};

const BLOCK_ID = 'technology/vllm-scheduling-envelope-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isWorkload(value: unknown): value is Workload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workload>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && isNumber(candidate.averagePromptTokens)
    && isNumber(candidate.averageOutputTokens)
    && isNumber(candidate.requestsPerSecond)
    && isNumber(candidate.targetConcurrency)
    && isNumber(candidate.prefillCapacityTokensPerSecond)
    && isNumber(candidate.decodeCapacityTokensPerSecond)
    && isNumber(candidate.baseTtftMs)
    && isNumber(candidate.baseItlMs)
    && isNumber(candidate.ttftSloMs)
    && isNumber(candidate.itlSloMs)
    && isNumber(candidate.reusePotentialPct);
}

function isSchedulingData(value: unknown): value is SchedulingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SchedulingData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && isNumber(candidate.defaults.maxNumSeqs)
      && isNumber(candidate.defaults.maxNumBatchedTokens)
      && isNumber(candidate.defaults.kvCacheGiB)
      && isNumber(candidate.defaults.prefixHitRatePct)
      && isBounds(candidate.bounds?.maxNumSeqs)
      && isBounds(candidate.bounds.maxNumBatchedTokens)
      && isBounds(candidate.bounds.kvCacheGiB)
      && isBounds(candidate.bounds.prefixHitRatePct)
      && isNumber(candidate.model?.blockSizeTokens)
      && isNumber(candidate.model.kvMiBPerThousandTokens)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every(isWorkload),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToBlock(tokens: number, blockSize: number) {
  return Math.ceil(tokens / blockSize) * blockSize;
}

function workloadIcon(id: string) {
  if (id === 'long-context-review') return ScrollText;
  if (id === 'offline-generation') return Layers3;
  return MessageSquare;
}

export default function VllmSchedulingEnvelopeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<SchedulingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No vLLM scheduling model was supplied.');
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
        if (!isSchedulingData(payload)) throw new Error('The scheduling model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the scheduling lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <SchedulingLab data={data} />;
}

function SchedulingLab({ data }: { data: SchedulingData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [maxNumSeqs, setMaxNumSeqs] = useState(data.defaults.maxNumSeqs);
  const [maxNumBatchedTokens, setMaxNumBatchedTokens] = useState(
    data.defaults.maxNumBatchedTokens,
  );
  const [kvCacheGiB, setKvCacheGiB] = useState(data.defaults.kvCacheGiB);
  const [prefixHitRatePct, setPrefixHitRatePct] = useState(data.defaults.prefixHitRatePct);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const effectiveHitPct = Math.min(prefixHitRatePct, workload.reusePotentialPct);
    const uncachedPromptTokens = Math.max(
      1,
      Math.round(workload.averagePromptTokens * (1 - effectiveHitPct / 100)),
    );
    const averageResidentTokens = workload.averagePromptTokens + workload.averageOutputTokens / 2;
    const roundedResidentTokens = roundToBlock(
      averageResidentTokens,
      data.model.blockSizeTokens,
    );
    const kvMiBPerSequence = (
      roundedResidentTokens * data.model.kvMiBPerThousandTokens
    ) / 1000;
    const kvCapacity = Math.max(1, Math.floor((kvCacheGiB * 1024) / kvMiBPerSequence));
    const admittedSequences = Math.min(maxNumSeqs, kvCapacity);
    const concurrencyFactor = clamp(admittedSequences / workload.targetConcurrency, 0.08, 1);
    const tokenBudgetFactor = clamp(maxNumBatchedTokens / 8192, 0.2, 1.5);
    const effectivePrefillCapacity = workload.prefillCapacityTokensPerSecond
      * (0.58 + tokenBudgetFactor * 0.42)
      * concurrencyFactor;
    const effectiveDecodeCapacity = workload.decodeCapacityTokensPerSecond
      * (0.55 + 0.45 * Math.sqrt(concurrencyFactor));
    const prefillRps = effectivePrefillCapacity / uncachedPromptTokens;
    const decodeRps = effectiveDecodeCapacity / workload.averageOutputTokens;
    const capacityRps = Math.max(0.01, Math.min(prefillRps, decodeRps));
    const loadRatio = workload.requestsPerSecond / capacityRps;
    const decodeReservation = Math.min(admittedSequences, maxNumBatchedTokens - 1);
    const availablePrefillTokens = Math.max(1, maxNumBatchedTokens - decodeReservation);
    const prefillChunks = Math.ceil(uncachedPromptTokens / availablePrefillTokens);
    const queuePenaltyMs = Math.max(0, loadRatio - 0.72) * 1100;
    const concurrencyPenaltyMs = Math.max(
      0,
      (workload.targetConcurrency - admittedSequences) / workload.targetConcurrency,
    ) * 420;
    const ttftMs = Math.round(
      workload.baseTtftMs
        + (prefillChunks - 1) * workload.baseItlMs * 1.35
        + queuePenaltyMs
        + concurrencyPenaltyMs,
    );
    const itlMs = Math.round(
      workload.baseItlMs
        * (1 + (maxNumBatchedTokens / data.bounds.maxNumBatchedTokens.max) * 0.42)
        * (1 + Math.max(0, loadRatio - 0.82) * 1.6),
    );
    const kvUsagePct = clamp((maxNumSeqs * kvMiBPerSequence) / (kvCacheGiB * 1024) * 100, 0, 180);
    const meetsTtft = ttftMs <= workload.ttftSloMs;
    const meetsItl = itlMs <= workload.itlSloMs;
    const meetsDemand = loadRatio <= 1;
    const memoryBound = kvCapacity < maxNumSeqs;
    const healthy = meetsTtft && meetsItl && meetsDemand && !memoryBound;
    const decodeSharePct = clamp(decodeReservation / maxNumBatchedTokens * 100, 4, 96);
    const prefixWastePct = Math.max(0, prefixHitRatePct - workload.reusePotentialPct);

    let status = 'Stable modeled envelope';
    let verdict = 'The modeled pool holds the configured sequences and serves demand inside both latency targets. Validate this point with representative load.';
    if (memoryBound) {
      status = 'KV capacity limits concurrency';
      verdict = `The cache holds about ${kvCapacity} average live sequences, below max_num_seqs=${maxNumSeqs}. Lower concurrency or context, add KV capacity, or change the model layout.`;
    } else if (!meetsDemand) {
      status = 'Arrival rate exceeds goodput';
      verdict = 'The queue grows even though the configuration fits in memory. Add replica capacity or reduce work before increasing scheduler limits.';
    } else if (!meetsItl) {
      status = 'Decode cadence misses the target';
      verdict = 'The iteration token budget gives prefill too much modeled influence on active decode. Test a smaller budget or isolate workload classes.';
    } else if (!meetsTtft) {
      status = 'First token misses the target';
      verdict = 'Prompt work spans too many chunks or waits for capacity. Increase measured prefill capacity, reuse eligible prefixes, or route long prompts separately.';
    }

    return {
      admittedSequences,
      capacityRps,
      decodeSharePct,
      effectiveHitPct,
      healthy,
      itlMs,
      kvCapacity,
      kvMiBPerSequence,
      kvUsagePct,
      memoryBound,
      prefillChunks,
      prefixWastePct,
      status,
      ttftMs,
      uncachedPromptTokens,
      verdict,
    };
  }, [
    data.bounds.maxNumBatchedTokens.max,
    data.model.blockSizeTokens,
    data.model.kvMiBPerThousandTokens,
    kvCacheGiB,
    maxNumBatchedTokens,
    maxNumSeqs,
    prefixHitRatePct,
    workload,
  ]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setMaxNumSeqs(data.defaults.maxNumSeqs);
    setMaxNumBatchedTokens(data.defaults.maxNumBatchedTokens);
    setKvCacheGiB(data.defaults.kvCacheGiB);
    setPrefixHitRatePct(data.defaults.prefixHitRatePct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="vLLM scheduling lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={workloadIcon(item.id)}
                      accent="violet"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="max_num_seqs"
                value={maxNumSeqs}
                output={`${maxNumSeqs} sequences`}
                {...data.bounds.maxNumSeqs}
                accent="blue"
                lowLabel="Less KV pressure"
                highLabel="More concurrency"
                onChange={setMaxNumSeqs}
              />
              <LabRange
                label="max_num_batched_tokens"
                value={maxNumBatchedTokens}
                output={`${maxNumBatchedTokens.toLocaleString()} tokens`}
                {...data.bounds.maxNumBatchedTokens}
                accent="violet"
                lowLabel="Protect decode"
                highLabel="Larger prefill steps"
                onChange={setMaxNumBatchedTokens}
              />
              <LabRange
                label="KV cache budget"
                value={kvCacheGiB}
                output={`${kvCacheGiB} GiB`}
                {...data.bounds.kvCacheGiB}
                accent="cyan"
                lowLabel="Tight"
                highLabel="More resident state"
                onChange={setKvCacheGiB}
              />
              <LabRange
                label="Measured prefix hit rate"
                value={prefixHitRatePct}
                output={`${prefixHitRatePct}%`}
                {...data.bounds.prefixHitRatePct}
                accent="emerald"
                lowLabel="Mostly unique"
                highLabel="Repeated prefixes"
                onChange={setPrefixHitRatePct}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Admitted sequences"
                value={`${result.admittedSequences}`}
                detail={`KV estimate allows ${result.kvCapacity}`}
                icon={MemoryStick}
                tone={result.memoryBound ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="Modeled TTFT"
                value={`${result.ttftMs} ms`}
                detail={`Target <= ${workload.ttftSloMs} ms`}
                icon={Clock3}
                tone={result.ttftMs <= workload.ttftSloMs ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Modeled ITL"
                value={`${result.itlMs} ms`}
                detail={`Target <= ${workload.itlSloMs} ms`}
                icon={Timer}
                tone={result.itlMs <= workload.itlSloMs ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Request capacity"
                value={`${result.capacityRps.toFixed(1)} req/s`}
                detail={`${workload.requestsPerSecond} req/s offered`}
                icon={Activity}
                tone={result.capacityRps >= workload.requestsPerSecond ? 'emerald' : 'rose'}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.healthy
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.verdict}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Illustrative engine step</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                    Decode is reserved first; remaining budget accepts prefill chunks
                  </p>
                </div>
                <span className="w-fit rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {result.prefillChunks} prefill {result.prefillChunks === 1 ? 'chunk' : 'chunks'} per average prompt
                </span>
              </div>
              <div
                className="mt-5 flex h-12 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
                aria-label={`${Math.round(result.decodeSharePct)} percent decode reservation and ${Math.round(100 - result.decodeSharePct)} percent prefill budget`}
              >
                <div
                  className="flex min-w-12 items-center justify-center bg-violet-600 px-2 text-xs font-semibold text-white transition-[width] motion-reduce:transition-none"
                  style={{ width: `${result.decodeSharePct}%` }}
                >
                  Decode
                </div>
                <div className="flex flex-1 items-center justify-center bg-cyan-100 px-2 text-xs font-semibold text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">
                  Prefill budget
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                This bar shows scheduler token share, not elapsed GPU time. Prefill and decode have different compute and memory behavior.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <ModelFact
                icon={Blocks}
                label="Average KV allocation"
                value={`${result.kvMiBPerSequence.toFixed(0)} MiB/sequence`}
                detail={`${data.model.blockSizeTokens}-token blocks; ${Math.round(result.kvUsagePct)}% of budget at max_num_seqs`}
              />
              <ModelFact
                icon={Layers3}
                label="Uncached prefill"
                value={`${result.uncachedPromptTokens.toLocaleString()} tokens/request`}
                detail={`${result.effectiveHitPct}% useful hit rate in this workload`}
              />
              <ModelFact
                icon={Gauge}
                label="Reuse ceiling"
                value={`${workload.reusePotentialPct}%`}
                detail={result.prefixWastePct > 0 ? `${result.prefixWastePct}% configured hit rate has no modeled reusable work` : 'Configured hits stay within reusable work'}
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ModelFact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Blocks;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading vLLM scheduling model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100">
      <p className="font-semibold">Scheduling lab unavailable</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
