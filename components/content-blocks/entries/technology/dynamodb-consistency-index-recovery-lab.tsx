'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  DatabaseBackup,
  Gauge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Route,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type DecisionOption = {
  id: string;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requirement: string;
  expected: {
    readPathId: string;
    writeBoundaryId: string;
    recoveryId: string;
  };
  rationale: {
    readPath: string;
    writeBoundary: string;
    recovery: string;
  };
  safeOutcome: string;
  unsafeOutcome: string;
};

type DecisionModel = {
  blockId: string;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    readPathId: string;
    writeBoundaryId: string;
    recoveryId: string;
  };
  scenarios: Scenario[];
  readPaths: DecisionOption[];
  writeBoundaries: DecisionOption[];
  recoveries: DecisionOption[];
};

type DecisionCheck = {
  label: string;
  pass: boolean;
  selected: string;
  detail: string;
};

const BLOCK_ID = 'technology/dynamodb-consistency-index-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/dynamodb/data/consistency-index-recovery-model.json';

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDecisionOption(value: unknown): value is DecisionOption {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DecisionOption>;
  return isString(candidate.id)
    && isString(candidate.label)
    && isString(candidate.detail);
}

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Scenario>;
  return Boolean(
    isString(candidate.id)
      && isString(candidate.label)
      && isString(candidate.detail)
      && isString(candidate.requirement)
      && isString(candidate.expected?.readPathId)
      && isString(candidate.expected?.writeBoundaryId)
      && isString(candidate.expected?.recoveryId)
      && isString(candidate.rationale?.readPath)
      && isString(candidate.rationale?.writeBoundary)
      && isString(candidate.rationale?.recovery)
      && isString(candidate.safeOutcome)
      && isString(candidate.unsafeOutcome),
  );
}

function isDecisionModel(value: unknown): value is DecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DecisionModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && isString(candidate.title)
      && isString(candidate.description)
      && isString(candidate.defaults?.scenarioId)
      && isString(candidate.defaults?.readPathId)
      && isString(candidate.defaults?.writeBoundaryId)
      && isString(candidate.defaults?.recoveryId)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isScenario)
      && Array.isArray(candidate.readPaths)
      && candidate.readPaths.length >= 3
      && candidate.readPaths.every(isDecisionOption)
      && Array.isArray(candidate.writeBoundaries)
      && candidate.writeBoundaries.length >= 3
      && candidate.writeBoundaries.every(isDecisionOption)
      && Array.isArray(candidate.recoveries)
      && candidate.recoveries.length >= 3
      && candidate.recoveries.every(isDecisionOption),
  );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function DynamoDBConsistencyIndexRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<DecisionModel | null>(null);
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
        if (!isDecisionModel(payload)) {
          throw new Error('The consistency and recovery decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the consistency and recovery model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Consistency, index, and recovery lab"
            title="Choose the contract, not just the API"
            description="Loading workload contracts and DynamoDB decision boundaries."
            icon={ShieldCheck}
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

  return <DecisionWorkbench model={model} />;
}

function DecisionWorkbench({ model }: { model: DecisionModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [readPathId, setReadPathId] = useState(model.defaults.readPathId);
  const [writeBoundaryId, setWriteBoundaryId] = useState(
    model.defaults.writeBoundaryId,
  );
  const [recoveryId, setRecoveryId] = useState(model.defaults.recoveryId);

  const scenario = findById(model.scenarios, scenarioId);
  const readPath = findById(model.readPaths, readPathId);
  const writeBoundary = findById(model.writeBoundaries, writeBoundaryId);
  const recovery = findById(model.recoveries, recoveryId);

  const result = useMemo(() => {
    const checks: DecisionCheck[] = [
      {
        label: 'Read surface',
        pass: readPath.id === scenario.expected.readPathId,
        selected: readPath.label,
        detail: scenario.rationale.readPath,
      },
      {
        label: 'Write correctness',
        pass: writeBoundary.id === scenario.expected.writeBoundaryId,
        selected: writeBoundary.label,
        detail: scenario.rationale.writeBoundary,
      },
      {
        label: 'Recovery boundary',
        pass: recovery.id === scenario.expected.recoveryId,
        selected: recovery.label,
        detail: scenario.rationale.recovery,
      },
    ];
    const passes = checks.filter((check) => check.pass).length;

    return {
      checks,
      passes,
      ready: passes === checks.length,
      outcome: passes === checks.length
        ? scenario.safeOutcome
        : scenario.unsafeOutcome,
    };
  }, [readPath, recovery, scenario, writeBoundary]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setReadPathId(model.defaults.readPathId);
    setWriteBoundaryId(model.defaults.writeBoundaryId);
    setRecoveryId(model.defaults.recoveryId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Consistency, index, and recovery lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload contract
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === scenario.id}
                      label={option.label}
                      detail={option.detail}
                      icon={Route}
                      accent="violet"
                      onClick={() => setScenarioId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <DecisionChoices
                legend="Read surface"
                options={model.readPaths}
                selectedId={readPath.id}
                icon="read"
                onSelect={setReadPathId}
              />

              <DecisionChoices
                legend="Write correctness boundary"
                options={model.writeBoundaries}
                selectedId={writeBoundary.id}
                icon="write"
                onSelect={setWriteBoundaryId}
              />

              <DecisionChoices
                legend="Recovery mechanism"
                options={model.recoveries}
                selectedId={recovery.id}
                icon="recovery"
                onSelect={setRecoveryId}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                Required outcome
              </p>
              <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                {scenario.label}
              </h4>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {scenario.requirement}
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Contract checks"
                value={`${result.passes} / 3`}
                detail={result.ready ? 'All selected boundaries fit' : 'One or more boundaries conflict'}
                icon={Gauge}
                tone={result.ready ? 'emerald' : result.passes === 2 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Read path"
                value={readPath.label}
                detail={readPath.detail}
                icon={Layers3}
                tone={readPath.id === scenario.expected.readPathId ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Recovery"
                value={recovery.label}
                detail={recovery.detail}
                icon={DatabaseBackup}
                tone={recovery.id === scenario.expected.recoveryId ? 'violet' : 'rose'}
              />
            </div>

            <section>
              <h4 className="font-semibold text-neutral-950 dark:text-white">
                Trace the selected contract
              </h4>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
                <TraceCard
                  eyebrow="Read"
                  title={readPath.label}
                  detail={readPath.detail}
                  pass={readPath.id === scenario.expected.readPathId}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-5 w-5 self-center text-neutral-400 lg:block"
                />
                <TraceCard
                  eyebrow="Mutate"
                  title={writeBoundary.label}
                  detail={writeBoundary.detail}
                  pass={writeBoundary.id === scenario.expected.writeBoundaryId}
                />
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-5 w-5 self-center text-neutral-400 lg:block"
                />
                <TraceCard
                  eyebrow="Recover"
                  title={recovery.label}
                  detail={recovery.detail}
                  pass={recovery.id === scenario.expected.recoveryId}
                />
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-neutral-950 dark:text-white">
                Why each boundary passes or fails
              </h4>
              <div className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {result.checks.map((check) => {
                  const CheckIcon = check.pass ? CheckCircle2 : XCircle;
                  return (
                    <div
                      key={check.label}
                      className="grid gap-3 bg-white p-4 sm:grid-cols-[minmax(150px,0.35fr)_minmax(0,1fr)] dark:bg-neutral-950"
                    >
                      <div className="flex items-start gap-2">
                        <CheckIcon
                          aria-hidden="true"
                          className={`mt-0.5 h-5 w-5 shrink-0 ${
                            check.pass
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {check.label}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {check.selected}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                        {check.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {result.ready ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                  />
                ) : (
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                  />
                )}
                <div>
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    {result.ready ? 'The contract is internally coherent' : 'The contract has a correctness gap'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.outcome}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function DecisionChoices({
  legend,
  options,
  selectedId,
  icon,
  onSelect,
}: {
  legend: string;
  options: DecisionOption[];
  selectedId: string;
  icon: 'read' | 'write' | 'recovery';
  onSelect: (id: string) => void;
}) {
  const Icon = icon === 'read' ? Layers3 : icon === 'write' ? ShieldCheck : DatabaseBackup;
  const accent = icon === 'read' ? 'blue' : icon === 'write' ? 'emerald' : 'violet';

  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={option.id === selectedId}
            label={option.label}
            detail={option.detail}
            icon={Icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function TraceCard({
  eyebrow,
  title,
  detail,
  pass,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  pass: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border p-4 ${
        pass
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase ${
          pass
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300'
        }`}
      >
        {eyebrow}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
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
    <div className="flex min-h-56 items-center justify-center p-6">
      <div className="max-w-md text-center">
        {error ? (
          <TriangleAlert
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
          />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-400"
          />
        )}
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          {error ?? 'Loading consistency, index, and recovery scenarios.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
