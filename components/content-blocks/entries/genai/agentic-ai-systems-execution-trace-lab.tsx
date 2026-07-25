'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Footprints,
  Hand,
  ListTree,
  Route,
  ShieldCheck,
  SquareTerminal,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StepKind = 'model' | 'read' | 'write' | 'verify';
type SignalKind = 'success' | 'failure' | 'injection';
type TraceStatus = 'complete' | 'failed' | 'blocked';
type Tone = 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'neutral';

interface TaskStep {
  id: string;
  label: string;
  detail: string;
  kind: StepKind;
  stateAfter: string;
}

interface Task {
  id: string;
  label: string;
  detail: string;
  successCriterion: string;
  unsafeConsequence: string;
  costs: {
    modelTurnUsd: number;
    readToolUsd: number;
    writeToolUsd: number;
  };
  steps: TaskStep[];
}

interface PlanningPolicy {
  id: string;
  label: string;
  detail: string;
  planningTurns: number;
  replanTurns: number;
  retryLimit: number;
  isolatesToolOutput: boolean;
}

interface ToolSignal {
  id: string;
  label: string;
  detail: string;
  kind: SignalKind;
}

interface ApprovalBoundary {
  id: string;
  label: string;
  detail: string;
}

interface TraceLabData {
  title: string;
  description: string;
  defaults: {
    taskId: string;
    policyId: string;
    signalId: string;
    stepBudget: number;
    approvalId: string;
  };
  tasks: Task[];
  policies: PlanningPolicy[];
  signals: ToolSignal[];
  approvals: ApprovalBoundary[];
}

interface TraceEntry {
  id: string;
  label: string;
  detail: string;
  from: string;
  to: string;
  status: TraceStatus;
}

const BLOCK_ID = 'genai/agentic-ai-systems-execution-trace-lab';

function isTraceLabData(value: unknown): value is TraceLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TraceLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.tasks)
      && candidate.tasks.length > 0
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && Array.isArray(candidate.signals)
      && candidate.signals.length > 0
      && Array.isArray(candidate.approvals)
      && candidate.approvals.length > 0,
  );
}

export default function AgenticAiSystemsExecutionTraceLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TraceLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No execution trace model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTraceLabData(payload)) throw new Error('Execution trace data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load execution data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return <LabState title="Execution trace unavailable" detail={loadError} tone="rose" />;
  }
  if (!data) {
    return (
      <LabState
        title="Loading execution trace"
        detail="Preparing tasks, policies, and failure signals..."
        tone="neutral"
      />
    );
  }

  return <ExecutionTraceLab data={data} />;
}

function ExecutionTraceLab({ data }: { data: TraceLabData }) {
  const [taskId, setTaskId] = useState(data.defaults.taskId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [signalId, setSignalId] = useState(data.defaults.signalId);
  const [stepBudget, setStepBudget] = useState(data.defaults.stepBudget);
  const [approvalId, setApprovalId] = useState(data.defaults.approvalId);

  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
  const signal = data.signals.find((item) => item.id === signalId) ?? data.signals[0];
  const approval =
    data.approvals.find((item) => item.id === approvalId) ?? data.approvals[0];

  const result = useMemo(
    () => simulateRun(task, policy, signal, approval, stepBudget),
    [approval, policy, signal, stepBudget, task],
  );

  const reset = () => {
    setTaskId(data.defaults.taskId);
    setPolicyId(data.defaults.policyId);
    setSignalId(data.defaults.signalId);
    setStepBudget(data.defaults.stepBudget);
    setApprovalId(data.defaults.approvalId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Execution-loop lab"
          title={data.title}
          description={data.description}
          icon={ListTree}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Choose a task"
                items={data.tasks}
                selectedId={task.id}
                icon={SquareTerminal}
                accent="cyan"
                onChoose={setTaskId}
              />
              <ChoiceGroup
                legend="2. Choose planning policy"
                items={data.policies}
                selectedId={policy.id}
                icon={Route}
                accent="violet"
                onChoose={setPolicyId}
              />
              <ChoiceGroup
                legend="3. Inject a tool signal"
                items={data.signals}
                selectedId={signal.id}
                icon={Wrench}
                accent="amber"
                onChoose={setSignalId}
              />
              <LabRange
                label="4. Run step budget"
                value={stepBudget}
                output={`${stepBudget} steps`}
                min={2}
                max={8}
                step={1}
                accent="blue"
                lowLabel="Early stop"
                highLabel="More loop exposure"
                onChange={setStepBudget}
              />
              <ChoiceGroup
                legend="5. Set approval boundary"
                items={data.approvals}
                selectedId={approval.id}
                icon={Hand}
                accent="emerald"
                onChoose={setApprovalId}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Stop reason"
                value={result.stopLabel}
                detail={result.stopDetail}
                icon={result.tone === 'emerald' ? CheckCircle2 : CircleAlert}
                tone={result.tone}
              />
              <LabMetric
                label="Durable state"
                value={formatState(result.finalState)}
                detail={result.statePath.map(formatState).join(' -> ')}
                icon={Footprints}
                tone={result.finalState === 'completed' ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Attempt envelope"
                value={`1-${policy.retryLimit + 1} / failed call`}
                detail={`${result.toolCalls} tool call${result.toolCalls === 1 ? '' : 's'} reached in this trace.`}
                icon={Clock3}
                tone="violet"
              />
              <LabMetric
                label="Cost envelope"
                value={`$${result.costLow.toFixed(3)}-$${result.costHigh.toFixed(3)}`}
                detail={`Teaching rates, bounded by ${stepBudget} visible steps.`}
                icon={BadgeDollarSign}
                tone="cyan"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <Footprints
                  aria-hidden="true"
                  className="h-4 w-4 text-violet-600 dark:text-violet-300"
                />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Step trace
                </h4>
              </div>
              <ol className="mt-4 space-y-3">
                {result.trace.map((entry, index) => (
                  <TraceRow key={entry.id} entry={entry} number={index + 1} />
                ))}
              </ol>
            </section>

            <section className={`rounded-md border p-4 ${toneClasses[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Ban aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Visible consequence
                  </p>
                  <p className="mt-2 text-sm leading-6">{result.consequence}</p>
                  <p className="mt-3 border-t border-current/20 pt-3 text-sm leading-6">
                    <strong>Success check:</strong> {task.successCriterion}
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

function simulateRun(
  task: Task,
  policy: PlanningPolicy,
  signal: ToolSignal,
  approval: ApprovalBoundary,
  stepBudget: number,
) {
  const trace: TraceEntry[] = [];
  const statePath = ['created'];
  let currentState = 'created';
  let toolCalls = 0;
  let affectedAttempts = 0;
  let spentCost = Math.max(0, policy.planningTurns - 1) * task.costs.modelTurnUsd;
  let signalHandled = false;
  let finalState = 'running';
  let stopLabel = 'Task completed';
  let stopDetail = 'The runtime reached the declared success state.';
  let consequence = task.successCriterion;
  let tone: Tone = 'emerald';
  let stopped = false;

  const transition = (
    id: string,
    label: string,
    detail: string,
    to: string,
    status: TraceStatus,
  ) => {
    if (trace.length >= stepBudget) return false;
    trace.push({ id: `${id}-${trace.length}`, label, detail, from: currentState, to, status });
    currentState = to;
    if (statePath[statePath.length - 1] !== to) statePath.push(to);
    return true;
  };

  const stopForBudget = () => {
    finalState = 'budget_exhausted';
    stopLabel = 'Step budget exhausted';
    stopDetail = `The runtime used all ${stepBudget} permitted steps before proving completion.`;
    consequence = 'No completion claim is released. Persist the checkpoint and require a new run decision.';
    tone = 'amber';
    stopped = true;
  };

  for (const step of task.steps) {
    if (trace.length >= stepBudget) {
      stopForBudget();
      break;
    }

    const isTool = step.kind === 'read' || step.kind === 'write' || step.kind === 'verify';
    const approvalRequired =
      isTool
      && (approval.id === 'all-tools' || (approval.id === 'writes' && step.kind === 'write'));

    if (approvalRequired) {
      transition(
        `${step.id}-approval`,
        `Pause before: ${step.label}`,
        `The ${approval.label.toLowerCase()} boundary preserves the proposal and exact arguments for review.`,
        'waiting_approval',
        'blocked',
      );
      finalState = 'waiting_approval';
      stopLabel = 'Approval required';
      stopDetail = 'Execution pauses before the external effect.';
      consequence =
        step.kind === 'write'
          ? 'The proposed mutation has not executed. An authorized reviewer can approve or reject this exact call.'
          : 'The tool call has not executed. Review load increases because even read-only evidence needs approval.';
      tone = 'amber';
      stopped = true;
      break;
    }

    if (step.kind === 'model') {
      spentCost += task.costs.modelTurnUsd;
    } else {
      toolCalls += 1;
      spentCost += step.kind === 'write' ? task.costs.writeToolUsd : task.costs.readToolUsd;
    }

    const isFirstObservation = !signalHandled && (step.kind === 'read' || step.kind === 'verify');
    if (isFirstObservation) {
      signalHandled = true;
      affectedAttempts = 1;

      if (signal.kind === 'failure') {
        transition(
          `${step.id}-failure`,
          `${step.label} fails`,
          'The tool reports a transient outage before any mutation.',
          'tool_failed',
          'failed',
        );

        if (policy.retryLimit === 0) {
          finalState = 'stopped';
          stopLabel = 'Tool failure';
          stopDetail = 'This planning policy has no automatic recovery attempt.';
          consequence = 'The checkpoint records the failed read. No external mutation has occurred.';
          tone = 'amber';
          stopped = true;
          break;
        }

        if (trace.length >= stepBudget) {
          stopForBudget();
          break;
        }

        spentCost += policy.replanTurns * task.costs.modelTurnUsd;
        if (
          !transition(
            `${step.id}-replan`,
            'Replan within policy',
            `Use ${policy.replanTurns} bounded model turn${policy.replanTurns === 1 ? '' : 's'} to retry the same scoped read.`,
            'recovering',
            'complete',
          )
        ) {
          stopForBudget();
          break;
        }

        if (trace.length >= stepBudget) {
          stopForBudget();
          break;
        }

        affectedAttempts += 1;
        toolCalls += 1;
        spentCost += task.costs.readToolUsd;
        transition(
          `${step.id}-retry`,
          'Retry returns valid evidence',
          'The retry stays within the original tool, object scope, and attempt ceiling.',
          step.stateAfter,
          'complete',
        );
        continue;
      }

      if (signal.kind === 'injection') {
        if (policy.isolatesToolOutput) {
          transition(
            `${step.id}-injection`,
            'Reject injected instruction',
            'Schema and trust-boundary checks preserve valid data but reject the tool result as a source of authority.',
            'blocked_untrusted_output',
            'blocked',
          );
          finalState = 'stopped';
          stopLabel = 'Untrusted output blocked';
          stopDetail = 'The runtime does not convert tool text into a new objective.';
          consequence = 'The unrelated export is never proposed to the tool gateway. Review the source before resuming.';
          tone = 'emerald';
          stopped = true;
          break;
        }

        transition(
          `${step.id}-injection`,
          'Raw tool text enters planner context',
          'The planning policy fails to separate evidence from instructions.',
          'goal_hijacked',
          'failed',
        );

        if (trace.length >= stepBudget) {
          stopForBudget();
          break;
        }

        spentCost += task.costs.modelTurnUsd;
        transition(
          `${step.id}-malicious-proposal`,
          'Planner proposes unrelated export',
          'A new write is proposed even though it is absent from the bound goal.',
          'unsafe_proposal',
          'failed',
        );

        if (approval.id !== 'none') {
          if (trace.length >= stepBudget) {
            stopForBudget();
            break;
          }
          transition(
            `${step.id}-approval-catch`,
            'Approval boundary intercepts write',
            'The runtime pauses before credentials reach the unrelated mutation tool.',
            'waiting_approval',
            'blocked',
          );
          finalState = 'waiting_approval';
          stopLabel = 'Injected action awaiting review';
          stopDetail = 'Approval contains the effect, but the goal-hijack defect still blocks release.';
          consequence =
            'No export executes. Reject the call, quarantine the tool result, and repair the output trust boundary.';
          tone = 'amber';
          stopped = true;
          break;
        }

        if (trace.length >= stepBudget) {
          stopForBudget();
          break;
        }

        toolCalls += 1;
        spentCost += task.costs.writeToolUsd;
        transition(
          `${step.id}-unsafe-write`,
          'Unrelated write executes',
          task.unsafeConsequence,
          'policy_violation',
          'failed',
        );
        finalState = 'policy_violation';
        stopLabel = 'Policy violation';
        stopDetail = 'The loop can call tools, but it cannot be trusted with this authority.';
        consequence = task.unsafeConsequence;
        tone = 'rose';
        stopped = true;
        break;
      }
    }

    transition(step.id, step.label, step.detail, step.stateAfter, 'complete');

    if (
      policy.id === 'open-reactive'
      && isTool
      && step.kind !== 'write'
      && trace.length < stepBudget
    ) {
      spentCost += policy.replanTurns * task.costs.modelTurnUsd;
      transition(
        `${step.id}-reactive-replan`,
        'Replan from observation',
        'The open loop adds another model decision before continuing.',
        'replanning',
        'complete',
      );
    }
  }

  if (!stopped) {
    if (trace.length >= stepBudget && currentState !== 'completed') {
      stopForBudget();
    } else {
      finalState = 'completed';
      if (statePath[statePath.length - 1] !== 'completed') statePath.push('completed');
    }
  }

  const remainingVisibleSteps = Math.max(0, stepBudget - trace.length);
  const largestUnitCost = Math.max(
    task.costs.modelTurnUsd,
    task.costs.readToolUsd,
    task.costs.writeToolUsd,
  );
  const retryReserve =
    Math.max(0, policy.retryLimit + 1 - affectedAttempts)
    * (task.costs.readToolUsd + policy.replanTurns * task.costs.modelTurnUsd);
  const costHigh = spentCost + remainingVisibleSteps * largestUnitCost + retryReserve;

  return {
    trace,
    statePath,
    finalState,
    stopLabel,
    stopDetail,
    consequence,
    tone,
    toolCalls,
    costLow: spentCost,
    costHigh: Math.max(spentCost, costHigh),
  };
}

function ChoiceGroup({
  legend,
  items,
  selectedId,
  icon,
  accent,
  onChoose,
}: {
  legend: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: typeof Route;
  accent: 'cyan' | 'violet' | 'amber' | 'emerald';
  onChoose: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onChoose(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function TraceRow({ entry, number }: { entry: TraceEntry; number: number }) {
  const styles: Record<TraceStatus, string> = {
    complete:
      'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950',
    failed:
      'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
    blocked:
      'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
  };

  return (
    <li className={`rounded-md border p-3 ${styles[entry.status]}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{entry.label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {entry.detail}
          </p>
          <p className="mt-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {formatState(entry.from)} -&gt; {formatState(entry.to)}
          </p>
        </div>
      </div>
    </li>
  );
}

function LabState({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: 'neutral' | 'rose';
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            role="status"
            className={`flex items-start gap-3 rounded-md border p-4 ${toneClasses[tone]}`}
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-6 opacity-75">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  amber:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
  violet:
    'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
  neutral:
    'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
};

function formatState(value: string) {
  return value.replaceAll('_', ' ');
}
