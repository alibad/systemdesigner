'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  LoaderCircle,
  MessageSquareMore,
  Network,
  Radio,
  RotateCcw,
  ShieldCheck,
  SquareStack,
  TriangleAlert,
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

type FailurePoint = 'none' | 'runtime' | 'handler' | 'tool';

type TraceStep = {
  id: string;
  actor: string;
  target: string;
  message: string;
  boundary: string;
  detail: string;
  failurePoint: FailurePoint;
};

type Topology = {
  id: string;
  label: string;
  detail: string;
  boundary: string;
  stateOwner: string;
  messageMode: string;
  termination: string;
  steps: TraceStep[];
};

type Failure = {
  id: string;
  label: string;
  detail: string;
  point: FailurePoint;
  controlledResult: string;
  uncontrolledResult: string;
};

type RuntimeTraceData = {
  title: string;
  description: string;
  defaults: {
    topologyId: string;
    failureId: string;
    checkpointed: boolean;
    idempotentTools: boolean;
  };
  topologies: Topology[];
  failures: Failure[];
};

type StepStatus = 'complete' | 'current' | 'failed' | 'recovered' | 'pending';

const BLOCK_ID = 'technology/autogen-runtime-trace-lab';
const failurePoints: FailurePoint[] = ['none', 'runtime', 'handler', 'tool'];

const topologyIcons: Record<string, LucideIcon> = {
  'single-agent': Bot,
  'round-robin': SquareStack,
  'core-direct': GitBranch,
  'core-broadcast': Radio,
};

const stepStatusStyles: Record<StepStatus, string> = {
  complete: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
  current: 'border-blue-400 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-600 dark:bg-blue-950/30 dark:ring-blue-900',
  failed: 'border-rose-400 bg-rose-50 ring-2 ring-rose-200 dark:border-rose-700 dark:bg-rose-950/30 dark:ring-rose-900',
  recovered: 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
  pending: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
};

function isFailurePoint(value: unknown): value is FailurePoint {
  return failurePoints.includes(value as FailurePoint);
}

function isRuntimeTraceData(value: unknown): value is RuntimeTraceData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RuntimeTraceData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.topologyId === 'string'
      && typeof data.defaults.failureId === 'string'
      && typeof data.defaults.checkpointed === 'boolean'
      && typeof data.defaults.idempotentTools === 'boolean'
      && Array.isArray(data.topologies)
      && data.topologies.length >= 3
      && data.topologies.every((topology) => (
        typeof topology.id === 'string'
        && typeof topology.label === 'string'
        && typeof topology.detail === 'string'
        && typeof topology.boundary === 'string'
        && typeof topology.stateOwner === 'string'
        && typeof topology.messageMode === 'string'
        && typeof topology.termination === 'string'
        && Array.isArray(topology.steps)
        && topology.steps.length >= 4
        && topology.steps.every((step) => (
          typeof step.id === 'string'
          && typeof step.actor === 'string'
          && typeof step.target === 'string'
          && typeof step.message === 'string'
          && typeof step.boundary === 'string'
          && typeof step.detail === 'string'
          && isFailurePoint(step.failurePoint)
        ))
      ))
      && Array.isArray(data.failures)
      && data.failures.length >= 2
      && data.failures.every((failure) => (
        typeof failure.id === 'string'
        && typeof failure.label === 'string'
        && typeof failure.detail === 'string'
        && isFailurePoint(failure.point)
        && typeof failure.controlledResult === 'string'
        && typeof failure.uncontrolledResult === 'string'
      )),
  );
}

export default function AutogenRuntimeTraceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RuntimeTraceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No runtime trace model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the runtime trace (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRuntimeTraceData(payload)) {
          throw new Error('The runtime trace model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the runtime trace.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <TraceLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <RuntimeTraceWorkbench data={data} />;
}

function RuntimeTraceWorkbench({ data }: { data: RuntimeTraceData }) {
  const initialTopology = data.topologies.find(
    (item) => item.id === data.defaults.topologyId,
  ) ?? data.topologies[0];
  const initialFailure = data.failures.find(
    (item) => item.id === data.defaults.failureId,
  ) ?? data.failures[0];

  const [topologyId, setTopologyId] = useState(initialTopology.id);
  const [failureId, setFailureId] = useState(initialFailure.id);
  const [checkpointed, setCheckpointed] = useState(data.defaults.checkpointed);
  const [idempotentTools, setIdempotentTools] = useState(data.defaults.idempotentTools);
  const [stepIndex, setStepIndex] = useState(0);

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
  const currentStep = topology.steps[stepIndex] ?? topology.steps[0];

  const result = useMemo(() => {
    const failureIndex = failure.point === 'none'
      ? -1
      : topology.steps.findIndex((step) => step.failurePoint === failure.point);
    const failureReached = failureIndex >= 0 && stepIndex >= failureIndex;
    const hasRecoveryControl = failure.point === 'tool'
      ? idempotentTools
      : failure.point === 'runtime'
        ? checkpointed
        : failure.point === 'handler';
    const broadcastHandlerFailure = failure.point === 'handler' && topology.id === 'core-broadcast';
    const canContinue = !failureReached
      || failure.point === 'none'
      || (hasRecoveryControl && failure.point !== 'handler');
    const completed = stepIndex === topology.steps.length - 1 && canContinue;

    let status = completed ? 'Completed' : 'Tracing';
    let verdict = `Advance the trace to see how ${topology.messageMode.toLowerCase()} crosses each ownership boundary.`;
    let tone: 'blue' | 'emerald' | 'amber' | 'rose' = completed ? 'emerald' : 'blue';

    if (failureReached) {
      if (broadcastHandlerFailure) {
        status = 'Logged, not returned';
        tone = 'amber';
        verdict = 'The publisher receives no subscriber response. The runtime logs the handler failure, so subscriber telemetry and remediation must detect the partial fan-out.';
      } else if (failure.point === 'handler') {
        status = 'Visible failure';
        tone = 'amber';
        verdict = 'The awaited path observes the handler exception and must terminate or choose an explicit recovery path. It is not a successful response.';
      } else if (hasRecoveryControl) {
        status = stepIndex > failureIndex ? 'Recovered' : 'Recovery ready';
        tone = 'amber';
        verdict = failure.controlledResult;
      } else {
        status = 'Blocked';
        tone = 'rose';
        verdict = failure.uncontrolledResult;
      }
    }

    return {
      broadcastHandlerFailure,
      canContinue,
      completed,
      failureIndex,
      failureReached,
      hasRecoveryControl,
      status,
      tone,
      verdict,
    } as const;
  }, [checkpointed, failure, idempotentTools, stepIndex, topology]);

  function chooseTopology(id: string) {
    setTopologyId(id);
    setStepIndex(0);
  }

  function chooseFailure(id: string) {
    setFailureId(id);
    setStepIndex(0);
  }

  function reset() {
    setTopologyId(initialTopology.id);
    setFailureId(initialFailure.id);
    setCheckpointed(data.defaults.checkpointed);
    setIdempotentTools(data.defaults.idempotentTools);
    setStepIndex(0);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime boundary trace"
          title={data.title}
          description={data.description}
          icon={Network}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Execution model"
                items={data.topologies}
                selectedId={topology.id}
                iconFor={(id) => topologyIcons[id] ?? Network}
                onSelect={chooseTopology}
              />

              <ChoiceGroup
                label="2. Failure injection"
                items={data.failures}
                selectedId={failure.id}
                iconFor={(id) => id === 'none' ? CheckCircle2 : TriangleAlert}
                accent="rose"
                onSelect={chooseFailure}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  3. Recovery controls
                </legend>
                <div className="mt-3 space-y-3">
                  <ControlCheckbox
                    checked={checkpointed}
                    label="Quiescent checkpoint"
                    detail="A compatible snapshot exists from a completed transition."
                    icon={Database}
                    onChange={setCheckpointed}
                  />
                  <ControlCheckbox
                    checked={idempotentTools}
                    label="Idempotency receipt"
                    detail="A timed-out write can be reconciled before retry."
                    icon={ShieldCheck}
                    onChange={setIdempotentTools}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Lifecycle boundary"
                value={topology.boundary}
                detail="Who creates and owns the running agent objects"
                icon={Network}
                tone="blue"
              />
              <LabMetric
                label="State owner"
                value={topology.stateOwner}
                detail="Conversation state is not the business system of record"
                icon={Database}
                tone="violet"
              />
              <LabMetric
                label="Message semantics"
                value={topology.messageMode}
                detail={topology.termination}
                icon={MessageSquareMore}
                tone="cyan"
              />
              <LabMetric
                label="Run status"
                value={result.status}
                detail={`Step ${stepIndex + 1} of ${topology.steps.length}`}
                icon={result.status === 'Blocked' ? XCircle : result.completed ? CheckCircle2 : CircleDot}
                tone={result.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Active transition
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {currentStep.actor} to {currentStep.target}
                  </h4>
                  <p className="mt-1 break-words font-mono text-xs text-blue-800 dark:text-blue-200">
                    {currentStep.message}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {currentStep.boundary}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {currentStep.detail}
              </p>
            </section>

            <ol className="space-y-2" aria-label={`${topology.label} message trace`}>
              {topology.steps.map((step, index) => {
                const status = getStepStatus(index, stepIndex, result.failureIndex, result.hasRecoveryControl);
                const StatusIcon = status === 'failed'
                  ? XCircle
                  : status === 'complete' || status === 'recovered'
                    ? CheckCircle2
                    : CircleDot;

                return (
                  <li
                    key={step.id}
                    aria-current={index === stepIndex ? 'step' : undefined}
                    className={`rounded-md border p-3 ${stepStatusStyles[status]}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {step.actor} to {step.target}
                          </p>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                            <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                            {status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {step.boundary}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Previous
              </button>
              <p className="text-center text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {result.canContinue
                  ? 'Advance to expose the next ownership boundary.'
                  : 'Change the recovery control or reset the trace.'}
              </p>
              <button
                type="button"
                disabled={stepIndex >= topology.steps.length - 1 || !result.canContinue}
                onClick={() => setStepIndex((value) => Math.min(topology.steps.length - 1, value + 1))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Next
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <section className={`rounded-md border p-4 ${
              result.status === 'Blocked'
                ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            }`}>
              <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Operational consequence
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.verdict}
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

function getStepStatus(
  index: number,
  currentIndex: number,
  failureIndex: number,
  hasRecoveryControl: boolean,
): StepStatus {
  if (index === failureIndex && currentIndex >= failureIndex) {
    return currentIndex > failureIndex && hasRecoveryControl ? 'recovered' : 'failed';
  }
  if (index < currentIndex) return 'complete';
  if (index === currentIndex) return 'current';
  return 'pending';
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  iconFor,
  accent = 'blue',
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  iconFor: (id: string) => LucideIcon;
  accent?: 'blue' | 'rose';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={iconFor(item.id)}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ControlCheckbox({
  checked,
  label,
  detail,
  icon: Icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  icon: LucideIcon;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-300 bg-white p-3 text-neutral-800 focus-within:ring-2 focus-within:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
      />
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
          {detail}
        </span>
      </span>
    </label>
  );
}

function TraceLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime boundary trace"
          title={error ? 'Runtime trace unavailable' : 'Loading runtime trace'}
          description={error ?? 'Loading the message and failure model.'}
          icon={error ? TriangleAlert : LoaderCircle}
          accent={error ? 'rose' : 'blue'}
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center">
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : (
              <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-300" />
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
