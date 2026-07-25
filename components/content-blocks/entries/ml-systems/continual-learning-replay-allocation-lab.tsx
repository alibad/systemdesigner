'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  Gauge,
  History,
  Layers3,
  RefreshCw,
  Scale,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type StrategyId = 'uniform' | 'balanced' | 'hybrid';
type ShiftId = 'nearby' | 'moderate' | 'distant';

type Strategy = {
  id: StrategyId;
  label: string;
  description: string;
  retentionPower: number;
  retentionBoost: number;
  plasticityBoost: number;
  computeOverhead: number;
  icon: LucideIcon;
};

const STRATEGIES: Strategy[] = [
  {
    id: 'uniform',
    label: 'Uniform replay',
    description: 'Sample old examples without task balancing.',
    retentionPower: 0.9,
    retentionBoost: 0,
    plasticityBoost: 1.5,
    computeOverhead: 0,
    icon: History,
  },
  {
    id: 'balanced',
    label: 'Task-balanced replay',
    description: 'Reserve equal replay capacity for each retained task.',
    retentionPower: 1.1,
    retentionBoost: 0.03,
    plasticityBoost: 0,
    computeOverhead: 0.12,
    icon: Scale,
  },
  {
    id: 'hybrid',
    label: 'Replay + EWC',
    description: 'Replay examples and constrain important parameters.',
    retentionPower: 1.15,
    retentionBoost: 0.14,
    plasticityBoost: -1,
    computeOverhead: 0.38,
    icon: Layers3,
  },
];

const SHIFTS: Array<{ id: ShiftId; label: string; newTaskPenalty: number; forgettingPressure: number }> = [
  { id: 'nearby', label: 'Nearby domain', newTaskPenalty: 0, forgettingPressure: 2 },
  { id: 'moderate', label: 'Moderate shift', newTaskPenalty: 4, forgettingPressure: 4 },
  { id: 'distant', label: 'Distant task', newTaskPenalty: 9, forgettingPressure: 8 },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className={`h-4 w-4 ${tone}`} />
        {label}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

export default function ContinualLearningReplayAllocationLab() {
  const [strategyId, setStrategyId] = useState<StrategyId>('balanced');
  const [shiftId, setShiftId] = useState<ShiftId>('moderate');
  const [replayShare, setReplayShare] = useState(35);
  const [retainedTasks, setRetainedTasks] = useState(4);

  const result = useMemo(() => {
    const strategy = STRATEGIES.find((item) => item.id === strategyId) ?? STRATEGIES[1];
    const shift = SHIFTS.find((item) => item.id === shiftId) ?? SHIFTS[1];
    const preservation = clamp(
      (replayShare / 100) * 1.15 * strategy.retentionPower + strategy.retentionBoost,
      0,
      0.94,
    );
    const forgettingPressure = 5 + retainedTasks * 1.2 + shift.forgettingPressure;
    const forgetting = clamp(forgettingPressure * (1 - preservation), 0.7, 32);
    const retainedAccuracy = clamp(92 - forgetting, 55, 92);
    const newTaskAccuracy = clamp(
      90 - shift.newTaskPenalty - replayShare * 0.115 + strategy.plasticityBoost,
      55,
      94,
    );
    const compute = 1 + (replayShare / 100) * (0.9 + retainedTasks * 0.05) + strategy.computeOverhead;
    const storedExamples = Math.round(replayShare * retainedTasks * 240);
    const retentionPass = retainedAccuracy >= 84;
    const adaptationPass = newTaskAccuracy >= 80;
    const status = retentionPass && adaptationPass
      ? 'Balanced update'
      : !retentionPass
        ? 'Retention at risk'
        : 'Adaptation constrained';
    const explanation = retentionPass && adaptationPass
      ? 'The update clears both release gates: it learns the new distribution while retaining enough earlier capability.'
      : !retentionPass
        ? 'The new task can learn, but the replay plan does not protect earlier tasks. Increase replay, balance the buffer, or add a parameter constraint.'
        : 'Earlier tasks are protected, but replay pressure leaves too little plasticity for the new task. Reduce replay or use a less restrictive strategy.';

    return {
      strategy,
      forgetting,
      retainedAccuracy,
      newTaskAccuracy,
      compute,
      storedExamples,
      retentionPass,
      adaptationPass,
      status,
      explanation,
    };
  }, [replayShare, retainedTasks, shiftId, strategyId]);

  const reset = () => {
    setStrategyId('balanced');
    setShiftId('moderate');
    setReplayShare(35);
    setRetainedTasks(4);
  };

  const healthy = result.retentionPass && result.adaptationPass;

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <BrainCircuit aria-hidden="true" className="h-4 w-4" />
              Stability-plasticity lab
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">Allocate one update batch between new and remembered data</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Move replay capacity and watch retention, adaptation, memory, and training cost change together.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-6 border-b border-neutral-200 bg-neutral-50 p-5 md:p-6 xl:border-b-0 xl:border-r dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose a preservation strategy</legend>
            <div className="mt-3 grid gap-2">
              {STRATEGIES.map((strategy) => {
                const selected = strategy.id === strategyId;
                const Icon = strategy.icon;
                return (
                  <button
                    key={strategy.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStrategyId(strategy.id)}
                    className={`flex min-h-[86px] w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3 text-sm font-bold">
                        {strategy.label}
                        {selected ? <span className="text-[10px] uppercase text-blue-700 dark:text-blue-200">Selected</span> : null}
                      </span>
                      <span className={`mt-1 block text-xs leading-5 ${selected ? 'text-blue-800 dark:text-blue-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {strategy.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Set task distance</legend>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-neutral-200 p-1 dark:bg-neutral-800">
              {SHIFTS.map((shift) => {
                const selected = shift.id === shiftId;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setShiftId(shift.id)}
                    className={`min-h-12 rounded-md px-2 text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      selected
                        ? 'bg-white text-violet-800 shadow-sm dark:bg-violet-950 dark:text-violet-200'
                        : 'text-neutral-600 hover:bg-white/60 dark:text-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {shift.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-900 dark:text-white">
              Replay examples per 100-example update
              <output className="rounded-md bg-white px-2 py-1 font-mono text-blue-700 shadow-sm dark:bg-neutral-800 dark:text-blue-300">{replayShare}</output>
            </span>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={replayShare}
              onChange={(event) => setReplayShare(Number(event.target.value))}
              className="mt-4 w-full cursor-pointer accent-blue-600"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>All new data</span>
              <span>80 replay examples</span>
            </span>
          </label>

          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-900 dark:text-white">
              Earlier tasks to retain
              <output className="rounded-md bg-white px-2 py-1 font-mono text-violet-700 shadow-sm dark:bg-neutral-800 dark:text-violet-300">{retainedTasks}</output>
            </span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={retainedTasks}
              onChange={(event) => setRetainedTasks(Number(event.target.value))}
              className="mt-4 w-full cursor-pointer accent-violet-600"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>1 task</span>
              <span>8 tasks</span>
            </span>
          </label>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Update batch composition</p>
              <h4 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">Plasticity and memory compete for the same batch</h4>
            </div>
            <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
              healthy
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
            }`}>
              {healthy ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
              {result.status}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex h-16 w-full text-xs font-bold">
              <div
                className="flex min-w-0 items-center justify-center bg-cyan-100 px-2 text-cyan-950 transition-[width] motion-reduce:transition-none dark:bg-cyan-950 dark:text-cyan-100"
                style={{ width: `${100 - replayShare}%` }}
              >
                {100 - replayShare >= 18 ? `${100 - replayShare} new` : null}
              </div>
              <div
                className="flex min-w-0 items-center justify-center bg-violet-100 px-2 text-violet-950 transition-[width] motion-reduce:transition-none dark:bg-violet-950 dark:text-violet-100"
                style={{ width: `${replayShare}%` }}
              >
                {replayShare >= 18 ? `${replayShare} replay` : null}
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-neutral-200 text-xs dark:border-neutral-800">
              <div className="px-3 py-2 text-cyan-800 dark:text-cyan-200">New distribution / plasticity</div>
              <div className="px-3 py-2 text-right text-violet-800 dark:text-violet-200">Earlier tasks / stability</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
            <Metric
              icon={Sparkles}
              label="New-task accuracy"
              value={`${result.newTaskAccuracy.toFixed(1)}%`}
              detail={result.adaptationPass ? 'Adaptation gate passes' : 'Below the 80% gate'}
              tone={result.adaptationPass ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}
            />
            <Metric
              icon={History}
              label="Retained accuracy"
              value={`${result.retainedAccuracy.toFixed(1)}%`}
              detail={result.retentionPass ? 'Retention gate passes' : 'Below the 84% gate'}
              tone={result.retentionPass ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}
            />
            <Metric
              icon={Gauge}
              label="Forgetting"
              value={`${result.forgetting.toFixed(1)} pts`}
              detail="Drop from the earlier-task baseline"
              tone="text-amber-600 dark:text-amber-300"
            />
            <Metric
              icon={Database}
              label="Replay storage"
              value={`${(result.storedExamples / 1000).toFixed(1)}k`}
              detail={`${result.compute.toFixed(2)}x training compute`}
              tone="text-blue-600 dark:text-blue-300"
            />
          </div>

          <div className={`mt-6 rounded-lg border p-5 ${
            healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          }`}>
            <div className="flex items-start gap-3">
              <Scale aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${healthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`} />
              <div>
                <p className="font-bold text-neutral-950 dark:text-white">{result.status}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Illustrative model: release gates and coefficients are teaching values. Calibrate them with task-specific validation sets and business risk.
          </p>
        </div>
      </div>
    </section>
  );
}
