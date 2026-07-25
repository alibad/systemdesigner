'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Network,
  Server,
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

type Bound = { min: number; max: number; step: number };
type CapacityData = {
  title: string;
  description: string;
  defaults: {
    logicalDataTiB: number;
    dailyGrowthGiB: number;
    targetRegionGiB: number;
    replicationFactor: number;
    writeAmplification: number;
    compactionCapacityMiBps: number;
  };
  bounds: {
    logicalDataTiB: Bound;
    dailyGrowthGiB: Bound;
    targetRegionGiB: Bound;
    writeAmplification: Bound;
    compactionCapacityMiBps: Bound;
  };
  replicationOptions: number[];
  cluster: {
    usableDiskTiBPerServer: number;
    safeRegionsPerServer: number;
    splitWarningPerDay: number;
    storageHeadroomPct: number;
  };
};

const BLOCK_ID = 'technology/hbase-sizing';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;
  const cluster = candidate.cluster;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults
      && Object.values(defaults).every((item) => typeof item === 'number' && Number.isFinite(item))
      && bounds
      && Object.values(bounds).every(isBound)
      && Array.isArray(candidate.replicationOptions)
      && candidate.replicationOptions.length >= 2
      && candidate.replicationOptions.every((item) => Number.isInteger(item) && item > 0)
      && cluster
      && Object.values(cluster).every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function HBaseSizingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No HBase capacity model was supplied.');
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
        if (!isCapacityData(payload)) throw new Error('The HBase capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityData }) {
  const [logicalDataTiB, setLogicalDataTiB] = useState(data.defaults.logicalDataTiB);
  const [dailyGrowthGiB, setDailyGrowthGiB] = useState(data.defaults.dailyGrowthGiB);
  const [targetRegionGiB, setTargetRegionGiB] = useState(data.defaults.targetRegionGiB);
  const [replicationFactor, setReplicationFactor] = useState(data.defaults.replicationFactor);
  const [writeAmplification, setWriteAmplification] = useState(data.defaults.writeAmplification);
  const [compactionCapacityMiBps, setCompactionCapacityMiBps] = useState(
    data.defaults.compactionCapacityMiBps,
  );

  const result = useMemo(() => {
    const regionCount = Math.ceil(logicalDataTiB * 1024 / targetRegionGiB);
    const physicalStorageTiB = logicalDataTiB * replicationFactor;
    const storageServers = Math.ceil(physicalStorageTiB / data.cluster.usableDiskTiBPerServer);
    const regionServers = Math.ceil(regionCount / data.cluster.safeRegionsPerServer);
    const requiredServers = Math.max(3, storageServers, regionServers);
    const regionsPerServer = regionCount / requiredServers;
    const splitRatePerDay = dailyGrowthGiB / targetRegionGiB;
    const logicalIngestMiBps = dailyGrowthGiB * 1024 / 86_400;
    const compactionDemandMiBps = logicalIngestMiBps * (writeAmplification - 1);
    const compactionUtilization = compactionDemandMiBps / compactionCapacityMiBps * 100;
    const deficitMiBps = Math.max(0, compactionDemandMiBps - compactionCapacityMiBps);
    const backlogGiBPerDay = deficitMiBps * 86_400 / 1024;
    const regionPressure = regionsPerServer / data.cluster.safeRegionsPerServer * 100;
    const splitPressure = splitRatePerDay / data.cluster.splitWarningPerDay * 100;
    const storageLimited = storageServers >= regionServers;
    const healthy = compactionUtilization <= 85
      && regionPressure <= 100
      && splitPressure <= 100;

    return {
      backlogGiBPerDay,
      compactionDemandMiBps,
      compactionUtilization,
      healthy,
      logicalIngestMiBps,
      physicalStorageTiB,
      regionCount,
      regionPressure,
      regionsPerServer,
      requiredServers,
      splitPressure,
      splitRatePerDay,
      storageLimited,
    };
  }, [
    compactionCapacityMiBps,
    dailyGrowthGiB,
    data.cluster,
    logicalDataTiB,
    replicationFactor,
    targetRegionGiB,
    writeAmplification,
  ]);

  function reset() {
    setLogicalDataTiB(data.defaults.logicalDataTiB);
    setDailyGrowthGiB(data.defaults.dailyGrowthGiB);
    setTargetRegionGiB(data.defaults.targetRegionGiB);
    setReplicationFactor(data.defaults.replicationFactor);
    setWriteAmplification(data.defaults.writeAmplification);
    setCompactionCapacityMiBps(data.defaults.compactionCapacityMiBps);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and compaction lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <div className="space-y-6">
                <LabRange
                  label="Live logical data"
                  value={logicalDataTiB}
                  output={`${logicalDataTiB} TiB`}
                  {...data.bounds.logicalDataTiB}
                  lowLabel="Small estate"
                  highLabel="Large estate"
                  accent="blue"
                  onChange={setLogicalDataTiB}
                />
                <LabRange
                  label="Daily logical growth"
                  value={dailyGrowthGiB}
                  output={`${compactNumber(dailyGrowthGiB)} GiB/day`}
                  {...data.bounds.dailyGrowthGiB}
                  lowLabel="Steady"
                  highLabel="Heavy ingest"
                  accent="cyan"
                  onChange={setDailyGrowthGiB}
                />
                <LabRange
                  label="Target region size"
                  value={targetRegionGiB}
                  output={`${targetRegionGiB} GiB`}
                  {...data.bounds.targetRegionGiB}
                  lowLabel="More regions"
                  highLabel="Larger regions"
                  accent="amber"
                  onChange={setTargetRegionGiB}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  HDFS replication
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {data.replicationOptions.map((option) => (
                    <LabChoice
                      key={option}
                      selected={replicationFactor === option}
                      label={`${option}x`}
                      detail={option === 1 ? 'No copy margin' : option === 3 ? 'Common baseline' : 'Reduced margin'}
                      icon={Layers3}
                      accent={option === 1 ? 'rose' : 'blue'}
                      onClick={() => setReplicationFactor(option)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Total write amplification"
                  value={writeAmplification}
                  output={`${writeAmplification.toFixed(1)}x`}
                  {...data.bounds.writeAmplification}
                  lowLabel="Light rewrites"
                  highLabel="Heavy rewrites"
                  accent="violet"
                  onChange={setWriteAmplification}
                />
                <LabRange
                  label="Compaction capacity"
                  value={compactionCapacityMiBps}
                  output={`${compactionCapacityMiBps} MiB/s`}
                  {...data.bounds.compactionCapacityMiBps}
                  lowLabel="Constrained"
                  highLabel="More workers / I/O"
                  accent="emerald"
                  onChange={setCompactionCapacityMiBps}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : dangerClass}`}>
              <div className="flex items-start gap-3">
                {result.healthy
                  ? <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Modeled envelope</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.healthy ? 'Background work can keep pace' : 'The cluster is accumulating operational debt'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.healthy
                      ? `About ${result.requiredServers} RegionServers cover the larger of the storage and region-count constraints, while compaction remains below the planning ceiling.`
                      : result.backlogGiBPerDay > 0
                        ? `Compaction falls behind by about ${compactNumber(result.backlogGiBPerDay)} GiB each day. Store files and read amplification keep growing until ingest slows or rewrite capacity rises.`
                        : `Region creation is outrunning the operational threshold. Increase target size or distribute growth before assignment and recovery work dominate.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Physical storage"
                value={`${result.physicalStorageTiB.toFixed(0)} TiB`}
                detail={`${replicationFactor}x HDFS replication before temporary compaction space`}
                icon={HardDrive}
                tone={replicationFactor === 1 ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Regions"
                value={compactNumber(result.regionCount)}
                detail={`${result.regionsPerServer.toFixed(0)} per modeled server`}
                icon={Boxes}
                tone={result.regionPressure > 100 ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="RegionServers"
                value={`${result.requiredServers}`}
                detail={result.storageLimited ? 'Storage is the larger constraint' : 'Region count is the larger constraint'}
                icon={Server}
                tone="violet"
              />
              <LabMetric
                label="Splits per day"
                value={result.splitRatePerDay.toFixed(1)}
                detail="Approximate new regions created by growth"
                icon={Split}
                tone={result.splitPressure > 100 ? 'amber' : 'emerald'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Compaction queue</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.compactionDemandMiBps.toFixed(1)} MiB/s rewrite demand
                  </h4>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {result.compactionUtilization.toFixed(0)}% of capacity
                </p>
              </div>
              <div
                className="mt-4 h-4 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label="Compaction capacity utilization"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(result.compactionUtilization))}
              >
                <div
                  className={`h-full transition-[width] motion-reduce:transition-none ${result.compactionUtilization > 100 ? 'bg-rose-500' : result.compactionUtilization > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.max(3, Math.min(100, result.compactionUtilization))}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InlineFact label="Logical ingest" value={`${result.logicalIngestMiBps.toFixed(1)} MiB/s`} icon={Database} />
                <InlineFact label="Rewrite multiplier" value={`${(writeAmplification - 1).toFixed(1)}x background`} icon={Network} />
                <InlineFact label="Backlog growth" value={`${compactNumber(result.backlogGiBPerDay)} GiB/day`} icon={Activity} />
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This is a planning model, not a benchmark. Validate HFile compression, HDFS overhead, compaction policy, disk bandwidth, region skew, and recovery headroom with production measurements.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function InlineFact({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Database }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function LabState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-5 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{error ? 'Capacity lab unavailable' : 'Loading capacity model'}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {error ?? 'Preparing the region and compaction envelope.'}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center rounded-md border border-neutral-300 px-3 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:hover:bg-neutral-950"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
