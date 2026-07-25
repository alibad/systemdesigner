'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  CheckCircle2,
  Clock3,
  Coins,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Sigma,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/quantum-as-a-service-architecture-experiment-budget-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/quantum-as-a-service-architecture/data/experiment-budget-model.json';

type NumericBound = {
  min: number;
  max: number;
  step: number;
};

type ExecutionTarget = {
  id: string;
  label: string;
  detail: string;
  kind: 'simulator' | 'qpu';
  queueWaitMinutes: number;
  taskOverheadMs: number;
  shotDurationMs: number;
  pricePerTaskUsd: number;
  pricePerShotUsd: number;
  maximumParallelTasks: number;
  maximumShotsPerTask: number;
  dailyTaskLimit: number;
};

type ExperimentBudgetModel = {
  kind: 'qaas-experiment-budget';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    targetId: string;
    circuitsPerIteration: number;
    iterations: number;
    shotsPerCircuit: number;
    mitigationScales: number;
    retryReservePercent: number;
    requestedParallelism: number;
    deadlineMinutes: number;
  };
  bounds: {
    circuitsPerIteration: NumericBound;
    iterations: NumericBound;
    shotsPerCircuit: NumericBound;
    mitigationScales: NumericBound;
    retryReservePercent: NumericBound;
    requestedParallelism: NumericBound;
    deadlineMinutes: NumericBound;
  };
  targets: ExecutionTarget[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isExperimentBudgetModel(value: unknown): value is ExperimentBudgetModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'qaas-experiment-budget'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.modelNote === 'string'
      && isRecord(value.defaults)
      && isRecord(value.bounds)
      && Array.isArray(value.targets)
      && value.targets.length >= 3
      && value.targets.every((target) => (
        isRecord(target)
        && typeof target.id === 'string'
        && typeof target.queueWaitMinutes === 'number'
        && typeof target.taskOverheadMs === 'number'
        && typeof target.shotDurationMs === 'number'
        && typeof target.pricePerTaskUsd === 'number'
        && typeof target.pricePerShotUsd === 'number'
        && typeof target.maximumParallelTasks === 'number'
        && typeof target.maximumShotsPerTask === 'number'
        && typeof target.dailyTaskLimit === 'number'
      )),
  );
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          {error} Retry
        </button>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
          Loading experiment budget...
        </>
      )}
    </div>
  );
}

export default function QuantumExperimentBudgetCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ExperimentBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [targetId, setTargetId] = useState('');
  const [circuitsPerIteration, setCircuitsPerIteration] = useState(24);
  const [iterations, setIterations] = useState(40);
  const [shotsPerCircuit, setShotsPerCircuit] = useState(1000);
  const [mitigationScales, setMitigationScales] = useState(3);
  const [retryReservePercent, setRetryReservePercent] = useState(10);
  const [requestedParallelism, setRequestedParallelism] = useState(8);
  const [deadlineMinutes, setDeadlineMinutes] = useState(120);

  function reset(nextModel: ExperimentBudgetModel) {
    setTargetId(nextModel.defaults.targetId);
    setCircuitsPerIteration(nextModel.defaults.circuitsPerIteration);
    setIterations(nextModel.defaults.iterations);
    setShotsPerCircuit(nextModel.defaults.shotsPerCircuit);
    setMitigationScales(nextModel.defaults.mitigationScales);
    setRetryReservePercent(nextModel.defaults.retryReservePercent);
    setRequestedParallelism(nextModel.defaults.requestedParallelism);
    setDeadlineMinutes(nextModel.defaults.deadlineMinutes);
  }

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isExperimentBudgetModel(payload)) {
          throw new Error('The experiment budget model is incomplete.');
        }
        setModel(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the experiment budget.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!model) return null;
    const target =
      model.targets.find((candidate) => candidate.id === targetId)
      ?? model.targets[0];
    const baseTasks = circuitsPerIteration * iterations * mitigationScales;
    const retryTasks = Math.ceil(baseTasks * retryReservePercent / 100);
    const totalTasks = baseTasks + retryTasks;
    const totalShots = totalTasks * shotsPerCircuit;
    const effectiveParallelism = Math.min(
      requestedParallelism,
      target.maximumParallelTasks,
    );
    const taskDurationMs =
      target.taskOverheadMs + shotsPerCircuit * target.shotDurationMs;
    const executionMinutes =
      Math.ceil(totalTasks / effectiveParallelism) * taskDurationMs / 60_000;
    const wallClockMinutes = target.queueWaitMinutes + executionMinutes;
    const estimatedCostUsd =
      totalTasks * target.pricePerTaskUsd
      + totalShots * target.pricePerShotUsd;
    const worstCaseMarginPercent =
      Math.min(100, 1.96 / Math.sqrt(shotsPerCircuit) * 100);
    const shotsClear = shotsPerCircuit <= target.maximumShotsPerTask;
    const taskLimitClears = totalTasks <= target.dailyTaskLimit;
    const deadlineClears = wallClockMinutes <= deadlineMinutes;
    const parallelismCapped = requestedParallelism > target.maximumParallelTasks;
    const gates = [
      {
        label: 'Provider task shape',
        clears: shotsClear,
        detail: shotsClear
          ? `${integer.format(shotsPerCircuit)} shots fit the ${integer.format(target.maximumShotsPerTask)}-shot task limit.`
          : `Split each circuit because ${integer.format(shotsPerCircuit)} shots exceed the ${integer.format(target.maximumShotsPerTask)}-shot task limit.`,
      },
      {
        label: 'Daily task quota',
        clears: taskLimitClears,
        detail: taskLimitClears
          ? `${integer.format(totalTasks)} tasks fit the ${integer.format(target.dailyTaskLimit)}-task teaching quota.`
          : `${integer.format(totalTasks)} tasks exceed the ${integer.format(target.dailyTaskLimit)}-task teaching quota.`,
      },
      {
        label: 'End-to-end deadline',
        clears: deadlineClears,
        detail: deadlineClears
          ? `${wallClockMinutes.toFixed(1)} modeled minutes fit the ${deadlineMinutes}-minute deadline.`
          : `${wallClockMinutes.toFixed(1)} modeled minutes exceed the ${deadlineMinutes}-minute deadline.`,
      },
    ];
    const feasible = gates.every((gate) => gate.clears);
    const tone = !feasible ? 'rose' : target.kind === 'simulator' ? 'amber' : 'emerald';
    const status = !feasible
      ? 'Budget does not clear'
      : target.kind === 'simulator'
        ? 'Feasible simulation plan'
        : 'Feasible illustrative QPU plan';
    const verdict = !feasible
      ? 'Reduce circuit variants, optimizer iterations, mitigation expansion, or shots; otherwise renegotiate the quota or deadline before submitting.'
      : target.kind === 'simulator'
        ? 'Use this run to validate orchestration and circuit behavior. It is not evidence that the selected workload benefits from quantum hardware.'
        : 'The modeled workload fits the operational envelope. Benchmark it against a strong classical baseline before calling the result useful.';

    return {
      target,
      baseTasks,
      retryTasks,
      totalTasks,
      totalShots,
      effectiveParallelism,
      executionMinutes,
      wallClockMinutes,
      estimatedCostUsd,
      worstCaseMarginPercent,
      parallelismCapped,
      gates,
      tone,
      status,
      verdict,
    };
  }, [
    circuitsPerIteration,
    deadlineMinutes,
    iterations,
    mitigationScales,
    model,
    requestedParallelism,
    retryReservePercent,
    shotsPerCircuit,
    targetId,
  ]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Experiment budget calculator"
          title={model?.title ?? 'Budget the complete experiment'}
          description={model?.description ?? 'Loading the experiment budget model.'}
          icon={Atom}
          accent="violet"
          onReset={model ? () => reset(model) : undefined}
        />

        {!model || !view ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Execution target
                  </legend>
                  <div className="mt-3 space-y-2">
                    {model.targets.map((target) => (
                      <LabChoice
                        key={target.id}
                        selected={target.id === view.target.id}
                        label={target.label}
                        detail={target.detail}
                        icon={target.kind === 'qpu' ? Atom : Cpu}
                        accent={target.kind === 'qpu' ? 'violet' : 'blue'}
                        onClick={() => setTargetId(target.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Circuits per iteration"
                  value={circuitsPerIteration}
                  output={integer.format(circuitsPerIteration)}
                  {...model.bounds.circuitsPerIteration}
                  accent="violet"
                  lowLabel="few observables"
                  highLabel="broad objective"
                  onChange={setCircuitsPerIteration}
                />
                <LabRange
                  label="Optimizer iterations"
                  value={iterations}
                  output={integer.format(iterations)}
                  {...model.bounds.iterations}
                  accent="violet"
                  lowLabel="short search"
                  highLabel="long search"
                  onChange={setIterations}
                />
                <LabRange
                  label="Deadline"
                  value={deadlineMinutes}
                  output={`${deadlineMinutes} min`}
                  {...model.bounds.deadlineMinutes}
                  accent="amber"
                  lowLabel="interactive"
                  highLabel="batch"
                  onChange={setDeadlineMinutes}
                />
              </div>
            )}
          >
            <div aria-live="polite">
              <div className="grid gap-6 xl:grid-cols-2">
                <section>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Measurement and resilience
                  </p>
                  <div className="mt-4 space-y-6">
                    <LabRange
                      label="Shots per circuit"
                      value={shotsPerCircuit}
                      output={integer.format(shotsPerCircuit)}
                      {...model.bounds.shotsPerCircuit}
                      accent="cyan"
                      lowLabel="noisy estimate"
                      highLabel="tighter estimate"
                      onChange={setShotsPerCircuit}
                    />
                    <LabRange
                      label="Mitigation scale count"
                      value={mitigationScales}
                      output={`${mitigationScales}x task expansion`}
                      {...model.bounds.mitigationScales}
                      accent="cyan"
                      lowLabel="none"
                      highLabel="many variants"
                      onChange={setMitigationScales}
                    />
                    <LabRange
                      label="Retry reserve"
                      value={retryReservePercent}
                      output={`${retryReservePercent}%`}
                      {...model.bounds.retryReservePercent}
                      accent="amber"
                      lowLabel="no headroom"
                      highLabel="failure-heavy"
                      onChange={setRetryReservePercent}
                    />
                    <LabRange
                      label="Requested parallel tasks"
                      value={requestedParallelism}
                      output={integer.format(requestedParallelism)}
                      {...model.bounds.requestedParallelism}
                      accent="blue"
                      lowLabel="serial"
                      highLabel="wide fan-out"
                      onChange={setRequestedParallelism}
                    />
                  </div>
                </section>

                <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Work multiplication
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                    <BudgetFactor
                      label="Circuits"
                      value={integer.format(circuitsPerIteration)}
                      detail="per iteration"
                    />
                    <BudgetFactor
                      label="Iterations"
                      value={`x ${integer.format(iterations)}`}
                      detail="optimizer rounds"
                    />
                    <BudgetFactor
                      label="Mitigation"
                      value={`x ${mitigationScales}`}
                      detail="execution variants"
                    />
                    <BudgetFactor
                      label="Retries"
                      value={`+ ${integer.format(view.retryTasks)}`}
                      detail="reserved tasks"
                    />
                  </div>
                  <div className="mt-4 flex items-start gap-3 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
                    <Sigma aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                    <p className="leading-6 text-neutral-700 dark:text-neutral-200">
                      <strong>{integer.format(view.totalTasks)} provider tasks</strong>{' '}
                      produce {integer.format(view.totalShots)} shots. The uncertainty
                      estimate applies per circuit, so unrelated circuit shots cannot
                      be pooled to claim a tighter observable.
                    </p>
                  </div>
                </section>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Total tasks"
                  value={integer.format(view.totalTasks)}
                  detail={`${integer.format(view.baseTasks)} planned + ${integer.format(view.retryTasks)} reserve`}
                  icon={Layers3}
                  tone="violet"
                />
                <LabMetric
                  label="Total shots"
                  value={integer.format(view.totalShots)}
                  detail={`${integer.format(shotsPerCircuit)} per circuit execution`}
                  icon={Gauge}
                  tone="cyan"
                />
                <LabMetric
                  label="Wall clock"
                  value={`${view.wallClockMinutes.toFixed(1)} min`}
                  detail={`${view.target.queueWaitMinutes} min queue + ${view.executionMinutes.toFixed(1)} min execution`}
                  icon={Clock3}
                  tone={view.wallClockMinutes <= deadlineMinutes ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Fixture cost"
                  value={currency.format(view.estimatedCostUsd)}
                  detail="Illustrative task + shot pricing"
                  icon={Coins}
                  tone="amber"
                />
              </div>

              <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.65fr)]">
                <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Admission gates
                  </p>
                  <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
                    {view.gates.map((gate) => (
                      <div key={gate.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        {gate.clears ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                          />
                        ) : (
                          <TriangleAlert
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {gate.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {gate.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`rounded-md border p-4 ${
                    view.tone === 'rose'
                      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                      : view.tone === 'amber'
                        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {view.tone === 'rose' ? (
                      <AlertTriangle aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                    )}
                    <p className="text-sm font-semibold">{view.status}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6">{view.verdict}</p>
                  <dl className="mt-4 space-y-2 border-t border-current/20 pt-4 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-75">Worst-case 95% margin</dt>
                      <dd className="font-semibold tabular-nums">
                        +/-{view.worstCaseMarginPercent.toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="opacity-75">Effective parallelism</dt>
                      <dd className="font-semibold tabular-nums">
                        {view.effectiveParallelism}
                        {view.parallelismCapped ? ' (provider cap)' : ''}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {model.modelNote}
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function BudgetFactor({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
