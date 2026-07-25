'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  GitBranch,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type AppendStatus = 'appended' | 'conflict' | 'domain-rejected';
type InvariantStatus = 'preserved' | 'broken' | 'review';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  rule: string;
};

type Command = {
  id: string;
  actor: string;
  label: string;
  expectedRevision: number;
  proposedEvent: string;
};

type AppendResult = {
  commandId: string;
  status: AppendStatus;
  assignedRevision?: number;
  detail: string;
};

type RaceOutcome = {
  appends: AppendResult[];
  finalState: string;
  invariant: InvariantStatus;
  summary: string;
  nextStep: string;
};

type RaceScenario = {
  id: string;
  label: string;
  detail: string;
  streamId: string;
  initialRevision: number;
  initialState: string;
  commands: Command[];
  outcomes: Record<string, RaceOutcome>;
};

type CommandRaceModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultStrategyId: string;
  strategies: Strategy[];
  scenarios: RaceScenario[];
};

const BLOCK_ID = 'technology/event-sourcing-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/technology/event-sourcing/data/command-race-scenarios.json';

const appendStatusMeta: Record<
  AppendStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  appended: {
    label: 'Appended',
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  conflict: {
    label: 'Revision conflict',
    icon: XCircle,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  'domain-rejected': {
    label: 'Rejected after re-evaluation',
    icon: ShieldCheck,
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
};

const invariantMeta: Record<
  InvariantStatus,
  { eyebrow: string; icon: LucideIcon; className: string }
> = {
  preserved: {
    eyebrow: 'Invariant preserved',
    icon: ShieldCheck,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  broken: {
    eyebrow: 'Invariant broken',
    icon: XCircle,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  review: {
    eyebrow: 'Business decision required',
    icon: TriangleAlert,
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
};

function isCommandRaceModel(value: unknown): value is CommandRaceModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CommandRaceModel>;
  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultScenarioId !== 'string'
    || typeof candidate.defaultStrategyId !== 'string'
    || !Array.isArray(candidate.strategies)
    || candidate.strategies.length < 3
    || !Array.isArray(candidate.scenarios)
    || candidate.scenarios.length < 3
  ) {
    return false;
  }

  const strategyIds = new Set(
    candidate.strategies
      .filter((strategy) => (
        typeof strategy.id === 'string'
        && typeof strategy.label === 'string'
        && typeof strategy.detail === 'string'
        && typeof strategy.rule === 'string'
      ))
      .map((strategy) => strategy.id),
  );
  if (strategyIds.size !== candidate.strategies.length) return false;

  return candidate.scenarios.every((scenario) => (
    typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && typeof scenario.streamId === 'string'
    && Number.isInteger(scenario.initialRevision)
    && typeof scenario.initialState === 'string'
    && Array.isArray(scenario.commands)
    && scenario.commands.length === 2
    && scenario.commands.every((command) => (
      typeof command.id === 'string'
      && typeof command.actor === 'string'
      && typeof command.label === 'string'
      && Number.isInteger(command.expectedRevision)
      && typeof command.proposedEvent === 'string'
    ))
    && typeof scenario.outcomes === 'object'
    && scenario.outcomes !== null
    && [...strategyIds].every((strategyId) => {
      const outcome = scenario.outcomes[strategyId];
      return Boolean(
        outcome
        && Array.isArray(outcome.appends)
        && outcome.appends.length === 2
        && outcome.appends.every((append) => (
          typeof append.commandId === 'string'
          && ['appended', 'conflict', 'domain-rejected'].includes(append.status)
          && typeof append.detail === 'string'
        ))
        && ['preserved', 'broken', 'review'].includes(outcome.invariant)
        && typeof outcome.finalState === 'string'
        && typeof outcome.summary === 'string'
        && typeof outcome.nextStep === 'string',
      );
    })
  ));
}

export default function EventSourcingCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CommandRaceModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isCommandRaceModel(payload)) {
          throw new Error('The command-race model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load command-race scenarios.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Optimistic concurrency lab"
            title="Decide which concurrent facts may enter the stream"
            description="Loading command races and append contracts."
            icon={LockKeyhole}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <CommandRaceWorkbench model={model} />
      )}
    </div>
  );
}

function CommandRaceWorkbench({ model }: { model: CommandRaceModel }) {
  const defaultScenario =
    model.scenarios.find((scenario) => scenario.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const defaultStrategy =
    model.strategies.find((strategy) => strategy.id === model.defaultStrategyId)
    ?? model.strategies[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [strategyId, setStrategyId] = useState(defaultStrategy.id);

  const scenario =
    model.scenarios.find((candidate) => candidate.id === scenarioId) ?? defaultScenario;
  const strategy =
    model.strategies.find((candidate) => candidate.id === strategyId) ?? defaultStrategy;
  const outcome = scenario.outcomes[strategy.id];
  const invariant = invariantMeta[outcome.invariant];
  const InvariantIcon = invariant.icon;

  function reset() {
    setScenarioId(defaultScenario.id);
    setStrategyId(defaultStrategy.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Optimistic concurrency lab"
        title={model.title}
        description={model.description}
        icon={LockKeyhole}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <div>
              <label
                htmlFor="event-sourcing-race-scenario"
                className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"
              >
                Concurrent command race
              </label>
              <select
                id="event-sourcing-race-scenario"
                value={scenario.id}
                onChange={(event) => setScenarioId(event.target.value)}
                className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {model.scenarios.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {scenario.detail}
              </p>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Append contract
              </legend>
              <div className="mt-3 space-y-2">
                {model.strategies.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === strategy.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={
                      candidate.id === 'append-any'
                        ? GitBranch
                        : candidate.id === 'expected-revision'
                          ? LockKeyhole
                          : RefreshCw
                    }
                    accent={
                      candidate.id === 'append-any'
                        ? 'rose'
                        : candidate.id === 'expected-revision'
                          ? 'violet'
                          : 'emerald'
                    }
                    onClick={() => setStrategyId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Store rule
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {strategy.rule}
              </p>
            </div>
          </div>
        )}
      >
        <div className="space-y-5" aria-live="polite">
          <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Aggregate stream
              </p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                {scenario.streamId}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {scenario.initialState}
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Loaded revision</p>
              <p className="text-xl font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                v{scenario.initialRevision}
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {scenario.commands.map((command, index) => (
              <div
                key={command.id}
                className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Command {index + 1} - {command.actor}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      {command.label}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-mono text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                    expects v{command.expectedRevision}
                  </span>
                </div>
                <p className="mt-3 break-words font-mono text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  {command.proposedEvent}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Append decisions
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                Both handlers made their decision from revision v{scenario.initialRevision}.
              </p>
            </div>
            <div className="grid gap-px bg-neutral-200 md:grid-cols-2 dark:bg-neutral-800">
              {outcome.appends.map((append) => {
                const command = scenario.commands.find(
                  (candidate) => candidate.id === append.commandId,
                );
                const meta = appendStatusMeta[append.status];
                const StatusIcon = meta.icon;
                return (
                  <div key={append.commandId} className="bg-white p-4 dark:bg-neutral-950">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      <History aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {command?.actor ?? append.commandId}
                    </div>
                    <div className={`mt-3 rounded-md border p-3 ${meta.className}`}>
                      <div className="flex items-center gap-2">
                        <StatusIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <p className="text-sm font-semibold">
                          {meta.label}
                          {append.assignedRevision !== undefined
                            ? ` as v${append.assignedRevision}`
                            : ''}
                        </p>
                      </div>
                      <p className="mt-2 text-xs leading-5 opacity-80">{append.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`rounded-md border p-5 ${invariant.className}`}>
            <div className="flex items-start gap-3">
              <InvariantIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  {invariant.eyebrow}
                </p>
                <p className="mt-2 text-xl font-semibold">{outcome.finalState}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{outcome.summary}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-200">
            <Scale aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div>
              <p className="text-sm font-semibold">What the command handler must do next</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {outcome.nextStep}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
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
    <div className="flex min-h-40 items-center justify-center p-5 md:p-6">
      {error ? (
        <div className="max-w-md text-center">
          <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Command-race scenarios unavailable
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading concurrency scenarios
        </div>
      )}
    </div>
  );
}
