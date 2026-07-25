'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Database,
  Gauge,
  KeyRound,
  LockKeyhole,
  MessageSquare,
  Network,
  Play,
  RotateCcw,
  Route,
  ShieldCheck,
  Square,
  Terminal,
  Timer,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import { CodeBlock } from '@/components/shared/CodeBlock';

type TaskId = 'billing' | 'access' | 'policy';
type TopologyId = 'single' | 'delegated';
type MemoryId = 'turn' | 'session' | 'case';
type AuthorityId = 'read-only' | 'approval' | 'delegated';
type ToolId = 'knowledge' | 'account' | 'refund' | 'handoff';
type GuardrailId = 'observe' | 'balanced' | 'strict';
type ChallengeId =
  | 'healthy'
  | 'tool-failure'
  | 'approval-denied'
  | 'context-overflow'
  | 'loop'
  | 'unsafe-action';
type TraceStatus = 'complete' | 'warning' | 'blocked';
type RunStatus = 'completed' | 'escalated' | 'stopped' | 'unsafe';
type IconComponent = typeof Bot;

interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  scope: string;
  mutates: boolean;
  sensitive: boolean;
  icon: IconComponent;
}

interface TraceStep {
  id: string;
  title: string;
  detail: string;
  status: TraceStatus;
  latencyMs: number;
  tokens: number;
  tool?: string;
}

interface SimulationResult {
  trace: TraceStep[];
  status: RunStatus;
  stopCondition: string;
  outcome: string;
  toolCalls: number;
  latencyMs: number;
  tokens: number;
  cost: number;
  taskScore: number;
  safetyScore: number;
  efficiencyScore: number;
  evaluationScore: number;
}

const TASKS: Array<{ id: TaskId; label: string; description: string; required: ToolId[] }> = [
  {
    id: 'billing',
    label: 'Resolve a billing dispute',
    description: 'Read the account, check policy, and propose a bounded refund.',
    required: ['account', 'knowledge', 'refund'],
  },
  {
    id: 'access',
    label: 'Investigate account access',
    description: 'Inspect account state, explain policy, and hand off sensitive recovery.',
    required: ['account', 'knowledge', 'handoff'],
  },
  {
    id: 'policy',
    label: 'Explain a service policy',
    description: 'Retrieve approved guidance without reading or changing customer records.',
    required: ['knowledge'],
  },
];

const TOOLS: ToolDefinition[] = [
  {
    id: 'knowledge',
    name: 'Policy search',
    description: 'Retrieves approved guidance with source references.',
    scope: 'Read public policy corpus',
    mutates: false,
    sensitive: false,
    icon: Database,
  },
  {
    id: 'account',
    name: 'Account lookup',
    description: 'Reads a tenant-scoped customer record.',
    scope: 'Read one authenticated account',
    mutates: false,
    sensitive: true,
    icon: KeyRound,
  },
  {
    id: 'refund',
    name: 'Refund action',
    description: 'Creates a reversible financial operation.',
    scope: 'Write refunds up to $200',
    mutates: true,
    sensitive: true,
    icon: CircleDollarSign,
  },
  {
    id: 'handoff',
    name: 'Human handoff',
    description: 'Creates a reviewed case with the trace attached.',
    scope: 'Create support case',
    mutates: true,
    sensitive: false,
    icon: UserCheck,
  },
];

const CHALLENGES: Array<{
  id: ChallengeId;
  label: string;
  short: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    id: 'healthy',
    label: 'Healthy run',
    short: 'Baseline',
    description: 'Tools respond and policy checks succeed.',
    icon: CheckCircle2,
  },
  {
    id: 'tool-failure',
    label: 'Tool timeout',
    short: 'Failure',
    description: 'Account lookup exceeds its deadline.',
    icon: Timer,
  },
  {
    id: 'approval-denied',
    label: 'Approval denied',
    short: 'Denial',
    description: 'A reviewer rejects the proposed write.',
    icon: Ban,
  },
  {
    id: 'context-overflow',
    label: 'Context overflow',
    short: 'Overflow',
    description: 'The case history exceeds the configured budget.',
    icon: Database,
  },
  {
    id: 'loop',
    label: 'Planner loop',
    short: 'Loop',
    description: 'The planner repeats without making progress.',
    icon: RotateCcw,
  },
  {
    id: 'unsafe-action',
    label: 'Unsafe action',
    short: 'Policy test',
    description: 'The model proposes a $480 refund outside scope.',
    icon: AlertTriangle,
  },
];

const AUTHORITY_COPY: Record<AuthorityId, { label: string; description: string }> = {
  'read-only': {
    label: 'Read only',
    description: 'All mutating tools are blocked at the policy gate.',
  },
  approval: {
    label: 'Approval gated',
    description: 'Writes pause until a person approves the exact arguments.',
  },
  delegated: {
    label: 'Bounded delegation',
    description: 'In-scope writes may execute without a synchronous reviewer.',
  },
};

const MEMORY_COPY: Record<MemoryId, { label: string; description: string }> = {
  turn: {
    label: 'Turn only',
    description: 'Discard context after each response.',
  },
  session: {
    label: 'Session scoped',
    description: 'Retain context until this conversation closes.',
  },
  case: {
    label: 'Case scoped',
    description: 'Persist selected evidence with retention and tenant controls.',
  },
};

const GUARDRAIL_COPY: Record<GuardrailId, { label: string; description: string }> = {
  observe: {
    label: 'Observe',
    description: 'Log policy findings but do not block execution.',
  },
  balanced: {
    label: 'Escalate',
    description: 'Escalate ambiguous or high-impact actions.',
  },
  strict: {
    label: 'Block',
    description: 'Block every action outside the declared envelope.',
  },
};

const CODE_EXAMPLES = [
  {
    id: 'authority',
    label: 'Authority policy',
    title: 'Policy-first tool dispatch',
    language: 'python',
    file: '/api/content/tools/google-agent-kit/code/example-01.py',
  },
  {
    id: 'runtime',
    label: 'Bounded runtime',
    title: 'Retry, approval, and stop conditions',
    language: 'python',
    file: '/api/content/tools/google-agent-kit/code/example-02.py',
  },
  {
    id: 'contract',
    label: 'Config contract',
    title: 'Vendor-neutral teaching fixture',
    language: 'yaml',
    file: '/api/content/tools/google-agent-kit/code/example-03.yaml',
  },
  {
    id: 'evaluation',
    label: 'Evaluation',
    title: 'Trace-derived release evaluation',
    language: 'python',
    file: '/api/content/tools/google-agent-kit/code/example-04.py',
  },
];

const formatCost = (value: number) => `$${value.toFixed(4)}`;

function toolPolicy(tool: ToolDefinition, authority: AuthorityId) {
  if (tool.mutates && authority === 'read-only') {
    return {
      label: 'Blocked',
      detail: 'The policy gate rejects this write.',
      tone: 'blocked' as const,
    };
  }
  if (tool.mutates && authority === 'approval') {
    return {
      label: 'Approval',
      detail: 'Arguments are frozen and sent for review.',
      tone: 'approval' as const,
    };
  }
  if (tool.mutates) {
    return {
      label: 'Delegated',
      detail: 'Execution is limited to the declared scope.',
      tone: 'allowed' as const,
    };
  }
  return {
    label: tool.sensitive ? 'Scoped read' : 'Allowed',
    detail: tool.sensitive ? 'Tenant identity is required.' : 'No mutable side effect.',
    tone: 'allowed' as const,
  };
}

function simulateRun({
  task,
  topology,
  memory,
  authority,
  enabledTools,
  challenge,
  contextBudget,
  maxTurns,
  timeoutMs,
  retryLimit,
  evaluationThreshold,
  guardrail,
  compactContext,
}: {
  task: TaskId;
  topology: TopologyId;
  memory: MemoryId;
  authority: AuthorityId;
  enabledTools: ToolId[];
  challenge: ChallengeId;
  contextBudget: number;
  maxTurns: number;
  timeoutMs: number;
  retryLimit: number;
  evaluationThreshold: number;
  guardrail: GuardrailId;
  compactContext: boolean;
}): SimulationResult {
  const trace: TraceStep[] = [];
  const selectedTask = TASKS.find((item) => item.id === task) ?? TASKS[0];
  const requiredTools = selectedTask.required;
  const missingTools = requiredTools.filter((toolId) => !enabledTools.includes(toolId));
  const contextDemand = challenge === 'context-overflow' ? 9200 : memory === 'case' ? 5200 : memory === 'session' ? 3500 : 1700;

  trace.push({
    id: 'intake',
    title: 'Classify request',
    detail: `${selectedTask.label}. The planner receives a typed task, not an open-ended mandate.`,
    status: 'complete',
    latencyMs: 120,
    tokens: 460,
  });
  trace.push({
    id: 'context',
    title: 'Load bounded context',
    detail: `${MEMORY_COPY[memory].label}: ${Math.min(contextDemand, contextBudget).toLocaleString()} of ${contextBudget.toLocaleString()} tokens admitted.`,
    status: contextDemand > contextBudget ? 'warning' : 'complete',
    latencyMs: memory === 'turn' ? 40 : memory === 'session' ? 80 : 130,
    tokens: Math.min(contextDemand, contextBudget),
  });

  if (challenge === 'context-overflow' && contextDemand > contextBudget) {
    if (!compactContext) {
      trace.push({
        id: 'context-stop',
        title: 'Stop before planning',
        detail: 'Compaction is disabled, so the runtime refuses to silently drop evidence.',
        status: 'blocked',
        latencyMs: 15,
        tokens: 0,
      });
      return finalizeRun(trace, 'stopped', 'context_budget_exceeded', 'The run stopped before any tool received partial context.', 0, evaluationThreshold, 92, 96, 89);
    }
    trace.push({
      id: 'compact',
      title: 'Compact with provenance',
      detail: `The runtime summarizes ${contextDemand.toLocaleString()} tokens to ${Math.round(contextBudget * 0.72).toLocaleString()} and retains source pointers.`,
      status: 'warning',
      latencyMs: 310,
      tokens: 620,
    });
  }

  trace.push({
    id: 'plan',
    title: topology === 'single' ? 'Plan in one agent' : 'Route to a specialist',
    detail:
      topology === 'single'
        ? 'One planner selects the smallest permitted tool sequence.'
        : 'A coordinator delegates a typed subtask and keeps tool authority at the shared policy gate.',
    status: 'complete',
    latencyMs: topology === 'single' ? 260 : 390,
    tokens: topology === 'single' ? 760 : 1120,
  });

  if (missingTools.length > 0) {
    trace.push({
      id: 'missing-tool',
      title: 'Reject incomplete composition',
      detail: `The task requires ${missingTools.map((id) => TOOLS.find((tool) => tool.id === id)?.name).join(', ')}.`,
      status: 'blocked',
      latencyMs: 20,
      tokens: 0,
    });
    return finalizeRun(trace, 'stopped', 'required_tool_unavailable', 'The workbench exposes the missing capability instead of improvising.', 0, evaluationThreshold, 42, 98, 92);
  }

  if (challenge === 'loop') {
    const loopTurns = Math.max(2, maxTurns);
    for (let turn = 1; turn <= loopTurns; turn += 1) {
      trace.push({
        id: `loop-${turn}`,
        title: `Planner turn ${turn}`,
        detail: turn === loopTurns ? 'No progress detected. The max-turn stop condition fires.' : 'The planner repeats the same evidence request.',
        status: turn === loopTurns ? 'blocked' : 'warning',
        latencyMs: 190,
        tokens: 430,
      });
    }
    return finalizeRun(
      trace,
      'stopped',
      'max_turns_without_progress',
      `The runtime stopped the loop after ${loopTurns} turns.`,
      0,
      evaluationThreshold,
      28,
      96,
      Math.max(35, 92 - loopTurns * 7),
    );
  }

  if (challenge === 'tool-failure') {
    const attempts = retryLimit + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      trace.push({
        id: `tool-attempt-${attempt}`,
        title: `Account lookup attempt ${attempt}`,
        detail:
          attempt === attempts
            ? `The ${timeoutMs.toLocaleString()} ms deadline expires. Retry budget is exhausted.`
            : `The tool exceeds ${timeoutMs.toLocaleString()} ms; the runtime retries within budget.`,
        status: attempt === attempts ? 'blocked' : 'warning',
        latencyMs: timeoutMs,
        tokens: 90,
        tool: 'account.lookup',
      });
    }
    if (enabledTools.includes('handoff')) {
      trace.push({
        id: 'tool-handoff',
        title: 'Escalate with evidence',
        detail: 'A human case receives the failed arguments, attempt count, and trace identifier.',
        status: 'complete',
        latencyMs: 180,
        tokens: 120,
        tool: 'case.create',
      });
      return finalizeRun(
        trace,
        'escalated',
        'tool_retry_budget_exhausted',
        'The user gets a case reference; the agent does not claim the lookup succeeded.',
        attempts + 1,
        evaluationThreshold,
        64,
        96,
        Math.max(30, 88 - attempts * 9),
      );
    }
    return finalizeRun(
      trace,
      'stopped',
      'tool_retry_budget_exhausted',
      'The run stops because no human handoff tool is available.',
      attempts,
      evaluationThreshold,
      45,
      96,
      Math.max(30, 88 - attempts * 9),
    );
  }

  const firstReadTool = requiredTools.find((id) => id === 'account' || id === 'knowledge');
  if (firstReadTool) {
    const definition = TOOLS.find((tool) => tool.id === firstReadTool);
    trace.push({
      id: 'read-tool',
      title: `Call ${definition?.name ?? 'read tool'}`,
      detail: definition?.scope ?? 'Read bounded data.',
      status: 'complete',
      latencyMs: firstReadTool === 'account' ? 340 : 210,
      tokens: 140,
      tool: firstReadTool === 'account' ? 'account.lookup' : 'policy.search',
    });
  }

  if (challenge === 'approval-denied') {
    trace.push({
      id: 'approval-request',
      title: 'Request approval',
      detail: 'The proposed action and exact arguments are frozen for review.',
      status: 'warning',
      latencyMs: 420,
      tokens: 120,
      tool: 'approval.request',
    });
    trace.push({
      id: 'approval-denied',
      title: 'Honor reviewer denial',
      detail: 'The write is not executed, and the denial becomes part of the audit trace.',
      status: 'blocked',
      latencyMs: 40,
      tokens: 0,
    });
    return finalizeRun(trace, 'stopped', 'human_approval_denied', 'No side effect occurs after the reviewer says no.', 2, evaluationThreshold, 58, 100, 84);
  }

  if (challenge === 'unsafe-action') {
    const outsideScope = 'The proposed $480 refund exceeds the declared $200 limit.';
    if (authority === 'read-only' || guardrail === 'strict') {
      trace.push({
        id: 'unsafe-block',
        title: 'Block out-of-scope action',
        detail: outsideScope,
        status: 'blocked',
        latencyMs: 24,
        tokens: 40,
      });
      return finalizeRun(trace, 'stopped', 'policy_scope_violation', 'The request is rejected before a write reaches the tool.', 1, evaluationThreshold, 52, 100, 94);
    }
    if (authority === 'approval' || guardrail === 'balanced') {
      trace.push({
        id: 'unsafe-escalate',
        title: 'Escalate out-of-scope action',
        detail: `${outsideScope} A person receives the evidence and proposed arguments.`,
        status: 'warning',
        latencyMs: 380,
        tokens: 130,
        tool: 'approval.request',
      });
      return finalizeRun(trace, 'escalated', 'policy_scope_escalation', 'The write remains pending; authority does not expand automatically.', 2, evaluationThreshold, 67, 98, 86);
    }
    trace.push({
      id: 'unsafe-execute',
      title: 'Unsafe write executed',
      detail: `${outsideScope} Observe-only guardrails recorded the breach but did not stop it.`,
      status: 'warning',
      latencyMs: 290,
      tokens: 90,
      tool: 'refund.create',
    });
    return finalizeRun(trace, 'unsafe', 'no_effective_stop', 'A financial side effect escaped the intended authority envelope.', 2, evaluationThreshold, 34, 18, 88);
  }

  if (requiredTools.includes('refund')) {
    if (authority === 'read-only') {
      trace.push({
        id: 'write-blocked',
        title: 'Block refund write',
        detail: 'Read-only authority cannot invoke a mutating tool.',
        status: 'blocked',
        latencyMs: 18,
        tokens: 30,
      });
      return finalizeRun(trace, 'stopped', 'write_authority_missing', 'The agent explains what a reviewer must do next.', 1, evaluationThreshold, 66, 100, 95);
    }
    if (authority === 'approval') {
      trace.push({
        id: 'approval',
        title: 'Approve exact refund arguments',
        detail: 'A reviewer approves $120 for the authenticated account. Later argument changes would require a new approval.',
        status: 'complete',
        latencyMs: 430,
        tokens: 110,
        tool: 'approval.request',
      });
    }
    trace.push({
      id: 'write',
      title: 'Execute bounded refund',
      detail: 'The tool validates tenant, amount, idempotency key, and declared $200 limit.',
      status: 'complete',
      latencyMs: 310,
      tokens: 90,
      tool: 'refund.create',
    });
  }

  if (requiredTools.includes('handoff')) {
    trace.push({
      id: 'handoff',
      title: 'Create reviewed recovery case',
      detail: 'The human receives evidence and a recommended next action, not hidden chain-of-thought.',
      status: 'complete',
      latencyMs: 180,
      tokens: 90,
      tool: 'case.create',
    });
  }

  trace.push({
    id: 'answer',
    title: 'Return verified outcome',
    detail: 'The response cites completed actions, pending work, and the trace identifier.',
    status: 'complete',
    latencyMs: 210,
    tokens: 420,
  });

  return finalizeRun(
    trace,
    'completed',
    'task_complete',
    'The task finishes inside the declared tool, memory, and authority boundaries.',
    trace.filter((step) => Boolean(step.tool)).length,
    evaluationThreshold,
    challenge === 'context-overflow' ? 86 : 94,
    98,
    topology === 'single' ? 92 : 84,
  );
}

function finalizeRun(
  trace: TraceStep[],
  status: RunStatus,
  stopCondition: string,
  outcome: string,
  toolCalls: number,
  evaluationThreshold: number,
  taskScore: number,
  safetyScore: number,
  efficiencyScore: number,
): SimulationResult {
  const latencyMs = trace.reduce((total, step) => total + step.latencyMs, 0);
  const tokens = trace.reduce((total, step) => total + step.tokens, 0);
  const cost = (tokens / 1_000_000) * 4 + toolCalls * 0.001;
  const evaluationScore = Math.round(taskScore * 0.4 + safetyScore * 0.4 + efficiencyScore * 0.2);

  return {
    trace,
    status,
    stopCondition,
    outcome,
    toolCalls,
    latencyMs,
    tokens,
    cost,
    taskScore,
    safetyScore,
    efficiencyScore,
    evaluationScore: Math.min(100, Math.max(0, evaluationScore)),
  };
}

function SectionLabel({
  step,
  title,
  description,
  icon: Icon,
}: {
  step: string;
  title: string;
  description: string;
  icon: IconComponent;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">{step}</p>
        <h3 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}) {
  const toneClasses = {
    neutral: 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
    good: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    danger: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
  };
  return (
    <div className={`min-w-0 rounded-md border p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-xl font-bold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        <span>{label}</span>
        <span className="font-mono text-indigo-700 dark:text-indigo-300">
          {value.toLocaleString()}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-indigo-600"
      />
      <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>
          {min.toLocaleString()}
          {suffix}
        </span>
        <span>
          {max.toLocaleString()}
          {suffix}
        </span>
      </span>
    </label>
  );
}

export default function GoogleAgentKitPage() {
  const [task, setTask] = useState<TaskId>('billing');
  const [topology, setTopology] = useState<TopologyId>('single');
  const [memory, setMemory] = useState<MemoryId>('session');
  const [authority, setAuthority] = useState<AuthorityId>('approval');
  const [enabledTools, setEnabledTools] = useState<ToolId[]>(['knowledge', 'account', 'refund', 'handoff']);
  const [challenge, setChallenge] = useState<ChallengeId>('healthy');
  const [contextBudget, setContextBudget] = useState(6000);
  const [maxTurns, setMaxTurns] = useState(5);
  const [timeoutMs, setTimeoutMs] = useState(1800);
  const [retryLimit, setRetryLimit] = useState(1);
  const [evaluationThreshold, setEvaluationThreshold] = useState(82);
  const [guardrail, setGuardrail] = useState<GuardrailId>('strict');
  const [compactContext, setCompactContext] = useState(true);
  const [runNumber, setRunNumber] = useState(1);
  const [codeExample, setCodeExample] = useState(CODE_EXAMPLES[0].id);

  const selectedTask = TASKS.find((item) => item.id === task) ?? TASKS[0];
  const selectedChallenge = CHALLENGES.find((item) => item.id === challenge) ?? CHALLENGES[0];
  const selectedCode = CODE_EXAMPLES.find((item) => item.id === codeExample) ?? CODE_EXAMPLES[0];

  const compositionRisk = useMemo(() => {
    const enabled = TOOLS.filter((tool) => enabledTools.includes(tool.id));
    const mutating = enabled.filter((tool) => tool.mutates).length;
    const sensitive = enabled.filter((tool) => tool.sensitive).length;
    const authorityRisk = authority === 'delegated' ? 28 : authority === 'approval' ? 8 : 0;
    const memoryRisk = memory === 'case' ? 14 : memory === 'session' ? 6 : 0;
    const topologyRisk = topology === 'delegated' ? 8 : 0;
    return Math.min(100, 8 + mutating * 12 + sensitive * 8 + authorityRisk + memoryRisk + topologyRisk);
  }, [authority, enabledTools, memory, topology]);

  const result = useMemo(
    () =>
      simulateRun({
        task,
        topology,
        memory,
        authority,
        enabledTools,
        challenge,
        contextBudget,
        maxTurns,
        timeoutMs,
        retryLimit,
        evaluationThreshold,
        guardrail,
        compactContext,
      }),
    [
      authority,
      challenge,
      compactContext,
      contextBudget,
      enabledTools,
      evaluationThreshold,
      guardrail,
      maxTurns,
      memory,
      retryLimit,
      task,
      timeoutMs,
      topology,
    ],
  );

  const toggleTool = (toolId: ToolId) => {
    setEnabledTools((current) =>
      current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId],
    );
  };

  const reset = () => {
    setTask('billing');
    setTopology('single');
    setMemory('session');
    setAuthority('approval');
    setEnabledTools(['knowledge', 'account', 'refund', 'handoff']);
    setChallenge('healthy');
    setContextBudget(6000);
    setMaxTurns(5);
    setTimeoutMs(1800);
    setRetryLimit(1);
    setEvaluationThreshold(82);
    setGuardrail('strict');
    setCompactContext(true);
    setRunNumber(1);
  };

  const resultTone =
    result.status === 'completed'
      ? 'good'
      : result.status === 'unsafe'
        ? 'danger'
        : result.status === 'escalated'
          ? 'warning'
          : 'danger';
  const passedEvaluation = result.evaluationScore >= evaluationThreshold && result.status !== 'unsafe';

  return (
    <div
      data-workbench="agent-control"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300">
              <Bot className="h-4 w-4" aria-hidden />
              Agent control workbench
            </div>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Design the authority. Then break the runtime.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Compose a vendor-neutral teaching fixture, run it under pressure, and inspect the exact policy gate,
              tool call, evaluation, and stop condition that shaped the outcome.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-800 pt-4 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-2">
            <Square className="h-3.5 w-3.5 fill-indigo-400 text-indigo-400" aria-hidden />
            Teaching fixture
          </span>
          <span className="inline-flex items-center gap-2">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
            Policy gate precedes every side effect
          </span>
          <span className="inline-flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Metrics recompute from the visible trace
          </span>
        </div>
      </header>

      <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
        <SectionLabel
          step="Loop 1"
          title="Compose capability and authority"
          description="Choose the job, topology, tools, memory, and write policy. The authority map updates before the runtime can execute."
          icon={Network}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0 space-y-6">
            <fieldset>
              <legend className="text-sm font-bold text-neutral-900 dark:text-white">Task contract</legend>
              <div className="mt-3 grid gap-2">
                {TASKS.map((item) => {
                  const selected = item.id === task;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTask(item.id)}
                      className={`min-h-[76px] rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-neutral-950 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-white'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-bold">{item.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {item.description}
                          </span>
                        </span>
                        {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-bold text-neutral-900 dark:text-white">Agent topology</legend>
                <div className="mt-3 grid gap-2">
                  {[
                    {
                      id: 'single' as const,
                      label: 'Single planner',
                      description: 'One bounded decision loop.',
                    },
                    {
                      id: 'delegated' as const,
                      label: 'Coordinator + specialist',
                      description: 'Typed delegation with shared policy.',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={topology === item.id}
                      onClick={() => setTopology(item.id)}
                      className={`rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        topology === item.id
                          ? 'border-indigo-500 bg-indigo-50 text-neutral-950 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-white'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">{item.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-bold text-neutral-900 dark:text-white">Memory boundary</legend>
                <div className="mt-3 grid gap-2">
                  {(Object.keys(MEMORY_COPY) as MemoryId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={memory === id}
                      onClick={() => setMemory(id)}
                      className={`rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        memory === id
                          ? 'border-cyan-600 bg-cyan-50 text-neutral-950 dark:border-cyan-400 dark:bg-cyan-950/50 dark:text-white'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="block text-sm font-bold">{MEMORY_COPY[id].label}</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {MEMORY_COPY[id].description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-neutral-900 dark:text-white">Write authority</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(Object.keys(AUTHORITY_COPY) as AuthorityId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={authority === id}
                    onClick={() => setAuthority(id)}
                    className={`min-h-[94px] rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      authority === id
                        ? 'border-emerald-600 bg-emerald-50 text-neutral-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-white'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="block text-sm font-bold">{AUTHORITY_COPY[id].label}</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {AUTHORITY_COPY[id].description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="min-w-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">Tool and permission envelope</p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Enable only capabilities the task can justify. Selection does not bypass the policy gate.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Exposure</p>
                <p className={`text-xl font-bold ${compositionRisk >= 70 ? 'text-rose-700 dark:text-rose-300' : compositionRisk >= 45 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {compositionRisk}/100
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {TOOLS.map((tool) => {
                const enabled = enabledTools.includes(tool.id);
                const policy = toolPolicy(tool, authority);
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={enabled}
                    onClick={() => toggleTool(tool.id)}
                    className={`min-h-[164px] rounded-md border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      enabled
                        ? 'border-indigo-500 bg-indigo-50 text-neutral-950 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-white'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-md ${enabled ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                        <Icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                        policy.tone === 'blocked'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          : policy.tone === 'approval'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      }`}>
                        {policy.label}
                      </span>
                    </span>
                    <span className="mt-3 block text-sm font-bold">{tool.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">{tool.description}</span>
                    <span className="mt-2 block border-t border-current/10 pt-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      {tool.scope}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Route className="h-4 w-4 text-indigo-700 dark:text-indigo-300" aria-hidden />
                <p className="text-sm font-bold text-neutral-900 dark:text-white">Authority path</p>
              </div>
              <div className="grid items-stretch gap-2 p-4 md:grid-cols-[1fr_auto_1fr_auto_1.2fr_auto_1fr]">
                {[
                  {
                    label: 'Request',
                    detail: selectedTask.label,
                    icon: MessageSquare,
                  },
                  {
                    label: topology === 'single' ? 'Planner' : 'Coordinator',
                    detail: topology === 'single' ? 'One decision loop' : 'Typed delegation',
                    icon: Bot,
                  },
                  {
                    label: 'Policy gate',
                    detail: AUTHORITY_COPY[authority].label,
                    icon: ShieldCheck,
                  },
                  {
                    label: 'Tool boundary',
                    detail: `${enabledTools.length} of ${TOOLS.length} tools enabled`,
                    icon: Wrench,
                  },
                ].map((node, index) => {
                  const Icon = node.icon;
                  return (
                    <div key={node.label} className="contents">
                      <div className={`min-w-0 rounded-md border p-3 ${node.label === 'Policy gate' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
                        <Icon className="h-4 w-4 text-neutral-700 dark:text-neutral-200" aria-hidden />
                        <p className="mt-2 text-xs font-bold text-neutral-900 dark:text-white">{node.label}</p>
                        <p className="mt-1 break-words text-[11px] leading-4 text-neutral-600 dark:text-neutral-300">{node.detail}</p>
                      </div>
                      {index < 3 && (
                        <div className="flex items-center justify-center py-1 text-neutral-400 md:py-0">
                          <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" aria-hidden />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 px-4 py-6 dark:border-neutral-800 sm:px-6">
        <SectionLabel
          step="Loop 2"
          title="Configure runtime and evaluation"
          description="Set budgets, retries, guardrails, and the release threshold. Then inject a scenario and inspect the resulting trace."
          icon={Gauge}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 space-y-6">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <RangeControl
                label="Context budget"
                value={contextBudget}
                min={2000}
                max={12000}
                step={500}
                suffix=" tokens"
                onChange={setContextBudget}
              />
              <RangeControl
                label="Maximum planner turns"
                value={maxTurns}
                min={2}
                max={10}
                step={1}
                suffix=""
                onChange={setMaxTurns}
              />
              <RangeControl
                label="Tool timeout"
                value={timeoutMs}
                min={500}
                max={5000}
                step={100}
                suffix=" ms"
                onChange={setTimeoutMs}
              />
              <RangeControl
                label="Retry limit"
                value={retryLimit}
                min={0}
                max={3}
                step={1}
                suffix=""
                onChange={setRetryLimit}
              />
              <RangeControl
                label="Evaluation threshold"
                value={evaluationThreshold}
                min={60}
                max={95}
                step={1}
                suffix=""
                onChange={setEvaluationThreshold}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-neutral-900 dark:text-white">Out-of-policy behavior</legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(GUARDRAIL_COPY) as GuardrailId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={guardrail === id}
                    onClick={() => setGuardrail(id)}
                    className={`rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      guardrail === id
                        ? 'border-amber-500 bg-amber-50 text-neutral-950 dark:border-amber-400 dark:bg-amber-950/50 dark:text-white'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="block text-sm font-bold">{GUARDRAIL_COPY[id].label}</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {GUARDRAIL_COPY[id].description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <input
                type="checkbox"
                checked={compactContext}
                onChange={(event) => setCompactContext(event.target.checked)}
                className="mt-1 h-4 w-4 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-bold text-neutral-900 dark:text-white">Compact overflowing context</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Summarize with source pointers instead of silently truncating evidence.
                </span>
              </span>
            </label>
          </div>

          <div className="min-w-0">
            <fieldset>
              <legend className="text-sm font-bold text-neutral-900 dark:text-white">Challenge the healthy configuration</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CHALLENGES.map((item) => {
                  const selected = item.id === challenge;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChallenge(item.id)}
                      className={`min-h-[116px] rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selected
                          ? item.id === 'healthy'
                            ? 'border-emerald-600 bg-emerald-50 text-neutral-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-white'
                            : 'border-rose-600 bg-rose-50 text-neutral-950 dark:border-rose-400 dark:bg-rose-950/50 dark:text-white'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <Icon className={`h-4 w-4 ${selected && item.id !== 'healthy' ? 'text-rose-700 dark:text-rose-300' : 'text-neutral-500 dark:text-neutral-400'}`} aria-hidden />
                        {selected && <Check className="h-4 w-4" aria-hidden />}
                      </span>
                      <span className="mt-2 block text-sm font-bold">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5 flex flex-col gap-3 border-y border-neutral-200 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Ready to simulate</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">
                  {selectedChallenge.label} with {GUARDRAIL_COPY[guardrail].label.toLowerCase()} guardrails
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRunNumber((current) => current + 1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 text-sm font-bold text-white transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:text-neutral-950 dark:hover:bg-indigo-400"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Run scenario #{runNumber}
              </button>
            </div>

            <div aria-live="polite" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Run status"
                value={result.status}
                detail={`Stop: ${result.stopCondition}`}
                tone={resultTone}
              />
              <Metric
                label="Latency"
                value={`${result.latencyMs.toLocaleString()} ms`}
                detail={`${result.toolCalls} tool call${result.toolCalls === 1 ? '' : 's'}`}
                tone={result.latencyMs > 5000 ? 'warning' : 'neutral'}
              />
              <Metric
                label="Tokens"
                value={result.tokens.toLocaleString()}
                detail={`${formatCost(result.cost)} fixture cost`}
                tone={result.tokens > contextBudget ? 'warning' : 'neutral'}
              />
              <Metric
                label="Evaluation"
                value={`${result.evaluationScore}/100`}
                detail={`${passedEvaluation ? 'Meets' : 'Misses'} threshold ${evaluationThreshold}`}
                tone={passedEvaluation ? 'good' : 'danger'}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-700 dark:text-indigo-300" aria-hidden />
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">Auditable run trace</p>
                </div>
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  trace agent-run-{String(runNumber).padStart(3, '0')}
                </span>
              </div>
              <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {result.trace.map((step, index) => {
                  const StatusIcon =
                    step.status === 'complete' ? CheckCircle2 : step.status === 'blocked' ? XCircle : AlertTriangle;
                  const statusClasses =
                    step.status === 'complete'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : step.status === 'blocked'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
                  return (
                    <li key={step.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${statusClasses}`}>
                        <StatusIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{index + 1}</span>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{step.title}</p>
                          {step.tool && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                              {step.tool}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                      </div>
                      <div className="flex gap-3 text-xs text-neutral-500 dark:text-neutral-400 sm:flex-col sm:items-end sm:gap-1">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {step.latencyMs.toLocaleString()} ms
                        </span>
                        <span>{step.tokens.toLocaleString()} tok</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className={`mt-5 rounded-md border p-4 ${
              result.status === 'completed'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                : result.status === 'unsafe'
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
            }`}>
              <div className="flex items-start gap-3">
                {result.status === 'completed' ? (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                ) : result.status === 'unsafe' ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden />
                ) : (
                  <Ban className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                )}
                <div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">Observed consequence</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.outcome}</p>
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                    Fixture pricing: $4 per million input-equivalent tokens plus $0.001 per tool call. Replace these
                    assumptions with measured provider and infrastructure costs.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Task result', score: result.taskScore, icon: CheckCircle2 },
                { label: 'Safety', score: result.safetyScore, icon: ShieldCheck },
                { label: 'Efficiency', score: result.efficiencyScore, icon: Activity },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-200">
                        <Icon className="h-4 w-4" aria-hidden />
                        {metric.label}
                      </span>
                      <span className="font-mono text-sm font-bold text-neutral-950 dark:text-white">{metric.score}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${metric.score >= evaluationThreshold ? 'bg-emerald-600' : metric.score >= 60 ? 'bg-amber-500' : 'bg-rose-600'}`}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6">
        <SectionLabel
          step="Implementation"
          title="Carry the control contract into code"
          description="These co-located examples are vendor-neutral teaching fixtures. They make authority checks, bounded retries, configuration, and evaluation explicit."
          icon={Terminal}
        />
        <div className="mt-5">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Implementation examples">
            {CODE_EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                role="tab"
                aria-selected={codeExample === example.id}
                onClick={() => setCodeExample(example.id)}
                className={`min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  codeExample === example.id
                    ? 'border-indigo-600 bg-indigo-700 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                }`}
              >
                {example.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-3 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <CodeBlock
              key={selectedCode.id}
              language={selectedCode.language}
              title={selectedCode.title}
              file={selectedCode.file}
            />
          </div>
        </div>

        <details className="group mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-white">
            Model assumptions and limits
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600 marker:text-indigo-600 dark:text-neutral-300 dark:marker:text-indigo-400">
            <li>Latency, token, evaluation, and cost values are deterministic teaching fixtures, not production benchmarks.</li>
            <li>The trace records decisions, tool arguments, approvals, and outcomes. It does not expose hidden model reasoning.</li>
            <li>Real systems must enforce authentication, tenant isolation, idempotency, rate limits, and tool-side validation independently.</li>
            <li>Evaluation scores illustrate release gates; they need domain-specific test sets and observed production outcomes.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
