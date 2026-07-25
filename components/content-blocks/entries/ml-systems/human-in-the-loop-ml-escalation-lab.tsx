'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Gauge,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

type ScenarioId = 'moderation' | 'credit' | 'medical';

type Scenario = {
  id: ScenarioId;
  label: string;
  description: string;
  volume: number;
  reviewCapacity: number;
  expertCapacity: number;
  baseErrorRate: number;
  mandatoryShare: number;
  escapedRiskLimit: number;
};

const scenarios: Scenario[] = [
  {
    id: 'moderation',
    label: 'Content moderation',
    description: 'High volume, reversible decisions',
    volume: 12000,
    reviewCapacity: 4800,
    expertCapacity: 1800,
    baseErrorRate: 6,
    mandatoryShare: 3,
    escapedRiskLimit: 45,
  },
  {
    id: 'credit',
    label: 'Credit eligibility',
    description: 'Regulated, material user impact',
    volume: 6000,
    reviewCapacity: 2500,
    expertCapacity: 1000,
    baseErrorRate: 4.5,
    mandatoryShare: 12,
    escapedRiskLimit: 25,
  },
  {
    id: 'medical',
    label: 'Medical triage',
    description: 'Lower volume, irreversible harm',
    volume: 3000,
    reviewCapacity: 1700,
    expertCapacity: 600,
    baseErrorRate: 3.5,
    mandatoryShare: 22,
    escapedRiskLimit: 8,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function formatInteger(value: number) {
  return Math.round(value).toLocaleString();
}

function Metric({
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

export default function HumanInTheLoopMlEscalationLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('credit');
  const [autoThreshold, setAutoThreshold] = useState(88);
  const [expertThreshold, setExpertThreshold] = useState(48);
  const [mandatoryReview, setMandatoryReview] = useState(true);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[1];

  const result = useMemo(() => {
    const rawAutoShare = clamp(91 - (autoThreshold - 72) * 1.7, 20, 88);
    const expertShare = clamp(3 + (expertThreshold - 25) * 0.48, 3, 26);
    const policyReviewShare = mandatoryReview ? scenario.mandatoryShare : 0;
    const autoShare = Math.max(8, rawAutoShare - policyReviewShare);
    const reviewShare = Math.max(0, 100 - autoShare - expertShare);

    const automatedCases = (scenario.volume * autoShare) / 100;
    const reviewCases = (scenario.volume * reviewShare) / 100;
    const expertCases = (scenario.volume * expertShare) / 100;
    const reviewUtilization = (reviewCases / scenario.reviewCapacity) * 100;
    const expertUtilization = (expertCases / scenario.expertCapacity) * 100;
    const peakUtilization = Math.max(reviewUtilization, expertUtilization);
    const delayHours =
      peakUtilization <= 70
        ? 1.2
        : peakUtilization <= 100
          ? 1.2 + (peakUtilization - 70) * 0.09
          : 4 + (peakUtilization - 100) * 0.24;
    const policyProtection = mandatoryReview ? 0.35 : 1;
    const escapedRisk =
      automatedCases *
      (scenario.baseErrorRate / 100) *
      ((100 - autoThreshold) / 26) *
      policyProtection;
    const riskPasses = escapedRisk <= scenario.escapedRiskLimit;
    const capacityPasses = peakUtilization <= 100;

    const status = !riskPasses
      ? {
          label: 'Risk boundary missed',
          detail: 'Too many likely errors bypass human review. Raise the automation threshold or restore mandatory review.',
          tone: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
          icon: ShieldAlert,
        }
      : !capacityPasses
        ? {
            label: 'Review queue overloaded',
            detail: 'The policy is protective, but the assigned queue cannot resolve arrivals within its capacity.',
            tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
            icon: AlertTriangle,
          }
        : {
            label: 'Balanced routing policy',
            detail: 'Escaped risk stays inside the scenario limit and both human queues remain within daily capacity.',
            tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
            icon: UserCheck,
          };

    return {
      autoShare,
      reviewShare,
      expertShare,
      automatedCases,
      reviewCases,
      expertCases,
      reviewUtilization,
      expertUtilization,
      peakUtilization,
      delayHours,
      escapedRisk,
      status,
    };
  }, [autoThreshold, expertThreshold, mandatoryReview, scenario]);

  const reset = () => {
    setScenarioId('credit');
    setAutoThreshold(88);
    setExpertThreshold(48);
    setMandatoryReview(true);
  };

  const updateAutoThreshold = (nextValue: number) => {
    setAutoThreshold(nextValue);
    if (expertThreshold > nextValue - 8) {
      setExpertThreshold(nextValue - 8);
    }
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-300">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Escalation threshold lab
            </div>
            <h3 className="mt-2 text-xl font-bold md:text-2xl">Choose what the model may decide alone</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Tune the automation and expert boundaries. A valid policy must protect users without sending more work than the review system can finish.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="min-w-0 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">1. Choose the operating domain</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {scenarios.map((item) => {
                const selected = item.id === scenarioId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScenarioId(item.id)}
                    className={`min-h-28 rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50'
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
                Auto-decide at or above
                <strong className="tabular-nums text-blue-700 dark:text-blue-300">{autoThreshold}%</strong>
              </span>
              <input
                type="range"
                min="76"
                max="98"
                step="1"
                value={autoThreshold}
                onChange={(event) => updateAutoThreshold(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-blue-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>More automation</span>
                <span>More review</span>
              </span>
            </label>

            <label className="block">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Escalate below
                <strong className="tabular-nums text-violet-700 dark:text-violet-300">{expertThreshold}%</strong>
              </span>
              <input
                type="range"
                min="25"
                max={autoThreshold - 8}
                step="1"
                value={expertThreshold}
                onChange={(event) => setExpertThreshold(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
              />
              <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Fewer experts</span>
                <span>More experts</span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Mandatory high-risk review</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                Route policy-sensitive cases even when confidence is high.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mandatoryReview}
              onClick={() => setMandatoryReview((current) => !current)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                mandatoryReview
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-neutral-400 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800'
              }`}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mandatoryReview ? 'translate-x-6' : 'translate-x-0.5'}`}
              />
              <span className="sr-only">Toggle mandatory high-risk review</span>
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
                  Policy outcome
                </div>
                <p className="mt-2 text-xl font-bold">{result.status.label}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.status.detail}</p>
              </div>
            );
          })()}

          <div className="mt-5 grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Metric icon={Bot} label="Automated" value={`${result.autoShare.toFixed(0)}%`} detail={`${formatInteger(result.automatedCases)} cases/day`} />
            <Metric icon={Users} label="Human review" value={`${result.reviewShare.toFixed(0)}%`} detail={`${result.reviewUtilization.toFixed(0)}% of capacity`} />
            <Metric icon={UserCheck} label="Expert" value={`${result.expertShare.toFixed(0)}%`} detail={`${result.expertUtilization.toFixed(0)}% of capacity`} />
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Daily route</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{scenario.volume.toLocaleString()} incoming cases</p>
              </div>
              <p className="text-right text-xs text-neutral-600 dark:text-neutral-400">
                Peak queue load <strong className="text-neutral-950 dark:text-white">{result.peakUtilization.toFixed(0)}%</strong>
              </p>
            </div>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
              <span className="bg-blue-500" style={{ width: `${result.autoShare}%` }} />
              <span className="bg-amber-500" style={{ width: `${result.reviewShare}%` }} />
              <span className="bg-violet-500" style={{ width: `${result.expertShare}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-neutral-500 dark:text-neutral-400">Estimated queue delay</p>
                <p className="mt-1 font-bold tabular-nums text-neutral-950 dark:text-white">{result.delayHours.toFixed(1)} hours</p>
              </div>
              <div>
                <p className="text-neutral-500 dark:text-neutral-400">Likely errors escaping</p>
                <p className="mt-1 font-bold tabular-nums text-neutral-950 dark:text-white">{formatInteger(result.escapedRisk)} / day</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
