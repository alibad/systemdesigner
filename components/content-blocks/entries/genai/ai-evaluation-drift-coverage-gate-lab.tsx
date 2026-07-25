'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface SamplingStrategy {
  id: string;
  label: string;
  detail: string;
  minimumAllocationPct: number;
  judgmentFactor: number;
}

interface CoverageScenario {
  id: string;
  label: string;
  detail: string;
  sliceLabel: string;
  trafficSharePct: number;
  baselinePassRatePct: number;
  currentPassRatePct: number;
  impact: 'moderate' | 'high' | 'critical';
  impactLabel: string;
}

interface CoverageData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
    dailySample: number;
    humanReviewPct: number;
  };
  gates: {
    minimumSliceCases: number;
    minimumHumanCases: number;
    maximumMarginPct: number;
    minimumReadinessPct: number;
  };
  strategies: SamplingStrategy[];
  scenarios: CoverageScenario[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/ai-evaluation-drift/data/drift-coverage-scenarios.json';
const BLOCK_ID = 'genai/ai-evaluation-drift-coverage-gate-lab';

function isCoverageData(value: unknown): value is CoverageData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CoverageData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && data.gates
      && Array.isArray(data.strategies)
      && data.strategies.length > 0
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.strategies.every((strategy) => (
        typeof strategy.id === 'string'
        && typeof strategy.minimumAllocationPct === 'number'
        && typeof strategy.judgmentFactor === 'number'
      ))
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.trafficSharePct === 'number'
        && typeof scenario.baselinePassRatePct === 'number'
        && typeof scenario.currentPassRatePct === 'number'
      )),
  );
}

const clamp = (value: number, minimum = 0, maximum = 100) => (
  Math.min(maximum, Math.max(minimum, value))
);

export default function AiEvaluationDriftCoverageGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [dailySample, setDailySample] = useState(800);
  const [humanReviewPct, setHumanReviewPct] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isCoverageData(payload)) throw new Error('Drift coverage data is incomplete.');

        if (active) {
          setData(payload);
          setScenarioId(payload.defaults.scenarioId);
          setStrategyId(payload.defaults.strategyId);
          setDailySample(payload.defaults.dailySample);
          setHumanReviewPct(payload.defaults.humanReviewPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load coverage data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const strategy = data?.strategies.find((item) => item.id === strategyId)
    ?? data?.strategies[0];

  const model = useMemo(() => {
    if (!data || !scenario || !strategy) return null;

    const evaluationSharePct = Math.max(
      scenario.trafficSharePct,
      strategy.minimumAllocationPct,
    );
    const sliceCases = Math.max(1, Math.round(dailySample * evaluationSharePct / 100));
    const humanCases = Math.max(1, Math.round(sliceCases * humanReviewPct / 100));
    const passRate = scenario.currentPassRatePct / 100;
    const marginPct = 1.96 * Math.sqrt(passRate * (1 - passRate) / sliceCases) * 100;
    const regressionPct = scenario.baselinePassRatePct - scenario.currentPassRatePct;
    const signalToNoise = regressionPct / Math.max(marginPct, 0.5);
    const statisticalEvidence = clamp(signalToNoise / 1.5 * 100);
    const caseCoverage = clamp(sliceCases / data.gates.minimumSliceCases * 100);
    const humanCoverage = clamp(
      humanCases / data.gates.minimumHumanCases * 100 * strategy.judgmentFactor,
    );
    const precisionCoverage = clamp(data.gates.maximumMarginPct / marginPct * 100);
    const readinessPct = Math.round(Math.min(
      statisticalEvidence,
      caseCoverage,
      humanCoverage,
      precisionCoverage,
    ));
    const ready = readinessPct >= data.gates.minimumReadinessPct;
    const decision = !ready
      ? 'Cap exposure and gather targeted evidence'
      : scenario.impact === 'critical'
        ? 'Block the affected path and investigate'
        : 'Hold the candidate while the regression is diagnosed';
    const recommendation = !ready
      ? `This plan expects ${sliceCases} ${scenario.sliceLabel} cases and ${humanCases} calibrated reviews. Increase targeted allocation or review before treating a missing alert as evidence of safety.`
      : `The plan has enough modeled evidence to act on a ${regressionPct.toFixed(1)}-point regression. Preserve the cases, join versioned traces, and contain the affected path.`;

    return {
      decision,
      evaluationSharePct,
      humanCases,
      marginPct,
      ready,
      readinessPct,
      recommendation,
      regressionPct,
      sliceCases,
    };
  }, [dailySample, data, humanReviewPct, scenario, strategy]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setStrategyId(data.defaults.strategyId);
    setDailySample(data.defaults.dailySample);
    setHumanReviewPct(data.defaults.humanReviewPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Slice coverage planner"
          title={data?.title ?? 'Allocate evidence before a rare regression escapes'}
          description={data?.description ?? 'Loading the slice sampling model...'}
          icon={Target}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !strategy || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Production slice
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.impact === 'critical' ? ShieldCheck : Activity}
                        accent={item.impact === 'critical' ? 'rose' : item.impact === 'high' ? 'amber' : 'blue'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Sampling policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.strategies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === strategy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Users}
                        accent={item.id === 'random' ? 'cyan' : item.id === 'stratified' ? 'violet' : 'emerald'}
                        onClick={() => setStrategyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Daily evaluated cases"
                  value={dailySample}
                  output={dailySample.toLocaleString()}
                  min={200}
                  max={5_000}
                  step={100}
                  accent="blue"
                  lowLabel="Small budget"
                  highLabel="Broad evidence"
                  onChange={setDailySample}
                />

                <LabRange
                  label="4. Human calibration share"
                  value={humanReviewPct}
                  output={`${humanReviewPct}%`}
                  min={2}
                  max={40}
                  step={1}
                  accent="amber"
                  lowLabel="Sparse audit"
                  highLabel="Deep review"
                  onChange={setHumanReviewPct}
                />
              </div>
            )}
          >
            <div className="min-h-[680px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Expected slice cases"
                  value={model.sliceCases.toLocaleString()}
                  detail={`${model.evaluationSharePct.toFixed(0)}% of the evaluation portfolio`}
                  icon={Users}
                  tone={model.sliceCases >= data.gates.minimumSliceCases ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="95% margin"
                  value={`+/-${model.marginPct.toFixed(1)} pts`}
                  detail={`Target at most +/-${data.gates.maximumMarginPct} points`}
                  icon={Gauge}
                  tone={model.marginPct <= data.gates.maximumMarginPct ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Human calibration"
                  value={`${model.humanCases} cases`}
                  detail={`Target at least ${data.gates.minimumHumanCases} reviewed cases`}
                  icon={ShieldCheck}
                  tone={model.humanCases >= data.gates.minimumHumanCases ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Decision readiness"
                  value={`${model.readinessPct}%`}
                  detail={`Action threshold: ${data.gates.minimumReadinessPct}%`}
                  icon={Target}
                  tone={model.ready ? 'emerald' : 'rose'}
                />
              </div>

              <section className="mt-5" aria-label="Traffic and evaluation allocation comparison">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Representation check
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {scenario.sliceLabel}: traffic share versus evidence share
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {scenario.impactLabel}. The evaluation blend may intentionally differ from traffic, but fleet reporting must preserve sampling weights.
                </p>

                <div className="mt-4 space-y-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <AllocationBar
                    label="Production traffic"
                    value={scenario.trafficSharePct}
                    tone="cyan"
                  />
                  <AllocationBar
                    label="Evaluation allocation"
                    value={model.evaluationSharePct}
                    tone="violet"
                  />
                </div>
              </section>

              <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Evidence pipeline">
                <PipelineStage
                  label="Sample"
                  value={`${dailySample.toLocaleString()} total`}
                  detail={`${model.sliceCases} from the decision slice`}
                />
                <PipelineStage
                  label="Calibrate"
                  value={`${model.humanCases} reviewed`}
                  detail={`${humanReviewPct}% of slice evidence`}
                />
                <PipelineStage
                  label="Detect"
                  value={`${model.regressionPct.toFixed(1)}-pt change`}
                  detail={`Modeled uncertainty +/-${model.marginPct.toFixed(1)} points`}
                />
              </section>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.ready
                  ? scenario.impact === 'critical'
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
                  : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.ready ? (
                    scenario.impact === 'critical' ? (
                      <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                    )
                  ) : (
                    <Activity aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-blue-700 dark:text-blue-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {model.recommendation}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      This teaching model uses a normal approximation and expected allocations. Real gates should account for dependence, weighting, delayed labels, multiple testing, evaluator error, and the cost of false decisions.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function AllocationBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'cyan' | 'violet';
}) {
  const fill = tone === 'cyan'
    ? 'bg-cyan-500 dark:bg-cyan-400'
    : 'bg-violet-500 dark:bg-violet-400';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-800 dark:text-neutral-100">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">{value.toFixed(0)}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${fill}`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function PipelineStage({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-base font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[360px] place-items-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Coverage data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading coverage model...</p>}
      </div>
    </LearningLabBody>
  );
}
