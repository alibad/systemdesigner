'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  LoaderCircle,
  RadioTower,
  Split,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  recordsPerSecond: number;
  averageRecordKiB: number;
};

type CapacityModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    shards: number;
    hottestKeyPercent: number;
  };
  bounds: {
    shards: Bound;
    hottestKeyPercent: Bound;
  };
  serviceLimits: {
    writeRecordsPerSecondPerShard: number;
    writeMiBPerSecondPerShard: number;
  };
  workloads: Workload[];
};

type ShardLoad = {
  id: number;
  recordsPerSecond: number;
  writeMiBPerSecond: number;
  utilization: number;
  hot: boolean;
};

const BLOCK_ID = 'technology/kinesis-cost';
const KIB_PER_MIB = 1024;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isWorkload(value: unknown): value is Workload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workload>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.recordsPerSecond === 'number'
      && typeof candidate.averageRecordKiB === 'number',
  );
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.shards === 'number'
      && typeof candidate.defaults.hottestKeyPercent === 'number'
      && isBound(candidate.bounds?.shards)
      && isBound(candidate.bounds?.hottestKeyPercent)
      && typeof candidate.serviceLimits?.writeRecordsPerSecondPerShard === 'number'
      && typeof candidate.serviceLimits.writeMiBPerSecondPerShard === 'number'
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every(isWorkload),
  );
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value > 0 && value < 1 ? Math.min(2, digits) : 0,
  }).format(value);
}

export default function KinesisShardCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No shard-capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityModel(payload)) {
          throw new Error('The shard-capacity model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the shard lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityModel }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [shards, setShards] = useState(data.defaults.shards);
  const [hottestKeyPercent, setHottestKeyPercent] = useState(
    data.defaults.hottestKeyPercent,
  );

  const workload = data.workloads.find((item) => item.id === workloadId)
    ?? data.workloads[0];

  const result = useMemo(() => {
    const limits = data.serviceLimits;
    const totalWriteMiBPerSecond = (
      workload.recordsPerSecond
      * workload.averageRecordKiB
      / KIB_PER_MIB
    );
    const shardFloorByRecords = Math.ceil(
      workload.recordsPerSecond / limits.writeRecordsPerSecondPerShard,
    );
    const shardFloorByBytes = Math.ceil(
      totalWriteMiBPerSecond / limits.writeMiBPerSecondPerShard,
    );
    const minimumShards = Math.max(shardFloorByRecords, shardFloorByBytes);
    const hotFraction = hottestKeyPercent / 100;
    const hotRecordsPerSecond = workload.recordsPerSecond * hotFraction;
    const hotWriteMiBPerSecond = totalWriteMiBPerSecond * hotFraction;
    const remainingRecordsPerSecond = workload.recordsPerSecond - hotRecordsPerSecond;
    const remainingWriteMiBPerSecond = totalWriteMiBPerSecond - hotWriteMiBPerSecond;
    const otherShardCount = Math.max(1, shards - 1);
    const otherRecordsPerSecond = shards === 1
      ? 0
      : remainingRecordsPerSecond / otherShardCount;
    const otherWriteMiBPerSecond = shards === 1
      ? 0
      : remainingWriteMiBPerSecond / otherShardCount;
    const utilization = (recordsPerSecond: number, writeMiBPerSecond: number) => Math.max(
      recordsPerSecond / limits.writeRecordsPerSecondPerShard,
      writeMiBPerSecond / limits.writeMiBPerSecondPerShard,
    ) * 100;
    const modeledHotRecordsPerSecond = shards === 1
      ? workload.recordsPerSecond
      : hotRecordsPerSecond;
    const modeledHotWriteMiBPerSecond = shards === 1
      ? totalWriteMiBPerSecond
      : hotWriteMiBPerSecond;
    const hotUtilization = utilization(
      modeledHotRecordsPerSecond,
      modeledHotWriteMiBPerSecond,
    );
    const otherUtilization = utilization(otherRecordsPerSecond, otherWriteMiBPerSecond);
    const aggregateUtilization = Math.max(
      workload.recordsPerSecond
        / (shards * limits.writeRecordsPerSecondPerShard),
      totalWriteMiBPerSecond
        / (shards * limits.writeMiBPerSecondPerShard),
    ) * 100;
    const hotKeyOver = shards > 1 && hotUtilization > 100;
    const fleetOver = shards < minimumShards;
    const maxUtilization = Math.max(hotUtilization, otherUtilization);
    const status = hotKeyOver || fleetOver
      ? 'critical'
      : maxUtilization > 80
        ? 'warning'
        : 'healthy';
    const visibleShardCount = Math.min(shards, 8);
    const shardLoads: ShardLoad[] = Array.from(
      { length: visibleShardCount },
      (_, index) => ({
        id: index + 1,
        recordsPerSecond: index === 0
          ? modeledHotRecordsPerSecond
          : otherRecordsPerSecond,
        writeMiBPerSecond: index === 0
          ? modeledHotWriteMiBPerSecond
          : otherWriteMiBPerSecond,
        utilization: index === 0 ? hotUtilization : otherUtilization,
        hot: index === 0,
      }),
    );

    return {
      aggregateUtilization,
      fleetOver,
      hotKeyOver,
      hotRecordsPerSecond: modeledHotRecordsPerSecond,
      hotUtilization,
      hotWriteMiBPerSecond: modeledHotWriteMiBPerSecond,
      minimumShards,
      shardFloorByBytes,
      shardFloorByRecords,
      shardLoads,
      status,
      totalWriteMiBPerSecond,
    } as const;
  }, [data.serviceLimits, hottestKeyPercent, shards, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setShards(data.defaults.shards);
    setHottestKeyPercent(data.defaults.hottestKeyPercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard capacity lab"
          title={data.title}
          description={data.description}
          icon={Split}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={`${item.recordsPerSecond.toLocaleString()} records/s · ${item.averageRecordKiB} KiB average`}
                      icon={item.id === 'device-telemetry' ? RadioTower : Activity}
                      accent={item.id === 'change-data-capture' ? 'violet' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {workload.detail}
                </p>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Provisioned shards"
                  value={shards}
                  output={`${shards} shards`}
                  {...data.bounds.shards}
                  lowLabel="One lane"
                  highLabel="More aggregate capacity"
                  accent="blue"
                  onChange={setShards}
                />
                <LabRange
                  label="Traffic on hottest key"
                  value={hottestKeyPercent}
                  output={`${hottestKeyPercent}%`}
                  {...data.bounds.hottestKeyPercent}
                  lowLabel="Well distributed"
                  highLabel="Concentrated"
                  accent="amber"
                  onChange={setHottestKeyPercent}
                />
              </div>

              <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                The fixture places the hottest key on shard 1 and distributes all
                remaining traffic evenly. Real hash distributions require
                per-shard metrics.
              </div>
            </div>
          )}
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Capacity floor"
                value={`${result.minimumShards} shards`}
                detail={`${result.shardFloorByRecords} by records · ${result.shardFloorByBytes} by bytes`}
                icon={Layers3}
                tone={result.fleetOver ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Logical write"
                value={`${formatNumber(result.totalWriteMiBPerSecond, 2)} MiB/s`}
                detail={`${workload.recordsPerSecond.toLocaleString()} records each second`}
                icon={Activity}
                tone="violet"
              />
              <LabMetric
                label="Hottest shard"
                value={`${formatNumber(result.hotUtilization)}%`}
                detail={`${formatNumber(result.hotRecordsPerSecond)} records/s · ${formatNumber(result.hotWriteMiBPerSecond, 2)} MiB/s`}
                icon={Gauge}
                tone={result.hotKeyOver ? 'rose' : result.hotUtilization > 80 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Fleet average"
                value={`${formatNumber(result.aggregateUtilization)}%`}
                detail="The average can look healthy while one shard throttles"
                icon={RadioTower}
                tone={result.aggregateUtilization > 100 ? 'rose' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Partition-key distribution
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    One key cannot spread across unrelated shards
                  </h4>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  100% is a modeled shard limit
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {result.shardLoads.map((shard) => (
                  <ShardMeter key={shard.id} shard={shard} />
                ))}
              </div>
              {shards > result.shardLoads.length ? (
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {shards - result.shardLoads.length} additional shards have the same
                  modeled load as the non-hot lanes shown above.
                </p>
              ) : null}
            </section>

            <section className={`rounded-md border p-4 ${
              result.status === 'critical'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
                : result.status === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <h4 className="font-semibold">
                    {result.hotKeyOver
                      ? 'The hottest partition key throttles one shard'
                      : result.fleetOver
                        ? 'The stream lacks aggregate write capacity'
                        : result.status === 'warning'
                          ? 'The stream fits with thin per-shard headroom'
                          : 'The modeled write path has shard headroom'}
                  </h4>
                  <p className="mt-2 text-sm leading-6">
                    {result.hotKeyOver
                      ? 'Adding shards does not split this key. Choose a finer key or add explicit buckets only where the business ordering contract allows it.'
                      : result.fleetOver
                        ? `Provision at least ${result.minimumShards} shards before adding operating reserve for bursts and resharding.`
                        : 'Keep the ordering key stable, validate the distribution with shard-level metrics, and reserve capacity for bursts and retries.'}
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

function ShardMeter({ shard }: { shard: ShardLoad }) {
  const overloaded = shard.utilization > 100;
  const warning = !overloaded && shard.utilization > 80;
  const tone = overloaded
    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
    : warning
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950';
  const bar = overloaded
    ? 'bg-rose-500'
    : warning
      ? 'bg-amber-500'
      : shard.hot
        ? 'bg-blue-500'
        : 'bg-emerald-500';

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-950 dark:text-white">
          Shard {shard.id}{shard.hot ? ' · hottest key' : ''}
        </span>
        <span className="text-[11px] font-semibold uppercase text-neutral-600 dark:text-neutral-300">
          {overloaded ? 'Over limit' : warning ? 'Thin headroom' : 'Headroom'}
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="meter"
        aria-label={`Shard ${shard.id} utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(shard.utilization))}
      >
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${bar}`}
          style={{ width: `${Math.min(100, shard.utilization)}%` }}
        />
      </div>
      <p className="mt-2 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {formatNumber(shard.utilization)}% · {formatNumber(shard.recordsPerSecond)} records/s
      </p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          {error ? (
            <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
          ) : (
            <LoaderCircle
              aria-hidden="true"
              className="h-7 w-7 animate-spin text-blue-500 motion-reduce:animate-none"
            />
          )}
          <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
            {error ? 'Shard model unavailable' : 'Loading shard model'}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {error ?? 'Loading the lesson-owned capacity assumptions.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Retry
            </button>
          ) : null}
        </div>
      </LearningLab>
    </div>
  );
}
