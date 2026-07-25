'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  Database,
  GitMerge,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

type StrategyId = 'stratified' | 'uncertain' | 'reported';

type Strategy = {
  id: StrategyId;
  label: string;
  description: string;
  bias: number;
  qualityDelta: number;
  informationMultiplier: number;
};

const strategies: Strategy[] = [
  {
    id: 'stratified',
    label: 'Stratified mix',
    description: 'Uncertain, random, and slice quotas',
    bias: 18,
    qualityDelta: 0,
    informationMultiplier: 1,
  },
  {
    id: 'uncertain',
    label: 'Uncertain only',
    description: 'Highest model uncertainty first',
    bias: 58,
    qualityDelta: 1.5,
    informationMultiplier: 1.3,
  },
  {
    id: 'reported',
    label: 'User reports only',
    description: 'Cases users choose to flag',
    bias: 76,
    qualityDelta: -3,
    informationMultiplier: 1.05,
  },
];

const DAILY_CASES = 1800;
const DAILY_REVIEW_CAPACITY = 2600;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function Consequence({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border-b border-neutral-200 py-4 last:border-b-0 dark:border-neutral-800 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

export default function HumanInTheLoopMlFeedbackLoopLab() {
  const [strategyId, setStrategyId] = useState<StrategyId>('stratified');
  const [overlap, setOverlap] = useState(20);
  const [holdbackDays, setHoldbackDays] = useState(7);
  const [adjudication, setAdjudication] = useState(true);

  const strategy = strategies.find((item) => item.id === strategyId) ?? strategies[0];

  const result = useMemo(() => {
    const disagreementRate = clamp(
      16 - overlap * 0.12 + (strategy.id === 'reported' ? 4 : 0),
      4,
      25,
    );
    const reviewActions =
      DAILY_CASES * (1 + overlap / 100) +
      (adjudication ? DAILY_CASES * (disagreementRate / 100) * 0.55 : 0);
    const reviewLoad = (reviewActions / DAILY_REVIEW_CAPACITY) * 100;
    const queueDelay =
      reviewLoad <= 80
        ? 0.5
        : reviewLoad <= 100
          ? 0.5 + (reviewLoad - 80) * 0.08
          : 2.1 + (reviewLoad - 100) * 0.25;
    const totalDelay = holdbackDays + queueDelay + 2;
    const labelQuality = clamp(
      82 + overlap * 0.22 + (adjudication ? 5 : 0) + strategy.qualityDelta,
      70,
      98,
    );
    const biasScore = clamp(
      strategy.bias - overlap * 0.08 - (adjudication ? 2 : 0),
      5,
      95,
    );
    const coverage = 100 - biasScore;
    const freshness = clamp(1 - totalDelay / 60, 0.35, 1);
    const learningScore = clamp(
      labelQuality * (coverage / 100) * strategy.informationMultiplier * freshness,
      10,
      99,
    );
    const biasLabel = biasScore < 30 ? 'Low' : biasScore < 55 ? 'Medium' : 'High';

    const status =
      biasScore >= 55
        ? {
            label: 'Hold: sample is not representative',
            detail: 'The selected source teaches the model about a narrow population. Add random audits and slice quotas before retraining.',
            tone: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
            icon: Scale,
          }
        : reviewLoad > 100
          ? {
              label: 'Slow intake: review capacity exceeded',
              detail: 'Quality controls consume more review actions than the team can finish. Reduce intake or add qualified capacity.',
              tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
              icon: AlertTriangle,
            }
          : labelQuality < 90
            ? {
                label: 'Add label quality control',
                detail: 'The feedback arrives quickly, but agreement and adjudication are too weak for an authoritative training set.',
                tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
                icon: GitMerge,
              }
            : totalDelay > 21
              ? {
                  label: 'Feedback is becoming stale',
                  detail: 'The evidence is sound, but the release will react slowly to drift. Shorten the holdback while preserving evaluation.',
                  tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
                  icon: Clock3,
                }
              : {
                  label: 'Ready for controlled retraining',
                  detail: 'The sample, label process, review load, and feedback delay support a versioned candidate evaluation.',
                  tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
                  icon: ShieldCheck,
                };

    return {
      disagreementRate,
      reviewActions,
      reviewLoad,
      totalDelay,
      labelQuality,
      biasScore,
      biasLabel,
      learningScore,
      status,
    };
  }, [adjudication, holdbackDays, overlap, strategy]);

  const reset = () => {
    setStrategyId('stratified');
    setOverlap(20);
    setHoldbackDays(7);
    setAdjudication(true);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-violet-300">
              <GitMerge aria-hidden="true" className="h-4 w-4" />
              Feedback-loop lab
            </div>
            <h3 className="mt-2 text-xl font-bold md:text-2xl">Build a training signal you can trust</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Choose where labels come from, how much work is duplicated for quality control, and how long evidence waits before evaluation.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="min-w-0 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">1. Select the feedback source</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {strategies.map((item) => {
                const selected = item.id === strategyId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStrategyId(item.id)}
                    className={`min-h-28 rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                      selected
                        ? 'border-violet-600 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold">{item.label}</span>
                      {selected ? <Check aria-label="Selected" className="h-4 w-4 shrink-0" /> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-5 opacity-75">{item.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Double-labeled cases
                <strong className="tabular-nums text-violet-700 dark:text-violet-300">{overlap}%</strong>
              </span>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={overlap}
                onChange={(event) => setOverlap(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>More throughput</span>
                <span>More agreement data</span>
              </span>
            </label>

            <label className="block">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Evaluation holdback
                <strong className="tabular-nums text-blue-700 dark:text-blue-300">{holdbackDays} days</strong>
              </span>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={holdbackDays}
                onChange={(event) => setHoldbackDays(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-blue-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Fresher signal</span>
                <span>Longer validation</span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Adjudicate reviewer disagreement</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                Send conflicting labels to a senior reviewer before admission.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={adjudication}
              onClick={() => setAdjudication((current) => !current)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                adjudication
                  ? 'border-violet-600 bg-violet-600'
                  : 'border-neutral-400 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800'
              }`}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${adjudication ? 'translate-x-6' : 'translate-x-0.5'}`}
              />
              <span className="sr-only">Toggle disagreement adjudication</span>
            </button>
          </div>
        </div>

        <div className="min-w-0 bg-neutral-50 p-5 dark:bg-neutral-900/50 md:p-6">
          {(() => {
            const StatusIcon = result.status.icon;
            return (
              <div className={`rounded-md border p-4 ${result.status.tone}`} aria-live="polite">
                <div className="flex items-center gap-2 text-xs font-bold uppercase">
                  <StatusIcon aria-hidden="true" className="h-4 w-4" />
                  Dataset admission decision
                </div>
                <p className="mt-2 text-xl font-bold">{result.status.label}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.status.detail}</p>
              </div>
            );
          })()}

          <div className="mt-5 grid sm:grid-cols-2">
            <Consequence icon={ShieldCheck} label="Label quality" value={`${result.labelQuality.toFixed(0)}%`} detail={`${result.disagreementRate.toFixed(1)}% initial disagreement`} />
            <Consequence icon={Users} label="Review load" value={`${result.reviewLoad.toFixed(0)}%`} detail={`${Math.round(result.reviewActions).toLocaleString()} actions/day`} />
            <Consequence icon={Clock3} label="Feedback delay" value={`${result.totalDelay.toFixed(1)}d`} detail="Queue, holdback, and evaluation" />
            <Consequence icon={Scale} label="Sample bias" value={result.biasLabel} detail={`${result.biasScore.toFixed(0)}/100 risk score`} />
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Effective learning signal</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">Quality adjusted for coverage and freshness</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">{result.learningScore.toFixed(0)}/100</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div className="h-full bg-violet-500" style={{ width: `${result.learningScore}%` }} />
            </div>

            <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm text-neutral-700 dark:text-neutral-300">
              <Database aria-hidden="true" className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-300" />
              <p><strong className="text-neutral-950 dark:text-white">Sample:</strong> {DAILY_CASES.toLocaleString()} cases/day through {strategy.label.toLowerCase()}.</p>
              <Users aria-hidden="true" className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
              <p><strong className="text-neutral-950 dark:text-white">Validate:</strong> overlap and adjudication consume a {DAILY_REVIEW_CAPACITY.toLocaleString()}-action daily budget.</p>
              <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 text-violet-600 dark:text-violet-300" />
              <p><strong className="text-neutral-950 dark:text-white">Release:</strong> only the versioned dataset advances to candidate evaluation.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
