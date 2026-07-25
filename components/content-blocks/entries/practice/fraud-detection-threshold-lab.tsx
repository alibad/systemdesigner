'use client';

import { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  Gauge,
  ScanSearch,
  ShieldCheck,
  ShoppingCart,
  TicketsPlane,
  Users,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ProfileId = 'retail' | 'travel' | 'digital';

type Profile = {
  id: ProfileId;
  label: string;
  detail: string;
  prevalence: number;
  baseFalsePositiveRate: number;
  recallAdjustment: number;
  fraudLoss: number;
  frictionCost: number;
  icon: typeof ShoppingCart;
};

const profiles: Profile[] = [
  {
    id: 'retail',
    label: 'Everyday retail',
    detail: 'Moderate order value with familiar repeat-customer behavior.',
    prevalence: 0.006,
    baseFalsePositiveRate: 0.04,
    recallAdjustment: 0.006,
    fraudLoss: 180,
    frictionCost: 28,
    icon: ShoppingCart,
  },
  {
    id: 'travel',
    label: 'Travel booking',
    detail: 'High order value, cross-border traffic, and legitimate location changes.',
    prevalence: 0.013,
    baseFalsePositiveRate: 0.055,
    recallAdjustment: -0.012,
    fraudLoss: 720,
    frictionCost: 115,
    icon: TicketsPlane,
  },
  {
    id: 'digital',
    label: 'Digital goods',
    detail: 'Instant fulfillment with rapid attacks and little recovery time.',
    prevalence: 0.02,
    baseFalsePositiveRate: 0.032,
    recallAdjustment: 0.014,
    fraudLoss: 90,
    frictionCost: 18,
    icon: BadgeDollarSign,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export default function FraudDetectionThresholdLab() {
  const [profileId, setProfileId] = useState<ProfileId>('retail');
  const [blockThreshold, setBlockThreshold] = useState(75);
  const [reviewCapacity, setReviewCapacity] = useState(800);

  const model = useMemo(() => {
    const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
    const total = 100_000;
    const fraud = Math.round(total * profile.prevalence);
    const legitimate = total - fraud;
    const recall = clamp(
      1.036 - (blockThreshold - 50) * 0.0029 + profile.recallAdjustment,
      0.82,
      0.995,
    );
    const falsePositiveRate = clamp(
      profile.baseFalsePositiveRate * Math.exp(-(blockThreshold - 60) / 8.5),
      0.0004,
      0.08,
    );
    const fraudBlocked = Math.round(fraud * recall);
    const fraudMissed = fraud - fraudBlocked;
    const legitimateBlocked = Math.round(legitimate * falsePositiveRate);
    const reviewQueue = Math.round(
      fraudMissed * 0.62 + legitimate * falsePositiveRate * 0.88,
    );
    const overflow = Math.max(0, reviewQueue - reviewCapacity);
    const expectedCost =
      fraudMissed * profile.fraudLoss +
      legitimateBlocked * profile.frictionCost +
      Math.min(reviewQueue, reviewCapacity) * 6 +
      overflow * 24;

    let title = 'Balanced operating point';
    let detail = 'The false-positive ceiling and review capacity both hold for this batch.';
    let tone: 'healthy' | 'warning' | 'danger' = 'healthy';

    if (falsePositiveRate > 0.008) {
      title = 'Legitimate customers absorb too much friction';
      detail = 'Raise the block threshold or narrow the policy to reduce false blocks.';
      tone = 'danger';
    } else if (overflow > 0) {
      title = 'The review queue is overloaded';
      detail = 'The policy creates more ambiguous cases than investigators can resolve.';
      tone = 'danger';
    } else if (recall < 0.97) {
      title = 'Automatic blocking is too selective';
      detail = 'Customer friction is controlled, but more fraud escapes the automatic action band.';
      tone = 'warning';
    }

    return {
      profile,
      total,
      fraud,
      fraudBlocked,
      fraudMissed,
      legitimateBlocked,
      falsePositiveRate,
      recall,
      reviewQueue,
      overflow,
      expectedCost,
      title,
      detail,
      tone,
    };
  }, [blockThreshold, profileId, reviewCapacity]);

  const reset = () => {
    setProfileId('retail');
    setBlockThreshold(75);
    setReviewCapacity(800);
  };

  const decisionStyle =
    model.tone === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.tone === 'warning'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  const DecisionIcon = model.tone === 'healthy' ? CheckCircle2 : CircleAlert;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Action threshold lab"
        title="Price fraud loss, customer friction, and review capacity together"
        description="Simulate 100,000 payment attempts. A higher block threshold protects legitimate customers, but it can let more fraud escape automatic blocking."
        icon={ScanSearch}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the payment profile
              </legend>
              <div className="mt-3 grid gap-2">
                {profiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={profile.id === profileId}
                    label={profile.label}
                    detail={profile.detail}
                    icon={profile.icon}
                    accent="violet"
                    onClick={() => setProfileId(profile.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="2. Automatic-block threshold"
              value={blockThreshold}
              output={`${blockThreshold}% risk`}
              min={60}
              max={94}
              accent="violet"
              lowLabel="Aggressive"
              highLabel="Selective"
              onChange={setBlockThreshold}
            />

            <LabRange
              label="3. Daily review capacity"
              value={reviewCapacity}
              output={`${formatCount(reviewCapacity)} cases`}
              min={200}
              max={2400}
              step={100}
              accent="cyan"
              lowLabel="Small team"
              highLabel="Large team"
              onChange={setReviewCapacity}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Fraud blocked"
            value={`${(model.recall * 100).toFixed(1)}%`}
            detail={`${formatCount(model.fraudBlocked)} of ${formatCount(model.fraud)} fraudulent attempts`}
            icon={ShieldCheck}
            tone={model.recall >= 0.97 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Legitimate blocked"
            value={`${(model.falsePositiveRate * 100).toFixed(2)}%`}
            detail={`${formatCount(model.legitimateBlocked)} customers in this batch`}
            icon={Users}
            tone={model.falsePositiveRate <= 0.008 ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Review demand"
            value={formatCount(model.reviewQueue)}
            detail={model.overflow > 0 ? `${formatCount(model.overflow)} cases over capacity` : 'Queue fits selected capacity'}
            icon={Gauge}
            tone={model.overflow > 0 ? 'rose' : 'cyan'}
          />
          <LabMetric
            label="Expected batch cost"
            value={formatMoney(model.expectedCost)}
            detail="Missed fraud + false-block friction + investigation cost"
            icon={BadgeDollarSign}
            tone="neutral"
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(230px,0.7fr)]">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Outcome per 100,000 attempts
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                  Every threshold moves harm; none removes it.
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-neutral-500">
                {model.profile.label}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {[
                {
                  label: 'Fraud caught automatically',
                  value: model.fraudBlocked,
                  total: model.fraud,
                  color: 'bg-emerald-500',
                },
                {
                  label: 'Fraud missed by automatic block',
                  value: model.fraudMissed,
                  total: model.fraud,
                  color: 'bg-rose-500',
                },
                {
                  label: 'Review capacity consumed',
                  value: Math.min(model.reviewQueue, reviewCapacity),
                  total: Math.max(model.reviewQueue, reviewCapacity),
                  color: model.overflow > 0 ? 'bg-rose-500' : 'bg-cyan-500',
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-medium text-neutral-700 dark:text-neutral-200">{row.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {formatCount(row.value)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded ${row.color}`}
                      style={{ width: `${Math.min(100, (row.value / Math.max(1, row.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-md border p-5 ${decisionStyle}`} aria-live="polite">
            <DecisionIcon
              aria-hidden="true"
              className={`h-6 w-6 ${
                model.tone === 'healthy'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : model.tone === 'warning'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-rose-700 dark:text-rose-300'
              }`}
            />
            <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Policy diagnosis
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.title}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.detail}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
