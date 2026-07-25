'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  GitMerge,
  LoaderCircle,
  Network,
  PackagePlus,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/clickhouse-ingestion-merge-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/clickhouse/data/ingestion-merge-model.json';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  batchMultiplier: number;
  queueBoundary: string;
};

type IngestionModel = {
  kind: 'clickhouse-ingestion-pressure';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    strategyId: string;
    rowsPerSecond: number;
    rowsPerInsert: number;
    partitionsPerInsert: number;
    mergeCapacityPerSecond: number;
  };
  ranges: {
    rowsPerSecond: { min: number; max: number; step: number };
    rowsPerInsert: { min: number; max: number; step: number };
    partitionsPerInsert: { min: number; max: number; step: number };
    mergeCapacityPerSecond: { min: number; max: number; step: number };
  };
  strategies: Strategy[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isIngestionModel(value: unknown): value is IngestionModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'clickhouse-ingestion-pressure'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.notice === 'string'
      && isRecord(value.defaults)
      && isRecord(value.ranges)
      && Array.isArray(value.strategies)
      && value.strategies.length >= 2,
  );
}

export default function ClickHouseIngestionMergeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<IngestionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [strategyId, setStrategyId] = useState('');
  const [rowsPerSecond, setRowsPerSecond] = useState(0);
  const [rowsPerInsert, setRowsPerInsert] = useState(0);
  const [partitionsPerInsert, setPartitionsPerInsert] = useState(1);
  const [mergeCapacityPerSecond, setMergeCapacityPerSecond] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isIngestionModel(payload)) {
          throw new Error('The ClickHouse ingestion model is incomplete.');
        }
        setModel(payload);
        setStrategyId(payload.defaults.strategyId);
        setRowsPerSecond(payload.defaults.rowsPerSecond);
        setRowsPerInsert(payload.defaults.rowsPerInsert);
        setPartitionsPerInsert(payload.defaults.partitionsPerInsert);
        setMergeCapacityPerSecond(payload.defaults.mergeCapacityPerSecond);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load ingestion data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const strategy =
    model?.strategies.find((item) => item.id === strategyId) ?? model?.strategies[0];

  const result = useMemo(() => {
    if (!strategy) return null;
    const effectiveRowsPerInsert = Math.max(1, rowsPerInsert * strategy.batchMultiplier);
    const requestsPerSecond = rowsPerSecond / effectiveRowsPerInsert;
    const partsCreatedPerSecond = requestsPerSecond * partitionsPerInsert;
    const mergeUtilization = partsCreatedPerSecond / mergeCapacityPerSecond;
    const netPartGrowthPerSecond = Math.max(
      0,
      partsCreatedPerSecond - mergeCapacityPerSecond,
    );
    const backlogAfter15Min = Math.ceil(netPartGrowthPerSecond * 15 * 60);
    const healthy = mergeUtilization <= 0.7;
    const saturated = mergeUtilization > 1;
    return {
      backlogAfter15Min,
      effectiveRowsPerInsert,
      healthy,
      mergeUtilization,
      netPartGrowthPerSecond,
      partsCreatedPerSecond,
      requestsPerSecond,
      saturated,
    };
  }, [
    mergeCapacityPerSecond,
    partitionsPerInsert,
    rowsPerInsert,
    rowsPerSecond,
    strategy,
  ]);

  if (!model || !strategy || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Part-pressure lab"
            title="Keep inserts ahead of merge debt"
            description="Loading batching strategies and MergeTree pressure assumptions."
            icon={GitMerge}
            accent="amber"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading ingestion model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setStrategyId(model.defaults.strategyId);
    setRowsPerSecond(model.defaults.rowsPerSecond);
    setRowsPerInsert(model.defaults.rowsPerInsert);
    setPartitionsPerInsert(model.defaults.partitionsPerInsert);
    setMergeCapacityPerSecond(model.defaults.mergeCapacityPerSecond);
  };
  const OutcomeIcon = result.healthy ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Part-pressure lab"
          title={model.title}
          description={model.description}
          icon={GitMerge}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Insert acknowledgement boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {model.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'async-insert' ? Network : PackagePlus}
                      accent={item.id === 'row-wise' ? 'rose' : item.id === 'async-insert' ? 'violet' : 'blue'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Queue owner
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {strategy.queueBoundary}
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Define who can drop, retry, deduplicate, flush, and report this queue before changing throughput settings.
                </p>
              </section>
            </div>
          )}
        >
          <div aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Shape inserts and background capacity
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Partition fan-out multiplies part creation even when row throughput stays constant.
                </p>
              </div>
              <div className="grid gap-x-6 gap-y-7 md:grid-cols-2">
                <LabRange
                  label="Incoming rows"
                  value={rowsPerSecond}
                  output={`${rowsPerSecond.toLocaleString()}/s`}
                  {...model.ranges.rowsPerSecond}
                  lowLabel="Steady stream"
                  highLabel="Bursting stream"
                  accent="blue"
                  onChange={setRowsPerSecond}
                />
                <LabRange
                  label="Rows per insert"
                  value={rowsPerInsert}
                  output={rowsPerInsert.toLocaleString()}
                  {...model.ranges.rowsPerInsert}
                  lowLabel="Chatty"
                  highLabel="Large batch"
                  accent="violet"
                  onChange={setRowsPerInsert}
                />
                <LabRange
                  label="Partitions touched"
                  value={partitionsPerInsert}
                  output={`${partitionsPerInsert}`}
                  {...model.ranges.partitionsPerInsert}
                  lowLabel="One partition"
                  highLabel="Wide fan-out"
                  accent="amber"
                  onChange={setPartitionsPerInsert}
                />
                <LabRange
                  label="Net merge capacity"
                  value={mergeCapacityPerSecond}
                  output={`${mergeCapacityPerSecond.toFixed(0)} parts/s`}
                  {...model.ranges.mergeCapacityPerSecond}
                  lowLabel="Constrained disks"
                  highLabel="Available background pool"
                  accent="emerald"
                  onChange={setMergeCapacityPerSecond}
                />
              </div>
            </section>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Effective batch"
                value={result.effectiveRowsPerInsert.toLocaleString()}
                detail="Rows represented by one modeled part-producing flush"
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Insert requests"
                value={`${result.requestsPerSecond.toFixed(1)}/s`}
                detail="Application or async-buffer flushes"
                icon={Network}
                tone="blue"
              />
              <LabMetric
                label="Parts created"
                value={`${result.partsCreatedPerSecond.toFixed(1)}/s`}
                detail={`${partitionsPerInsert} partition${partitionsPerInsert === 1 ? '' : 's'} per insert`}
                icon={PackagePlus}
                tone={result.saturated ? 'rose' : 'amber'}
              />
              <LabMetric
                label="15-minute debt"
                value={result.backlogAfter15Min.toLocaleString()}
                detail="Modeled net parts awaiting consolidation"
                icon={Clock3}
                tone={result.backlogAfter15Min === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Modeled part path
              </p>
              <div className="mt-4 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <FlowNode
                  icon={Network}
                  label="Insert boundary"
                  value={`${result.requestsPerSecond.toFixed(1)} req/s`}
                  tone="blue"
                />
                <span className="hidden self-center text-center text-neutral-400 sm:block">→</span>
                <FlowNode
                  icon={Database}
                  label="New parts"
                  value={`${result.partsCreatedPerSecond.toFixed(1)}/s`}
                  tone={result.saturated ? 'rose' : 'amber'}
                />
                <span className="hidden self-center text-center text-neutral-400 sm:block">→</span>
                <FlowNode
                  icon={GitMerge}
                  label="Merge capacity"
                  value={`${mergeCapacityPerSecond}/s`}
                  tone={result.healthy ? 'emerald' : 'violet'}
                />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full ${
                    result.healthy
                      ? 'bg-emerald-500'
                      : result.saturated
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, result.mergeUtilization * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Merge headroom</span>
                <span>{(result.mergeUtilization * 100).toFixed(0)}% modeled utilization</span>
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.healthy
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : result.saturated
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.healthy
                      ? 'The model retains merge headroom'
                      : result.saturated
                        ? 'Part creation outruns the modeled merge drain'
                        : 'The model is close to sustained merge saturation'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-85">
                    {result.healthy
                      ? 'Rehearse burst behavior and monitor active parts, delayed inserts, merge queues, disk bandwidth, and replica lag before release.'
                      : 'Increase effective batch size, reduce partition fan-out, smooth bursts, or add verified merge capacity. Do not hide debt by raising only a part-count threshold.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  tone: 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
  } as const;

  return (
    <div className={`rounded-md border p-3 ${styles[tone]}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <p className="mt-3 text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
