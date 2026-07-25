'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Binary,
  CheckCircle2,
  CircleAlert,
  Flame,
  Gauge,
  GitBranch,
  KeyRound,
  Network,
  Route,
  ScanSearch,
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
type QueryScope = 'global' | 'entity';
type Distribution = 'sequential' | 'even' | 'entity';
type Workload = {
  id: string;
  label: string;
  detail: string;
  queryScope: QueryScope;
  hotEntityShare: number;
  queryLabel: string;
};
type Strategy = {
  id: string;
  label: string;
  detail: string;
  distribution: Distribution;
  globalRangeFanout: number;
  entityRangeFanout: number;
  example: string;
};
type RowKeyData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    strategyId: string;
    writesPerSecond: number;
    regionCapacityPerSecond: number;
  };
  bounds: {
    writesPerSecond: Bound;
    regionCapacityPerSecond: Bound;
  };
  regions: string[];
  workloads: Workload[];
  strategies: Strategy[];
};

const BLOCK_ID = 'technology/hbase-row-key-distribution-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isRowKeyData(value: unknown): value is RowKeyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RowKeyData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.strategyId
      && typeof candidate.defaults.writesPerSecond === 'number'
      && typeof candidate.defaults.regionCapacityPerSecond === 'number'
      && isBound(candidate.bounds?.writesPerSecond)
      && isBound(candidate.bounds?.regionCapacityPerSecond)
      && Array.isArray(candidate.regions)
      && candidate.regions.length >= 4
      && candidate.regions.every((item) => typeof item === 'string')
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && ['global', 'entity'].includes(item.queryScope)
        && typeof item.hotEntityShare === 'number'
        && typeof item.queryLabel === 'string'
      ))
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 3
      && candidate.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && ['sequential', 'even', 'entity'].includes(item.distribution)
        && typeof item.globalRangeFanout === 'number'
        && typeof item.entityRangeFanout === 'number'
        && typeof item.example === 'string'
      )),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function HBaseRowKeyDistributionLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RowKeyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No row-key distribution model was supplied.');
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
        if (!isRowKeyData(payload)) throw new Error('The row-key distribution model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the row-key lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LabState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <RowKeyWorkbench data={data} />;
}

function RowKeyWorkbench({ data }: { data: RowKeyData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [strategyId, setStrategyId] = useState(data.defaults.strategyId);
  const [writesPerSecond, setWritesPerSecond] = useState(data.defaults.writesPerSecond);
  const [regionCapacityPerSecond, setRegionCapacityPerSecond] = useState(
    data.defaults.regionCapacityPerSecond,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const result = useMemo(() => {
    const regionCount = data.regions.length;
    let shares: number[];

    if (strategy.distribution === 'sequential') {
      const tailShare = 0.84;
      const background = (1 - tailShare) / (regionCount - 1);
      shares = data.regions.map((_, index) => index === regionCount - 1 ? tailShare : background);
    } else if (strategy.distribution === 'entity') {
      const background = (1 - workload.hotEntityShare) / regionCount;
      shares = data.regions.map((_, index) => index === 0 ? background + workload.hotEntityShare : background);
    } else {
      const weights = data.regions.map((_, index) => index % 3 === 0 ? 1.04 : index % 3 === 1 ? 0.96 : 1);
      const total = weights.reduce((sum, value) => sum + value, 0);
      shares = weights.map((value) => value / total);
    }

    const regionLoads = shares.map((share, index) => ({
      id: data.regions[index],
      share,
      writesPerSecond: writesPerSecond * share,
    }));
    const hottest = regionLoads.reduce((current, item) => (
      item.writesPerSecond > current.writesPerSecond ? item : current
    ));
    const averageWrites = writesPerSecond / regionCount;
    const hotspotRatio = hottest.writesPerSecond / averageWrites;
    const scanFanout = workload.queryScope === 'global'
      ? strategy.globalRangeFanout
      : strategy.entityRangeFanout;
    const overloaded = hottest.writesPerSecond > regionCapacityPerSecond;
    const balanced = hotspotRatio <= 1.35;
    const localScan = scanFanout === 1;

    return {
      balanced,
      hottest,
      hotspotRatio,
      localScan,
      overloaded,
      regionLoads,
      scanFanout,
    };
  }, [data.regions, regionCapacityPerSecond, strategy, workload, writesPerSecond]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setStrategyId(data.defaults.strategyId);
    setWritesPerSecond(data.defaults.writesPerSecond);
    setRegionCapacityPerSecond(data.defaults.regionCapacityPerSecond);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Row-key distribution lab"
          title={data.title}
          description={data.description}
          icon={KeyRound}
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
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'global-events' ? Network : Activity}
                      accent="cyan"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Row-key shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.distribution === 'sequential' ? Route : Binary}
                      accent={item.distribution === 'sequential' ? 'amber' : 'violet'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Incoming writes"
                  value={writesPerSecond}
                  output={`${compactNumber(writesPerSecond)}/s`}
                  {...data.bounds.writesPerSecond}
                  lowLabel="Normal"
                  highLabel="Burst"
                  accent="rose"
                  onChange={setWritesPerSecond}
                />
                <LabRange
                  label="One region capacity"
                  value={regionCapacityPerSecond}
                  output={`${compactNumber(regionCapacityPerSecond)}/s`}
                  {...data.bounds.regionCapacityPerSecond}
                  lowLabel="Constrained"
                  highLabel="Faster server"
                  accent="emerald"
                  onChange={setRegionCapacityPerSecond}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${result.overloaded ? dangerClass : result.balanced ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.overloaded
                  ? <Flame aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : result.balanced
                    ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Placement verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.overloaded
                      ? `${result.hottest.id} is beyond one region's write budget`
                      : result.balanced
                        ? 'Writes are distributed across the key space'
                        : 'The key is workable, but one region carries disproportionate load'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.overloaded
                      ? `The hottest region receives about ${compactNumber(result.hottest.writesPerSecond)} writes/s against a ${compactNumber(regionCapacityPerSecond)} writes/s planning limit.`
                      : `The hottest region receives ${result.hotspotRatio.toFixed(1)}x the average load. The same key shape makes "${workload.queryLabel}" contact ${result.scanFanout} region${result.scanFanout === 1 ? '' : 's'}.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Hottest region"
                value={`${(result.hottest.share * 100).toFixed(0)}%`}
                detail={`${compactNumber(result.hottest.writesPerSecond)} writes/s`}
                icon={Flame}
                tone={result.overloaded ? 'rose' : result.balanced ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Skew ratio"
                value={`${result.hotspotRatio.toFixed(1)}x`}
                detail="Hottest region versus cluster average"
                icon={Gauge}
                tone={result.balanced ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Range fan-out"
                value={`${result.scanFanout} region${result.scanFanout === 1 ? '' : 's'}`}
                detail={workload.queryLabel}
                icon={ScanSearch}
                tone={result.localScan ? 'cyan' : 'violet'}
              />
              <LabMetric
                label="Range order"
                value={result.localScan ? 'Local' : 'Merge'}
                detail={result.localScan ? 'Preserved in one scan' : `${result.scanFanout} ordered scans to combine`}
                icon={GitBranch}
                tone={result.localScan ? 'blue' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Eight contiguous regions</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Where current writes land</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Bar width is load versus one-region capacity</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.regionLoads.map((region) => {
                  const utilization = region.writesPerSecond / regionCapacityPerSecond * 100;
                  return (
                    <div key={region.id} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-100">Region {region.id}</span>
                        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                          {compactNumber(region.writesPerSecond)}/s
                        </span>
                      </div>
                      <div
                        className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
                        role="progressbar"
                        aria-label={`Region ${region.id} write utilization`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.round(utilization))}
                      >
                        <div
                          className={`h-full transition-[width] motion-reduce:transition-none ${utilization > 100 ? 'bg-rose-500' : utilization > 75 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                          style={{ width: `${Math.max(2, Math.min(100, utilization))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                <p className="text-xs font-semibold uppercase opacity-70">Encoded row key</p>
                <code className="mt-2 block break-all text-sm font-semibold">{strategy.example}</code>
              </div>
              <Route aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 md:rotate-0" />
              <div className={`rounded-md border p-4 ${result.localScan ? healthyClass : warningClass}`}>
                <p className="text-xs font-semibold uppercase opacity-70">Read consequence</p>
                <p className="mt-2 text-sm font-semibold">
                  {result.localScan
                    ? `One bounded scan serves ${workload.queryLabel.toLowerCase()}.`
                    : `${result.scanFanout} scans must be issued and merged for ${workload.queryLabel.toLowerCase()}.`}
                </p>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
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
              <p className="text-sm font-semibold">{error ? 'Row-key lab unavailable' : 'Loading row-key model'}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {error ?? 'Preparing workload and region scenarios.'}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center rounded-md border border-neutral-300 px-3 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:hover:bg-neutral-950"
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
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
