'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  Gauge,
  LineChart,
  Scale,
  Sigma,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type MethodId = 'no-baseline' | 'value-baseline' | 'gae';

type MethodResult = {
  id: MethodId;
  label: string;
  estimator: string;
  variance: number;
  bias: number;
  efficiency: number;
  wait: string;
  explanation: string;
};

const METHODS: Record<
  MethodId,
  { label: string; detail: string; estimator: string }
> = {
  'no-baseline': {
    label: 'No baseline',
    detail: 'Weight each score by its Monte Carlo return.',
    estimator: 'G_t',
  },
  'value-baseline': {
    label: 'Value baseline',
    detail: 'Subtract V(s_t) from a sampled Monte Carlo return.',
    estimator: 'G_t − V(s_t)',
  },
  gae: {
    label: 'Advantage estimation',
    detail: 'Blend bootstrapped TD residuals with GAE(λ).',
    estimator: 'Σ(γλ)^k δ_{t+k}',
  },
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function ResultBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'rose' | 'amber' | 'emerald';
}) {
  const barTone = {
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }[tone];

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {value.toFixed(0)}/100
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full transition-[width] motion-reduce:transition-none ${barTone}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function PolicyGradientTheoremEstimatorLab() {
  const [methodId, setMethodId] = useState<MethodId>('gae');
  const [horizon, setHorizon] = useState(64);
  const [criticQualityPercent, setCriticQualityPercent] = useState(80);
  const [gaeLambda, setGaeLambda] = useState(0.95);

  const methods = useMemo<MethodResult[]>(() => {
    const horizonScale = (horizon - 8) / 120;
    const criticQuality = criticQualityPercent / 100;
    const noBaselineVariance = clamp(74 + 20 * horizonScale);
    const noBaselineEfficiency = clamp(34 - 13 * horizonScale, 15, 40);

    const valueVariance = clamp(
      noBaselineVariance * (0.82 - 0.54 * criticQuality),
      16,
      95,
    );
    const valueEfficiency = clamp(
      79 - 0.45 * valueVariance - 8 * horizonScale,
      30,
      78,
    );

    const gaeVariance = clamp(
      valueVariance * (0.44 + 0.52 * gaeLambda) +
        (1 - criticQuality) * 12,
      10,
      95,
    );
    const gaeBias = clamp(
      (1 - criticQuality) *
        ((1 - gaeLambda) * 70 + (1 - horizonScale) * 18),
      0,
      65,
    );
    const gaeEfficiency = clamp(
      92 - 0.52 * gaeVariance - 0.45 * gaeBias + (1 - horizonScale) * 5,
      25,
      92,
    );

    return [
      {
        id: 'no-baseline',
        label: METHODS['no-baseline'].label,
        estimator: METHODS['no-baseline'].estimator,
        variance: noBaselineVariance,
        bias: 0,
        efficiency: noBaselineEfficiency,
        wait: `${horizon} steps, then return`,
        explanation:
          'The on-policy Monte Carlo estimator is unbiased, but unrelated trajectory outcomes remain in every gradient weight. Longer trajectories amplify this variance.',
      },
      {
        id: 'value-baseline',
        label: METHODS['value-baseline'].label,
        estimator: METHODS['value-baseline'].estimator,
        variance: valueVariance,
        bias: 0,
        efficiency: valueEfficiency,
        wait: `${horizon} steps, then centered return`,
        explanation:
          'Subtracting an action-independent state baseline preserves the expected policy gradient. A more predictive critic removes more irrelevant variation.',
      },
      {
        id: 'gae',
        label: METHODS.gae.label,
        estimator: METHODS.gae.estimator,
        variance: gaeVariance,
        bias: gaeBias,
        efficiency: gaeEfficiency,
        wait: `${horizon}-step rollout + bootstrap`,
        explanation:
          gaeLambda < 0.5
            ? 'Short TD traces produce a cleaner signal quickly, but the estimate depends heavily on the critic and can inherit its error.'
            : gaeLambda > 0.9
              ? 'Long TD traces approach Monte Carlo advantages: critic bias matters less, while trajectory noise returns.'
              : 'Intermediate traces trade some critic dependence for lower variance than a near-Monte-Carlo estimate.',
      },
    ];
  }, [criticQualityPercent, gaeLambda, horizon]);

  const selected =
    methods.find((method) => method.id === methodId) ?? methods[2];

  const reset = () => {
    setMethodId('gae');
    setHorizon(64);
    setCriticQualityPercent(80);
    setGaeLambda(0.95);
  };

  return (
    <div data-content-block="ml-systems/policy-gradient-theorem-estimator-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Estimator consequence lab"
          title="Choose where variance reduction comes from"
          description="Compare the same rollout under raw Monte Carlo returns, an action-independent value baseline, and generalized advantage estimation."
          icon={BarChart3}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inspect an estimator
                </legend>
                <div className="mt-3 space-y-2">
                  {(Object.keys(METHODS) as MethodId[]).map((id) => (
                    <LabChoice
                      key={id}
                      selected={methodId === id}
                      label={METHODS[id].label}
                      detail={METHODS[id].detail}
                      icon={
                        id === 'no-baseline'
                          ? Activity
                          : id === 'value-baseline'
                            ? Scale
                            : LineChart
                      }
                      accent={
                        id === 'no-baseline'
                          ? 'amber'
                          : id === 'value-baseline'
                            ? 'cyan'
                            : 'violet'
                      }
                      onClick={() => setMethodId(id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Rollout horizon"
                  value={horizon}
                  output={`${horizon} steps`}
                  min={8}
                  max={128}
                  step={8}
                  accent="amber"
                  lowLabel="Frequent updates"
                  highLabel="Long credit chain"
                  onChange={setHorizon}
                />
                <LabRange
                  label="Critic prediction quality"
                  value={criticQualityPercent}
                  output={`${criticQualityPercent}%`}
                  min={40}
                  max={98}
                  step={1}
                  accent="cyan"
                  lowLabel="Noisy baseline"
                  highLabel="Predictive baseline"
                  onChange={setCriticQualityPercent}
                />
                <LabRange
                  label="GAE λ"
                  value={gaeLambda}
                  output={gaeLambda.toFixed(2)}
                  min={0}
                  max={1}
                  step={0.05}
                  accent="violet"
                  lowLabel="More bootstrap"
                  highLabel="More Monte Carlo"
                  onChange={setGaeLambda}
                />
              </div>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-2 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected estimator
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {selected.label}
                </h4>
              </div>
              <code className="w-fit rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                {selected.estimator}
              </code>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Relative variance"
                value={`${selected.variance.toFixed(0)}/100`}
                detail="Lower means fewer noisy gradient swings"
                icon={Activity}
                tone={
                  selected.variance < 40
                    ? 'emerald'
                    : selected.variance < 70
                      ? 'amber'
                      : 'rose'
                }
              />
              <LabMetric
                label="Bias risk"
                value={`${selected.bias.toFixed(0)}/100`}
                detail={
                  methodId === 'value-baseline'
                    ? 'Baseline subtraction adds no policy-gradient bias'
                    : methodId === 'no-baseline'
                      ? 'On-policy full returns are unbiased'
                      : 'Bootstrapping can inherit critic error'
                }
                icon={Sigma}
                tone={
                  selected.bias < 10
                    ? 'emerald'
                    : selected.bias < 30
                      ? 'amber'
                      : 'rose'
                }
              />
              <LabMetric
                label="Sample efficiency"
                value={`${selected.efficiency.toFixed(0)}/100`}
                detail="Relative signal gained per rollout sample"
                icon={Gauge}
                tone={
                  selected.efficiency >= 65
                    ? 'emerald'
                    : selected.efficiency >= 40
                      ? 'amber'
                      : 'rose'
                }
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  All estimators under these conditions
                </h4>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Relative indicators
                </span>
              </div>

              <div className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {methods.map((method) => {
                  const isSelected = method.id === methodId;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setMethodId(method.id)}
                      className={`grid w-full gap-4 px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 lg:grid-cols-[minmax(150px,0.75fr)_repeat(3,minmax(110px,1fr))] lg:items-center ${
                        isSelected
                          ? 'bg-violet-50 dark:bg-violet-950/35'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                          {method.label}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <Clock3
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          {method.wait}
                        </span>
                      </span>
                      <ResultBar
                        label="Variance"
                        value={method.variance}
                        tone="rose"
                      />
                      <ResultBar
                        label="Bias risk"
                        value={method.bias}
                        tone="amber"
                      />
                      <ResultBar
                        label="Efficiency"
                        value={method.efficiency}
                        tone="emerald"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {selected.explanation}
            </p>

            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              The 0–100 scores show expected directional trade-offs, not benchmark
              guarantees. Real variance and efficiency depend on reward noise, policy
              class, environment dynamics, critic training, and batch construction.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
