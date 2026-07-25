'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, GitBranch, RefreshCw, ShieldAlert, Wrench } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE = '/api/content/ml-systems/data-pipeline-design/data/pipeline-failure-lab.json';

type FailureId = 'schema' | 'delay' | 'duplicates' | 'logic';
type StrategyId = 'contain' | 'bounded' | 'full';
type Layer = { id: string; label: string };
type Failure = { id: FailureId; label: string; detail: string; affected: string[]; blast: string; skew: string; recovery: string[] };
type Strategy = { id: StrategyId; label: string; detail: string; coverage: string };
type LabData = { title: string; description: string; layers: Layer[]; failures: Failure[]; strategies: Strategy[] };

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.layers) && data.layers.length > 0 &&
      Array.isArray(data.failures) && data.failures.length === 4 &&
      Array.isArray(data.strategies) && data.strategies.length === 3,
  );
}

function severity(failure: FailureId, strategy: StrategyId) {
  const base = failure === 'logic' ? 3 : failure === 'schema' || failure === 'duplicates' ? 2 : 1;
  const reduction = strategy === 'full' ? 2 : strategy === 'bounded' ? 1 : 0;
  const value = Math.max(1, base - reduction);
  return value === 3 ? 'Critical' : value === 2 ? 'High' : 'Moderate';
}

export default function DataPipelineDesignFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureId, setFailureId] = useState<FailureId>('schema');
  const [strategyId, setStrategyId] = useState<StrategyId>('bounded');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
    const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[1];
    const skew = severity(failure.id, strategy.id);
    const recovery = [
      strategy.id === 'contain' ? 'Contain: freeze the affected publication and route a documented fallback.' : 'Contain: freeze publication and preserve the raw input, checkpoints, and bad interval.',
      ...failure.recovery,
      strategy.id === 'bounded'
        ? 'Publish the validated candidate for the bounded event-time interval atomically.'
        : strategy.id === 'full'
          ? 'Replay the full compatible history, then promote the new version after parity validation.'
          : 'Plan the event-time backfill before re-enabling the affected feature.',
    ];
    return { failure, strategy, skew, recovery };
  }, [data, failureId, strategyId]);

  const reset = () => {
    setFailureId('schema');
    setStrategyId('bounded');
  };

  if (error) {
    return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>;
  }
  if (!data || !result) {
    return <div className="not-prose my-7 h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading pipeline failure lab" />;
  }

  return (
    <div data-content-block="ml-systems/data-pipeline-design-failure-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Failure containment lab" title={data.title} description={data.description} icon={ShieldAlert} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a failure</legend>
                <div className="mt-3 space-y-2">
                  {data.failures.map((failure) => (
                    <LabChoice key={failure.id} selected={failureId === failure.id} label={failure.label} detail={failure.detail} icon={failure.id === 'delay' ? AlertTriangle : failure.id === 'logic' ? Wrench : GitBranch} accent="rose" onClick={() => setFailureId(failure.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose recovery depth</legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((strategy) => (
                    <LabChoice key={strategy.id} selected={strategyId === strategy.id} label={strategy.label} detail={strategy.detail} icon={strategy.id === 'contain' ? ShieldAlert : strategy.id === 'bounded' ? RefreshCw : Database} accent={strategy.id === 'contain' ? 'amber' : strategy.id === 'bounded' ? 'cyan' : 'violet'} onClick={() => setStrategyId(strategy.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite" className="rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/35">
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.failure.label}: {result.strategy.coverage}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">Blast radius: {result.failure.blast}. The recovery plan must protect both the current online view and any training snapshot that could preserve the defect.</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric label="Affected layers" value={`${result.failure.affected.length} of ${data.layers.length}`} detail={result.failure.affected.map((id) => data.layers.find((layer) => layer.id === id)?.label).join(', ')} icon={GitBranch} tone="rose" />
            <LabMetric label="Training-serving skew" value={result.skew} detail={result.failure.skew} icon={RefreshCw} tone={result.skew === 'Critical' || result.skew === 'High' ? 'rose' : 'amber'} />
            <LabMetric label="Backfill scope" value={result.strategy.coverage} detail="Choose the smallest repair that restores compatible semantics" icon={Database} tone="cyan" />
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-5" aria-label="Affected pipeline layers">
            {data.layers.map((layer) => {
              const affected = result.failure.affected.includes(layer.id);
              return <div key={layer.id} className={`min-w-0 rounded-md border p-3 text-center text-xs font-semibold ${affected ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'}`}><span className="block">{affected ? 'Affected' : 'Healthy'}</span><span className="mt-1 block text-[11px] font-medium opacity-80">{layer.label}</span></div>;
            })}
          </div>
          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Recovery order</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {result.recovery.map((step, index) => <li key={`${result.failure.id}-${result.strategy.id}-${index}`}>{step}</li>)}
            </ol>
            <p className="mt-4 border-t border-neutral-200 pt-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"><CheckCircle2 aria-hidden="true" className="mr-2 inline h-4 w-4 text-emerald-700 dark:text-emerald-300" />Do not declare recovery from a green job alone. Verify event-time completeness, contract checks, and offline/online parity before promotion.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
