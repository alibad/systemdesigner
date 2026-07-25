'use client';

import {
  AlertTriangle,
  Banknote,
  Check,
  CircleDollarSign,
  FlaskConical,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type RolloutId = 'shadow' | 'canary-1' | 'canary-10' | 'full';

const ROLLOUTS: Array<{ id: RolloutId; label: string; exposure: string }> = [
  { id: 'shadow', label: 'Shadow', exposure: '0% exposed' },
  { id: 'canary-1', label: '1% canary', exposure: '1% exposed' },
  { id: 'canary-10', label: '10% canary', exposure: '10% exposed' },
  { id: 'full', label: 'Full launch', exposure: '100% exposed' },
];

const ROLLOUT_RANK: Record<RolloutId, number> = {
  shadow: 0,
  'canary-1': 1,
  'canary-10': 2,
  full: 3,
};

export default function GenaiInterviewFrameworkReleaseLab() {
  const [qualityLift, setQualityLift] = useState(7);
  const [criticalFailures, setCriticalFailures] = useState(0);
  const [costDelta, setCostDelta] = useState(12);
  const [rolloutId, setRolloutId] = useState<RolloutId>('canary-1');

  const qualityPass = qualityLift >= 3;
  const safetyPass = criticalFailures === 0;
  const costPass = costDelta <= 20;
  const maxRollout: RolloutId | 'hold' = !safetyPass
    ? 'hold'
    : !qualityPass
      ? 'shadow'
      : !costPass
        ? 'canary-1'
        : 'canary-10';
  const approved = maxRollout !== 'hold' && ROLLOUT_RANK[rolloutId] <= ROLLOUT_RANK[maxRollout];
  const selectedRollout = ROLLOUTS.find((rollout) => rollout.id === rolloutId) ?? ROLLOUTS[0];
  const decision = getDecision({ approved, maxRollout, rolloutId, qualityPass, safetyPass, costPass });

  return (
    <section
      aria-labelledby="release-lab-title"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white dark:border-neutral-700 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-md bg-amber-300 text-neutral-950">
            <FlaskConical aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Release decision lab</p>
            <h3 id="release-lab-title" className="mt-1 text-xl font-semibold text-white sm:text-2xl">
              Decide how much evidence earns exposure
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Set evaluation, safety, and unit-economics evidence, then request a rollout. Critical safety failures are a hard gate, not a score to average away.
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-6 border-b border-neutral-200 p-5 dark:border-neutral-700 sm:p-6 lg:border-b-0 lg:border-r">
          <RangeControl
            icon={Gauge}
            id="quality-lift"
            label="Task-success lift"
            max={15}
            min={-5}
            onChange={setQualityLift}
            unit=" pp"
            value={qualityLift}
          />
          <RangeControl
            icon={ShieldAlert}
            id="critical-failures"
            label="Critical safety failures"
            max={5}
            min={0}
            onChange={setCriticalFailures}
            unit=""
            value={criticalFailures}
          />
          <RangeControl
            icon={CircleDollarSign}
            id="cost-delta"
            label="Cost per successful task"
            max={60}
            min={-30}
            onChange={setCostDelta}
            unit="%"
            value={costDelta}
          />

          <fieldset>
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Requested rollout radius</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {ROLLOUTS.map((rollout) => {
                const selected = rollout.id === rolloutId;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected
                      ? 'min-h-20 rounded-md border border-amber-600 bg-amber-100 px-2 py-3 text-amber-950 ring-1 ring-amber-600 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-300'
                      : 'min-h-20 rounded-md border border-neutral-200 bg-white px-2 py-3 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500'}
                    key={rollout.id}
                    onClick={() => setRolloutId(rollout.id)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold">{rollout.label}</span>
                    <span className="mt-1 block text-[11px] opacity-75">{rollout.exposure}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="bg-neutral-50 p-5 dark:bg-neutral-900 sm:p-6">
          <div className={approved
            ? 'border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4 dark:border-emerald-300 dark:bg-emerald-950/60'
            : 'border-l-4 border-rose-500 bg-rose-50 px-4 py-4 dark:border-rose-300 dark:bg-rose-950/60'}>
            <div className="flex items-start gap-3">
              {approved
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-700 dark:text-emerald-200" />
                : <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-rose-700 dark:text-rose-200" />}
              <div>
                <p className={approved
                  ? 'text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200'
                  : 'text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200'}>
                  {approved ? 'Request approved' : 'Request blocked'}
                </p>
                <h4 className={approved
                  ? 'mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50'
                  : 'mt-1 text-xl font-semibold text-rose-950 dark:text-rose-50'}>
                  {decision.title}
                </h4>
                <p className={approved
                  ? 'mt-2 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                  : 'mt-2 text-sm leading-6 text-rose-900 dark:text-rose-100'}>
                  {decision.explanation}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Gate
              detail={`${qualityLift > 0 ? '+' : ''}${qualityLift} pp measured lift`}
              label="Evaluation"
              pass={qualityPass}
              requirement="At least +3 pp"
            />
            <Gate
              detail={`${criticalFailures} critical failures`}
              label="Safety"
              pass={safetyPass}
              requirement="Exactly zero"
            />
            <Gate
              detail={`${costDelta > 0 ? '+' : ''}${costDelta}% per success`}
              label="Economics"
              pass={costPass}
              requirement="No more than +20%"
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence-to-exposure ladder</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Maximum: {formatMaxRollout(maxRollout)}</p>
            </div>
            <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Release exposure ladder">
              {ROLLOUTS.map((rollout, index) => {
                const permitted = maxRollout !== 'hold' && index <= ROLLOUT_RANK[maxRollout];
                const requested = rollout.id === rolloutId;
                return (
                  <li className="min-w-0" key={rollout.id}>
                    <div className={permitted
                      ? 'h-2 rounded-full bg-emerald-500 dark:bg-emerald-400'
                      : 'h-2 rounded-full bg-neutral-200 dark:bg-neutral-700'} />
                    <p className={requested
                      ? 'mt-2 break-words text-xs font-semibold text-neutral-950 dark:text-white'
                      : 'mt-2 break-words text-xs text-neutral-500 dark:text-neutral-400'}>
                      {rollout.label}{requested ? ' (requested)' : ''}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-6 flex items-start gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <Banknote aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-700 dark:text-violet-300" />
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Interview signal</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Name every gate, its threshold, its evidence source, and the rollback trigger. Averages are useful for quality and cost; critical harms need separate zero-tolerance checks.
              </p>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            {selectedRollout.label} is {approved ? 'approved' : 'blocked'}. {decision.explanation}
          </p>
        </div>
      </div>
    </section>
  );
}

function RangeControl({
  icon: Icon,
  id,
  label,
  max,
  min,
  onChange,
  unit,
  value,
}: {
  icon: LucideIcon;
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  unit: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white" htmlFor={id}>
          <Icon aria-hidden="true" className="size-4 text-violet-700 dark:text-violet-300" />
          {label}
        </label>
        <output className="shrink-0 font-mono text-sm font-semibold text-violet-800 dark:text-violet-200" htmlFor={id}>
          {value > 0 ? '+' : ''}{value}{unit}
        </output>
      </div>
      <input
        className="mt-3 w-full accent-violet-700 dark:accent-violet-400"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
      <div className="mt-1 flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function Gate({
  detail,
  label,
  pass,
  requirement,
}: {
  detail: string;
  label: string;
  pass: boolean;
  requirement: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <span className={pass
          ? 'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
          : 'inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300'}>
          {pass ? <Check aria-hidden="true" className="size-3.5" /> : <AlertTriangle aria-hidden="true" className="size-3.5" />}
          {pass ? 'Pass' : 'Fail'}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">{detail}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Gate: {requirement}</p>
    </div>
  );
}

function formatMaxRollout(maxRollout: RolloutId | 'hold') {
  if (maxRollout === 'hold') return 'Hold';
  return ROLLOUTS.find((rollout) => rollout.id === maxRollout)?.label ?? 'Hold';
}

function getDecision({
  approved,
  maxRollout,
  rolloutId,
  qualityPass,
  safetyPass,
  costPass,
}: {
  approved: boolean;
  maxRollout: RolloutId | 'hold';
  rolloutId: RolloutId;
  qualityPass: boolean;
  safetyPass: boolean;
  costPass: boolean;
}) {
  if (!safetyPass) {
    return {
      title: 'Hold the candidate',
      explanation: 'A critical safety failure blocks every user-facing rollout. Reproduce it, repair the control path, and rerun the full release suite before requesting exposure again.',
    };
  }
  if (!qualityPass) {
    return {
      title: approved ? 'Shadow traffic only' : 'Reduce the request to shadow mode',
      explanation: 'The candidate has not demonstrated the minimum task-success improvement. Shadow evaluation can collect production-shaped evidence without changing user outcomes.',
    };
  }
  if (!costPass) {
    return {
      title: approved ? 'Cap exposure at 1%' : 'The cost guardrail limits exposure to 1%',
      explanation: 'Quality and safety pass, but unit economics do not. Use a small canary to test routing, caching, and model-tier changes before increasing traffic.',
    };
  }
  if (rolloutId === 'full') {
    return {
      title: 'A full launch needs canary evidence',
      explanation: 'Offline evidence supports a 10% canary, not immediate global exposure. Define production abort thresholds and earn the next stage with observed quality, safety, latency, and cost.',
    };
  }
  return {
    title: approved ? `Proceed with ${formatMaxRollout(rolloutId)}` : `Reduce exposure to ${formatMaxRollout(maxRollout)}`,
    explanation: approved
      ? 'All current gates support this bounded exposure. Monitor the same metrics by cohort and roll back automatically if a guardrail crosses its threshold.'
      : 'The evidence is promising, but the requested blast radius is larger than the gates currently support. Advance one measured stage at a time.',
  };
}
