'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Clock3,
  Gauge,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const decisionsPerReviewerDay = 45 * 7;
const healthyUtilization = 0.8;

function compact(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ContentModerationTriageCapacityLab() {
  const [dailyMillions, setDailyMillions] = useState(10);
  const [reviewRate, setReviewRate] = useState(5);
  const [reviewers, setReviewers] = useState(2000);

  const model = useMemo(() => {
    const dailyPosts = dailyMillions * 1_000_000;
    const reviewArrivals = dailyPosts * (reviewRate / 100);
    const dailyCapacity = reviewers * decisionsPerReviewerDay;
    const targetCapacity = dailyCapacity * healthyUtilization;
    const utilization = reviewArrivals / dailyCapacity;
    const carryover = Math.max(0, reviewArrivals - dailyCapacity);
    const headroom = targetCapacity - reviewArrivals;
    const requiredReviewers = Math.ceil(
      reviewArrivals / (decisionsPerReviewerDay * healthyUtilization),
    );
    const automated = dailyPosts - reviewArrivals;

    const status = utilization > 1
      ? {
          title: 'Backlog grows every day',
          detail: `${compact(carryover)} cases remain after one day of reviewer capacity. Add admission controls, prioritize severe cases, or staff the queue before widening the review band.`,
          classes:
            'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
          icon: CircleAlert,
        }
      : utilization > healthyUtilization
        ? {
            title: 'The queue clears, but has little shock capacity',
            detail: `Utilization is above the 80% planning limit. A policy change, absence, or viral event can break the review SLA.`,
            classes:
              'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
            icon: Clock3,
          }
        : {
            title: 'Review capacity has operating headroom',
            detail: `${compact(Math.max(0, headroom))} more cases can enter the daily queue before reaching the 80% planning limit.`,
            classes:
              'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
            icon: ShieldCheck,
          };

    return {
      automated,
      carryover,
      dailyCapacity,
      reviewArrivals,
      requiredReviewers,
      status,
      utilization,
    };
  }, [dailyMillions, reviewRate, reviewers]);

  const reset = () => {
    setDailyMillions(10);
    setReviewRate(5);
    setReviewers(2000);
  };

  const StatusIcon = model.status.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Human review capacity lab"
        title="Keep ambiguity inside a bounded queue"
        description="Change traffic, the uncertainty band, and reviewer staffing. The model shows why a safer threshold is only safe when operations can absorb it."
        icon={Gauge}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <LabRange
              label="Daily posts"
              value={dailyMillions}
              output={`${dailyMillions}M`}
              min={10}
              max={100}
              step={10}
              lowLabel="Baseline"
              highLabel="Event day"
              accent="blue"
              onChange={setDailyMillions}
            />
            <LabRange
              label="Sent to review"
              value={reviewRate}
              output={`${reviewRate}%`}
              min={1}
              max={8}
              lowLabel="Narrow band"
              highLabel="More ambiguity"
              accent="violet"
              onChange={setReviewRate}
            />
            <LabRange
              label="Reviewer headcount"
              value={reviewers}
              output={reviewers.toLocaleString()}
              min={800}
              max={6000}
              step={200}
              lowLabel="Lean"
              highLabel="Global coverage"
              accent="emerald"
              onChange={setReviewers}
            />
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">Planning assumptions</p>
              <p className="mt-1">Each reviewer completes 45 cases per productive hour and seven productive hours per day. Healthy capacity stops at 80% utilization.</p>
            </div>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Review arrivals"
            value={compact(model.reviewArrivals)}
            detail="Cases entering human queues each day."
            icon={Users}
            tone="violet"
          />
          <LabMetric
            label="Review capacity"
            value={compact(model.dailyCapacity)}
            detail="Maximum daily decisions before headroom."
            icon={Activity}
            tone="blue"
          />
          <LabMetric
            label="Utilization"
            value={`${Math.round(model.utilization * 100)}%`}
            detail="Queue arrivals divided by service capacity."
            icon={Gauge}
            tone={model.utilization > 1 ? 'rose' : model.utilization > healthyUtilization ? 'amber' : 'emerald'}
          />
          <LabMetric
            label="Headcount needed"
            value={model.requiredReviewers.toLocaleString()}
            detail="Reviewers required at the 80% planning limit."
            icon={Users}
            tone="neutral"
          />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            <span>Daily review pressure</span>
            <span className="tabular-nums">{compact(model.reviewArrivals)} / {compact(model.dailyCapacity)}</span>
          </div>
          <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full transition-[width,background-color] duration-300 ${
                model.utilization > 1
                  ? 'bg-rose-500'
                  : model.utilization > healthyUtilization
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, model.utilization * 100)}%` }}
            />
            <span className="absolute inset-y-0 w-0.5 bg-neutral-950/70 dark:bg-white/80" style={{ left: '80%' }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>0%</span>
            <span>80% planning limit</span>
            <span>100%</span>
          </div>
        </div>

        <div className={`mt-5 rounded-lg border p-4 ${model.status.classes}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{model.status.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{model.status.detail}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Automated path</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">{compact(model.automated)} posts/day</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Clear cases still need sampled quality checks and reversible actions.</p>
          </div>
          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Daily carryover</p>
            <p className={`mt-2 text-xl font-semibold tabular-nums ${model.carryover > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {compact(model.carryover)} cases
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">A positive value compounds until policy, prioritization, or staffing changes.</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
