'use client';

import { useMemo, useState } from 'react';
import { AlignLeft, AlignRight, BarChart3, ScanSearch, Shuffle, TriangleAlert } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PositionPlan = 'a-left' | 'balanced' | 'b-left';

const TRUE_PREFERENCE_A = 0.52;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function LmsysArenaEvaluationBiasLab() {
  const [positionPlan, setPositionPlan] = useState<PositionPlan>('a-left');
  const [positionAdvantage, setPositionAdvantage] = useState(4);
  const [votes, setVotes] = useState(400);

  const model = useMemo(() => {
    const aLeftShare = positionPlan === 'a-left' ? 1 : positionPlan === 'balanced' ? 0.5 : 0;
    const systematicShift = ((2 * aLeftShare - 1) * positionAdvantage) / 100;
    const expectedObserved = Math.min(0.99, Math.max(0.01, TRUE_PREFERENCE_A + systematicShift));
    const margin = 1.96 * Math.sqrt((expectedObserved * (1 - expectedObserved)) / votes);
    const lower = Math.max(0, expectedObserved - margin);
    const upper = Math.min(1, expectedObserved + margin);
    const apparentWinner = lower > 0.5 ? 'Candidate A' : upper < 0.5 ? 'Candidate B' : 'No clear winner';
    const randomized = positionPlan === 'balanced';
    const verdict = randomized
      ? lower > 0.5
        ? 'Directionally reliable'
        : 'Sampling uncertainty remains'
      : Math.abs(systematicShift) >= margin
        ? 'Bias dominates the interval'
        : 'Position is uncontrolled';
    const explanation = randomized
      ? lower > 0.5
        ? 'Balanced swapping cancels the modeled position effect, and the interval supports A for this sample.'
        : 'Balanced swapping controls position, but this vote count does not yet separate a 52% preference from chance.'
      : `The expected estimate is shifted by ${Math.abs(systematicShift * 100).toFixed(1)} points. More votes narrow the interval around that shifted value; they do not repair the assignment design.`;

    return {
      apparentWinner,
      expectedObserved,
      explanation,
      lower,
      margin,
      systematicShift,
      upper,
      verdict,
    };
  }, [positionAdvantage, positionPlan, votes]);

  const reset = () => {
    setPositionPlan('a-left');
    setPositionAdvantage(4);
    setVotes(400);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Bias and reliability lab"
        title="Separate sampling confidence from position bias"
        description="A is truly preferred 52% of the time in this model. Change response placement, bias strength, and vote count to see when the arena reports the wrong story confidently."
        icon={ScanSearch}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Response placement
              </legend>
              <div className="mt-3 grid gap-2">
                <LabChoice
                  selected={positionPlan === 'a-left'}
                  label="Always put A on the left"
                  detail="A receives the full modeled position advantage."
                  icon={AlignLeft}
                  accent="rose"
                  onClick={() => setPositionPlan('a-left')}
                />
                <LabChoice
                  selected={positionPlan === 'balanced'}
                  label="Swap positions evenly"
                  detail="Half of A's responses appear on each side."
                  icon={Shuffle}
                  accent="emerald"
                  onClick={() => setPositionPlan('balanced')}
                />
                <LabChoice
                  selected={positionPlan === 'b-left'}
                  label="Always put B on the left"
                  detail="B receives the advantage and can reverse the apparent winner."
                  icon={AlignRight}
                  accent="violet"
                  onClick={() => setPositionPlan('b-left')}
                />
              </div>
            </fieldset>
            <LabRange
              label="Left-side advantage"
              value={positionAdvantage}
              output={`${positionAdvantage} points`}
              min={0}
              max={10}
              step={1}
              accent="rose"
              lowLabel="None"
              highLabel="Strong"
              onChange={setPositionAdvantage}
            />
            <LabRange
              label="Collected votes"
              value={votes}
              output={votes.toLocaleString()}
              min={50}
              max={4000}
              step={50}
              accent="blue"
              lowLabel="50"
              highLabel="4,000"
              onChange={setVotes}
            />
          </div>
        }
      >
        <div className="min-h-[430px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric
              label="True A preference"
              value={percent(TRUE_PREFERENCE_A)}
              detail="Fixed in this teaching model"
              tone="emerald"
            />
            <LabMetric
              label="Expected arena estimate"
              value={percent(model.expectedObserved)}
              detail={`Systematic shift: ${model.systematicShift >= 0 ? '+' : ''}${(model.systematicShift * 100).toFixed(1)} points`}
              tone="rose"
            />
            <LabMetric
              label="Approximate 95% interval"
              value={`${percent(model.lower)}-${percent(model.upper)}`}
              detail={`Sampling margin: +/- ${percent(model.margin)}`}
              icon={BarChart3}
              tone="blue"
            />
            <LabMetric
              label="Apparent winner"
              value={model.apparentWinner}
              detail="Based only on whether the interval crosses 50%"
              icon={TriangleAlert}
              tone="amber"
            />
          </div>

          <div className="mt-6 space-y-4" aria-label="True and expected observed preference comparison">
            <PreferenceBar label="True A preference" value={TRUE_PREFERENCE_A} tone="bg-emerald-500" />
            <PreferenceBar label="Expected arena estimate" value={model.expectedObserved} tone="bg-rose-500" />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.verdict}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.explanation}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PreferenceBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-neutral-900 dark:text-white">{label}</span>
        <span className="tabular-nums text-neutral-600 dark:text-neutral-300">{percent(value)}</span>
      </div>
      <div className="relative mt-2 h-7 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full ${tone}`} style={{ width: `${value * 100}%` }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-950 dark:bg-white" aria-hidden="true" />
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">The center marker is an even 50% matchup.</p>
    </div>
  );
}
