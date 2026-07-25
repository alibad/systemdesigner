'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Hash,
  KeyRound,
  Layers3,
  RefreshCw,
  Route,
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
  question: string;
};

type Fit = {
  status: FitStatus;
  title: string;
  detail: string;
};

type KeyStrategy = {
  id: string;
  label: string;
  detail: string;
  example: string;
  distribution: number[];
  queryConsequence: string;
  fits: Record<string, Fit>;
};

type KeyDistributionModel = {
  title: string;
  description: string;
  sampleWrites: number;
  rangeLabels: string[];
  defaults: {
    workloadId: string;
    strategyId: string;
  };
  workloads: Workload[];
  strategies: KeyStrategy[];
};

const BLOCK_ID = 'technology/spanner-key-distribution-lab';

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

function isKeyDistributionModel(value: unknown): value is KeyDistributionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KeyDistributionModel>;

  if (
    !candidate.title
    || !candidate.description
    || typeof candidate.sampleWrites !== 'number'
    || !Number.isFinite(candidate.sampleWrites)
    || candidate.sampleWrites <= 0
    || !candidate.defaults?.workloadId
    || !candidate.defaults.strategyId
    || !Array.isArray(candidate.rangeLabels)
    || candidate.rangeLabels.length < 4
    || !candidate.rangeLabels.every((label) => typeof label === 'string' && label.length > 0)
    || !Array.isArray(candidate.workloads)
    || candidate.workloads.length < 2
    || !candidate.workloads.every(
      (workload) =>
        workload
        && typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && typeof workload.question === 'string',
    )
    || !Array.isArray(candidate.strategies)
    || candidate.strategies.length < 2
  ) {
    return false;
  }

  const workloadIds = new Set(candidate.workloads.map((workload) => workload.id));
  if (!workloadIds.has(candidate.defaults.workloadId)) return false;

  const strategiesValid = candidate.strategies.every((strategy) => {
    if (
      !strategy
      || typeof strategy.id !== 'string'
      || typeof strategy.label !== 'string'
      || typeof strategy.detail !== 'string'
      || typeof strategy.example !== 'string'
      || typeof strategy.queryConsequence !== 'string'
      || !Array.isArray(strategy.distribution)
      || strategy.distribution.length !== candidate.rangeLabels?.length
      || !strategy.distribution.every(
        (count) => typeof count === 'number' && Number.isInteger(count) && count >= 0,
      )
      || strategy.distribution.reduce((sum, count) => sum + count, 0) !== candidate.sampleWrites
      || !strategy.fits
      || typeof strategy.fits !== 'object'
    ) {
      return false;
    }

    return [...workloadIds].every((workloadId) => isFit(strategy.fits[workloadId]));
  });

  return (
    strategiesValid
    && candidate.strategies.some((strategy) => strategy.id === candidate.defaults?.strategyId)
  );
}

export default function SpannerKeyDistributionLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<KeyDistributionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No key-distribution model was supplied.');
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
        if (!isKeyDistributionModel(payload)) {
          throw new Error('The key-distribution model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the key lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return <KeyDistributionWorkbench model={model} />;
}

function KeyDistributionWorkbench({ model }: { model: KeyDistributionModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);

  const workload =
    model.workloads.find((candidate) => candidate.id === workloadId) ?? model.workloads[0];
  const strategy =
    model.strategies.find((candidate) => candidate.id === strategyId) ?? model.strategies[0];
  const fit = strategy.fits[workload.id];

  const result = useMemo(() => {
    const hottestCount = Math.max(...strategy.distribution);
    const hottestIndex = strategy.distribution.indexOf(hottestCount);
    const activeRanges = strategy.distribution.filter((count) => count > 0).length;
    const hottestShare = Math.round((hottestCount / model.sampleWrites) * 100);

    return {
      activeRanges,
      hottestCount,
      hottestLabel: model.rangeLabels[hottestIndex],
      hottestShare,
    };
  }, [model.rangeLabels, model.sampleWrites, strategy.distribution]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setStrategyId(model.defaults.strategyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Primary-key design lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload constraint
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.workloads.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === workload.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={Layers3}
                      accent="cyan"
                      onClick={() => setWorkloadId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Leading key shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.strategies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === strategy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.id === 'sequential' ? Route : Hash}
                      accent={candidate.id === 'sequential' ? 'amber' : 'violet'}
                      onClick={() => setStrategyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${verdictStyles[fit.status]}`}>
              <div className="flex items-start gap-3">
                <VerdictIcon status={fit.status} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {fit.status === 'recommended'
                      ? 'Recommended fit'
                      : fit.status === 'tradeoff'
                        ? 'Explicit trade-off'
                        : 'Hotspot risk'}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">{fit.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{fit.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Hottest range"
                value={`${result.hottestShare}%`}
                detail={`${result.hottestCount} of ${model.sampleWrites} writes land in range ${result.hottestLabel}`}
                tone={result.hottestShare > 50 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Active ranges"
                value={`${result.activeRanges}/${model.rangeLabels.length}`}
                detail="Logical ranges receiving at least one modeled write"
                tone={result.activeRanges === model.rangeLabels.length ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Sample"
                value={`${model.sampleWrites} writes`}
                detail="Fixed teaching data, not a service benchmark"
                tone="neutral"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Illustrative key-range pressure
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Same writes, different placement
                  </h4>
                </div>
                <code className="max-w-full break-words rounded-md bg-neutral-200 px-2.5 py-1.5 text-xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                  {strategy.example}
                </code>
              </div>

              <p className="sr-only">
                {strategy.distribution
                  .map((count, index) => `Range ${model.rangeLabels[index]} receives ${count} writes`)
                  .join('. ')}
              </p>
              <div
                className="mt-5 grid h-48 grid-cols-8 items-end gap-2"
                role="img"
                aria-label={`Distribution for ${strategy.label}. Range ${result.hottestLabel} is hottest at ${result.hottestShare} percent.`}
              >
                {strategy.distribution.map((count, index) => {
                  const height = Math.max(4, (count / model.sampleWrites) * 100);
                  const hot = count === result.hottestCount && result.hottestShare > 50;
                  return (
                    <div
                      className="flex h-full min-w-0 flex-col justify-end"
                      key={model.rangeLabels[index]}
                      aria-hidden="true"
                    >
                      <span className="mb-1 text-center text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                        {count}
                      </span>
                      <span
                        className={`w-full rounded-t-sm border ${
                          hot
                            ? 'border-rose-500 bg-rose-400 dark:bg-rose-600'
                            : 'border-cyan-600 bg-cyan-400 dark:border-cyan-400 dark:bg-cyan-700'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="mt-2 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {model.rangeLabels[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload question
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {workload.question}
                </p>
              </section>
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Query consequence
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {strategy.queryConsequence}
                </p>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function VerdictIcon({ status }: { status: FitStatus }) {
  if (status === 'recommended') {
    return <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
  }
  if (status === 'avoid') {
    return <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
  }
  return <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <div className="flex min-h-[28rem] items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center" role="alert">
              <AlertTriangle
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-rose-600 dark:text-rose-400"
              />
              <h3 className="mt-4 text-lg font-semibold text-neutral-950 dark:text-white">
                Key-distribution model unavailable
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {error}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <div className="w-full max-w-2xl" role="status" aria-label="Loading key-distribution lab">
              <div className="h-6 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="mt-8 grid h-48 grid-cols-8 items-end gap-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    className="animate-pulse rounded-t bg-neutral-200 dark:bg-neutral-800"
                    key={index}
                    style={{ height: `${32 + ((index * 17) % 60)}%` }}
                  />
                ))}
              </div>
              <span className="sr-only">Loading key-distribution lab</span>
            </div>
          )}
        </div>
      </LearningLab>
    </div>
  );
}
