'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Network,
  ScanSearch,
  TableProperties,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FitStatus = 'recommended' | 'tradeoff' | 'avoid';

type Workload = {
  id: string;
  label: string;
  detail: string;
  tableGb: number;
};

type Fit = {
  status: FitStatus;
  title: string;
  detail: string;
};

type Distribution = {
  id: string;
  label: string;
  detail: string;
  sliceShares: number[];
  storageCopies: number;
  redistributionPercent: Record<string, number>;
  fits: Record<string, Fit>;
};

type SortDesign = {
  id: string;
  label: string;
  detail: string;
  scanPercent: Record<string, number>;
  fits: Record<string, Fit>;
};

type DistributionModel = {
  title: string;
  description: string;
  sliceLabels: string[];
  defaults: {
    workloadId: string;
    distributionId: string;
    sortId: string;
  };
  workloads: Workload[];
  distributions: Distribution[];
  sortDesigns: SortDesign[];
};

const BLOCK_ID = 'technology/redshift-cluster';

const verdictStyles: Record<FitStatus, string> = {
  recommended:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  tradeoff:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  avoid:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
};

function isFit(value: unknown): value is Fit {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Fit>;
  return Boolean(
    candidate.status
      && ['recommended', 'tradeoff', 'avoid'].includes(candidate.status)
      && candidate.title
      && candidate.detail,
  );
}

function hasNumericRecord(value: unknown, keys: Set<string>) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return [...keys].every((key) => typeof record[key] === 'number' && Number.isFinite(record[key]));
}

function hasFitRecord(value: unknown, keys: Set<string>) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return [...keys].every((key) => isFit(record[key]));
}

function isDistributionModel(value: unknown): value is DistributionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DistributionModel>;
  if (
    !candidate.title
    || !candidate.description
    || !candidate.defaults?.workloadId
    || !candidate.defaults.distributionId
    || !candidate.defaults.sortId
    || !Array.isArray(candidate.sliceLabels)
    || candidate.sliceLabels.length < 4
    || !candidate.sliceLabels.every((label) => typeof label === 'string')
    || !Array.isArray(candidate.workloads)
    || candidate.workloads.length < 2
    || !candidate.workloads.every(
      (workload) =>
        workload
        && typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && typeof workload.tableGb === 'number'
        && workload.tableGb > 0,
    )
  ) {
    return false;
  }

  const workloadIds = new Set(candidate.workloads.map((workload) => workload.id));
  if (!workloadIds.has(candidate.defaults.workloadId)) return false;

  const distributionsValid =
    Array.isArray(candidate.distributions)
    && candidate.distributions.length >= 2
    && candidate.distributions.every(
      (distribution) =>
        distribution
        && typeof distribution.id === 'string'
        && typeof distribution.label === 'string'
        && typeof distribution.detail === 'string'
        && typeof distribution.storageCopies === 'number'
        && distribution.storageCopies >= 1
        && Array.isArray(distribution.sliceShares)
        && distribution.sliceShares.length === candidate.sliceLabels?.length
        && distribution.sliceShares.every(
          (share) => typeof share === 'number' && share >= 0,
        )
        && Math.abs(
          distribution.sliceShares.reduce((sum, share) => sum + share, 0) - 100,
        ) < 0.01
        && hasNumericRecord(distribution.redistributionPercent, workloadIds)
        && hasFitRecord(distribution.fits, workloadIds),
    );

  const sortsValid =
    Array.isArray(candidate.sortDesigns)
    && candidate.sortDesigns.length >= 2
    && candidate.sortDesigns.every(
      (sort) =>
        sort
        && typeof sort.id === 'string'
        && typeof sort.label === 'string'
        && typeof sort.detail === 'string'
        && hasNumericRecord(sort.scanPercent, workloadIds)
        && hasFitRecord(sort.fits, workloadIds),
    );

  return Boolean(
    distributionsValid
      && sortsValid
      && candidate.distributions?.some(
        (distribution) => distribution.id === candidate.defaults?.distributionId,
      )
      && candidate.sortDesigns?.some((sort) => sort.id === candidate.defaults?.sortId),
  );
}

export default function RedshiftDistributionLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<DistributionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No Redshift table-design model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDistributionModel(payload)) {
          throw new Error('The Redshift table-design model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <div
          className={`not-prose my-7 min-h-40 rounded-lg border p-5 ${
            error
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              : 'animate-pulse border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
          role={error ? 'alert' : undefined}
        >
          {error ? (
            <>
              <p className="font-semibold">The table-design lab could not be loaded.</p>
              <p className="mt-2 text-sm opacity-75">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold"
              >
                Retry
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return <DistributionWorkbench model={model} />;
}

function DistributionWorkbench({ model }: { model: DistributionModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [distributionId, setDistributionId] = useState(model.defaults.distributionId);
  const [sortId, setSortId] = useState(model.defaults.sortId);

  const workload =
    model.workloads.find((candidate) => candidate.id === workloadId) ?? model.workloads[0];
  const distribution =
    model.distributions.find((candidate) => candidate.id === distributionId)
    ?? model.distributions[0];
  const sort =
    model.sortDesigns.find((candidate) => candidate.id === sortId) ?? model.sortDesigns[0];

  const result = useMemo(() => {
    const hottestShare = Math.max(...distribution.sliceShares);
    const hottestIndex = distribution.sliceShares.indexOf(hottestShare);
    const averageShare = 100 / distribution.sliceShares.length;
    const skewRatio = hottestShare / averageShare;
    const redistributionPercent = distribution.redistributionPercent[workload.id];
    const scanPercent = sort.scanPercent[workload.id];
    const scanGb = workload.tableGb * (scanPercent / 100);
    const redistributedGb = workload.tableGb * (redistributionPercent / 100);
    const storageGb = workload.tableGb * distribution.storageCopies;

    return {
      hottestIndex,
      hottestShare,
      skewRatio,
      redistributionPercent,
      scanPercent,
      scanGb,
      redistributedGb,
      storageGb,
    };
  }, [distribution, sort, workload]);

  const distributionFit = distribution.fits[workload.id];
  const sortFit = sort.fits[workload.id];
  const overallStatus: FitStatus =
    distributionFit.status === 'avoid' || sortFit.status === 'avoid'
      ? 'avoid'
      : distributionFit.status === 'tradeoff' || sortFit.status === 'tradeoff'
        ? 'tradeoff'
        : 'recommended';

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setDistributionId(model.defaults.distributionId);
    setSortId(model.defaults.sortId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Table-design lab"
          title={model.title}
          description={model.description}
          icon={TableProperties}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Query workload"
                options={model.workloads}
                selectedId={workload.id}
                onSelect={setWorkloadId}
                icon={Activity}
                accent="cyan"
              />
              <ChoiceGroup
                legend="2. Distribution style"
                options={model.distributions}
                selectedId={distribution.id}
                onSelect={setDistributionId}
                icon={Network}
                accent="violet"
              />
              <ChoiceGroup
                legend="3. Sort design"
                options={model.sortDesigns}
                selectedId={sort.id}
                onSelect={setSortId}
                icon={ScanSearch}
                accent="amber"
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Hottest slice"
                value={`${result.hottestShare.toFixed(0)}%`}
                detail={`${result.skewRatio.toFixed(1)}x the even-share baseline`}
                icon={Database}
                tone={result.skewRatio > 1.8 ? 'rose' : result.skewRatio > 1.3 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Modeled redistribution"
                value={`${result.redistributedGb.toFixed(0)} GB`}
                detail={`${result.redistributionPercent}% of the table moves for this join`}
                icon={Network}
                tone={result.redistributionPercent > 40 ? 'rose' : result.redistributionPercent > 10 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Modeled scan"
                value={`${result.scanGb.toFixed(0)} GB`}
                detail={`${result.scanPercent}% of blocks for this filter shape`}
                icon={ScanSearch}
                tone={result.scanPercent > 60 ? 'rose' : result.scanPercent > 20 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Table storage"
                value={`${result.storageGb.toFixed(0)} GB`}
                detail={`${distribution.storageCopies} modeled table ${distribution.storageCopies === 1 ? 'copy' : 'copies'}`}
                icon={TableProperties}
                tone={distribution.storageCopies > 1 ? 'amber' : 'blue'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Rows assigned to compute slices
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Every bar is a share of one table. The slowest busy slice can hold back the parallel stage.
                </p>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {distribution.sliceShares.map((share, index) => {
                  const hottest = index === result.hottestIndex;
                  return (
                    <div key={model.sliceLabels[index]} className="min-w-0">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                          {model.sliceLabels[index]}
                        </span>
                        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-[width] ${
                            hottest ? 'bg-rose-500' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className={`rounded-md border p-5 ${verdictStyles[overallStatus]}`}>
              <div className="flex items-start gap-3">
                {overallStatus === 'recommended' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {overallStatus === 'recommended'
                      ? 'The selected layout fits this dominant query shape'
                      : overallStatus === 'tradeoff'
                        ? 'The layout is usable, but one cost remains visible'
                        : 'The selected layout works against this query shape'}
                  </p>
                  <p className="mt-2 text-sm leading-6">{distributionFit.title}: {distributionFit.detail}</p>
                  <p className="mt-2 text-sm leading-6">{sortFit.title}: {sortFit.detail}</p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Teaching model: percentages are fixed scenario assumptions, not an optimizer prediction.
              Validate real layouts with query plans, system views, table statistics, and representative data.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  legend,
  options,
  selectedId,
  onSelect,
  icon,
  accent,
}: {
  legend: string;
  options: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  icon: typeof Activity;
  accent: 'cyan' | 'violet' | 'amber';
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={option.id === selectedId}
            label={option.label}
            detail={option.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
