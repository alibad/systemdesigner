'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  Filter,
  ScanSearch,
  Scissors,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Partition = {
  id: string;
  minDay: number;
  maxDay: number;
  regions: string[];
};

type Layout = {
  id: string;
  label: string;
  detail: string;
  loadingPattern: string;
  partitions: Partition[];
};

type Region = {
  id: string;
  label: string;
};

type PruningModel = {
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    layoutId: string;
    startDay: number;
    windowDays: number;
    regionId: string;
  };
  bounds: {
    startDay: {
      min: number;
      max: number;
      step: number;
    };
    windowDays: {
      min: number;
      max: number;
      step: number;
    };
  };
  regions: Region[];
  layouts: Layout[];
};

const BLOCK_ID = 'technology/snowflake-pruning-lab';
const DATA_FILE = '/api/content/technology/snowflake/data/micro-partition-pruning-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPruningModel(value: unknown): value is PruningModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PruningModel>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && defaults?.layoutId
      && defaults.regionId
      && isFiniteNumber(defaults.startDay)
      && isFiniteNumber(defaults.windowDays)
      && isFiniteNumber(bounds?.startDay?.min)
      && isFiniteNumber(bounds?.startDay?.max)
      && isFiniteNumber(bounds?.startDay?.step)
      && isFiniteNumber(bounds?.windowDays?.min)
      && isFiniteNumber(bounds?.windowDays?.max)
      && isFiniteNumber(bounds?.windowDays?.step)
      && Array.isArray(candidate.regions)
      && candidate.regions.length >= 4
      && candidate.regions.every((region) => (
        typeof region.id === 'string' && typeof region.label === 'string'
      ))
      && Array.isArray(candidate.layouts)
      && candidate.layouts.length >= 3
      && candidate.layouts.every((layout) => (
        typeof layout.id === 'string'
        && typeof layout.label === 'string'
        && typeof layout.detail === 'string'
        && typeof layout.loadingPattern === 'string'
        && Array.isArray(layout.partitions)
        && layout.partitions.length > 0
        && layout.partitions.every((partition) => (
          typeof partition.id === 'string'
          && isFiniteNumber(partition.minDay)
          && isFiniteNumber(partition.maxDay)
          && partition.minDay <= partition.maxDay
          && Array.isArray(partition.regions)
          && partition.regions.every((region) => typeof region === 'string')
        ))
      )),
  );
}

export default function SnowflakePruningLab() {
  const [data, setData] = useState<PruningModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(DATA_FILE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPruningModel(payload)) {
          throw new Error('The micro-partition metadata model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the pruning model.',
        );
      });

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {data ? (
        <PruningLab data={data} />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Micro-partition pruning lab"
            title="Which partitions can the predicate eliminate?"
            description="Loading the explicit metadata map."
            icon={ScanSearch}
            accent="cyan"
          />
          <LearningLabBody>
            <div className="flex min-h-44 items-center justify-center text-center">
              {error ? (
                <div className="max-w-md">
                  <CircleAlert className="mx-auto h-6 w-6 text-rose-500" aria-hidden="true" />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Loading partition metadata
                </p>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      )}
    </div>
  );
}

function PruningLab({ data }: { data: PruningModel }) {
  const [layoutId, setLayoutId] = useState(data.defaults.layoutId);
  const [startDay, setStartDay] = useState(data.defaults.startDay);
  const [windowDays, setWindowDays] = useState(data.defaults.windowDays);
  const [regionId, setRegionId] = useState(data.defaults.regionId);

  const selectedLayout = (
    data.layouts.find((layout) => layout.id === layoutId)
    ?? data.layouts[0]
  );

  const result = useMemo(() => {
    const endDay = Math.min(30, startDay + windowDays - 1);
    const scannedIds = new Set(
      selectedLayout.partitions
        .filter((partition) => {
          const overlapsDate = partition.minDay <= endDay && partition.maxDay >= startDay;
          const overlapsRegion = (
            regionId === 'all'
            || partition.regions.includes(regionId)
          );
          return overlapsDate && overlapsRegion;
        })
        .map((partition) => partition.id),
    );
    const scannedCount = scannedIds.size;
    const partitionCount = selectedLayout.partitions.length;
    const prunedCount = partitionCount - scannedCount;
    const scannedPercent = scannedCount / partitionCount * 100;
    const prunedPercent = prunedCount / partitionCount * 100;
    const selectedDays = endDay - startDay + 1;

    return {
      endDay,
      partitionCount,
      prunedCount,
      prunedPercent,
      scannedCount,
      scannedIds,
      scannedPercent,
      selectedDays,
    };
  }, [regionId, selectedLayout.partitions, startDay, windowDays]);

  const pruningState = (
    result.scannedPercent <= 25
      ? 'focused'
      : result.scannedPercent <= 50
        ? 'mixed'
        : 'broad'
  );

  const selectedRegion = (
    data.regions.find((region) => region.id === regionId)
    ?? data.regions[0]
  );

  function reset() {
    setLayoutId(data.defaults.layoutId);
    setStartDay(data.defaults.startDay);
    setWindowDays(data.defaults.windowDays);
    setRegionId(data.defaults.regionId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Micro-partition pruning lab"
        title={data.title}
        description={data.description}
        icon={ScanSearch}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Metadata layout
              </legend>
              <div className="mt-3 grid gap-2">
                {data.layouts.map((layout) => (
                  <LabChoice
                    key={layout.id}
                    selected={layout.id === selectedLayout.id}
                    label={layout.label}
                    detail={layout.detail}
                    icon={Boxes}
                    accent="cyan"
                    onClick={() => setLayoutId(layout.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Predicate start day"
                value={startDay}
                output={`Day ${startDay}`}
                {...data.bounds.startDay}
                lowLabel="Month start"
                highLabel="Month end"
                accent="blue"
                onChange={setStartDay}
              />
              <LabRange
                label="Predicate window"
                value={windowDays}
                output={`${windowDays} day${windowDays === 1 ? '' : 's'}`}
                {...data.bounds.windowDays}
                lowLabel="Selective"
                highLabel="Broader range"
                accent="violet"
                onChange={setWindowDays}
              />
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Optional region predicate
              </span>
              <select
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {data.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              pruningState === 'focused'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : pruningState === 'mixed'
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {pruningState === 'focused' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Filter className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Pruning consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {pruningState === 'focused'
                    ? 'Metadata eliminates most partitions'
                    : pruningState === 'mixed'
                      ? 'The predicate still touches several ranges'
                      : 'Overlapping ranges force a broad scan'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  `order_day BETWEEN {startDay} AND {result.endDay}` with{' '}
                  {regionId === 'all'
                    ? 'no region predicate'
                    : `region = '${selectedRegion.label}'`}{' '}
                  scans {result.scannedCount} of {result.partitionCount} modeled
                  partitions.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Partitions scanned"
              value={`${result.scannedCount} / ${result.partitionCount}`}
              detail="Range metadata can match the predicate"
              icon={ScanSearch}
              tone={pruningState === 'broad' ? 'rose' : 'cyan'}
            />
            <LabMetric
              label="Partitions pruned"
              value={`${result.prunedPercent.toFixed(0)}%`}
              detail={`${result.prunedCount} partitions cannot match`}
              icon={Scissors}
              tone={pruningState === 'focused' ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Date selectivity"
              value={`${result.selectedDays} / 30 days`}
              detail="Logical predicate width, not scan percentage"
              icon={Filter}
              tone="violet"
            />
            <LabMetric
              label="Physical claim"
              value="None"
              detail="Measure bytes, runtime, and credits in Query Profile"
              icon={Database}
              tone="neutral"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Explicit micro-partition metadata
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {selectedLayout.loadingPattern}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs font-medium text-neutral-600 sm:mt-0 dark:text-neutral-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
                  Scan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm border border-neutral-400 bg-white dark:bg-neutral-950" />
                  Prune
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {selectedLayout.partitions.map((partition) => {
                const isScanned = result.scannedIds.has(partition.id);
                const regionLabels = partition.regions.map((partitionRegion) => (
                  data.regions.find((region) => region.id === partitionRegion)?.label
                  ?? partitionRegion
                ));

                return (
                  <div
                    key={partition.id}
                    className={`min-w-0 rounded-md border p-3 ${
                      isScanned
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-200 dark:border-cyan-700 dark:bg-cyan-950/45 dark:text-cyan-50 dark:ring-cyan-900'
                        : 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{partition.id}</span>
                      <span className="text-[10px] font-bold uppercase">
                        {isScanned ? 'Scan' : 'Prune'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      Day {partition.minDay}–{partition.maxDay}
                    </p>
                    <p className="mt-1 truncate text-xs" title={regionLabels.join(', ')}>
                      {regionLabels.join(', ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50">
              <p className="font-semibold">What the model proves</p>
              <p className="mt-2 opacity-85">
                Every pruned partition has either a non-overlapping date range or no
                matching region value in its declared metadata.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">
                What production must measure
              </p>
              <p className="mt-2">
                {data.modelNote} A clustering key is justified by repeated workload
                evidence, not by this diagram alone.
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
