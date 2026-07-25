'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleAlert,
  Cpu,
  Gauge,
  GitBranch,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Network,
  Server,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
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

interface Topology {
  id: string;
  label: string;
  shortLabel: string;
  gpusPerReplica: number;
  shardFactor: number;
  communicationPenalty: number;
  detail: string;
}

interface Scheduler {
  id: string;
  label: string;
  turnoverFactor: number;
  waitPenalty: string;
  detail: string;
}

interface ServingEnvelopeData {
  title: string;
  description: string;
  notice: string;
  model: {
    label: string;
    parametersBillions: number;
    layers: number;
    queryHeads: number;
    kvHeads: number;
    headDimension: number;
    bytesPerWeight: number;
    bytesPerCacheElement: number;
  };
  fleet: {
    totalGpus: number;
    hbmGiBPerGpu: number;
    runtimeReserveGiBPerGpu: number;
  };
  defaults: {
    topologyId: string;
    schedulerId: string;
    contextTokens: number;
    concurrency: number;
    maxSequencesPerReplica: number;
    failureInjected: boolean;
  };
  ranges: {
    contextTokens: { min: number; max: number; step: number };
    concurrency: { min: number; max: number; step: number };
    maxSequencesPerReplica: { min: number; max: number; step: number };
  };
  topologies: Topology[];
  schedulers: Scheduler[];
}

interface ReplicaGroup {
  id: number;
  gpuIds: number[];
  healthy: boolean;
}

const BLOCK_ID = 'genai/production-transformer-architecture-serving-envelope-lab';
const GIB = 1024 ** 3;

const topologyIcons: Record<string, LucideIcon> = {
  replica: Server,
  tp2: Network,
  pp2: GitBranch,
  'tp2-pp2': Boxes,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isServingEnvelopeData(value: unknown): value is ServingEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingEnvelopeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.notice
      && candidate.model
      && isFiniteNumber(candidate.model.parametersBillions)
      && isFiniteNumber(candidate.model.layers)
      && isFiniteNumber(candidate.model.kvHeads)
      && isFiniteNumber(candidate.model.headDimension)
      && candidate.fleet
      && isFiniteNumber(candidate.fleet.totalGpus)
      && isFiniteNumber(candidate.fleet.hbmGiBPerGpu)
      && candidate.defaults?.topologyId
      && candidate.defaults.schedulerId
      && candidate.ranges
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length >= 2
      && candidate.topologies.every((item) => item.id && item.label && isFiniteNumber(item.gpusPerReplica) && isFiniteNumber(item.shardFactor))
      && Array.isArray(candidate.schedulers)
      && candidate.schedulers.length >= 2
      && candidate.schedulers.every((item) => item.id && item.label && isFiniteNumber(item.turnoverFactor)),
  );
}

function formatGiB(value: number) {
  if (value >= 10) return `${value.toFixed(1)} GiB`;
  return `${value.toFixed(2)} GiB`;
}

export default function ProductionTransformerArchitectureServingEnvelopeLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ServingEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No serving envelope model was supplied.');
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
        if (!isServingEnvelopeData(payload)) throw new Error('The serving envelope data is incomplete.');
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
  return <ServingEnvelopeLab data={data} />;
}

function ServingEnvelopeLab({ data }: { data: ServingEnvelopeData }) {
  const [topologyId, setTopologyId] = useState(data.defaults.topologyId);
  const [schedulerId, setSchedulerId] = useState(data.defaults.schedulerId);
  const [contextTokens, setContextTokens] = useState(data.defaults.contextTokens);
  const [concurrency, setConcurrency] = useState(data.defaults.concurrency);
  const [maxSequencesPerReplica, setMaxSequencesPerReplica] = useState(
    data.defaults.maxSequencesPerReplica,
  );
  const [failureInjected, setFailureInjected] = useState(data.defaults.failureInjected);

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const scheduler = data.schedulers.find((item) => item.id === schedulerId) ?? data.schedulers[0];

  const result = useMemo(() => {
    const totalGroups = Math.floor(data.fleet.totalGpus / topology.gpusPerReplica);
    const healthyGroups = Math.max(0, totalGroups - (failureInjected ? 1 : 0));
    const modelWeightGiB = data.model.parametersBillions
      * 1_000_000_000
      * data.model.bytesPerWeight
      / GIB
      / topology.shardFactor;
    const kvGiBPerSequence = 2
      * data.model.layers
      * contextTokens
      * data.model.kvHeads
      * data.model.headDimension
      * data.model.bytesPerCacheElement
      / GIB
      / topology.shardFactor;
    const usableGiB = data.fleet.hbmGiBPerGpu - data.fleet.runtimeReserveGiBPerGpu;
    const cacheBudgetGiB = Math.max(0, usableGiB - modelWeightGiB);
    const memorySlots = kvGiBPerSequence > 0 ? Math.floor(cacheBudgetGiB / kvGiBPerSequence) : 0;
    const slotsPerReplica = Math.max(0, Math.min(maxSequencesPerReplica, memorySlots));
    const rawFleetSlots = slotsPerReplica * healthyGroups;
    const schedulerSlots = Math.floor(rawFleetSlots * scheduler.turnoverFactor);
    const effectiveCapacity = Math.floor(schedulerSlots * (1 - topology.communicationPenalty));
    const queued = Math.max(0, concurrency - effectiveCapacity);
    const admitted = Math.min(concurrency, effectiveCapacity);
    const modeledHbmGiB = modelWeightGiB + slotsPerReplica * kvGiBPerSequence;
    const memoryFits = modelWeightGiB < usableGiB && slotsPerReplica > 0;
    const trafficFits = queued === 0;
    const resilient = !failureInjected || healthyGroups > 0;
    const stable = memoryFits && trafficFits && resilient;

    let verdict = 'The selected fleet envelope absorbs the modeled traffic';
    let detail = `${healthyGroups} serving ${healthyGroups === 1 ? 'group has' : 'groups have'} enough cache and scheduler capacity for ${concurrency} active sequences.`;
    let tone: 'emerald' | 'amber' | 'rose' | 'violet' = 'emerald';

    if (!resilient) {
      verdict = 'No complete serving group remains';
      detail = 'The failed GPU invalidates the only sharded replica. Route elsewhere or reject before scheduling work.';
      tone = 'rose';
    } else if (!memoryFits) {
      verdict = 'Weights and one live sequence do not fit the usable HBM budget';
      detail = 'Choose a larger device, a compatible lower-precision bundle, or a topology that shards the required state.';
      tone = 'rose';
    } else if (!trafficFits) {
      verdict = `${queued} active sequences exceed modeled capacity`;
      detail = `The scheduler can carry about ${effectiveCapacity} sequences under this topology. Bound the queue, add independent groups, or reduce context and per-replica slots.`;
      tone = failureInjected ? 'rose' : 'amber';
    } else if (topology.communicationPenalty >= 0.2) {
      verdict = 'The workload fits, but the token path crosses four devices';
      detail = 'The memory partition succeeds. Benchmark collectives and tail token latency before accepting the larger failure domain.';
      tone = 'violet';
    } else if (scheduler.id === 'static') {
      verdict = 'The workload fits with modeled static-batch slack';
      detail = 'Mixed output lengths can still strand finished slots. Compare goodput and tail latency against continuous batching.';
      tone = 'amber';
    }

    const groups: ReplicaGroup[] = Array.from({ length: totalGroups }, (_, groupIndex) => ({
      id: groupIndex,
      gpuIds: Array.from(
        { length: topology.gpusPerReplica },
        (_, deviceIndex) => groupIndex * topology.gpusPerReplica + deviceIndex,
      ),
      healthy: !(failureInjected && groupIndex === 0),
    }));

    return {
      admitted,
      cacheBudgetGiB,
      effectiveCapacity,
      groups,
      healthyGroups,
      kvGiBPerSequence,
      memoryFits,
      memorySlots,
      modeledHbmGiB,
      modelWeightGiB,
      queued,
      resilient,
      slotsPerReplica,
      stable,
      tone,
      totalGroups,
      trafficFits,
      verdict,
      detail,
    };
  }, [concurrency, contextTokens, data.fleet, data.model, failureInjected, maxSequencesPerReplica, scheduler, topology]);

  const reset = () => {
    setTopologyId(data.defaults.topologyId);
    setSchedulerId(data.defaults.schedulerId);
    setContextTokens(data.defaults.contextTokens);
    setConcurrency(data.defaults.concurrency);
    setMaxSequencesPerReplica(data.defaults.maxSequencesPerReplica);
    setFailureInjected(data.defaults.failureInjected);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Serving envelope lab"
          title={data.title}
          description={data.description}
          icon={Workflow}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Partition the fleet
                </legend>
                <div className="mt-3 space-y-2">
                  {data.topologies.map((item) => {
                    const Icon = topologyIcons[item.id] ?? Cpu;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === topology.id}
                        label={`${item.shortLabel}: ${item.gpusPerReplica} GPU ${item.gpusPerReplica === 1 ? 'group' : 'group'}`}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'replica' ? 'emerald' : item.id === 'tp2' ? 'blue' : item.id === 'pp2' ? 'violet' : 'amber'}
                        onClick={() => setTopologyId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the batch scheduler
                </legend>
                <div className="mt-3 space-y-2">
                  {data.schedulers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scheduler.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'continuous' ? Workflow : Layers3}
                      accent={item.id === 'continuous' ? 'cyan' : 'amber'}
                      onClick={() => setSchedulerId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Cached context per sequence"
                value={contextTokens}
                output={`${contextTokens.toLocaleString()} tokens`}
                min={data.ranges.contextTokens.min}
                max={data.ranges.contextTokens.max}
                step={data.ranges.contextTokens.step}
                accent="violet"
                lowLabel="Short context"
                highLabel="Long context"
                onChange={setContextTokens}
              />
              <LabRange
                label="Active traffic"
                value={concurrency}
                output={`${concurrency} sequences`}
                min={data.ranges.concurrency.min}
                max={data.ranges.concurrency.max}
                step={data.ranges.concurrency.step}
                accent="blue"
                lowLabel="Light load"
                highLabel="Traffic burst"
                onChange={setConcurrency}
              />
              <LabRange
                label="Scheduler cap per replica"
                value={maxSequencesPerReplica}
                output={`${maxSequencesPerReplica} slots`}
                min={data.ranges.maxSequencesPerReplica.min}
                max={data.ranges.maxSequencesPerReplica.max}
                step={data.ranges.maxSequencesPerReplica.step}
                accent="cyan"
                lowLabel="Tight batch"
                highLabel="Wide batch"
                onChange={setMaxSequencesPerReplica}
              />

              <button
                type="button"
                aria-pressed={failureInjected}
                onClick={() => setFailureInjected((current) => !current)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  failureInjected
                    ? 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-100'
                    : 'border-neutral-300 bg-white text-neutral-800 hover:border-rose-300 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-rose-800'
                }`}
              >
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">
                    {failureInjected ? 'GPU failure injected' : 'Inject one GPU failure'}
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Remove the first device and the complete serving group that depends on it.
                  </span>
                </span>
              </button>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Weights per GPU"
              value={formatGiB(result.modelWeightGiB)}
              detail={`${topology.shardFactor}-way modeled partition of ${data.model.parametersBillions}B BF16-equivalent weights.`}
              icon={Cpu}
              tone="blue"
            />
            <LabMetric
              label="KV per sequence per GPU"
              value={formatGiB(result.kvGiBPerSequence)}
              detail={`${contextTokens.toLocaleString()} tokens with ${data.model.kvHeads} KV heads.`}
              icon={MemoryStick}
              tone="violet"
            />
            <LabMetric
              label="Healthy serving groups"
              value={`${result.healthyGroups} / ${result.totalGroups}`}
              detail={`${topology.gpusPerReplica} ${topology.gpusPerReplica === 1 ? 'GPU' : 'GPUs'} required per group.`}
              icon={Server}
              tone={result.resilient ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Modeled active capacity"
              value={`${result.effectiveCapacity} seq`}
              detail={`${result.admitted} admitted and ${result.queued} waiting at this load.`}
              icon={Gauge}
              tone={result.queued > 0 ? 'rose' : 'emerald'}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/55">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">Fleet topology</p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {topology.shortLabel} across {data.fleet.totalGpus} GPUs
                </h4>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {scheduler.label} - {scheduler.waitPenalty}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {result.groups.map((group) => (
                <div
                  key={group.id}
                  className={`rounded-md border p-3 ${
                    group.healthy
                      ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950'
                      : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Group {group.id + 1}
                    </p>
                    <span className={`text-[11px] font-semibold uppercase ${group.healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      {group.healthy ? 'Ready' : 'Unavailable'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.gpuIds.map((gpuId, deviceIndex) => {
                      const failed = !group.healthy && deviceIndex === 0;
                      return (
                        <span
                          key={gpuId}
                          className={`inline-flex h-10 min-w-12 items-center justify-center rounded-md border px-2 text-xs font-semibold tabular-nums ${
                            failed
                              ? 'border-rose-400 bg-rose-100 text-rose-950 line-through dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
                              : group.healthy
                                ? 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100'
                                : 'border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
                          }`}
                        >
                          GPU {gpuId + 1}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {group.healthy
                      ? `${result.slotsPerReplica} planned sequence slots - ${formatGiB(result.modeledHbmGiB)} modeled HBM/GPU`
                      : 'One required rank failed; the whole group leaves admission.'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className={`mt-5 rounded-md border p-5 ${
            result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
              : result.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                : result.tone === 'violet'
                  ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
          }`}>
            <div className="flex items-start gap-3">
              {result.stable ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Modeled decision</p>
                <p className="mt-1 text-lg font-semibold">{result.verdict}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Usable cache budget</p>
              <p className="mt-1 font-semibold tabular-nums text-neutral-950 dark:text-white">{formatGiB(result.cacheBudgetGiB)} / GPU</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Memory-limited slots</p>
              <p className="mt-1 font-semibold tabular-nums text-neutral-950 dark:text-white">{result.memorySlots} / replica</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Communication reserve</p>
              <p className="mt-1 font-semibold tabular-nums text-neutral-950 dark:text-white">{Math.round(topology.communicationPenalty * 100)}% modeled penalty</p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading the serving envelope...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Serving envelope data could not be loaded</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
