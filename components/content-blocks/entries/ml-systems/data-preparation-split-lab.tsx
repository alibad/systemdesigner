'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  ScanSearch,
  ShieldCheck,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-preparation/data/split-boundary-scenarios.json';
const BLOCK_ID = 'ml-systems/data-preparation-split-lab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
};

type FitScope = {
  id: string;
  label: string;
  detail: string;
};

type SampleRecord = {
  id: string;
  entity: string;
  period: string;
};

type Scenario = {
  id: string;
  label: string;
  context: string;
  deploymentQuestion: string;
  recommendedStrategy: string;
  mismatchRisk: string;
  records: SampleRecord[];
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
    fitScopeId: string;
  };
  strategies: Strategy[];
  fitScopes: FitScope[];
  scenarios: Scenario[];
};

type Partition = 'train' | 'validation' | 'test';

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      data.defaults &&
      typeof data.defaults.scenarioId === 'string' &&
      Array.isArray(data.strategies) &&
      data.strategies.length === 3 &&
      Array.isArray(data.fitScopes) &&
      data.fitScopes.length === 2 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.recommendedStrategy === 'string' &&
          Array.isArray(scenario.records) &&
          scenario.records.length >= 9,
      ),
  );
}

function assignPartitions(records: SampleRecord[], strategyId: string) {
  if (strategyId === 'chronological') {
    return records.map((record, index) => ({
      ...record,
      partition:
        index < Math.ceil(records.length * 0.6)
          ? ('train' as const)
          : index < Math.ceil(records.length * 0.8)
            ? ('validation' as const)
            : ('test' as const),
    }));
  }

  if (strategyId === 'group') {
    const entities = Array.from(new Set(records.map((record) => record.entity)));
    const entityPartition = new Map<string, Partition>();
    entities.forEach((entity, index) => {
      entityPartition.set(
        entity,
        index < Math.ceil(entities.length * 0.6)
          ? 'train'
          : index < Math.ceil(entities.length * 0.8)
            ? 'validation'
            : 'test',
      );
    });
    return records.map((record) => ({
      ...record,
      partition: entityPartition.get(record.entity) ?? ('train' as const),
    }));
  }

  const pattern: Partition[] = [
    'train',
    'validation',
    'train',
    'test',
    'train',
    'validation',
    'train',
    'test',
    'train',
    'validation',
    'train',
    'test',
  ];
  return records.map((record, index) => ({
    ...record,
    partition: pattern[index % pattern.length],
  }));
}

const partitionStyles: Record<Partition, string> = {
  train:
    'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100',
  validation:
    'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
  test: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
};

const partitionLabels: Record<Partition, string> = {
  train: 'Train',
  validation: 'Validate',
  test: 'Test',
};

export default function DataPreparationSplitLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('recurring-customers');
  const [strategyId, setStrategyId] = useState('random-row');
  const [fitScopeId, setFitScopeId] = useState('all-rows');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load split scenarios (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isLabData(value)) throw new Error('The split scenarios have an invalid contract.');
        setData(value);
        setScenarioId(value.defaults.scenarioId);
        setStrategyId(value.defaults.strategyId);
        setFitScopeId(value.defaults.fitScopeId);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
    const fitScope = data.fitScopes.find((item) => item.id === fitScopeId) ?? data.fitScopes[0];
    const assignedRecords = assignPartitions(scenario.records, strategy.id);
    const boundaryMismatch = strategy.id !== scenario.recommendedStrategy;
    const preprocessingLeak = fitScope.id === 'all-rows';
    const failures = Number(boundaryMismatch) + Number(preprocessingLeak);
    const counts = assignedRecords.reduce(
      (total, record) => ({ ...total, [record.partition]: total[record.partition] + 1 }),
      { train: 0, validation: 0, test: 0 } satisfies Record<Partition, number>,
    );
    return {
      assignedRecords,
      boundaryMismatch,
      counts,
      failures,
      fitScope,
      preprocessingLeak,
      scenario,
      strategy,
    };
  }, [data, fitScopeId, scenarioId, strategyId]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setStrategyId(data.defaults.strategyId);
    setFitScopeId(data.defaults.fitScopeId);
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
        aria-label="Loading split boundary lab"
      />
    );
  }

  const healthy = result.failures === 0;
  const VerdictIcon = healthy ? CheckCircle2 : AlertTriangle;
  const verdictClass = healthy
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Split boundary lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Prediction setting
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.context}
                      icon={scenario.id === 'future-demand' ? CalendarClock : Users}
                      accent="violet"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Split boundary
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((strategy) => (
                    <LabChoice
                      key={strategy.id}
                      selected={strategy.id === result.strategy.id}
                      label={strategy.label}
                      detail={strategy.detail}
                      accent="cyan"
                      onClick={() => setStrategyId(strategy.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Fit learned transforms on
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.fitScopes.map((scope) => (
                    <LabChoice
                      key={scope.id}
                      selected={scope.id === result.fitScope.id}
                      label={scope.label}
                      detail={scope.detail}
                      icon={ShieldCheck}
                      accent="emerald"
                      onClick={() => setFitScopeId(scope.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${verdictClass}`}>
              <div className="flex items-start gap-3">
                <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Evaluation verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {healthy
                      ? 'The evaluation boundary matches deployment'
                      : `${result.failures} leakage ${result.failures === 1 ? 'risk' : 'risks'} found`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {healthy
                      ? `The ${result.strategy.label.toLowerCase()} and training-only fitted transforms preserve the evidence boundary for this prediction setting.`
                      : 'A held-out score is credible only when the split reproduces what will be unknown at prediction time and learned preprocessing never inspects held-out rows.'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Sample assignment
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                    {result.scenario.deploymentQuestion}
                  </p>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {result.counts.train} train / {result.counts.validation} validate / {result.counts.test}{' '}
                  test
                </p>
              </div>
              <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {result.assignedRecords.map((record) => (
                  <li
                    key={record.id}
                    className={`min-w-0 rounded-md border p-3 ${partitionStyles[record.partition]}`}
                  >
                    <span className="block text-[10px] font-semibold uppercase opacity-75">
                      {partitionLabels[record.partition]}
                    </span>
                    <span className="mt-1 block truncate text-sm font-semibold">{record.entity}</span>
                    <span className="mt-1 block text-xs opacity-75">{record.period}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric
                label="Boundary"
                value={result.boundaryMismatch ? 'Mismatch' : 'Aligned'}
                detail={result.strategy.label}
                icon={GitBranch}
                tone={result.boundaryMismatch ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Transform fit"
                value={result.preprocessingLeak ? 'Contaminated' : 'Train only'}
                detail={result.fitScope.label}
                icon={ScanSearch}
                tone={result.preprocessingLeak ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="Credibility"
                value={healthy ? 'Defensible' : 'Optimistic'}
                detail="Held-out metric interpretation"
                icon={ShieldCheck}
                tone={healthy ? 'emerald' : 'amber'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Findings
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                <li className="flex items-start gap-3">
                  {result.boundaryMismatch ? (
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  )}
                  <span>
                    {result.boundaryMismatch
                      ? `${result.scenario.mismatchRisk} Use ${data.strategies.find((item) => item.id === result.scenario.recommendedStrategy)?.label.toLowerCase()}.`
                      : 'The selected split keeps the deployment-time unknowns on the held-out side.'}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  {result.preprocessingLeak ? (
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  )}
                  <span>
                    {result.preprocessingLeak
                      ? 'Held-out rows influence imputation, scaling, vocabulary, or feature selection. Split first, fit on train, then transform every partition with the frozen state.'
                      : 'Learned transform state comes only from training rows and is reused unchanged on validation, test, and serving inputs.'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
