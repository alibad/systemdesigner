'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  FileCode2,
  Files,
  Filter,
  ListTree,
  ShieldCheck,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Layout = {
  id: string;
  label: string;
  detail: string;
  compressionRatio: number;
  columnPruning: boolean;
  partitionUnit: 'none' | 'day' | 'hour';
  filesPerPartition: number;
};
type Scenario = {
  id: string;
  label: string;
  detail: string;
  daysRequested: number;
  selectedColumnPct: number;
  hasPartitionFilter: boolean;
  catalogFresh: boolean;
  projectionFillPct: number;
  schemaCompatible: boolean;
};
type LayoutFailureModel = {
  dataset: { rawGbPerDay: number; retentionDays: number };
  layouts: Layout[];
  scenarios: Scenario[];
};

const DEFAULT_DATA_FILE = '/api/content/technology/athena/data/layout-failure-model.json';

function isLayoutFailureModel(value: unknown): value is LayoutFailureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LayoutFailureModel>;
  return Boolean(
    candidate.dataset
      && Array.isArray(candidate.layouts)
      && candidate.layouts.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function formatGb(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} TB`;
  return `${value.toFixed(value < 10 ? 1 : 0)} GB`;
}

export default function AthenaLayoutFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LayoutFailureModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [layoutId, setLayoutId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [partitionStrategy, setPartitionStrategy] = useState<'catalog' | 'projection'>('catalog');
  const [compactFiles, setCompactFiles] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isLayoutFailureModel(payload)) throw new Error('The layout failure model is incomplete.');
        if (!active) return;
        setData(payload);
        setLayoutId(payload.layouts.find((item) => item.id === 'parquet-daily')?.id ?? payload.layouts[0].id);
        setScenarioId(payload.scenarios.find((item) => item.id === 'bounded-report')?.id ?? payload.scenarios[0].id);
        setPartitionStrategy('catalog');
        setCompactFiles(true);
      } catch (loadError) {
        if (!active) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the layout model.');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const layout = data.layouts.find((item) => item.id === layoutId) ?? data.layouts[0];
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const hasPartitions = layout.partitionUnit !== 'none';
    const daysRead = hasPartitions && scenario.hasPartitionFilter
      ? scenario.daysRequested
      : data.dataset.retentionDays;
    const partitionsPerDay = layout.partitionUnit === 'hour' ? 24 : 1;
    const partitionsConsidered = hasPartitions ? daysRead * partitionsPerDay : 1;
    const columnFraction = layout.columnPruning ? scenario.selectedColumnPct / 100 : 1;
    const scannedGb =
      data.dataset.rawGbPerDay * daysRead * layout.compressionRatio * columnFraction;
    const compactedFilesPerPartition = compactFiles
      ? Math.max(1, Math.ceil(layout.filesPerPartition / 8))
      : layout.filesPerPartition;
    const dataFilesOpened = partitionsConsidered * compactedFilesPerPartition;
    const projectedPrefixes = partitionStrategy === 'projection' && hasPartitions
      ? Math.ceil(partitionsConsidered / (scenario.projectionFillPct / 100))
      : partitionsConsidered;
    const emptyPrefixes = Math.max(0, projectedPrefixes - partitionsConsidered);
    const missingFreshPartition =
      hasPartitions && partitionStrategy === 'catalog' && !scenario.catalogFresh;
    const schemaFailure = !scenario.schemaCompatible;
    const listingPressure = emptyPrefixes > 500 || dataFilesOpened > 5000;
    const broadScan = !hasPartitions || !scenario.hasPartitionFilter;

    if (schemaFailure) {
      return {
        layout,
        scenario,
        daysRead,
        partitionsConsidered,
        scannedGb,
        dataFilesOpened,
        emptyPrefixes,
        state: 'Schema failure',
        completeness: 'No trusted result',
        tone: 'rose' as const,
        verdict: 'The physical format cannot repair an incompatible producer contract. Quarantine the new objects, compare the stored and catalog schemas, and deploy an explicit compatible migration before trusting results.',
      };
    }

    if (missingFreshPartition) {
      return {
        layout,
        scenario,
        daysRead,
        partitionsConsidered,
        scannedGb,
        dataFilesOpened,
        emptyPrefixes,
        state: 'Silent omission',
        completeness: 'Latest day missing',
        tone: 'rose' as const,
        verdict: 'The query can succeed while omitting fresh S3 objects because the catalog does not expose their partition. Monitor data freshness separately from query success and repair registration before publishing the report.',
      };
    }

    if (listingPressure) {
      return {
        layout,
        scenario,
        daysRead,
        partitionsConsidered,
        scannedGb,
        dataFilesOpened,
        emptyPrefixes,
        state: 'Planning pressure',
        completeness: 'Result may be correct',
        tone: 'amber' as const,
        verdict: emptyPrefixes > 500
          ? `Projection avoids catalog registration, but this sparse key space makes Athena consider ${emptyPrefixes.toLocaleString()} empty prefixes. Narrow the projected range or use indexed catalog partitions for this access pattern.`
          : `The selected layout opens about ${dataFilesOpened.toLocaleString()} data files. Compact upstream output so listing and per-file overhead do not dominate a modest scan.`,
      };
    }

    if (broadScan) {
      return {
        layout,
        scenario,
        daysRead,
        partitionsConsidered,
        scannedGb,
        dataFilesOpened,
        emptyPrefixes,
        state: 'Broad scan',
        completeness: 'Complete but expensive',
        tone: 'amber' as const,
        verdict: hasPartitions
          ? 'The table has partitions, but the query does not expose a usable partition predicate. Add the date boundary or reject the query with a workgroup scan cutoff.'
          : 'The layout gives Athena no prefix boundary to prune. Partition for common bounded predicates before relying on this table for repeated analysis.',
      };
    }

    return {
      layout,
      scenario,
      daysRead,
      partitionsConsidered,
      scannedGb,
      dataFilesOpened,
      emptyPrefixes,
      state: 'Bounded scan',
      completeness: 'Complete in model',
      tone: 'emerald' as const,
      verdict: `${layout.columnPruning ? 'Column pruning and compression' : 'Compression'} combine with the partition filter to bound the scan. Confirm actual bytes and freshness from query statistics and pipeline telemetry.`,
    };
  }, [compactFiles, data, layoutId, partitionStrategy, scenarioId]);

  const reset = () => {
    if (!data) return;
    setLayoutId(data.layouts.find((item) => item.id === 'parquet-daily')?.id ?? data.layouts[0].id);
    setScenarioId(data.scenarios.find((item) => item.id === 'bounded-report')?.id ?? data.scenarios[0].id);
    setPartitionStrategy('catalog');
    setCompactFiles(true);
  };

  return (
    <div data-content-block="technology/athena-layout-failure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Format, partition, and failure lab"
          title="Choose a layout, then challenge its metadata contract"
          description="Compare row and column formats, daily and hourly partitions, catalog registration and projection, and compacted or fragmented files. Inject a query or data failure to reveal scan and correctness consequences."
          icon={ListTree}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Physical layout
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.layouts.map((layout) => (
                      <LabChoice
                        key={layout.id}
                        selected={layout.id === result.layout.id}
                        label={layout.label}
                        detail={layout.detail}
                        icon={layout.columnPruning ? Boxes : FileCode2}
                        accent="violet"
                        onClick={() => setLayoutId(layout.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Query or failure
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((scenario) => (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === result.scenario.id}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={scenario.id === 'bounded-report' ? Filter : CircleAlert}
                        accent={scenario.id === 'bounded-report' ? 'emerald' : 'rose'}
                        onClick={() => setScenarioId(scenario.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Partition discovery
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LabChoice
                      selected={partitionStrategy === 'catalog'}
                      label="Glue catalog"
                      detail="Register populated partitions"
                      icon={Database}
                      accent="blue"
                      onClick={() => setPartitionStrategy('catalog')}
                    />
                    <LabChoice
                      selected={partitionStrategy === 'projection'}
                      label="Projection"
                      detail="Compute prefixes from rules"
                      icon={ListTree}
                      accent="cyan"
                      onClick={() => setPartitionStrategy('projection')}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    4. File maintenance
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LabChoice
                      selected={!compactFiles}
                      label="Fragmented"
                      detail="Keep every small upstream file"
                      icon={Files}
                      accent="rose"
                      onClick={() => setCompactFiles(false)}
                    />
                    <LabChoice
                      selected={compactFiles}
                      label="Compacted"
                      detail="Combine files before analysis"
                      icon={ShieldCheck}
                      accent="emerald"
                      onClick={() => setCompactFiles(true)}
                    />
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Modeled scan"
                  value={formatGb(result.scannedGb)}
                  detail={`${result.daysRead} of ${data.dataset.retentionDays} retained days read`}
                  icon={Database}
                  tone={result.tone}
                />
                <LabMetric
                  label="Partitions considered"
                  value={result.partitionsConsidered.toLocaleString()}
                  detail={`${result.layout.partitionUnit} partition unit`}
                  icon={ListTree}
                  tone="blue"
                />
                <LabMetric
                  label="Data files opened"
                  value={result.dataFilesOpened.toLocaleString()}
                  detail={compactFiles ? 'Upstream files compacted 8:1 in the model' : 'Original file count retained'}
                  icon={Files}
                  tone={result.dataFilesOpened > 5000 ? 'amber' : 'violet'}
                />
                <LabMetric
                  label="Query consequence"
                  value={result.state}
                  detail={result.completeness}
                  icon={result.tone === 'rose' ? CircleAlert : CheckCircle2}
                  tone={result.tone}
                />
              </div>

              <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">What Athena can skip</h4>
                </header>
                <div className="grid gap-px bg-neutral-200 sm:grid-cols-3 dark:bg-neutral-800">
                  <ConsequenceTile
                    label="Retention pruning"
                    value={result.layout.partitionUnit !== 'none' && result.scenario.hasPartitionFilter ? `${result.daysRead} days read` : 'No pruning'}
                    active={result.layout.partitionUnit !== 'none' && result.scenario.hasPartitionFilter}
                  />
                  <ConsequenceTile
                    label="Column pruning"
                    value={result.layout.columnPruning ? `${result.scenario.selectedColumnPct}% selected` : 'Complete rows read'}
                    active={result.layout.columnPruning}
                  />
                  <ConsequenceTile
                    label="Empty projected prefixes"
                    value={result.emptyPrefixes.toLocaleString()}
                    active={result.emptyPrefixes === 0}
                  />
                </div>
              </section>

              <section className={`mt-5 border-l-4 p-4 ${result.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
                <p className="text-sm font-semibold">{result.verdict}</p>
                <p className="mt-2 text-xs leading-5 opacity-80">
                  The model starts from {data.dataset.rawGbPerDay} GB of raw data per day and separates result correctness from query cost. A low scan is not healthy when fresh partitions or compatible fields are missing.
                </p>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function ConsequenceTile({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="bg-white p-4 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{value}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) {
    return <div className="min-h-[560px] animate-pulse bg-neutral-100 dark:bg-neutral-900" aria-label="Loading Athena layout model" />;
  }

  return (
    <div className="p-5 md:p-6" role="alert">
      <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
        <p className="text-sm font-semibold">Layout failure model unavailable</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
          Retry
        </button>
      </div>
    </div>
  );
}
