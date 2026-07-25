'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Gauge,
  Images,
  RefreshCw,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  TextSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';

type DatasetId = 'support' | 'legal' | 'images';

type DatasetProfile = {
  id: DatasetId;
  label: string;
  eyebrow: string;
  description: string;
  prevalence: number;
  baseFalsePositiveRate: number;
  recallShift: number;
  falseMergeCost: string;
  icon: LucideIcon;
};

const profiles: DatasetProfile[] = [
  {
    id: 'support',
    label: 'Support prompts',
    eyebrow: 'Text / repetitive',
    description: 'Short paraphrases with many legitimate template variants.',
    prevalence: 0.14,
    baseFalsePositiveRate: 0.12,
    recallShift: 0.02,
    falseMergeCost: 'Moderate: a unique intent may disappear from training.',
    icon: TextSearch,
  },
  {
    id: 'legal',
    label: 'Legal clauses',
    eyebrow: 'Text / high consequence',
    description: 'Small wording changes can reverse an obligation or exception.',
    prevalence: 0.06,
    baseFalsePositiveRate: 0.08,
    recallShift: -0.04,
    falseMergeCost: 'High: similar language can carry a different legal meaning.',
    icon: Scale,
  },
  {
    id: 'images',
    label: 'Product images',
    eyebrow: 'Vision / transformed',
    description: 'Crops, compression, backgrounds, and nearby viewpoints.',
    prevalence: 0.2,
    baseFalsePositiveRate: 0.15,
    recallShift: 0.04,
    falseMergeCost: 'Moderate: distinct product variants may be collapsed.',
    icon: Images,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export default function MlDuplicateDetectionThresholdLab() {
  const [profileId, setProfileId] = useState<DatasetId>('support');
  const [threshold, setThreshold] = useState(86);
  const [reviewCapacity, setReviewCapacity] = useState(500);

  const model = useMemo(() => {
    const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
    const total = 10_000;
    const actualDuplicates = Math.round(total * profile.prevalence);
    const uniqueItems = total - actualDuplicates;
    const thresholdProgress = (threshold - 68) / 29;
    const recall = clamp(
      0.99 - Math.pow(Math.max(0, thresholdProgress), 1.35) * 0.48 + profile.recallShift,
      0.38,
      0.995,
    );
    const falsePositiveRate = Math.max(
      0.0007,
      profile.baseFalsePositiveRate * Math.exp(-(threshold - 68) / 5.8),
    );
    const truePositives = Math.round(actualDuplicates * recall);
    const falseNegatives = actualDuplicates - truePositives;
    const falsePositives = Math.round(uniqueItems * falsePositiveRate);
    const trueNegatives = uniqueItems - falsePositives;
    const reviewQueue = truePositives + falsePositives;
    const precision = reviewQueue > 0 ? truePositives / reviewQueue : 1;
    const queueUtilization = reviewQueue / reviewCapacity;

    let decision = 'Defensible review band';
    let explanation = 'The queue fits capacity while precision and recall remain useful.';
    let tone: 'healthy' | 'warning' | 'danger' = 'healthy';

    if (falsePositives > actualDuplicates * 0.12) {
      decision = 'Too permissive';
      explanation = 'False candidates consume review capacity and raise false-merge exposure.';
      tone = 'danger';
    } else if (falseNegatives > actualDuplicates * 0.26) {
      decision = 'Too strict';
      explanation = 'The system suppresses too many real duplicates before reviewers can see them.';
      tone = 'warning';
    } else if (reviewQueue > reviewCapacity) {
      decision = 'Review queue overloaded';
      explanation = 'This operating point creates more candidates than the team can resolve per batch.';
      tone = 'danger';
    }

    return {
      profile,
      total,
      actualDuplicates,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      reviewQueue,
      precision,
      recall,
      queueUtilization,
      decision,
      explanation,
      tone,
    };
  }, [profileId, reviewCapacity, threshold]);

  const reset = () => {
    setProfileId('support');
    setThreshold(86);
    setReviewCapacity(500);
  };

  const decisionClass =
    model.tone === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.tone === 'warning'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              Threshold calibration lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Choose an operating point reviewers can sustain</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Test 10,000 incoming items. Raising the threshold reduces false candidates, but it can also hide real duplicates.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose a dataset</legend>
            <div className="mt-3 grid gap-2">
              {profiles.map((profile) => {
                const Icon = profile.icon;
                const selected = profile.id === profileId;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setProfileId(profile.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{profile.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{profile.eyebrow}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{profile.description}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Pair threshold</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{(threshold / 100).toFixed(2)}</output>
            </span>
            <input
              type="range"
              min="68"
              max="97"
              step="1"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-cyan-500"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>More recall</span><span>More precision</span></span>
          </label>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">3. Review capacity</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{reviewCapacity.toLocaleString()}</output>
            </span>
            <input
              type="range"
              min="100"
              max="1200"
              step="50"
              value={reviewCapacity}
              onChange={(event) => setReviewCapacity(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
            <p className="mt-2 text-xs leading-5 text-neutral-500">Pairs reviewers can resolve in this 10,000-item batch.</p>
          </label>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Precision" value={`${(model.precision * 100).toFixed(1)}%`} detail={`${model.falsePositives} false candidates`} tone="cyan" />
            <MetricCard label="Recall" value={`${(model.recall * 100).toFixed(1)}%`} detail={`${model.falseNegatives} duplicates missed`} tone="violet" />
            <MetricCard label="Review queue" value={model.reviewQueue.toLocaleString()} detail={`Capacity ${reviewCapacity.toLocaleString()}`} tone={model.reviewQueue > reviewCapacity ? 'rose' : 'emerald'} />
            <MetricCard label="Known duplicates" value={model.actualDuplicates.toLocaleString()} detail={`In ${model.total.toLocaleString()} items`} tone="amber" />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Confusion matrix</p>
                  <p className="mt-1 text-xs text-neutral-500">Every item lands in one visible outcome.</p>
                </div>
                <span className="rounded bg-neutral-200 px-2 py-1 text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {model.profile.label}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <OutcomeCell label="Found duplicates" value={model.truePositives} detail="True positive" tone="emerald" />
                <OutcomeCell label="False candidates" value={model.falsePositives} detail="False positive" tone="rose" />
                <OutcomeCell label="Missed duplicates" value={model.falseNegatives} detail="False negative" tone="amber" />
                <OutcomeCell label="Correctly ignored" value={model.trueNegatives} detail="True negative" tone="neutral" />
              </div>
            </div>

            <div className={`rounded-lg border p-4 md:p-5 ${decisionClass}`}>
              <div className="flex items-center gap-2">
                {model.tone === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                ) : model.tone === 'warning' ? (
                  <CircleAlert aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                )}
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">Operating decision</p>
              </div>
              <p className="mt-3 text-lg font-bold text-neutral-950 dark:text-white">{model.decision}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.explanation}</p>
              <div className="mt-4 border-t border-current/15 pt-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-neutral-700 dark:text-neutral-200"><Users aria-hidden="true" className="h-4 w-4" /> Queue utilization</span>
                  <span className="font-bold tabular-nums text-neutral-950 dark:text-white">{(model.queueUtilization * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-black/10 dark:bg-white/10">
                  <div className={`h-full rounded transition-[width] duration-300 ${model.queueUtilization > 1 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, model.queueUtilization * 100)}%` }} />
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><strong>False-merge cost:</strong> {model.profile.falseMergeCost}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type MetricTone = 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber';

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: MetricTone }) {
  const toneClass: Record<MetricTone, string> = {
    cyan: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/35',
    violet: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35',
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${toneClass[tone]}`}>
      <Gauge aria-hidden="true" className="h-4 w-4 text-neutral-500" />
      <p className="mt-3 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-200">{label}</p>
      <p className="mt-1 text-[10px] leading-4 text-neutral-500">{detail}</p>
    </div>
  );
}

type OutcomeTone = 'emerald' | 'rose' | 'amber' | 'neutral';

function OutcomeCell({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: OutcomeTone }) {
  const toneClass: Record<OutcomeTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    neutral: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${toneClass[tone]}`}>
      <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-200">{label}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">{detail}</p>
    </div>
  );
}
