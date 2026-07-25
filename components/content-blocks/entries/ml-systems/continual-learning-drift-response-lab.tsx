'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowDown,
  CheckCircle2,
  Clock3,
  CloudCog,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  TimerReset,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

type DriftId = 'gradual' | 'sudden' | 'seasonal';
type PolicyId = 'scheduled' | 'triggered' | 'shadow';

type DriftScenario = {
  id: DriftId;
  label: string;
  description: string;
  delayHours: number;
  forgettingPressure: number;
  computeFactor: number;
  noise: number;
  icon: LucideIcon;
};

type Policy = {
  id: PolicyId;
  label: string;
  description: string;
  delayFactor: number;
  retentionFactor: number;
  computeFactor: number;
};

const DRIFTS: DriftScenario[] = [
  {
    id: 'gradual',
    label: 'Gradual drift',
    description: 'Preferences move over several weeks.',
    delayHours: 36,
    forgettingPressure: 7,
    computeFactor: 0.8,
    noise: 0.45,
    icon: TrendingUp,
  },
  {
    id: 'sudden',
    label: 'Sudden shift',
    description: 'A policy or product change breaks the baseline.',
    delayHours: 12,
    forgettingPressure: 13,
    computeFactor: 1.1,
    noise: 0.15,
    icon: Siren,
  },
  {
    id: 'seasonal',
    label: 'Seasonal return',
    description: 'A known pattern returns with some variation.',
    delayHours: 24,
    forgettingPressure: 9,
    computeFactor: 1,
    noise: 0.8,
    icon: History,
  },
];

const POLICIES: Policy[] = [
  {
    id: 'scheduled',
    label: 'Scheduled retraining',
    description: 'Update on a fixed calendar after labels arrive.',
    delayFactor: 2.2,
    retentionFactor: 1.05,
    computeFactor: 0.65,
  },
  {
    id: 'triggered',
    label: 'Drift-triggered update',
    description: 'Start an update when a diagnosed signal crosses threshold.',
    delayFactor: 0.9,
    retentionFactor: 0.9,
    computeFactor: 1,
  },
  {
    id: 'shadow',
    label: 'Trigger + shadow replay',
    description: 'Train early, replay retained tasks, and validate in shadow.',
    delayFactor: 1.15,
    retentionFactor: 0.45,
    computeFactor: 1.65,
  },
];

function Toggle({
  checked,
  label,
  description,
  icon: Icon,
  tone,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'rose';
  onChange: () => void;
}) {
  const activeClasses = tone === 'rose'
    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
    : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40';
  const switchClasses = tone === 'rose' ? 'bg-rose-600 dark:bg-rose-500' : 'bg-blue-600 dark:bg-blue-500';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? activeClasses : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
      }`}
    >
      <span className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${checked ? (tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300') : 'text-neutral-500 dark:text-neutral-400'}`} />
        <span>
          <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</span>
        </span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? switchClasses : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function OutcomeMetric({
  icon: Icon,
  label,
  value,
  detail,
  pass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  pass: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${
      pass
        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
        : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className={`h-5 w-5 ${pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`} />
        <span className={`text-[10px] font-bold uppercase ${pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {pass ? 'Within gate' : 'Gate missed'}
        </span>
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{label}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

export default function ContinualLearningDriftResponseLab() {
  const [driftId, setDriftId] = useState<DriftId>('gradual');
  const [policyId, setPolicyId] = useState<PolicyId>('triggered');
  const [sensitivity, setSensitivity] = useState(60);
  const [reversibleRelease, setReversibleRelease] = useState(true);
  const [regressionInjected, setRegressionInjected] = useState(false);

  const result = useMemo(() => {
    const drift = DRIFTS.find((item) => item.id === driftId) ?? DRIFTS[0];
    const policy = POLICIES.find((item) => item.id === policyId) ?? POLICIES[1];
    const sensitivityFactor = 1.2 - sensitivity * 0.007;
    const adaptationDelay = Math.max(1, drift.delayHours * policy.delayFactor * sensitivityFactor);
    const frequentUpdatePenalty = Math.max(0, sensitivity - 65) * 0.08;
    const forgetting = drift.forgettingPressure * policy.retentionFactor + frequentUpdatePenalty;
    const compute = drift.computeFactor * policy.computeFactor * (0.7 + sensitivity * 0.009);
    const falseTriggers = Math.round(drift.noise * (sensitivity / 100) * 20);
    const delayPass = adaptationDelay <= 36;
    const forgettingPass = forgetting <= 10;
    const computePass = compute <= 2.25;
    const rollbackPass = !regressionInjected || reversibleRelease;
    const healthy = delayPass && forgettingPass && computePass && rollbackPass;
    const status = regressionInjected && !reversibleRelease
      ? 'Unsafe regression exposure'
      : !forgettingPass
        ? 'Retention gate fails'
        : !delayPass
          ? 'Adaptation is too slow'
          : !computePass
            ? 'Compute budget exceeded'
            : regressionInjected
              ? 'Regression contained'
              : 'Canary ready';
    const releaseConsequence = regressionInjected
      ? reversibleRelease
        ? 'The canary is stopped and the previous checkpoint resumes in about 12 minutes. New samples remain queued for diagnosis.'
        : 'The regressed model remains exposed while operators rebuild a prior version. Estimated manual recovery is eight hours.'
      : reversibleRelease
        ? 'A versioned checkpoint and canary route keep the next update reversible if a retained-task slice regresses.'
        : 'The candidate can launch, but a hidden regression would require a manual rebuild instead of a fast traffic rollback.';

    return {
      drift,
      policy,
      adaptationDelay,
      forgetting,
      compute,
      falseTriggers,
      delayPass,
      forgettingPass,
      computePass,
      rollbackPass,
      healthy,
      status,
      releaseConsequence,
    };
  }, [driftId, policyId, regressionInjected, reversibleRelease, sensitivity]);

  const reset = () => {
    setDriftId('gradual');
    setPolicyId('triggered');
    setSensitivity(60);
    setReversibleRelease(true);
    setRegressionInjected(false);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-300">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Drift response lab
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">Choose when to adapt and how to recover</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Compare retraining policies, then inject a bad update to expose the operational cost of an irreversible release.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(310px,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-6 border-b border-neutral-200 bg-neutral-50 p-5 md:p-6 xl:border-b-0 xl:border-r dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Select the change pattern</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {DRIFTS.map((drift) => {
                const selected = drift.id === driftId;
                const Icon = drift.icon;
                return (
                  <button
                    key={drift.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDriftId(drift.id)}
                    className={`flex min-h-[78px] items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-500 dark:text-neutral-400'}`} />
                    <span>
                      <span className="block text-sm font-bold">{drift.label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${selected ? 'text-violet-800 dark:text-violet-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {drift.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose the retraining policy</legend>
            <div className="mt-3 space-y-2">
              {POLICIES.map((policy) => {
                const selected = policy.id === policyId;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPolicyId(policy.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-bold">
                      {policy.label}
                      {selected ? <span className="text-[10px] uppercase text-blue-700 dark:text-blue-200">Selected</span> : null}
                    </span>
                    <span className={`mt-1 block text-xs leading-5 ${selected ? 'text-blue-800 dark:text-blue-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {policy.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-900 dark:text-white">
              Trigger sensitivity
              <output className="rounded-md bg-white px-2 py-1 font-mono text-amber-700 shadow-sm dark:bg-neutral-800 dark:text-amber-300">{sensitivity}%</output>
            </span>
            <input
              type="range"
              min="20"
              max="90"
              step="5"
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
              className="mt-4 w-full cursor-pointer accent-amber-600"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>Conservative / slower</span>
              <span>Aggressive / noisier</span>
            </span>
          </label>

          <div className="space-y-2">
            <Toggle
              checked={reversibleRelease}
              label="Reversible canary release"
              description="Keep the previous checkpoint and a tested traffic rollback."
              icon={ShieldCheck}
              tone="blue"
              onChange={() => setReversibleRelease((value) => !value)}
            />
            <Toggle
              checked={regressionInjected}
              label="Inject retained-task regression"
              description="Challenge the release with a candidate that passed the new-task metric but forgot old behavior."
              icon={AlertOctagon}
              tone="rose"
              onChange={() => setRegressionInjected((value) => !value)}
            />
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Projected operating outcome</p>
              <h4 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">Every adaptation policy spends time, compute, and safety margin</h4>
            </div>
            <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
              result.healthy
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
            }`}>
              {result.healthy ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <AlertOctagon aria-hidden="true" className="h-4 w-4" />}
              {result.status}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <OutcomeMetric
              icon={Clock3}
              label="Adaptation delay"
              value={result.adaptationDelay < 24 ? `${result.adaptationDelay.toFixed(1)} hr` : `${(result.adaptationDelay / 24).toFixed(1)} days`}
              detail="Gate: no more than 36 hours"
              pass={result.delayPass}
            />
            <OutcomeMetric
              icon={History}
              label="Retained-task forgetting"
              value={`${result.forgetting.toFixed(1)} pts`}
              detail="Gate: no more than 10 points"
              pass={result.forgettingPass}
            />
            <OutcomeMetric
              icon={CloudCog}
              label="Weekly compute"
              value={`${result.compute.toFixed(2)}x`}
              detail={`${result.falseTriggers} false trigger${result.falseTriggers === 1 ? '' : 's'} projected`}
              pass={result.computePass}
            />
            <OutcomeMetric
              icon={RotateCcw}
              label="Rollback posture"
              value={reversibleRelease ? (regressionInjected ? '12 min' : 'Ready') : (regressionInjected ? '8 hr' : 'Manual')}
              detail={reversibleRelease ? 'Previous checkpoint retained' : 'No fast traffic rollback'}
              pass={result.rollbackPass}
            />
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Response path</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_24px_minmax(0,1fr)] md:items-stretch">
              <div className="rounded-lg border border-violet-200 bg-white p-4 dark:border-violet-900 dark:bg-neutral-950">
                <Activity aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Detect and diagnose</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.drift.label} at {sensitivity}% sensitivity</p>
              </div>
              <div className="flex items-center justify-center text-neutral-400">
                <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
              </div>
              <div className="rounded-lg border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-neutral-950">
                <TimerReset aria-hidden="true" className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Train and validate</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.policy.label} / {result.compute.toFixed(2)}x compute</p>
              </div>
              <div className="flex items-center justify-center text-neutral-400">
                <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
              </div>
              <div className={`rounded-lg border p-4 ${
                result.rollbackPass
                  ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}>
                {result.rollbackPass
                  ? <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  : <AlertOctagon aria-hidden="true" className="h-5 w-5 text-rose-700 dark:text-rose-300" />}
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Release or recover</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {regressionInjected ? (reversibleRelease ? 'Regression rolled back' : 'Regression remains exposed') : 'Candidate ready for canary'}
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${
            result.rollbackPass
              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}>
            <div className="flex items-start gap-3">
              {result.rollbackPass
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
                : <AlertOctagon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="font-bold text-neutral-950 dark:text-white">{result.status}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.releaseConsequence}</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Illustrative model: measure real drift, label delay, task retention, infrastructure cost, and rollback time before automating a production policy.
          </p>
        </div>
      </div>
    </section>
  );
}
