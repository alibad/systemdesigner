'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  CircleAlert,
  Clock3,
  Coins,
  Gauge,
  GitBranch,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StageKind = 'generate' | 'branch' | 'tool' | 'verify' | 'review';
type ResultTone = 'emerald' | 'amber' | 'rose' | 'violet';

interface BudgetStage {
  id: string;
  label: string;
  purpose: string;
  latencyMs: number;
  costUnits: number;
  kind: StageKind;
}

interface ReasoningPolicy {
  id: string;
  label: string;
  detail: string;
  confidenceLift: number;
  evidenceCoverage: number;
  includesHumanReview: boolean;
  stages: BudgetStage[];
}

interface BudgetScenario {
  id: string;
  label: string;
  detail: string;
  risk: string;
  baselineConfidence: number;
  targetConfidence: number;
  deadlineMs: number;
  costCeiling: number;
  evidenceFloor: number;
  requiresHumanReview: boolean;
  recommendedPolicyId: string;
  decisionNote: string;
}

interface BudgetLabData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
  };
  scenarios: BudgetScenario[];
  policies: ReasoningPolicy[];
}

const BLOCK_ID = 'genai/inference-time-scaling-budget-allocation-lab';

const stageStyles: Record<StageKind, { bar: string; border: string; icon: LucideIcon }> = {
  generate: {
    bar: 'bg-blue-500 dark:bg-blue-400',
    border: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    icon: BrainCircuit,
  },
  branch: {
    bar: 'bg-violet-500 dark:bg-violet-400',
    border: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30',
    icon: GitBranch,
  },
  tool: {
    bar: 'bg-cyan-500 dark:bg-cyan-400',
    border: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30',
    icon: Search,
  },
  verify: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    border: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    icon: ShieldCheck,
  },
  review: {
    bar: 'bg-rose-500 dark:bg-rose-400',
    border: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
    icon: UserCheck,
  },
};

function isBudgetLabData(value: unknown): value is BudgetLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BudgetLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && Array.isArray(policy.stages)
        && policy.stages.length > 0
      )),
  );
}

function formatSeconds(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(milliseconds % 1000 === 0 ? 0 : 1)}s`;
}

export default function InferenceTimeScalingBudgetAllocationLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BudgetLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No reasoning budget model was supplied.');
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
        if (!isBudgetLabData(payload)) throw new Error('Reasoning budget data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load reasoning budget data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <BudgetAllocationLab data={data} />;
}

function BudgetAllocationLab({ data }: { data: BudgetLabData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [deadlineMs, setDeadlineMs] = useState(initialScenario.deadlineMs);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const latencyMs = policy.stages.reduce((total, stage) => total + stage.latencyMs, 0);
    const costUnits = policy.stages.reduce((total, stage) => total + stage.costUnits, 0);
    const confidence = Math.min(99, scenario.baselineConfidence + policy.confidenceLift);
    const deadlinePass = latencyMs <= deadlineMs;
    const costPass = costUnits <= scenario.costCeiling;
    const confidencePass = confidence >= scenario.targetConfidence;
    const evidencePass = policy.evidenceCoverage >= scenario.evidenceFloor;
    const reviewPass = !scenario.requiresHumanReview || policy.includesHumanReview;
    const viable = deadlinePass && costPass && confidencePass && evidencePass && reviewPass;

    let verdict = 'Policy fits the decision contract';
    let detail = scenario.decisionNote;
    let tone: ResultTone = policy.id === scenario.recommendedPolicyId ? 'emerald' : 'amber';

    if (!deadlinePass) {
      verdict = 'The critical path misses the deadline';
      detail = `The route needs ${formatSeconds(latencyMs)}, but the request stops at ${formatSeconds(deadlineMs)}.`;
      tone = 'rose';
    } else if (!costPass) {
      verdict = 'The route breaks the cost ceiling';
      detail = `This policy spends ${costUnits.toFixed(1)} units against a ${scenario.costCeiling.toFixed(1)} unit ceiling.`;
      tone = 'rose';
    } else if (!reviewPass) {
      verdict = 'Automation cannot satisfy the ownership rule';
      detail = 'The request requires accountable review before an answer may be accepted.';
      tone = 'violet';
    } else if (!evidencePass) {
      verdict = 'The policy stops with too little evidence';
      detail = `Evidence coverage reaches ${policy.evidenceCoverage}%, below the ${scenario.evidenceFloor}% floor.`;
      tone = 'rose';
    } else if (!confidencePass) {
      verdict = 'The measured quality proxy stays below target';
      detail = `Projected confidence reaches ${confidence}%, below the ${scenario.targetConfidence}% target for this slice.`;
      tone = 'amber';
    } else if (policy.id !== scenario.recommendedPolicyId) {
      verdict = 'Viable, but not the measured default';
      detail = `${scenario.decisionNote} Compare this route with the recommended policy at matched quality.`;
    }

    return {
      confidence,
      costPass,
      costUnits,
      deadlinePass,
      detail,
      evidencePass,
      latencyMs,
      reviewPass,
      tone,
      verdict,
      viable,
    };
  }, [deadlineMs, policy, scenario]);

  const reset = () => {
    setScenarioId(initialScenario.id);
    setPolicyId(data.defaults.policyId);
    setDeadlineMs(initialScenario.deadlineMs);
  };

  const selectScenario = (next: BudgetScenario) => {
    setScenarioId(next.id);
    setPolicyId(next.recommendedPolicyId);
    setDeadlineMs(next.deadlineMs);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Reasoning budget lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Decision context
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.requiresHumanReview ? UserCheck : item.id === 'code-migration' ? Workflow : Clock3}
                      accent={item.requiresHumanReview ? 'rose' : item.id === 'code-migration' ? 'violet' : 'blue'}
                      onClick={() => selectScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Runtime policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={policy.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.includesHumanReview ? UserCheck : item.stages.length > 1 ? GitBranch : BrainCircuit}
                      accent={item.id === scenario.recommendedPolicyId ? 'emerald' : 'amber'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Request deadline"
                value={deadlineMs}
                output={formatSeconds(deadlineMs)}
                min={1000}
                max={15000}
                step={500}
                accent="amber"
                lowLabel="1s"
                highLabel="15s"
                onChange={setDeadlineMs}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Critical path"
                value={formatSeconds(result.latencyMs)}
                detail={`${formatSeconds(deadlineMs)} request deadline`}
                icon={Clock3}
                tone={result.deadlinePass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Runtime spend"
                value={`${result.costUnits.toFixed(1)} units`}
                detail={`${scenario.costCeiling.toFixed(1)} unit ceiling`}
                icon={Coins}
                tone={result.costPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Quality proxy"
                value={`${result.confidence}%`}
                detail={`${scenario.targetConfidence}% slice target`}
                icon={BrainCircuit}
                tone={result.confidence >= scenario.targetConfidence ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Evidence coverage"
                value={`${policy.evidenceCoverage}%`}
                detail={`${scenario.evidenceFloor}% acceptance floor`}
                icon={ShieldCheck}
                tone={result.evidencePass ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Shared request envelope
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {policy.label}
                  </h4>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {scenario.risk} · {scenario.requiresHumanReview ? 'Human review required' : 'Automatic acceptance permitted'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${result.viable
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'}`}
                >
                  {result.viable ? 'Contract satisfied' : 'Contract broken'}
                </span>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label="Latency allocation by stage">
                <div className="flex h-full w-full">
                  {policy.stages.map((stage) => (
                    <div
                      key={stage.id}
                      className={`${stageStyles[stage.kind].bar} min-w-1 transition-[width] motion-reduce:transition-none`}
                      style={{ width: `${stage.latencyMs / result.latencyMs * 100}%` }}
                      title={`${stage.label}: ${formatSeconds(stage.latencyMs)}`}
                    />
                  ))}
                </div>
              </div>

              <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {policy.stages.map((stage, index) => {
                  const StageIcon = stageStyles[stage.kind].icon;
                  return (
                    <li key={stage.id} className={`min-w-0 rounded-md border p-4 ${stageStyles[stage.kind].border}`}>
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-neutral-800 shadow-sm dark:bg-neutral-950 dark:text-neutral-100">
                          <StageIcon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                            {index + 1}. {stage.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                            {formatSeconds(stage.latencyMs)} · {stage.costUnits.toFixed(1)} units
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {stage.purpose}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'violet'
                ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Routing consequence</p>
                  <p className="mt-2 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading reasoning budget model...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Reasoning budget lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
