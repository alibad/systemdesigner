'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  Route,
  ShieldAlert,
  TriangleAlert,
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

type Strategy = {
  id: string;
  label: string;
  detail: string;
  planningMs: number;
  maxUsefulSteps: number;
  coordinationRisk: number;
};

type AgentTool = {
  id: string;
  label: string;
  detail: string;
  capability: string;
  latencyMs: number;
  authority: number;
};

type Task = {
  id: string;
  label: string;
  brief: string;
  requiredCapabilities: string[];
  steps: number;
  defaultStrategyId: string;
  defaultToolIds: string[];
  defaultIterations: number;
  latencyBudgetMs: number;
  consequence: string;
};

type RoutingModel = {
  title: string;
  description: string;
  strategies: Strategy[];
  tools: AgentTool[];
  tasks: Task[];
};

const BLOCK_ID = 'genai/ai-agents-planning-tool-routing-lab';

export default function AiAgentsPlanningToolRoutingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RoutingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No planning and routing model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RoutingModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the routing model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <PlanningToolRoutingLab data={data} />;
}

function PlanningToolRoutingLab({ data }: { data: RoutingModel }) {
  const initialTask = data.tasks[0];
  const [taskId, setTaskId] = useState(initialTask?.id ?? '');
  const [strategyId, setStrategyId] = useState(initialTask?.defaultStrategyId ?? '');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    initialTask?.defaultToolIds ?? [],
  );
  const [iterations, setIterations] = useState(initialTask?.defaultIterations ?? 1);

  const task = data.tasks.find((candidate) => candidate.id === taskId) ?? initialTask;
  const strategy =
    data.strategies.find((candidate) => candidate.id === strategyId) ?? data.strategies[0];
  const selectedTools = data.tools.filter((tool) => selectedToolIds.includes(tool.id));

  const result = useMemo(() => {
    if (!task || !strategy) return null;

    const coveredCapabilities = task.requiredCapabilities.filter((capability) =>
      selectedTools.some((tool) => tool.capability === capability),
    );
    const missingCapabilities = task.requiredCapabilities.filter(
      (capability) => !coveredCapabilities.includes(capability),
    );
    const unnecessaryTools = selectedTools.filter(
      (tool) => !task.requiredCapabilities.includes(tool.capability),
    );
    const coverage = Math.round(
      (coveredCapabilities.length / Math.max(1, task.requiredCapabilities.length)) * 100,
    );
    const strategyFits = strategy.maxUsefulSteps >= task.steps;
    const stepBudgetFits = iterations >= task.steps;
    const latencyMs =
      strategy.planningMs +
      selectedTools.reduce((total, tool) => total + tool.latencyMs, 0) +
      Math.min(iterations, task.steps + 2) * 120;
    const withinLatency = latencyMs <= task.latencyBudgetMs;
    const passedChecks = [
      coverage === 100,
      strategyFits,
      stepBudgetFits,
      withinLatency,
    ].filter(Boolean).length;
    const readiness = Math.round((passedChecks / 4) * 100);
    const exposureScore =
      selectedTools.reduce((total, tool) => total + tool.authority, 0) +
      strategy.coordinationRisk +
      unnecessaryTools.length * 2;
    const exposure = exposureScore <= 2 ? 'Low' : exposureScore <= 6 ? 'Managed' : 'High';

    let status = 'Ready to execute';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (coverage < 100) {
      status = 'Missing capability';
      tone = 'rose';
    } else if (!strategyFits || !stepBudgetFits) {
      status = 'Will stop incomplete';
      tone = 'rose';
    } else if (!withinLatency) {
      status = 'Over latency budget';
      tone = 'amber';
    } else if (exposure === 'High') {
      status = 'Capable, over-authorized';
      tone = 'amber';
    }

    return {
      coverage,
      missingCapabilities,
      unnecessaryTools,
      strategyFits,
      stepBudgetFits,
      latencyMs,
      withinLatency,
      readiness,
      exposure,
      status,
      tone,
    };
  }, [iterations, selectedTools, strategy, task]);

  if (!task || !strategy || !result) {
    return <LabError detail="The routing model has no usable task or strategy." />;
  }

  const chooseTask = (nextTask: Task) => {
    setTaskId(nextTask.id);
    setStrategyId(nextTask.defaultStrategyId);
    setSelectedToolIds(nextTask.defaultToolIds);
    setIterations(nextTask.defaultIterations);
  };

  const toggleTool = (toolId: string) => {
    setSelectedToolIds((current) =>
      current.includes(toolId)
        ? current.filter((candidate) => candidate !== toolId)
        : [...current, toolId],
    );
  };

  const reset = () => {
    if (!initialTask) return;
    chooseTask(initialTask);
  };

  const StatusIcon = result.tone === 'emerald' ? CheckCircle2 : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Planning and tool-routing lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the task contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.tasks.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === task.id}
                      label={candidate.label}
                      detail={candidate.brief}
                      icon={Gauge}
                      accent="blue"
                      onClick={() => chooseTask(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the execution shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === strategy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={BrainCircuit}
                      accent="violet"
                      onClick={() => setStrategyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Delegate capabilities
                </legend>
                <div className="mt-3 space-y-2">
                  {data.tools.map((tool) => (
                    <LabChoice
                      key={tool.id}
                      selected={selectedToolIds.includes(tool.id)}
                      label={tool.label}
                      detail={tool.detail}
                      icon={Wrench}
                      accent="cyan"
                      onClick={() => toggleTool(tool.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Maximum loop iterations"
                value={iterations}
                output={`${iterations} steps`}
                min={1}
                max={12}
                accent="amber"
                lowLabel="Fast stop"
                highLabel="More autonomy"
                onChange={setIterations}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Route readiness"
                value={`${result.readiness}%`}
                detail="Capability, strategy, step budget, and latency checks passed."
                icon={StatusIcon}
                tone={result.tone}
              />
              <LabMetric
                label="Capability coverage"
                value={`${result.coverage}%`}
                detail={
                  result.missingCapabilities.length
                    ? `Missing: ${result.missingCapabilities.join(', ')}`
                    : 'Every required capability has a selected tool.'
                }
                icon={Wrench}
                tone={result.coverage === 100 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Estimated path latency"
                value={`${result.latencyMs} ms`}
                detail={`${result.withinLatency ? 'Inside' : 'Outside'} the ${task.latencyBudgetMs} ms task budget.`}
                icon={Clock3}
                tone={result.withinLatency ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Control exposure"
                value={result.exposure}
                detail={
                  result.unnecessaryTools.length
                    ? `Unneeded: ${result.unnecessaryTools.map((tool) => tool.label).join(', ')}`
                    : 'No unnecessary tool authority selected.'
                }
                icon={ShieldAlert}
                tone={result.exposure === 'High' ? 'rose' : result.exposure === 'Managed' ? 'amber' : 'emerald'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Visible execution path
              </p>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                <PathStep
                  number="1"
                  label="Frame"
                  value={`${task.steps} dependent step${task.steps === 1 ? '' : 's'}`}
                  state="active"
                />
                <PathStep
                  number="2"
                  label="Plan"
                  value={`${strategy.label}: up to ${strategy.maxUsefulSteps} useful steps`}
                  state={result.strategyFits ? 'active' : 'failed'}
                />
                <PathStep
                  number="3"
                  label="Route"
                  value={selectedTools.length ? selectedTools.map((tool) => tool.label).join(' + ') : 'No tools selected'}
                  state={result.coverage === 100 ? 'active' : 'failed'}
                />
                <PathStep
                  number="4"
                  label="Stop"
                  value={result.status}
                  state={result.tone === 'emerald' ? 'active' : 'warning'}
                />
              </ol>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                <StatusIcon aria-hidden="true" className="h-4 w-4" />
                Product consequence
              </div>
              <p className="mt-2 text-sm leading-6">
                {task.consequence}{' '}
                {result.status === 'Ready to execute'
                  ? 'The selected route can finish inside the declared contract.'
                  : result.status === 'Missing capability'
                    ? 'The loop cannot create the missing evidence by reasoning harder.'
                    : result.status === 'Will stop incomplete'
                      ? 'Increase only the planning or iteration capacity the task actually needs.'
                      : result.status === 'Over latency budget'
                        ? 'Use a faster route, move the work asynchronous, or change the product deadline explicitly.'
                        : 'Remove tools that the goal does not require before execution.'}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathStep({
  number,
  label,
  value,
  state,
}: {
  number: string;
  label: string;
  value: string;
  state: 'active' | 'warning' | 'failed';
}) {
  const classes = {
    active:
      'border-emerald-200 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white',
    warning:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    failed:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  };

  return (
    <li className={`min-w-0 rounded-md border p-3 ${classes[state]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        {label}
      </div>
      <p className="mt-3 break-words text-sm font-semibold leading-5">{value}</p>
    </li>
  );
}

function LabLoading() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[680px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading planning and tool-routing lab"
    />
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Planning and tool-routing lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
