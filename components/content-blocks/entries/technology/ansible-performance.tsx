'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileX2,
  LoaderCircle,
  Play,
  Repeat2,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type HostStateId = 'missing' | 'drifted' | 'compliant';
type ImplementationId = 'template' | 'guarded-command' | 'raw-command';
type Behavior = 'convergent' | 'existence-guard' | 'imperative';
type TaskResult = 'changed' | 'ok' | 'skipped';

type HostState = {
  id: HostStateId;
  label: string;
  detail: string;
};

type Implementation = {
  id: ImplementationId;
  label: string;
  detail: string;
  taskLabel: string;
  behavior: Behavior;
};

type ExecutionModel = {
  title: string;
  description: string;
  defaults: {
    implementationId: ImplementationId;
    hostStateId: HostStateId;
  };
  hostStates: HostState[];
  implementations: Implementation[];
};

type StepResult = {
  label: string;
  result: TaskResult;
  detail: string;
};

type RunRecord = {
  number: number;
  taskResult: TaskResult;
  stateAfter: HostStateId;
  handlerRan: boolean;
  steps: StepResult[];
};

const BLOCK_ID = 'technology/ansible-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/ansible/data/execution-idempotency-model.json';

const stateMeta: Record<
  HostStateId,
  {
    icon: LucideIcon;
    tone: 'emerald' | 'amber' | 'rose';
    className: string;
  }
> = {
  missing: {
    icon: FileX2,
    tone: 'rose',
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  drifted: {
    icon: TriangleAlert,
    tone: 'amber',
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  compliant: {
    icon: FileCheck2,
    tone: 'emerald',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
};

const resultMeta: Record<
  TaskResult,
  { icon: LucideIcon; className: string }
> = {
  changed: {
    icon: Wrench,
    className:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
  },
  ok: {
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  skipped: {
    icon: CircleAlert,
    className:
      'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  },
};

function isHostStateId(value: unknown): value is HostStateId {
  return value === 'missing' || value === 'drifted' || value === 'compliant';
}

function isImplementationId(value: unknown): value is ImplementationId {
  return value === 'template'
    || value === 'guarded-command'
    || value === 'raw-command';
}

function isBehavior(value: unknown): value is Behavior {
  return value === 'convergent'
    || value === 'existence-guard'
    || value === 'imperative';
}

function isExecutionModel(value: unknown): value is ExecutionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutionModel>;

  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && isImplementationId(candidate.defaults?.implementationId)
      && isHostStateId(candidate.defaults.hostStateId)
      && Array.isArray(candidate.hostStates)
      && candidate.hostStates.length === 3
      && candidate.hostStates.every((state) => (
        isHostStateId(state.id)
        && typeof state.label === 'string'
        && typeof state.detail === 'string'
      ))
      && Array.isArray(candidate.implementations)
      && candidate.implementations.length === 3
      && candidate.implementations.every((implementation) => (
        isImplementationId(implementation.id)
        && typeof implementation.label === 'string'
        && typeof implementation.detail === 'string'
        && typeof implementation.taskLabel === 'string'
        && isBehavior(implementation.behavior)
      )),
  );
}

export default function AnsibleExecutionIdempotencyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ExecutionModel | null>(null);
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
        if (!isExecutionModel(payload)) {
          throw new Error('The execution and idempotency model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the execution model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Execution and idempotency lab"
            title="Load the convergence model"
            description="The lesson-owned host states and task behaviors are loading."
            icon={Repeat2}
            accent="emerald"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <ExecutionWorkbench model={model} />
      )}
    </div>
  );
}

function ExecutionWorkbench({ model }: { model: ExecutionModel }) {
  const [implementationId, setImplementationId] = useState<ImplementationId>(
    model.defaults.implementationId,
  );
  const [initialStateId, setInitialStateId] = useState<HostStateId>(
    model.defaults.hostStateId,
  );
  const [currentStateId, setCurrentStateId] = useState<HostStateId>(
    model.defaults.hostStateId,
  );
  const [runRecords, setRunRecords] = useState<RunRecord[]>([]);
  const [handlerRestarts, setHandlerRestarts] = useState(0);
  const [appendWrites, setAppendWrites] = useState(0);

  const implementation =
    model.implementations.find((item) => item.id === implementationId)
    ?? model.implementations[0];
  const currentState =
    model.hostStates.find((item) => item.id === currentStateId)
    ?? model.hostStates[0];
  const currentStateStyle = stateMeta[currentState.id];
  const CurrentStateIcon = currentStateStyle.icon;
  const latestRun = runRecords.at(-1);

  const verdict = useMemo(
    () => describeVerdict(
      implementation.behavior,
      currentStateId,
      runRecords,
    ),
    [currentStateId, implementation.behavior, runRecords],
  );
  const VerdictIcon = verdict.icon;

  function resetSimulation(
    nextImplementationId = implementationId,
    nextInitialStateId = initialStateId,
  ) {
    setImplementationId(nextImplementationId);
    setInitialStateId(nextInitialStateId);
    setCurrentStateId(nextInitialStateId);
    setRunRecords([]);
    setHandlerRestarts(0);
    setAppendWrites(0);
  }

  function runPlaybook() {
    const nextRun = executeTask({
      behavior: implementation.behavior,
      currentStateId,
      appendWrites,
      number: runRecords.length + 1,
    });

    setCurrentStateId(nextRun.stateAfter);
    setRunRecords((records) => [...records, nextRun]);
    if (nextRun.handlerRan) {
      setHandlerRestarts((count) => count + 1);
    }
    if (implementation.behavior === 'imperative') {
      setAppendWrites((count) => count + 1);
    }
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Execution and idempotency lab"
        title={model.title}
        description={model.description}
        icon={Repeat2}
        accent="emerald"
        onReset={() => resetSimulation(
          model.defaults.implementationId,
          model.defaults.hostStateId,
        )}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Task implementation
              </legend>
              <div className="mt-3 grid gap-2">
                {model.implementations.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === implementation.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.behavior === 'convergent' ? ShieldCheck : Terminal}
                    accent={
                      item.behavior === 'convergent'
                        ? 'emerald'
                        : item.behavior === 'existence-guard'
                          ? 'amber'
                          : 'rose'
                    }
                    onClick={() => resetSimulation(item.id, initialStateId)}
                  />
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="ansible-starting-state"
                className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"
              >
                2. Starting host state
              </label>
              <select
                id="ansible-starting-state"
                value={initialStateId}
                onChange={(event) => resetSimulation(
                  implementation.id,
                  event.target.value as HostStateId,
                )}
                className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {model.hostStates.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {model.hostStates.find((state) => state.id === initialStateId)?.detail}
              </p>
            </div>

            <button
              type="button"
              onClick={runPlaybook}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:text-neutral-950 dark:hover:bg-emerald-400 dark:focus-visible:ring-offset-neutral-950"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              Run playbook
            </button>

            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Task under test
              </p>
              <p className="mt-2 break-words font-mono text-xs leading-5">
                {implementation.taskLabel}
              </p>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${verdict.className}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  Convergence verdict
                </p>
                <h4 className="mt-1 text-xl font-semibold">{verdict.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {verdict.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Executions"
              value={`${runRecords.length}`}
              detail="Run the same task at least twice"
              icon={Play}
              tone="blue"
            />
            <LabMetric
              label="Latest report"
              value={latestRun?.taskResult ?? 'Not run'}
              detail="Ansible task classification"
              icon={latestRun ? resultMeta[latestRun.taskResult].icon : CircleAlert}
              tone={
                latestRun?.taskResult === 'changed'
                  ? 'blue'
                  : latestRun?.taskResult === 'ok'
                    ? 'emerald'
                    : 'neutral'
              }
            />
            <LabMetric
              label="Host state"
              value={currentState.label}
              detail="Observed after the latest run"
              icon={CurrentStateIcon}
              tone={currentStateStyle.tone}
            />
            <LabMetric
              label="Handler restarts"
              value={`${handlerRestarts}`}
              detail="Triggered only by reported change"
              icon={Repeat2}
              tone={handlerRestarts > 1 ? 'rose' : 'violet'}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <HostStateCard
              state={currentState}
              implementation={implementation}
              appendWrites={appendWrites}
            />
            <RunHistory records={runRecords} />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function executeTask({
  behavior,
  currentStateId,
  appendWrites,
  number,
}: {
  behavior: Behavior;
  currentStateId: HostStateId;
  appendWrites: number;
  number: number;
}): RunRecord {
  if (behavior === 'convergent') {
    const changed = currentStateId !== 'compliant';
    return {
      number,
      taskResult: changed ? 'changed' : 'ok',
      stateAfter: 'compliant',
      handlerRan: changed,
      steps: [
        {
          label: 'Compare template and metadata',
          result: changed ? 'changed' : 'ok',
          detail: changed
            ? 'Observed state differs from the complete desired state.'
            : 'Content, owner, group, and mode already match.',
        },
        {
          label: 'Restart handler',
          result: changed ? 'changed' : 'skipped',
          detail: changed
            ? 'A real configuration change notifies one restart.'
            : 'No change means no new handler notification.',
        },
      ],
    };
  }

  if (behavior === 'existence-guard') {
    const fileIsMissing = currentStateId === 'missing';
    return {
      number,
      taskResult: fileIsMissing ? 'changed' : 'skipped',
      stateAfter: fileIsMissing ? 'compliant' : currentStateId,
      handlerRan: false,
      steps: [
        {
          label: 'Evaluate creates guard',
          result: fileIsMissing ? 'changed' : 'skipped',
          detail: fileIsMissing
            ? 'The file is absent, so the command is allowed to run.'
            : 'The file exists, so the command is skipped without reading its contents.',
        },
        {
          label: 'Verify desired contents',
          result: 'skipped',
          detail: 'The guard has no model of the desired bytes or metadata.',
        },
      ],
    };
  }

  const firstAppendCreatesCleanFile =
    currentStateId === 'missing' && appendWrites === 0;

  return {
    number,
    taskResult: 'changed',
    stateAfter: firstAppendCreatesCleanFile ? 'compliant' : 'drifted',
    handlerRan: false,
    steps: [
      {
        label: 'Execute shell append',
        result: 'changed',
        detail: 'The external command writes on every execution.',
      },
      {
        label: 'Evaluate resulting file',
        result: firstAppendCreatesCleanFile ? 'ok' : 'changed',
        detail: firstAppendCreatesCleanFile
          ? 'The first append happened to create the expected line once.'
          : 'Repeated or pre-existing content now differs from the desired file.',
      },
    ],
  };
}

function describeVerdict(
  behavior: Behavior,
  currentStateId: HostStateId,
  records: RunRecord[],
): {
  title: string;
  detail: string;
  icon: LucideIcon;
  className: string;
} {
  const latest = records.at(-1);

  if (!latest) {
    return {
      title: 'Run the same design twice',
      detail:
        'A first execution can repair state. The repeat execution reveals whether the task becomes quiet or repeats work.',
      icon: Repeat2,
      className:
        'border-neutral-300 bg-neutral-50 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50',
    };
  }

  if (behavior === 'convergent') {
    if (records.length < 2) {
      return {
        title: 'The host is correct; repeat the proof',
        detail:
          'Run again without changing the host. A complete desired-state module should now report ok and leave the handler quiet.',
        icon: ShieldCheck,
        className:
          'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
      };
    }

    return {
      title: latest.taskResult === 'ok'
        ? 'Convergence demonstrated'
        : 'The task still reports change',
      detail: latest.taskResult === 'ok'
        ? 'The repeat run observed the same desired state, made no change, and did not restart the service.'
        : 'A repeat change means the desired state, module behavior, input data, or external system is not stable.',
      icon: latest.taskResult === 'ok' ? CheckCircle2 : TriangleAlert,
      className: latest.taskResult === 'ok'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
        : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    };
  }

  if (behavior === 'existence-guard') {
    const falseClean = currentStateId === 'drifted' && latest.taskResult === 'skipped';
    return {
      title: falseClean
        ? 'The task is quiet, but the host is wrong'
        : 'The guard proves existence, not convergence',
      detail: falseClean
        ? 'The existing file bypassed the command even though its contents are drifted. Quiet output is not enough.'
        : 'The creates guard can suppress repeat execution, but it cannot repair later content or metadata drift.',
      icon: falseClean ? XCircle : CircleAlert,
      className: falseClean
        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
        : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    };
  }

  return {
    title: records.length > 1
      ? 'The repeat run performs the side effect again'
      : 'The command changed state without a convergence check',
    detail:
      'The shell append always reports changed and repeated execution duplicates or compounds content. Reporting overrides cannot repair this behavior.',
    icon: TriangleAlert,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };
}

function HostStateCard({
  state,
  implementation,
  appendWrites,
}: {
  state: HostState;
  implementation: Implementation;
  appendWrites: number;
}) {
  const meta = stateMeta[state.id];
  const StateIcon = meta.icon;

  return (
    <div className={`min-w-0 rounded-md border p-5 ${meta.className}`}>
      <div className="flex items-start gap-3">
        <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">
            Managed host
          </p>
          <h4 className="mt-1 text-lg font-semibold">{state.label}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{state.detail}</p>
        </div>
      </div>
      <div className="mt-5 rounded-md border border-current/20 bg-white/60 p-3 font-mono text-xs leading-5 dark:bg-neutral-950/35">
        <p>file: /etc/checkout-api/config.conf</p>
        <p>state: {state.id}</p>
        <p>task: {implementation.taskLabel}</p>
        {implementation.behavior === 'imperative' ? (
          <p>append executions: {appendWrites}</p>
        ) : null}
      </div>
    </div>
  );
}

function RunHistory({ records }: { records: RunRecord[] }) {
  const visibleRecords = records.slice(-4);

  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Execution trace
          </p>
          <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
            Compare every repeat run
          </h4>
          {records.length > visibleRecords.length ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Showing the latest {visibleRecords.length} of {records.length} runs.
            </p>
          ) : null}
        </div>
        <Terminal
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-neutral-500 dark:text-neutral-400"
        />
      </div>

      {records.length === 0 ? (
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-white px-5 text-center text-sm leading-6 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400">
          Run the playbook to record task results and handler behavior.
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {visibleRecords.map((record) => (
            <li
              key={record.number}
              className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Run {record.number}
                </p>
                <ResultBadge result={record.taskResult} />
              </div>
              <div className="mt-3 space-y-2">
                {record.steps.map((step) => (
                  <div
                    key={step.label}
                    className="grid gap-1 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {step.label}
                      </p>
                      <p className="mt-0.5 leading-5 text-neutral-600 dark:text-neutral-400">
                        {step.detail}
                      </p>
                    </div>
                    <ResultBadge result={step.result} compact />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResultBadge({
  result,
  compact = false,
}: {
  result: TaskResult;
  compact?: boolean;
}) {
  const meta = resultMeta[result];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border font-semibold uppercase ${meta.className} ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {result}
    </span>
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
    <LearningLabBody>
      <div className="flex min-h-52 items-center justify-center p-4">
        {error ? (
          <div
            role="alert"
            className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50"
          >
            <div className="flex items-start gap-3">
              <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Unable to load the lab</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            Loading execution states...
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
