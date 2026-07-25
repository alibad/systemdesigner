'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Gauge,
  Scale,
  Sigma,
  Target,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type SignalMode = 'return' | 'advantage';

const SIGNALS: Record<
  SignalMode,
  { label: string; detail: string; symbol: string }
> = {
  return: {
    label: 'Raw return',
    detail: 'Weight the score by the sampled discounted return G_t.',
    symbol: 'G_t',
  },
  advantage: {
    label: 'Advantage',
    detail: 'Weight the score by how much better the action was than the baseline.',
    symbol: 'A_t',
  },
};

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function logit(probability: number) {
  return Math.log(probability / (1 - probability));
}

export default function PolicyGradientTheoremGradientExplorer() {
  const [mode, setMode] = useState<SignalMode>('advantage');
  const [probabilityPercent, setProbabilityPercent] = useState(35);
  const [signal, setSignal] = useState(2);
  const [learningRate, setLearningRate] = useState(0.1);

  const result = useMemo(() => {
    const probability = probabilityPercent / 100;
    const score = 1 - probability;
    const chosenLogitGradient = score * signal;
    const chosenLogitStep = learningRate * chosenLogitGradient;
    const otherLogitStep = -learningRate * probability * signal;
    const logOddsStep = chosenLogitStep - otherLogitStep;
    const newProbability = sigmoid(logit(probability) + logOddsStep);
    const probabilityDelta = (newProbability - probability) * 100;
    const direction =
      signal > 0 ? 'increase' : signal < 0 ? 'decrease' : 'hold';
    const magnitude = Math.abs(probabilityDelta);
    const strength =
      magnitude < 0.1
        ? 'No meaningful movement'
        : magnitude < 2
          ? 'Small update'
          : magnitude < 6
            ? 'Moderate update'
            : 'Aggressive update';

    return {
      score,
      chosenLogitStep,
      otherLogitStep,
      logOddsStep,
      newProbability,
      probabilityDelta,
      direction,
      strength,
    };
  }, [learningRate, probabilityPercent, signal]);

  const reset = () => {
    setMode('advantage');
    setProbabilityPercent(35);
    setSignal(2);
    setLearningRate(0.1);
  };

  const DirectionIcon =
    result.direction === 'increase'
      ? ArrowUp
      : result.direction === 'decrease'
        ? ArrowDown
        : ArrowRight;

  return (
    <div data-content-block="ml-systems/policy-gradient-theorem-gradient-explorer">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Gradient explorer"
          title="Turn one sampled action into a policy update"
          description="Adjust the current action probability, learning signal, and step size. The explorer applies the exact two-action softmax gradient to both logits."
          icon={Sigma}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the weight
                </legend>
                <div className="mt-3 space-y-2">
                  {(Object.keys(SIGNALS) as SignalMode[]).map((id) => (
                    <LabChoice
                      key={id}
                      selected={mode === id}
                      label={SIGNALS[id].label}
                      detail={SIGNALS[id].detail}
                      icon={id === 'return' ? Gauge : Scale}
                      accent={id === 'return' ? 'amber' : 'cyan'}
                      onClick={() => setMode(id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Chosen action probability"
                  value={probabilityPercent}
                  output={`${probabilityPercent}%`}
                  min={5}
                  max={95}
                  step={1}
                  accent="violet"
                  lowLabel="Action is rare"
                  highLabel="Action is likely"
                  onChange={setProbabilityPercent}
                />
                <LabRange
                  label={`${SIGNALS[mode].label} ${SIGNALS[mode].symbol}`}
                  value={signal}
                  output={signal > 0 ? `+${signal.toFixed(2)}` : signal.toFixed(2)}
                  min={-5}
                  max={5}
                  step={0.25}
                  accent="cyan"
                  lowLabel="Worse than reference"
                  highLabel="Better than reference"
                  onChange={setSignal}
                />
                <LabRange
                  label="Learning rate α"
                  value={learningRate}
                  output={learningRate.toFixed(2)}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  accent="emerald"
                  lowLabel="Cautious"
                  highLabel="Aggressive"
                  onChange={setLearningRate}
                />
              </div>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Update direction"
                value={result.direction}
                detail={result.strength}
                icon={DirectionIcon}
                tone={
                  result.direction === 'increase'
                    ? 'emerald'
                    : result.direction === 'decrease'
                      ? 'rose'
                      : 'neutral'
                }
              />
              <LabMetric
                label="Probability change"
                value={`${result.probabilityDelta >= 0 ? '+' : ''}${result.probabilityDelta.toFixed(2)} pp`}
                detail={`${probabilityPercent}% to ${(result.newProbability * 100).toFixed(2)}%`}
                icon={Target}
                tone="violet"
              />
              <LabMetric
                label="Chosen-logit step"
                value={`${result.chosenLogitStep >= 0 ? '+' : ''}${result.chosenLogitStep.toFixed(3)}`}
                detail={`α × ${SIGNALS[mode].symbol} × (1 − p)`}
                icon={Sigma}
                tone="cyan"
              />
            </div>

            <div className="mt-6 border-y border-neutral-200 py-5 dark:border-neutral-800">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <div>
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    <span>Before update</span>
                    <span className="tabular-nums">{probabilityPercent}%</span>
                  </div>
                  <div className="mt-2 flex h-8 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
                    <div
                      className="bg-violet-500 transition-[width] motion-reduce:transition-none"
                      style={{ width: `${probabilityPercent}%` }}
                    />
                    <div className="flex-1 bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                </div>

                <ArrowDown
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-neutral-400 md:-rotate-90 dark:text-neutral-600"
                />

                <div>
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    <span>After update</span>
                    <span className="tabular-nums">
                      {(result.newProbability * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2 flex h-8 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
                    <div
                      className="bg-emerald-500 transition-[width] motion-reduce:transition-none"
                      style={{ width: `${result.newProbability * 100}%` }}
                    />
                    <div className="flex-1 bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 text-sm leading-6 text-neutral-700 sm:grid-cols-2 dark:text-neutral-300">
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">
                  Score term for the chosen logit
                </p>
                <p className="mt-1 font-mono text-xs tabular-nums">
                  1 − p = {result.score.toFixed(2)}
                </p>
                <p className="mt-2">
                  A likely action has a smaller chosen-logit score. This is why the
                  same signal moves a saturated policy less at that logit.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">
                  Full two-logit update
                </p>
                <p className="mt-1 font-mono text-xs tabular-nums">
                  Δz(chosen) = {result.chosenLogitStep.toFixed(3)}, Δz(other) ={' '}
                  {result.otherLogitStep.toFixed(3)}
                </p>
                <p className="mt-2">
                  Their difference changes the log-odds by{' '}
                  {result.logOddsStep >= 0 ? '+' : ''}
                  {result.logOddsStep.toFixed(3)}. A negative signal reverses both
                  updates.
                </p>
              </div>
            </div>

            <p className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              <strong className="text-neutral-950 dark:text-white">
                Interpretation:
              </strong>{' '}
              {mode === 'return'
                ? 'Raw return uses zero as its reference. A positive but below-average outcome can still increase the sampled action.'
                : 'Advantage uses the state baseline as its reference, so only outcomes better than expectation increase the sampled action.'}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
