'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Columns3,
  Database,
  FileSpreadsheet,
  Filter,
  Gauge,
  HardDrive,
  Layers3,
  LoaderCircle,
  MemoryStick,
  ScanLine,
  TriangleAlert,
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

const BLOCK_ID = 'technology/duckdb-scan-shape-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/duckdb/data/scan-shape-model.json';

type Source = {
  id: string;
  label: string;
  detail: string;
  storageRatio: number;
  projectionPushdown: boolean;
  zoneMapPruning: boolean;
  sourceNote: string;
};

type FilterShape = {
  id: string;
  label: string;
  detail: string;
  selectivityPercent: number;
  prunedFraction: number;
};

type Operator = {
  id: string;
  label: string;
  detail: string;
  workingSetFactor: number;
  blocking: boolean;
};

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type ScanShapeModel = {
  kind: 'duckdb-scan-shape';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    sourceId: string;
    datasetGb: number;
    columnsPercent: number;
    filterId: string;
    operatorId: string;
    memoryGb: number;
  };
  bounds: {
    datasetGb: Bounds;
    columnsPercent: Bounds;
    memoryGb: Bounds;
  };
  sources: Source[];
  filters: FilterShape[];
  operators: Operator[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isSource(value: unknown): value is Source {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.storageRatio)
    && typeof value.projectionPushdown === 'boolean'
    && typeof value.zoneMapPruning === 'boolean'
    && isNonEmptyString(value.sourceNote);
}

function isFilterShape(value: unknown): value is FilterShape {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.selectivityPercent)
    && isFiniteNumber(value.prunedFraction);
}

function isOperator(value: unknown): value is Operator {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.workingSetFactor)
    && typeof value.blocking === 'boolean';
}

function isBounds(value: unknown): value is Bounds {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isScanShapeModel(value: unknown): value is ScanShapeModel {
  if (!isRecord(value)
    || value.kind !== 'duckdb-scan-shape'
    || value.blockId !== BLOCK_ID
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.description)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
    || !Array.isArray(value.sources)
    || value.sources.length < 3
    || !value.sources.every(isSource)
    || !hasUniqueIds(value.sources)
    || !Array.isArray(value.filters)
    || value.filters.length < 3
    || !value.filters.every(isFilterShape)
    || !hasUniqueIds(value.filters)
    || !Array.isArray(value.operators)
    || value.operators.length < 3
    || !value.operators.every(isOperator)
    || !hasUniqueIds(value.operators)
    || !isNonEmptyString(value.notice)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;
  return isNonEmptyString(defaults.sourceId)
    && isFiniteNumber(defaults.datasetGb)
    && isFiniteNumber(defaults.columnsPercent)
    && isNonEmptyString(defaults.filterId)
    && isNonEmptyString(defaults.operatorId)
    && isFiniteNumber(defaults.memoryGb)
    && isBounds(bounds.datasetGb)
    && isBounds(bounds.columnsPercent)
    && isBounds(bounds.memoryGb)
    && value.sources.some((item) => item.id === defaults.sourceId)
    && value.filters.some((item) => item.id === defaults.filterId)
    && value.operators.some((item) => item.id === defaults.operatorId);
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function DuckDBScanShapeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ScanShapeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScanShapeModel(payload)) {
          throw new Error('The DuckDB scan model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the DuckDB scan lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Scan-shape lab"
            title="Budget the bytes and the blocking state"
            description="Loading file layouts, predicate shapes, and execution operators."
            icon={ScanLine}
            accent="violet"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <ScanShapeWorkbench model={model} />;
}

function ScanShapeWorkbench({ model }: { model: ScanShapeModel }) {
  const [sourceId, setSourceId] = useState(model.defaults.sourceId);
  const [datasetGb, setDatasetGb] = useState(model.defaults.datasetGb);
  const [columnsPercent, setColumnsPercent] = useState(
    model.defaults.columnsPercent,
  );
  const [filterId, setFilterId] = useState(model.defaults.filterId);
  const [operatorId, setOperatorId] = useState(model.defaults.operatorId);
  const [memoryGb, setMemoryGb] = useState(model.defaults.memoryGb);

  const source = findById(model.sources, sourceId);
  const filter = findById(model.filters, filterId);
  const operator = findById(model.operators, operatorId);

  const result = useMemo(() => {
    const physicalDatasetGb = datasetGb * source.storageRatio;
    const projectionFraction = source.projectionPushdown
      ? columnsPercent / 100
      : 1;
    const appliedPruningFraction = source.zoneMapPruning
      ? filter.prunedFraction
      : 0;
    const scanGb = physicalDatasetGb
      * projectionFraction
      * (1 - appliedPruningFraction);
    const selectedLogicalGb = datasetGb
      * (columnsPercent / 100)
      * (filter.selectivityPercent / 100);
    const modeledWorkingSetGb = selectedLogicalGb * operator.workingSetFactor;
    const pressureRatio = modeledWorkingSetGb / memoryGb;
    const reductionPercent = Math.max(0, (1 - scanGb / datasetGb) * 100);
    const spillLikely = operator.blocking && pressureRatio > 0.65;
    const broadScan = scanGb / datasetGb > 0.5;
    const cardinalityRisk = operator.id === 'many-to-many-join';

    let verdict = 'Pushdown removes most modeled source bytes';
    let explanation =
      'The selected source can use projection and pruning before the operator consumes rows.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (cardinalityRisk && spillLikely) {
      verdict = 'Join cardinality dominates this budget';
      explanation =
        'The modeled intermediate exceeds the memory budget. Prove key multiplicity and size the temp path before trusting this plan.';
      tone = 'rose';
    } else if (spillLikely) {
      verdict = 'Plan for a spill and measure it';
      explanation =
        'The blocking working-state assumption is large relative to the configured memory budget.';
      tone = 'amber';
    } else if (broadScan) {
      verdict = 'The result is selective, but the scan is still broad';
      explanation =
        'This source shape cannot turn the chosen projection and predicate into equivalent byte pruning.';
      tone = 'amber';
    }

    return {
      appliedPruningFraction,
      broadScan,
      explanation,
      modeledWorkingSetGb,
      physicalDatasetGb,
      pressureRatio,
      reductionPercent,
      scanGb,
      selectedLogicalGb,
      spillLikely,
      tone,
      verdict,
    };
  }, [columnsPercent, datasetGb, filter, memoryGb, operator, source]);

  function reset() {
    setSourceId(model.defaults.sourceId);
    setDatasetGb(model.defaults.datasetGb);
    setColumnsPercent(model.defaults.columnsPercent);
    setFilterId(model.defaults.filterId);
    setOperatorId(model.defaults.operatorId);
    setMemoryGb(model.defaults.memoryGb);
  }

  const statusClass = result.tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.tone === 'rose'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  const StatusIcon = result.tone === 'emerald'
    ? CheckCircle2
    : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Scan-shape lab"
          title={model.title}
          description={model.description}
          icon={ScanLine}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose the source layout">
                {model.sources.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === source.id}
                    label={item.label}
                    detail={item.detail}
                    icon={sourceIcon(item.id)}
                    accent={item.id === 'csv' ? 'amber' : 'blue'}
                    onClick={() => setSourceId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Logical dataset"
                value={datasetGb}
                output={`${datasetGb} GB`}
                min={model.bounds.datasetGb.min}
                max={model.bounds.datasetGb.max}
                step={model.bounds.datasetGb.step}
                accent="blue"
                lowLabel="Bounded extract"
                highLabel="Large snapshot"
                onChange={setDatasetGb}
              />

              <LabRange
                label="Columns selected"
                value={columnsPercent}
                output={`${columnsPercent}%`}
                min={model.bounds.columnsPercent.min}
                max={model.bounds.columnsPercent.max}
                step={model.bounds.columnsPercent.step}
                accent="cyan"
                lowLabel="Narrow projection"
                highLabel="SELECT *"
                onChange={setColumnsPercent}
              />

              <ChoiceGroup label="2. Shape the predicate">
                {model.filters.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === filter.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Filter}
                    accent="cyan"
                    onClick={() => setFilterId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Choose the expensive operator">
                {model.operators.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === operator.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.blocking ? Layers3 : ArrowRight}
                    accent={item.blocking ? 'violet' : 'emerald'}
                    onClick={() => setOperatorId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="DuckDB memory budget"
                value={memoryGb}
                output={`${memoryGb} GB`}
                min={model.bounds.memoryGb.min}
                max={model.bounds.memoryGb.max}
                step={model.bounds.memoryGb.step}
                accent="amber"
                lowLabel="Tight process"
                highLabel="Large worker"
                onChange={setMemoryGb}
              />
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section className={`rounded-md border p-5 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Modeled execution verdict
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Physical source"
                value={formatGb(result.physicalDatasetGb)}
                detail="Modeled compressed bytes"
                icon={HardDrive}
                tone="blue"
              />
              <LabMetric
                label="Bytes scanned"
                value={formatGb(result.scanGb)}
                detail={`${formatPercent(result.reductionPercent)} below logical baseline`}
                icon={ScanLine}
                tone={result.broadScan ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Logical result"
                value={formatGb(result.selectedLogicalGb)}
                detail={`${filter.selectivityPercent}% row selectivity`}
                icon={Filter}
                tone="cyan"
              />
              <LabMetric
                label="Modeled state"
                value={formatGb(result.modeledWorkingSetGb)}
                detail={`${formatRatio(result.pressureRatio)} of memory budget`}
                icon={MemoryStick}
                tone={result.spillLikely ? 'rose' : 'violet'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                Byte path
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <FlowStage
                  label="Logical values"
                  value={`${datasetGb} GB`}
                  detail="Uncompressed baseline"
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 text-neutral-400 md:rotate-0"
                />
                <FlowStage
                  label="Physical source"
                  value={formatGb(result.physicalDatasetGb)}
                  detail={source.projectionPushdown
                    ? `${columnsPercent}% projection eligible`
                    : 'Broad row scan'}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 text-neutral-400 md:rotate-0"
                />
                <FlowStage
                  label="Operator input"
                  value={formatGb(result.scanGb)}
                  detail={result.appliedPruningFraction > 0
                    ? `${formatPercent(result.appliedPruningFraction * 100)} row groups modeled pruned`
                    : 'No modeled row-group pruning'}
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Why this result changed
              </h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                <li>{source.sourceNote}</li>
                <li>
                  {source.projectionPushdown
                    ? `Projection reduces the modeled scan to ${columnsPercent}% of stored columns.`
                    : 'This source shape must read its row bytes even when the query returns fewer columns.'}
                </li>
                <li>
                  {result.appliedPruningFraction > 0
                    ? 'The ordered predicate and source metadata can skip modeled row groups.'
                    : 'Result selectivity does not become byte pruning for this source and predicate combination.'}
                </li>
                <li>
                  {operator.blocking
                    ? `${operator.label} retains modeled intermediate state and may use temporary disk.`
                    : `${operator.label} can stream bounded chunks without retaining the full input.`}
                </li>
              </ul>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function FlowStage({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-52 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert
            aria-hidden="true"
            className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400"
          />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The scan model could not be loaded
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="text-center">
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto h-6 w-6 animate-spin text-violet-600 dark:text-violet-400"
          />
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            Loading the scan model…
          </p>
        </div>
      )}
    </div>
  );
}

function sourceIcon(id: string): LucideIcon {
  if (id === 'csv') return FileSpreadsheet;
  if (id === 'native-table') return Database;
  return Columns3;
}

function formatGb(value: number): string {
  if (value < 0.1) return `${Math.round(value * 1024)} MB`;
  if (value < 10) return `${value.toFixed(1)} GB`;
  return `${Math.round(value)} GB`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatRatio(value: number): string {
  if (value < 0.1) return `${Math.round(value * 100)}%`;
  return `${value.toFixed(1)}×`;
}
