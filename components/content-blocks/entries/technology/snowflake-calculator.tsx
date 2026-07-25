'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Gauge,
  Layers3,
  Server,
} from 'lucide-react';

import {
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

type WarehouseSize = {
  id: string;
  label: string;
  creditsPerHourPerCluster: number;
};

type WarehouseModel = {
  title: string;
  description: string;
  rateNote: string;
  editionNote: string;
  defaults: {
    warehouseSizeId: string;
    arrivalQueriesPerMinute: number;
    observedRuntimeSeconds: number;
    measuredConcurrencyPerCluster: number;
    clusterCount: number;
    activeWindowMinutes: number;
  };
  bounds: {
    arrivalQueriesPerMinute: Bound;
    observedRuntimeSeconds: Bound;
    measuredConcurrencyPerCluster: Bound;
    clusterCount: Bound;
    activeWindowMinutes: Bound;
  };
  warehouseSizes: WarehouseSize[];
};

const BLOCK_ID = 'technology/snowflake-calculator';
const DATA_FILE = '/api/content/technology/snowflake/data/warehouse-queue-model.json';

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const bound = value as Partial<Bound>;
  return (
    isPositiveNumber(bound.min)
    && isPositiveNumber(bound.max)
    && isPositiveNumber(bound.step)
    && bound.min <= bound.max
  );
}

function isWarehouseModel(value: unknown): value is WarehouseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WarehouseModel>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.rateNote
      && candidate.editionNote
      && defaults?.warehouseSizeId
      && isPositiveNumber(defaults.arrivalQueriesPerMinute)
      && isPositiveNumber(defaults.observedRuntimeSeconds)
      && isPositiveNumber(defaults.measuredConcurrencyPerCluster)
      && isPositiveNumber(defaults.clusterCount)
      && isPositiveNumber(defaults.activeWindowMinutes)
      && isBound(bounds?.arrivalQueriesPerMinute)
      && isBound(bounds?.observedRuntimeSeconds)
      && isBound(bounds?.measuredConcurrencyPerCluster)
      && isBound(bounds?.clusterCount)
      && isBound(bounds?.activeWindowMinutes)
      && Array.isArray(candidate.warehouseSizes)
      && candidate.warehouseSizes.length >= 4
      && candidate.warehouseSizes.every((size) => (
        typeof size.id === 'string'
        && typeof size.label === 'string'
        && isPositiveNumber(size.creditsPerHourPerCluster)
      )),
  );
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export default function SnowflakeCalculator() {
  const [data, setData] = useState<WarehouseModel | null>(null);
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
        if (!isWarehouseModel(payload)) {
          throw new Error('The warehouse queue model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the queue model.',
        );
      });

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {data ? (
        <WarehouseQueueLab data={data} />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Warehouse queue lab"
            title="Can this compute envelope absorb the arrivals?"
            description="Loading the documented credit rates and transparent workload inputs."
            icon={Gauge}
            accent="blue"
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
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Loading workload assumptions
                </p>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      )}
    </div>
  );
}

function WarehouseQueueLab({ data }: { data: WarehouseModel }) {
  const [warehouseSizeId, setWarehouseSizeId] = useState(data.defaults.warehouseSizeId);
  const [arrivalQueriesPerMinute, setArrivalQueriesPerMinute] = useState(
    data.defaults.arrivalQueriesPerMinute,
  );
  const [observedRuntimeSeconds, setObservedRuntimeSeconds] = useState(
    data.defaults.observedRuntimeSeconds,
  );
  const [measuredConcurrencyPerCluster, setMeasuredConcurrencyPerCluster] = useState(
    data.defaults.measuredConcurrencyPerCluster,
  );
  const [clusterCount, setClusterCount] = useState(data.defaults.clusterCount);
  const [activeWindowMinutes, setActiveWindowMinutes] = useState(
    data.defaults.activeWindowMinutes,
  );

  const selectedSize = (
    data.warehouseSizes.find((size) => size.id === warehouseSizeId)
    ?? data.warehouseSizes[0]
  );

  const result = useMemo(() => {
    const serviceCapacityPerMinute = (
      clusterCount
      * measuredConcurrencyPerCluster
      * 60
      / observedRuntimeSeconds
    );
    const utilizationPercent = arrivalQueriesPerMinute / serviceCapacityPerMinute * 100;
    const queueGrowthPerMinute = Math.max(
      0,
      arrivalQueriesPerMinute - serviceCapacityPerMinute,
    );
    const queuedAfterWindow = queueGrowthPerMinute * activeWindowMinutes;
    const headroomPerMinute = Math.max(
      0,
      serviceCapacityPerMinute - arrivalQueriesPerMinute,
    );
    const referenceCredits = (
      selectedSize.creditsPerHourPerCluster
      * clusterCount
      * activeWindowMinutes
      / 60
    );

    return {
      headroomPerMinute,
      queuedAfterWindow,
      queueGrowthPerMinute,
      referenceCredits,
      serviceCapacityPerMinute,
      utilizationPercent,
    };
  }, [
    activeWindowMinutes,
    arrivalQueriesPerMinute,
    clusterCount,
    measuredConcurrencyPerCluster,
    observedRuntimeSeconds,
    selectedSize.creditsPerHourPerCluster,
  ]);

  const state = (
    result.utilizationPercent <= 80
      ? 'healthy'
      : result.utilizationPercent <= 100
        ? 'pressure'
        : 'queue'
  );

  function reset() {
    setWarehouseSizeId(data.defaults.warehouseSizeId);
    setArrivalQueriesPerMinute(data.defaults.arrivalQueriesPerMinute);
    setObservedRuntimeSeconds(data.defaults.observedRuntimeSeconds);
    setMeasuredConcurrencyPerCluster(data.defaults.measuredConcurrencyPerCluster);
    setClusterCount(data.defaults.clusterCount);
    setActiveWindowMinutes(data.defaults.activeWindowMinutes);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Warehouse queue lab"
        title={data.title}
        description={data.description}
        icon={Gauge}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Warehouse size under test
              </span>
              <select
                value={warehouseSizeId}
                onChange={(event) => setWarehouseSizeId(event.target.value)}
                className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {data.warehouseSizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label} · {size.creditsPerHourPerCluster} Gen1 credits/hour
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Changing size does not invent a new runtime. Enter the observed pilot
                result below.
              </span>
            </label>

            <LabRange
              label="Incoming query rate"
              value={arrivalQueriesPerMinute}
              output={`${arrivalQueriesPerMinute} qpm`}
              {...data.bounds.arrivalQueriesPerMinute}
              lowLabel="Quiet"
              highLabel="Burst"
              accent="blue"
              onChange={setArrivalQueriesPerMinute}
            />
            <LabRange
              label="Observed mean runtime"
              value={observedRuntimeSeconds}
              output={`${observedRuntimeSeconds}s`}
              {...data.bounds.observedRuntimeSeconds}
              lowLabel="Pilot measurement"
              highLabel="Slower query set"
              accent="violet"
              onChange={setObservedRuntimeSeconds}
            />
            <LabRange
              label="Measured safe concurrency"
              value={measuredConcurrencyPerCluster}
              output={`${measuredConcurrencyPerCluster} queries/cluster`}
              {...data.bounds.measuredConcurrencyPerCluster}
              lowLabel="Conservative"
              highLabel="Measured ceiling"
              accent="cyan"
              onChange={setMeasuredConcurrencyPerCluster}
            />
            <LabRange
              label="Active clusters"
              value={clusterCount}
              output={`${clusterCount}`}
              {...data.bounds.clusterCount}
              lowLabel="Single cluster"
              highLabel="Scale out"
              accent="emerald"
              onChange={setClusterCount}
            />
            <LabRange
              label="Observation window"
              value={activeWindowMinutes}
              output={`${activeWindowMinutes}m`}
              {...data.bounds.activeWindowMinutes}
              accent="amber"
              onChange={setActiveWindowMinutes}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              state === 'healthy'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : state === 'pressure'
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {state === 'healthy' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Queue consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {state === 'healthy'
                    ? 'Capacity has operating headroom'
                    : state === 'pressure'
                      ? 'The envelope has little burst margin'
                      : 'Queries accumulate faster than they finish'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {state === 'queue'
                    ? `${formatDecimal(result.queueGrowthPerMinute)} queries join the queue each minute under these assumptions.`
                    : `${formatDecimal(result.headroomPerMinute)} queries per minute of calculated service headroom remain.`}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Service envelope"
              value={`${formatDecimal(result.serviceCapacityPerMinute)} qpm`}
              detail="clusters × measured slots × 60 ÷ observed seconds"
              icon={Activity}
              tone="blue"
            />
            <LabMetric
              label="Offered utilization"
              value={`${formatDecimal(result.utilizationPercent)}%`}
              detail="arrival rate ÷ calculated service envelope"
              icon={Gauge}
              tone={state === 'queue' ? 'rose' : state === 'pressure' ? 'amber' : 'emerald'}
            />
            <LabMetric
              label={`Queue after ${activeWindowMinutes}m`}
              value={formatDecimal(result.queuedAfterWindow)}
              detail="No retry, cancellation, or workload-shape correction"
              icon={Clock3}
              tone={state === 'queue' ? 'rose' : 'neutral'}
            />
            <LabMetric
              label="Reference credits"
              value={formatDecimal(result.referenceCredits, 2)}
              detail="All selected Gen1 clusters active for the full window"
              icon={Coins}
              tone="violet"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
              <Layers3 className="h-4 w-4 text-blue-500" aria-hidden="true" />
              Transparent workload arithmetic
            </div>
            <div className="mt-4 grid gap-3 text-sm text-neutral-700 md:grid-cols-3 dark:text-neutral-300">
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <span className="block text-xs font-semibold uppercase text-neutral-500">
                  1. Concurrent completions
                </span>
                <span className="mt-1 block font-mono text-xs leading-5">
                  {clusterCount} × {measuredConcurrencyPerCluster} slots
                </span>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <span className="block text-xs font-semibold uppercase text-neutral-500">
                  2. Completion cycles
                </span>
                <span className="mt-1 block font-mono text-xs leading-5">
                  60 ÷ {observedRuntimeSeconds}s per minute
                </span>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <span className="block text-xs font-semibold uppercase text-neutral-500">
                  3. Queue growth
                </span>
                <span className="mt-1 block font-mono text-xs leading-5">
                  max(0, {arrivalQueriesPerMinute} − {formatDecimal(result.serviceCapacityPerMinute)})
                </span>
              </div>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
              <div className="flex items-center gap-2 font-semibold">
                <Server className="h-4 w-4" aria-hidden="true" />
                Size changes need a new pilot
              </div>
              <p className="mt-2 opacity-85">
                A larger warehouse can help complex queries, but small queries might not
                benefit. Re-measure runtime, spill, and safe concurrency after resizing.
              </p>
            </div>
            <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50">
              <div className="flex items-center gap-2 font-semibold">
                <Coins className="h-4 w-4" aria-hidden="true" />
                Credit boundary
              </div>
              <p className="mt-2 opacity-85">
                {clusterCount > 1 ? data.editionNote : data.rateNote}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
