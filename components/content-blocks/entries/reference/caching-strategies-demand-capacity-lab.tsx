'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Database,
  Gauge,
  HardDrive,
  TimerReset,
  Zap,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type DemandInputs = {
  requestRate: number;
  objectSizeKb: number;
  workingSetSkewPercent: number;
  cacheSizeGb: number;
  ttlSeconds: number;
  mutationRatePerMinute: number;
  hitRatePercent: number;
};
type DemandModel = {
  defaults: DemandInputs;
  bounds: Record<keyof DemandInputs, Bound>;
  assumptions: {
    uniqueKeysPerMinuteAtNoSkew: number;
    entryOverheadMultiplier: number;
    cacheHitLatencyMs: number;
    originLatencyMs: number;
    originCapacityQps: number;
    originEgressUsdPerGb: number;
    hotKeyCount: number;
  };
};

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024).toLocaleString()} KB`;
}

export default function CachingStrategiesDemandCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DemandModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<DemandInputs>({
    requestRate: 8000,
    objectSizeKb: 12,
    workingSetSkewPercent: 80,
    cacheSizeGb: 2,
    ttlSeconds: 300,
    mutationRatePerMinute: 20,
    hitRatePercent: 92,
  });

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The cache demand model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<DemandModel>;
      })
      .then((model) => {
        setData(model);
        setInputs(model.defaults);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the cache demand model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError title="Cache demand model unavailable" detail={loadError} />;
  if (!data) return <LabLoading label="Loading cache demand model" />;

  const update = (key: keyof DemandInputs) => (value: number) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };
  const { assumptions } = data;
  const missRate = 1 - inputs.hitRatePercent / 100;
  const uniqueKeysPerMinute = assumptions.uniqueKeysPerMinuteAtNoSkew * (1 - (inputs.workingSetSkewPercent / 100) * 0.8);
  const retainedKeys = uniqueKeysPerMinute * (inputs.ttlSeconds / 60);
  const memoryNeedBytes = retainedKeys * inputs.objectSizeKb * 1024 * assumptions.entryOverheadMultiplier;
  const cacheCapacityBytes = inputs.cacheSizeGb * 1024 ** 3;
  const memoryPressure = memoryNeedBytes / cacheCapacityBytes;
  const originQps = inputs.requestRate * missRate;
  const overloadedOrigin = originQps > assumptions.originCapacityQps;
  const originLatency = assumptions.originLatencyMs * (overloadedOrigin ? 1 + Math.min(2, originQps / assumptions.originCapacityQps - 1) : 1);
  const weightedLatency = inputs.hitRatePercent / 100 * assumptions.cacheHitLatencyMs + missRate * originLatency;
  const originBytesPerSecond = originQps * inputs.objectSizeKb * 1024;
  const hourlyEgressCost = originBytesPerSecond * 3600 / 1024 ** 3 * assumptions.originEgressUsdPerGb;
  const hotKeyQps = inputs.requestRate * (inputs.workingSetSkewPercent / 100) / assumptions.hotKeyCount;
  const mutationWindow = inputs.mutationRatePerMinute * inputs.ttlSeconds / 60;
  const stampedeRisk = inputs.ttlSeconds <= 300 && hotKeyQps >= 100;
  const capacityRisk = memoryPressure > 1;
  const staleRisk = mutationWindow > 20;
  const warning = stampedeRisk
    ? `Stampede risk: about ${number.format(hotKeyQps)} requests/second concentrate on each modeled hot key while expiry is synchronized. Add jitter and coalesce the refresh.`
    : capacityRisk
      ? `Capacity risk: the modeled working set needs ${formatBytes(memoryNeedBytes)}, more than the configured cache. Evictions can make the selected hit rate unattainable.`
      : overloadedOrigin
        ? `Origin risk: miss traffic exceeds the modeled ${number.format(assumptions.originCapacityQps)} QPS origin capacity. Improve hit rate or add origin capacity before relying on this TTL.`
        : staleRisk
          ? `Freshness risk: about ${number.format(mutationWindow)} source changes occur during one TTL window. Use source versions or invalidation if those changes cannot wait for expiry.`
          : 'The modeled cache fits its working set and origin remains below capacity. Validate this with per-key production measurements before committing the target.';
  const warningTone = stampedeRisk || capacityRisk || overloadedOrigin
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    : staleRisk
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100';

  return (
    <div data-content-block="reference/caching-strategies-demand-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Demand, memory, freshness, and origin model"
          title="Treat hit rate as a capacity and correctness decision"
          description="Adjust traffic, object footprint, locality, cache size, TTL, mutation rate, and hit rate. The model exposes the memory needed for the selected TTL, origin demand created by misses, and the expiry conditions that can create a stampede."
          icon={Gauge}
          accent="cyan"
          onReset={() => setInputs(data.defaults)}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange label="Request rate" value={inputs.requestRate} output={`${number.format(inputs.requestRate)} req/s`} {...data.bounds.requestRate} accent="blue" lowLabel="quiet path" highLabel="peak path" onChange={update('requestRate')} />
              <LabRange label="Object size" value={inputs.objectSizeKb} output={`${inputs.objectSizeKb} KB`} {...data.bounds.objectSizeKb} accent="violet" lowLabel="small value" highLabel="large payload" onChange={update('objectSizeKb')} />
              <LabRange label="Working-set skew" value={inputs.workingSetSkewPercent} output={`${inputs.workingSetSkewPercent}%`} {...data.bounds.workingSetSkewPercent} accent="cyan" lowLabel="even keys" highLabel="few hot keys" onChange={update('workingSetSkewPercent')} />
              <LabRange label="Cache size" value={inputs.cacheSizeGb} output={`${inputs.cacheSizeGb} GB`} {...data.bounds.cacheSizeGb} accent="emerald" lowLabel="small cache" highLabel="large cache" onChange={update('cacheSizeGb')} />
              <LabRange label="TTL" value={inputs.ttlSeconds} output={`${inputs.ttlSeconds} sec`} {...data.bounds.ttlSeconds} accent="amber" lowLabel="rapid expiry" highLabel="long reuse" onChange={update('ttlSeconds')} />
              <LabRange label="Source mutations" value={inputs.mutationRatePerMinute} output={`${number.format(inputs.mutationRatePerMinute)}/min`} {...data.bounds.mutationRatePerMinute} accent="rose" lowLabel="mostly static" highLabel="rapidly changing" onChange={update('mutationRatePerMinute')} />
              <LabRange label="Observed hit rate" value={inputs.hitRatePercent} output={`${inputs.hitRatePercent}%`} {...data.bounds.hitRatePercent} accent="blue" lowLabel="miss-heavy" highLabel="hit-heavy" onChange={update('hitRatePercent')} />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Working-set memory" value={formatBytes(memoryNeedBytes)} detail={`${number.format(Math.round(retainedKeys))} modeled keys over ${inputs.ttlSeconds} sec, including ${assumptions.entryOverheadMultiplier}x overhead.`} icon={HardDrive} tone={capacityRisk ? 'rose' : 'emerald'} />
              <LabMetric label="Origin QPS" value={`${number.format(originQps)} req/s`} detail={`${100 - inputs.hitRatePercent}% misses from ${number.format(inputs.requestRate)} total requests.`} icon={Database} tone={overloadedOrigin ? 'rose' : 'cyan'} />
              <LabMetric label="Expected latency" value={`${weightedLatency.toFixed(1)} ms`} detail={`${inputs.hitRatePercent}% at ${assumptions.cacheHitLatencyMs} ms; misses at ${originLatency.toFixed(0)} ms.`} icon={Activity} tone={overloadedOrigin ? 'rose' : 'blue'} />
              <LabMetric label="Origin bandwidth" value={`${(originBytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`} detail={`${money.format(hourlyEgressCost)}/hour modeled egress at the origin.`} icon={BadgeDollarSign} tone="violet" />
              <LabMetric label="Memory pressure" value={`${(memoryPressure * 100).toFixed(0)}%`} detail={`${formatBytes(cacheCapacityBytes)} configured cache capacity.`} icon={HardDrive} tone={capacityRisk ? 'rose' : memoryPressure > 0.75 ? 'amber' : 'emerald'} />
              <LabMetric label="Hot-key refresh load" value={`${number.format(hotKeyQps)} req/s`} detail={`${assumptions.hotKeyCount} modeled hot keys; ${stampedeRisk ? 'expiry needs coalescing' : 'monitor this before reducing TTL'}.`} icon={Zap} tone={stampedeRisk ? 'rose' : 'amber'} />
            </div>

            <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">How the model connects the controls</p>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-neutral-700 md:grid-cols-2 dark:text-neutral-200">
                <p><code>origin QPS = request rate x (1 - hit rate)</code></p>
                <p><code>memory need = distinct keys during TTL x object bytes x entry overhead</code></p>
                <p><code>weighted latency = hit rate x cache latency + miss rate x origin latency</code></p>
                <p><code>stale-change exposure = mutation rate x TTL window</code></p>
              </div>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${warningTone}`} role="status">
              <div className="flex items-start gap-3">
                {stampedeRisk || capacityRisk || overloadedOrigin ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">Current consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{warning}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading({ label }: { label: string }) {
  return <div data-content-block="reference/caching-strategies-demand-capacity-lab"><div className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} /></div>;
}

function LabError({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block="reference/caching-strategies-demand-capacity-lab"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
