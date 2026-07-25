'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleGauge,
  Cpu,
  Filter,
  Layers3,
  ShieldAlert,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-quality-filtering/data/filter-cascade-fixture.json';
const BLOCK_ID = 'ml-systems/data-quality-filtering-calculator';

type Stage = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  millisecondsPerRecord: number;
};

type RecordBucket = {
  id: string;
  label: string;
  records: number;
  failedStageIds: string[];
};

type LabData = {
  title: string;
  description: string;
  benchmarkNote: string;
  defaults: {
    batchMultiplier: number;
    stageOrder: string[];
  };
  stages: Stage[];
  recordBuckets: RecordBucket[];
};

type StageResult = Stage & {
  calls: number;
  cpuMilliseconds: number;
  rejected: number;
};

type SimulationResult = {
  accepted: number;
  cpuMilliseconds: number;
  firstReasonCounts: Record<string, number>;
  stageResults: StageResult[];
  totalRecords: number;
  totalStageCalls: number;
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  if (
    typeof data.title !== 'string' ||
    typeof data.description !== 'string' ||
    typeof data.benchmarkNote !== 'string' ||
    !data.defaults ||
    !Array.isArray(data.defaults.stageOrder) ||
    typeof data.defaults.batchMultiplier !== 'number' ||
    !Array.isArray(data.stages) ||
    data.stages.length < 3 ||
    !Array.isArray(data.recordBuckets) ||
    data.recordBuckets.length === 0
  ) {
    return false;
  }

  const stageIds = new Set(data.stages.map((stage) => stage.id));
  const orderedStageIds = new Set(data.defaults.stageOrder);
  const bucketIds = new Set(data.recordBuckets.map((bucket) => bucket.id));
  return Boolean(
    stageIds.size === data.stages.length &&
      orderedStageIds.size === data.stages.length &&
      bucketIds.size === data.recordBuckets.length &&
      data.defaults.stageOrder.length === data.stages.length &&
      data.defaults.stageOrder.every((id) => stageIds.has(id)) &&
      data.stages.every(
        (stage) =>
          typeof stage.id === 'string' &&
          typeof stage.label === 'string' &&
          typeof stage.shortLabel === 'string' &&
          typeof stage.description === 'string' &&
          Number.isFinite(stage.millisecondsPerRecord) &&
          stage.millisecondsPerRecord >= 0,
      ) &&
      data.recordBuckets.every(
        (bucket) =>
          typeof bucket.id === 'string' &&
          typeof bucket.label === 'string' &&
          Number.isInteger(bucket.records) &&
          bucket.records > 0 &&
          Array.isArray(bucket.failedStageIds) &&
          bucket.failedStageIds.every((id) => stageIds.has(id)),
      ),
  );
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [
      item,
      ...tail,
    ]),
  );
}

function simulate(
  data: LabData,
  stageOrder: string[],
  batchMultiplier: number,
): SimulationResult {
  const stagesById = new Map(data.stages.map((stage) => [stage.id, stage]));
  const stageResults = stageOrder.map((stageId) => {
    const stage = stagesById.get(stageId);
    if (!stage) throw new Error(`Unknown stage: ${stageId}`);
    return {
      ...stage,
      calls: 0,
      cpuMilliseconds: 0,
      rejected: 0,
    };
  });
  const firstReasonCounts: Record<string, number> = {};
  let accepted = 0;

  for (const bucket of data.recordBuckets) {
    const records = bucket.records * batchMultiplier;
    const firstFailureIndex = stageResults.findIndex((stage) =>
      bucket.failedStageIds.includes(stage.id),
    );

    stageResults.forEach((stage, index) => {
      if (firstFailureIndex === -1 || index <= firstFailureIndex) {
        stage.calls += records;
        stage.cpuMilliseconds += records * stage.millisecondsPerRecord;
      }
    });

    if (firstFailureIndex === -1) {
      accepted += records;
    } else {
      const failedStage = stageResults[firstFailureIndex];
      failedStage.rejected += records;
      firstReasonCounts[failedStage.id] = (firstReasonCounts[failedStage.id] ?? 0) + records;
    }
  }

  const totalRecords =
    data.recordBuckets.reduce((total, bucket) => total + bucket.records, 0) * batchMultiplier;
  return {
    accepted,
    cpuMilliseconds: stageResults.reduce(
      (total, stage) => total + stage.cpuMilliseconds,
      0,
    ),
    firstReasonCounts,
    stageResults,
    totalRecords,
    totalStageCalls: stageResults.reduce((total, stage) => total + stage.calls, 0),
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(milliseconds: number) {
  if (milliseconds >= 60_000) return `${(milliseconds / 60_000).toFixed(1)} CPU min`;
  return `${(milliseconds / 1_000).toFixed(1)} CPU sec`;
}

export default function DataQualityFilteringCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchMultiplier, setBatchMultiplier] = useState(10);
  const [stageOrder, setStageOrder] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the cascade fixture (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isLabData(value)) {
          throw new Error('The cascade fixture has an invalid data contract.');
        }
        setData(value);
        setBatchMultiplier(value.defaults.batchMultiplier);
        setStageOrder(value.defaults.stageOrder);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(
            fetchError instanceof Error ? fetchError.message : 'Could not load the cascade lab.',
          );
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data || stageOrder.length !== data.stages.length) return null;
    const current = simulate(data, stageOrder, batchMultiplier);
    const candidates = permutations(data.stages.map((stage) => stage.id)).map((order) => ({
      order,
      result: simulate(data, order, batchMultiplier),
    }));
    const fastest = candidates.reduce((best, candidate) =>
      candidate.result.cpuMilliseconds < best.result.cpuMilliseconds ? candidate : best,
    );
    return { current, fastest };
  }, [batchMultiplier, data, stageOrder]);

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stageOrder.length) return;
    setStageOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const reset = () => {
    if (!data) return;
    setBatchMultiplier(data.defaults.batchMultiplier);
    setStageOrder(data.defaults.stageOrder);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading filter cascade lab"
      />
    );
  }

  const isBestOrder =
    Math.abs(result.current.cpuMilliseconds - result.fastest.result.cpuMilliseconds) <
    Number.EPSILON;
  const cpuPenalty =
    result.fastest.result.cpuMilliseconds === 0
      ? 0
      : ((result.current.cpuMilliseconds - result.fastest.result.cpuMilliseconds) /
          result.fastest.result.cpuMilliseconds) *
        100;
  const retentionPct = (result.current.accepted / result.current.totalRecords) * 100;
  const allStagesCalls = result.current.totalRecords * data.stages.length;
  const avoidedCalls = allStagesCalls - result.current.totalStageCalls;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Filter cascade lab"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange
                label="Fixture repetitions"
                value={batchMultiplier}
                output={`${formatCount(
                  data.recordBuckets.reduce((total, bucket) => total + bucket.records, 0) *
                    batchMultiplier,
                )} records`}
                min={1}
                max={100}
                step={1}
                accent="cyan"
                lowLabel="One cohort"
                highLabel="100 cohorts"
                onChange={setBatchMultiplier}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evaluation order
                </legend>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Move cheap, high-rejection gates earlier. Every record stops at its first
                  failed gate.
                </p>
                <ol className="mt-3 space-y-2">
                  {stageOrder.map((stageId, index) => {
                    const stage = data.stages.find((item) => item.id === stageId);
                    if (!stage) return null;
                    return (
                      <li
                        key={stage.id}
                        className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem_2.5rem] items-center gap-2 rounded-md border border-neutral-200 bg-white p-2 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{stage.shortLabel}</span>
                          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                            {stage.millisecondsPerRecord.toFixed(2)} ms / call
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => moveStage(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${stage.label} earlier`}
                          title={`Move ${stage.label} earlier`}
                          className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:border-cyan-500 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
                        >
                          <ArrowUp aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStage(index, 1)}
                          disabled={index === stageOrder.length - 1}
                          aria-label={`Move ${stage.label} later`}
                          title={`Move ${stage.label} later`}
                          className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 hover:border-cyan-500 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
                        >
                          <ArrowDown aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                isBestOrder
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {isBestOrder ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Measured verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {isBestOrder
                      ? 'This is the lowest-cost order for the fixture'
                      : `${cpuPenalty.toFixed(1)}% more CPU than the fixture's best order`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    The retained set stays fixed because every deterministic gate still runs
                    unless an earlier gate already quarantined the record. Only evaluation work
                    and the first recorded reason change.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Fixture CPU"
                value={formatDuration(result.current.cpuMilliseconds)}
                detail="Sum of calls × measured fixture cost"
                icon={Cpu}
                tone={isBestOrder ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Stage calls"
                value={formatCount(result.current.totalStageCalls)}
                detail={`${formatCount(avoidedCalls)} avoided by early exit`}
                icon={CircleGauge}
                tone="blue"
              />
              <LabMetric
                label="Retained"
                value={`${retentionPct.toFixed(1)}%`}
                detail={`${formatCount(result.current.accepted)} records`}
                icon={Filter}
                tone="cyan"
              />
              <LabMetric
                label="Quarantined"
                value={formatCount(result.current.totalRecords - result.current.accepted)}
                detail="Preserved with first-failure reason"
                icon={ShieldAlert}
                tone="rose"
              />
            </div>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Work through the cascade
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    Calls and rejections at each gate
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Costs come from the fixture, not a vendor benchmark.
                </p>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-2">
                {result.current.stageResults.map((stage, index) => (
                  <li
                    key={stage.id}
                    className="relative min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                        {index + 1}
                      </span>
                      <span className="text-right text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatDuration(stage.cpuMilliseconds)}
                      </span>
                    </div>
                    <h5 className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                      {stage.label}
                    </h5>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {stage.description}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Evaluated</dt>
                        <dd className="mt-1 font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {formatCount(stage.calls)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Stopped here</dt>
                        <dd className="mt-1 font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                          {formatCount(stage.rejected)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </div>

            <p className="rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <strong className="text-neutral-950 dark:text-white">Fixture boundary:</strong>{' '}
              {data.benchmarkNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
