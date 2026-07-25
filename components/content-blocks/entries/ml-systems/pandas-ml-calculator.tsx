'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Rows3,
  Type,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/pandas-ml-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/pandas-ml/data/dataframe-memory-model.json';
const GIB = 1024 ** 3;

type Profile = { id: string; label: string; detail: string };

type MemoryModel = {
  kind: 'pandas-dataframe-memory';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    profileId: string;
    rows: number;
    numericColumns: number;
    textColumns: number;
    averageTextBytes: number;
    peakMultiplier: number;
    availableMemoryGb: number;
    chunkRows: number;
  };
  ranges: {
    rows: Range;
    numericColumns: Range;
    textColumns: Range;
    averageTextBytes: Range;
    peakMultiplier: Range;
    availableMemoryGb: Range;
    chunkRows: Range;
  };
  profiles: Profile[];
  notice: string;
};

type Range = { min: number; max: number; step: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isMemoryModel(value: unknown): value is MemoryModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'pandas-dataframe-memory'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.notice === 'string'
      && isRecord(value.defaults)
      && isRecord(value.ranges)
      && Array.isArray(value.profiles)
      && value.profiles.length >= 2,
  );
}

function formatBytes(bytes: number) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes >= 10 * GIB ? 1 : 2)} GiB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`;
}

export default function PandasMLCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MemoryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [rows, setRows] = useState(0);
  const [numericColumns, setNumericColumns] = useState(0);
  const [textColumns, setTextColumns] = useState(0);
  const [averageTextBytes, setAverageTextBytes] = useState(0);
  const [peakMultiplier, setPeakMultiplier] = useState(1);
  const [availableMemoryGb, setAvailableMemoryGb] = useState(4);
  const [chunkRows, setChunkRows] = useState(10_000);

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
        if (!isMemoryModel(payload)) throw new Error('The pandas memory model is incomplete.');
        setModel(payload);
        setProfileId(payload.defaults.profileId);
        setRows(payload.defaults.rows);
        setNumericColumns(payload.defaults.numericColumns);
        setTextColumns(payload.defaults.textColumns);
        setAverageTextBytes(payload.defaults.averageTextBytes);
        setPeakMultiplier(payload.defaults.peakMultiplier);
        setAvailableMemoryGb(payload.defaults.availableMemoryGb);
        setChunkRows(payload.defaults.chunkRows);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load memory data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const profile = model?.profiles.find((item) => item.id === profileId) ?? model?.profiles[0];

  const result = useMemo(() => {
    const numericBytes = rows * numericColumns * 8;
    const textBytes = rows * textColumns * (8 + averageTextBytes);
    const indexBytes = rows * 8;
    const payloadBytes = numericBytes + textBytes + indexBytes;
    const peakBytes = payloadBytes * peakMultiplier;
    const availableBytes = availableMemoryGb * GIB;
    const chunkPayloadBytes =
      (Math.min(rows, chunkRows) / Math.max(1, rows)) * payloadBytes;
    const chunkPeakBytes = chunkPayloadBytes * peakMultiplier;
    const fullUtilization = peakBytes / availableBytes;
    const chunkUtilization = chunkPeakBytes / availableBytes;
    return {
      availableBytes,
      chunkCount: Math.ceil(rows / Math.max(1, chunkRows)),
      chunkPeakBytes,
      chunkUtilization,
      fullUtilization,
      indexBytes,
      numericBytes,
      payloadBytes,
      peakBytes,
      textBytes,
    };
  }, [
    availableMemoryGb,
    averageTextBytes,
    chunkRows,
    numericColumns,
    peakMultiplier,
    rows,
    textColumns,
  ]);

  if (!model || !profile) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="DataFrame memory lab"
            title="Plan transformation peak memory"
            description="Loading table profiles and memory assumptions."
            icon={MemoryStick}
            accent="violet"
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
                Loading memory model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setProfileId(model.defaults.profileId);
    setRows(model.defaults.rows);
    setNumericColumns(model.defaults.numericColumns);
    setTextColumns(model.defaults.textColumns);
    setAverageTextBytes(model.defaults.averageTextBytes);
    setPeakMultiplier(model.defaults.peakMultiplier);
    setAvailableMemoryGb(model.defaults.availableMemoryGb);
    setChunkRows(model.defaults.chunkRows);
  };
  const fitsFull = result.fullUtilization <= 0.7;
  const fitsChunk = result.chunkUtilization <= 0.7;
  const OutcomeIcon = fitsFull ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="DataFrame memory lab"
          title={model.title}
          description={model.description}
          icon={MemoryStick}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Table profile
                </legend>
                <div className="mt-3 space-y-2">
                  {model.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'text-heavy' ? Type : Database}
                      accent={item.id === 'text-heavy' ? 'amber' : 'blue'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Rows"
                  value={rows}
                  output={rows.toLocaleString()}
                  {...model.ranges.rows}
                  lowLabel="Prototype"
                  highLabel="Large local table"
                  accent="blue"
                  onChange={setRows}
                />
                <LabRange
                  label="Available memory"
                  value={availableMemoryGb}
                  output={`${availableMemoryGb} GiB`}
                  {...model.ranges.availableMemoryGb}
                  lowLabel="Laptop"
                  highLabel="Large worker"
                  accent="emerald"
                  onChange={setAvailableMemoryGb}
                />
              </div>
            </div>
          )}
        >
          <div aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Define row width and temporary work
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Projection and dtype choices often matter more than adding parallel workers.
                </p>
              </div>
              <div className="grid gap-x-6 gap-y-7 md:grid-cols-2">
                <LabRange
                  label="Numeric columns"
                  value={numericColumns}
                  output={`${numericColumns}`}
                  {...model.ranges.numericColumns}
                  lowLabel="Narrow"
                  highLabel="Wide"
                  accent="blue"
                  onChange={setNumericColumns}
                />
                <LabRange
                  label="Text columns"
                  value={textColumns}
                  output={`${textColumns}`}
                  {...model.ranges.textColumns}
                  lowLabel="None"
                  highLabel="Text-heavy"
                  accent="amber"
                  onChange={setTextColumns}
                />
                <LabRange
                  label="Average text payload"
                  value={averageTextBytes}
                  output={`${averageTextBytes} B`}
                  {...model.ranges.averageTextBytes}
                  lowLabel="Short category"
                  highLabel="Long value"
                  accent="violet"
                  onChange={setAverageTextBytes}
                />
                <LabRange
                  label="Peak multiplier"
                  value={peakMultiplier}
                  output={`${peakMultiplier.toFixed(2)}x`}
                  {...model.ranges.peakMultiplier}
                  lowLabel="In-place-like"
                  highLabel="Multiple temporaries"
                  accent="rose"
                  onChange={setPeakMultiplier}
                />
              </div>
            </section>

            <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Table payload"
                value={formatBytes(result.payloadBytes)}
                detail="Numeric, text, and index teaching estimate"
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Full transform peak"
                value={formatBytes(result.peakBytes)}
                detail={`${(result.fullUtilization * 100).toFixed(0)}% of available memory`}
                icon={Layers3}
                tone={fitsFull ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Chunk peak"
                value={formatBytes(result.chunkPeakBytes)}
                detail={`${result.chunkCount.toLocaleString()} chunks at selected size`}
                icon={Rows3}
                tone={fitsChunk ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Available"
                value={formatBytes(result.availableBytes)}
                detail="Leave headroom for Python, libraries, model, and OS"
                icon={HardDrive}
                tone="violet"
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Modeled payload composition
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    The bar excludes temporary copies represented by the peak multiplier.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {formatBytes(result.payloadBytes)}
                </span>
              </div>
              <div className="mt-4 flex h-9 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                {[
                  { label: 'Numeric', bytes: result.numericBytes, color: 'bg-blue-500' },
                  { label: 'Text', bytes: result.textBytes, color: 'bg-amber-500' },
                  { label: 'Index', bytes: result.indexBytes, color: 'bg-violet-500' },
                ].map((part) => (
                  <div
                    key={part.label}
                    className={part.color}
                    style={{ width: `${part.bytes / Math.max(1, result.payloadBytes) * 100}%` }}
                    title={`${part.label}: ${formatBytes(part.bytes)}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <Legend color="bg-blue-500" label="Numeric" value={formatBytes(result.numericBytes)} />
                <Legend color="bg-amber-500" label="Text" value={formatBytes(result.textBytes)} />
                <Legend color="bg-violet-500" label="Index" value={formatBytes(result.indexBytes)} />
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <LabRange
                label="Chunk rows"
                value={chunkRows}
                output={chunkRows.toLocaleString()}
                {...model.ranges.chunkRows}
                lowLabel="Lower peak, more boundaries"
                highLabel="Fewer, larger chunks"
                accent="cyan"
                onChange={setChunkRows}
              />
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                fitsFull
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : fitsChunk
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {fitsFull
                      ? 'The full-table transformation keeps modeled headroom'
                      : fitsChunk
                        ? 'A chunk-local algorithm fits, but the full transform does not'
                        : 'Neither modeled path leaves enough memory headroom'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-85">
                    {fitsFull
                      ? 'Confirm with DataFrame.memory_usage(deep=True), process RSS, and the actual operation before fixing worker size.'
                      : fitsChunk
                        ? 'Chunking is valid only when the computation needs little or explicitly managed state across chunks.'
                        : 'Project and filter earlier, improve dtypes or representation, change the algorithm, or move the workload to an execution engine that owns out-of-core or distributed state.'}
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

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 text-neutral-600 dark:text-neutral-300">
      <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="font-semibold">{label}</span>
      <span className="mt-1 block tabular-nums text-neutral-500 dark:text-neutral-400">
        {value}
      </span>
    </div>
  );
}
