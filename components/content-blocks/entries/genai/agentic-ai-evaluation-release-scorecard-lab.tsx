'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  CircleAlert,
  Footprints,
  Gauge,
  ShieldAlert,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface EvaluationScenario {
  id: string;
  label: string;
  detail: string;
  selfReportedCompletion: number;
  verifiedCompletion: number;
  boundaryViolationRate: number;
  toolErrorRate: number;
  p95Steps: number;
  recoveryRate: number;
  costPerRun: number;
}

interface ScorecardData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    sampleSize: number;
    stepBudget: number;
  };
  gates: {
    minVerifiedCompletionLower: number;
    maxFalseSuccessGap: number;
    maxBoundaryViolationUpper: number;
    maxToolErrorRate: number;
    minRecoveryRate: number;
  };
  scenarios: EvaluationScenario[];
}

type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

const BLOCK_ID = 'genai/agentic-ai-evaluation-release-scorecard-lab';

function isScorecardData(value: unknown): value is ScorecardData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScorecardData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.gates
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function wilsonBounds(successes: number, total: number) {
  if (total <= 0) return { lower: 0, upper: 1 };
  const z = 1.96;
  const rate = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = rate + (z * z) / (2 * total);
  const spread = z * Math.sqrt((rate * (1 - rate)) / total + (z * z) / (4 * total * total));
  return {
    lower: Math.max(0, (center - spread) / denominator),
    upper: Math.min(1, (center + spread) / denominator),
  };
}

const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export default function AgenticAiEvaluationReleaseScorecardLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No trajectory evidence model was supplied.');
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
        if (!isScorecardData(payload)) throw new Error('Trajectory evidence is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load trajectory evidence.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Evaluation data unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading trajectory evidence" detail="Preparing scorecard scenarios..." />;
  return <ScorecardLab data={data} />;
}

function ScorecardLab({ data }: { data: ScorecardData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [sampleSize, setSampleSize] = useState(data.defaults.sampleSize);
  const [stepBudget, setStepBudget] = useState(data.defaults.stepBudget);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const result = useMemo(() => {
    const verifiedSuccesses = Math.round(scenario.verifiedCompletion * sampleSize);
    const verifiedBounds = wilsonBounds(verifiedSuccesses, sampleSize);
    const boundaryFailures = Math.round(scenario.boundaryViolationRate * sampleSize);
    const boundaryBounds = wilsonBounds(boundaryFailures, sampleSize);
    const falseSuccessGap = Math.max(
      0,
      scenario.selfReportedCompletion - scenario.verifiedCompletion,
    );

    const checks = [
      {
        label: 'Verified completion',
        passed: verifiedBounds.lower >= data.gates.minVerifiedCompletionLower,
        detail: `${percent(verifiedBounds.lower)} conservative lower bound`,
      },
      {
        label: 'False-success gap',
        passed: falseSuccessGap <= data.gates.maxFalseSuccessGap,
        detail: `${percent(falseSuccessGap)} claim-to-state gap`,
      },
      {
        label: 'Permission safety',
        passed: boundaryBounds.upper <= data.gates.maxBoundaryViolationUpper,
        detail: `${percent(boundaryBounds.upper)} violation upper bound`,
      },
      {
        label: 'Tool reliability',
        passed: scenario.toolErrorRate <= data.gates.maxToolErrorRate,
        detail: `${percent(scenario.toolErrorRate)} tool error rate`,
      },
      {
        label: 'Recovery behavior',
        passed: scenario.recoveryRate >= data.gates.minRecoveryRate,
        detail: `${percent(scenario.recoveryRate)} successful recovery`,
      },
      {
        label: 'Trajectory budget',
        passed: scenario.p95Steps <= stepBudget,
        detail: `${scenario.p95Steps} p95 steps against ${stepBudget}`,
      },
    ];
    const failed = checks.filter((check) => !check.passed);
    const verdict = failed.length === 0
      ? 'Ready for a bounded production canary'
      : failed.length <= 2
        ? 'Hold and repair the failed evidence gates'
        : 'Reject this agent configuration';

    return {
      boundaryUpper: boundaryBounds.upper,
      checks,
      failed,
      falseSuccessGap,
      verifiedLower: verifiedBounds.lower,
      verdict,
    };
  }, [data.gates, sampleSize, scenario, stepBudget]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setSampleSize(data.defaults.sampleSize);
    setStepBudget(data.defaults.stepBudget);
  };

  const verdictTone: Tone = result.failed.length === 0
    ? 'emerald'
    : result.failed.length <= 2
      ? 'amber'
      : 'rose';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trajectory release scorecard"
          title={data.title}
          description={data.description}
          icon={Target}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Agent behavior
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'controlled-run' ? BadgeCheck : CircleAlert}
                      accent={item.id === 'controlled-run' ? 'emerald' : 'amber'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Independent evaluation runs"
                value={sampleSize}
                output={sampleSize.toLocaleString()}
                min={100}
                max={2_000}
                step={100}
                accent="blue"
                lowLabel="Wide uncertainty"
                highLabel="Narrower bounds"
                onChange={setSampleSize}
              />

              <LabRange
                label="Allowed p95 trajectory steps"
                value={stepBudget}
                output={`${stepBudget} steps`}
                min={6}
                max={24}
                step={1}
                accent="violet"
                lowLabel="Tight budget"
                highLabel="More autonomy"
                onChange={setStepBudget}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${toneClasses[verdictTone]}`}>
              <div className="flex items-start gap-3">
                {result.failed.length === 0 ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release decision</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.failed.length === 0
                      ? 'The outcome, policy, recovery, reliability, and cost evidence agree. Keep exposure bounded while collecting production traces.'
                      : `${result.failed.length} of ${result.checks.length} independent gates fail. A strong average cannot cancel a failed safety or outcome contract.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Verified lower bound"
                value={percent(result.verifiedLower)}
                detail="Authoritative external state"
                icon={BadgeCheck}
                tone={result.checks[0].passed ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="False-success gap"
                value={percent(result.falseSuccessGap)}
                detail="Claimed minus verified completion"
                icon={CircleAlert}
                tone={result.checks[1].passed ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Violation upper bound"
                value={percent(result.boundaryUpper)}
                detail="Conservative permission risk"
                icon={ShieldAlert}
                tone={result.checks[2].passed ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Cost per run"
                value={`$${scenario.costPerRun.toFixed(2)}`}
                detail={`${scenario.p95Steps} p95 trajectory steps`}
                icon={Gauge}
                tone={scenario.p95Steps <= stepBudget ? 'violet' : 'amber'}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Activity aria-hidden="true" className="h-4 w-4" />
                Independent evidence gates
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {result.checks.map((check, index) => (
                  <div
                    key={check.label}
                    className={`rounded-md border p-4 ${check.passed ? toneClasses.emerald : toneClasses.rose}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{check.label}</p>
                        <p className="mt-1 text-xs leading-5 opacity-75">{check.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <Footprints aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">How to read this scorecard</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    More runs narrow statistical uncertainty, but they do not fix repeated tool errors, unsafe actions, poor recovery, or an oversized trajectory. Improve the agent or its controls instead of averaging those failures away.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50',
  violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
};

function LabState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
