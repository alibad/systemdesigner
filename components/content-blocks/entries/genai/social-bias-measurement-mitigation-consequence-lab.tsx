'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  FlaskConical,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  referenceHarmEvents: number;
  focusHarmEvents: number;
  qualityRetentionPct: number;
  falseInterventionPct: number;
  addedLatencyMs: number;
  candidateGenerationsPerRequest: number;
  operationalNote: string;
};

type MitigationData = {
  defaultStrategyId: string;
  defaultSamplesPerPrompt: number;
  samplesMin: number;
  samplesMax: number;
  promptsPerGroup: number;
  withinPromptCorrelation: number;
  tokensPerEvaluationGeneration: number;
  fairnessGapThresholdPct: number;
  qualityRetentionFloorPct: number;
  falseInterventionCeilingPct: number;
  strategies: Strategy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/social-bias-measurement/data/mitigation-consequences.json';

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPoints(value: number) {
  return `${(value * 100).toFixed(1)} pp`;
}

function formatTokenCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

function isMitigationData(value: unknown): value is MitigationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MitigationData>;
  return Array.isArray(candidate.strategies)
    && candidate.strategies.length > 0
    && typeof candidate.promptsPerGroup === 'number'
    && typeof candidate.withinPromptCorrelation === 'number'
    && typeof candidate.fairnessGapThresholdPct === 'number'
    && typeof candidate.defaultStrategyId === 'string';
}

export default function SocialBiasMeasurementMitigationConsequenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MitigationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [strategyId, setStrategyId] = useState('');
  const [samplesPerPrompt, setSamplesPerPrompt] = useState(2);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const payload = (await response.json()) as unknown;
        if (!isMitigationData(payload)) throw new Error('Mitigation data is incomplete.');

        if (active) {
          setData(payload);
          setStrategyId(payload.defaultStrategyId);
          setSamplesPerPrompt(payload.defaultSamplesPerPrompt);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load mitigation data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const strategy = data?.strategies.find((item) => item.id === strategyId) ?? data?.strategies[0];

  const model = useMemo(() => {
    if (!data || !strategy) return null;

    const denominatorPerGroup = data.promptsPerGroup * samplesPerPrompt;
    const referenceEvents = strategy.referenceHarmEvents * samplesPerPrompt;
    const focusEvents = strategy.focusHarmEvents * samplesPerPrompt;
    const referenceRate = referenceEvents / denominatorPerGroup;
    const focusRate = focusEvents / denominatorPerGroup;
    const gap = focusRate - referenceRate;
    const designEffect = 1 + (samplesPerPrompt - 1) * data.withinPromptCorrelation;
    const effectiveDenominatorPerGroup = denominatorPerGroup / designEffect;
    const standardError = Math.sqrt(
      focusRate * (1 - focusRate) / effectiveDenominatorPerGroup
      + referenceRate * (1 - referenceRate) / effectiveDenominatorPerGroup,
    );
    const gapLower = Math.max(-1, gap - 1.96 * standardError);
    const gapUpper = Math.min(1, gap + 1.96 * standardError);
    const fairnessThreshold = data.fairnessGapThresholdPct / 100;
    const fairnessState = gapLower > fairnessThreshold
      ? 'fail'
      : gapUpper > fairnessThreshold
        ? 'uncertain'
        : 'pass';
    const qualityPass = strategy.qualityRetentionPct >= data.qualityRetentionFloorPct;
    const interventionPass = strategy.falseInterventionPct <= data.falseInterventionCeilingPct;
    const evaluationGenerations = denominatorPerGroup * 2;
    const evaluationTokens = evaluationGenerations * data.tokensPerEvaluationGeneration;

    let decision = 'Eligible for bounded canary';
    let decisionState: 'pass' | 'hold' | 'block' = 'pass';
    let explanation = 'The fairness interval is below the declared gap, and the mitigation remains inside quality and false-intervention limits.';

    if (!qualityPass || !interventionPass) {
      decision = 'Reject this mitigation policy';
      decisionState = 'block';
      explanation = 'A lower harm gap does not compensate for violating the useful-answer or false-intervention contract.';
    } else if (fairnessState === 'fail') {
      decision = 'Block and remediate the harm path';
      decisionState = 'block';
      explanation = 'The plausible gap remains above the fairness threshold. Sampling more can strengthen that conclusion, but it does not change deployed behavior.';
    } else if (fairnessState === 'uncertain') {
      decision = 'Hold for more independent evidence';
      decisionState = 'hold';
      explanation = 'The current interval crosses the fairness threshold. Increase independent prompt coverage and audit scorer validity before deployment.';
    }

    return {
      decision,
      decisionState,
      denominatorPerGroup,
      effectiveDenominatorPerGroup,
      evaluationGenerations,
      evaluationTokens,
      explanation,
      fairnessState,
      focusEvents,
      focusRate,
      gap,
      gapLower,
      gapUpper,
      interventionPass,
      qualityPass,
      referenceEvents,
      referenceRate,
    };
  }, [data, samplesPerPrompt, strategy]);

  function reset() {
    if (!data) return;
    setStrategyId(data.defaultStrategyId);
    setSamplesPerPrompt(data.defaultSamplesPerPrompt);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Sampling and mitigation consequences"
        title="Separate confidence from deployed behavior"
        description="Choose a product mitigation, then change evaluation samples per prompt. Sampling changes denominator, uncertainty, and evaluation cost; mitigation changes harm, latency, utility, and false interventions."
        icon={ShieldCheck}
        accent="emerald"
        onReset={data ? reset : undefined}
      />

      {!data || !strategy || !model ? (
        <LoadState
          error={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose deployment mitigation
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === strategy.id}
                      label={option.label}
                      detail={option.detail}
                      icon={ShieldCheck}
                      accent={option.id === 'broad-refusal' ? 'amber' : 'emerald'}
                      onClick={() => setStrategyId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Evaluation samples per prompt"
                value={samplesPerPrompt}
                output={`${samplesPerPrompt}`}
                min={data.samplesMin}
                max={data.samplesMax}
                step={1}
                lowLabel="Low precision"
                highLabel="Higher cost"
                accent="blue"
                onChange={setSamplesPerPrompt}
              />

              <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
                <p className="font-semibold text-neutral-950 dark:text-white">What this control cannot do</p>
                <p className="mt-2 leading-6 text-neutral-600 dark:text-neutral-300">
                  More evaluation samples do not reduce the deployed harm rate. They only change how precisely this run estimates it.
                </p>
              </div>
            </div>
          )}
        >
          <div className="min-h-[620px] min-w-0">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Observed harm gap"
                value={formatPoints(model.gap)}
                detail={`95% range ${formatPoints(model.gapLower)} to ${formatPoints(model.gapUpper)}`}
                icon={Gauge}
                tone={model.fairnessState === 'pass' ? 'emerald' : model.fairnessState === 'fail' ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Evidence denominator"
                value={(model.denominatorPerGroup * 2).toLocaleString()}
                detail={`Effective n about ${Math.round(model.effectiveDenominatorPerGroup * 2).toLocaleString()} after prompt correlation`}
                icon={FlaskConical}
                tone="blue"
              />
              <LabMetric
                label="Evaluation tokens"
                value={formatTokenCount(model.evaluationTokens)}
                detail={`${model.evaluationGenerations.toLocaleString()} generated samples`}
                icon={Coins}
                tone="violet"
              />
              <LabMetric
                label="Added product latency"
                value={`+${strategy.addedLatencyMs} ms`}
                detail={`${strategy.candidateGenerationsPerRequest} candidate generation${strategy.candidateGenerationsPerRequest === 1 ? '' : 's'} on the mitigated path`}
                icon={Clock3}
                tone={strategy.addedLatencyMs > 100 ? 'amber' : 'neutral'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Measured consequence
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {strategy.label}
                  </h4>
                </div>
                <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  Fairness gate {data.fairnessGapThresholdPct} pp
                </span>
              </div>

              <div className="mt-5 space-y-5">
                <OutcomeBar
                  label="Reference harm rate"
                  events={model.referenceEvents}
                  total={model.denominatorPerGroup}
                  rate={model.referenceRate}
                  tone="bg-blue-500"
                />
                <OutcomeBar
                  label="Focus harm rate"
                  events={model.focusEvents}
                  total={model.denominatorPerGroup}
                  rate={model.focusRate}
                  tone="bg-rose-500"
                />
              </div>

              <p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {strategy.operationalNote}
              </p>
            </section>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ContractGauge
                label="Useful answers retained"
                value={strategy.qualityRetentionPct}
                threshold={data.qualityRetentionFloorPct}
                thresholdLabel="minimum"
                passes={model.qualityPass}
              />
              <ContractGauge
                label="False interventions"
                value={strategy.falseInterventionPct}
                threshold={data.falseInterventionCeilingPct}
                thresholdLabel="maximum"
                passes={model.interventionPass}
              />
            </div>

            <div
              className={`mt-5 rounded-md border p-5 ${
                model.decisionState === 'pass'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : model.decisionState === 'hold'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {model.decisionState === 'pass' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.decisionState === 'hold' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {model.explanation}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Synthetic teaching model. The interval applies a {data.withinPromptCorrelation.toFixed(2)} within-prompt correlation to show diminishing evidence; production analysis should use a prompt-cluster bootstrap.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function OutcomeBar({
  label,
  events,
  total,
  rate,
  tone,
}: {
  label: string;
  events: number;
  total: number;
  rate: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-neutral-900 dark:text-white">{label}</span>
        <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
          {events.toLocaleString()} / {total.toLocaleString()} = {formatPercent(rate)}
        </span>
      </div>
      <div
        className="mt-2 h-5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate * 100}
      >
        <div className={`h-full ${tone}`} style={{ width: `${rate * 100}%` }} />
      </div>
    </div>
  );
}

function ContractGauge({
  label,
  value,
  threshold,
  thresholdLabel,
  passes,
}: {
  label: string;
  value: number;
  threshold: number;
  thresholdLabel: string;
  passes: boolean;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Contract {thresholdLabel}: {threshold}%
          </p>
        </div>
        <span className={`text-lg font-semibold tabular-nums ${passes ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {value}%
        </span>
      </div>
      <div className="relative mt-4 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full ${passes ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${value}%` }} />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
          style={{ left: `${threshold}%` }}
        />
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[600px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Mitigation evidence could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-emerald-500 motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading mitigation evidence...
          </p>
        </div>
      )}
    </div>
  );
}
