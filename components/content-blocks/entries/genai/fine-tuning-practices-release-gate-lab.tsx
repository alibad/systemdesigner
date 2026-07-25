'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleGauge,
  FileClock,
  GitCompareArrows,
  PackageCheck,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  TrendingDown,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Policy {
  id: string;
  label: string;
  detail: string;
  minimumTaskScore: number;
  minimumRareSliceScore: number;
  minimumSafetyScore: number;
  maximumBaseRegressionPp: number;
  maximumLossGap: number;
}

interface Checkpoint {
  id: string;
  label: string;
  epoch: number;
  trainLoss: number;
  validationLoss: number;
  taskScore: number;
  rareSliceScore: number;
  safetyScore: number;
  baseRegressionPp: number;
  rollbackReady: boolean;
}

interface Run {
  id: string;
  label: string;
  detail: string;
  method: string;
  learningRate: string;
  effectiveBatch: number;
  baseModel: string;
  tokenizer: string;
  chatTemplate: string;
  artifactType: 'adapter' | 'full-model';
  checkpoints: Checkpoint[];
}

interface Runtime {
  id: string;
  label: string;
  detail: string;
  baseModel: string;
  tokenizer: string;
  chatTemplate: string;
  supportsAdapters: boolean;
  supportsFullModel: boolean;
}

interface ReleaseData {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    runId: string;
    checkpointId: string;
    runtimeId: string;
    policyId: string;
  };
  policies: Policy[];
  runs: Run[];
  runtimes: Runtime[];
}

interface Gate {
  id: string;
  label: string;
  value: string;
  threshold: string;
  passed: boolean;
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/fine-tuning-practices/data/release-gate-model.json';
const BLOCK_ID = 'genai/fine-tuning-practices-release-gate-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseData>;
  return Boolean(
    data.blockId === BLOCK_ID
      && data.title
      && data.description
      && data.defaults
      && Array.isArray(data.policies)
      && data.policies.length >= 2
      && data.policies.every((item) => (
        isNumber(item.minimumTaskScore)
          && isNumber(item.minimumRareSliceScore)
          && isNumber(item.minimumSafetyScore)
          && isNumber(item.maximumBaseRegressionPp)
          && isNumber(item.maximumLossGap)
      ))
      && Array.isArray(data.runs)
      && data.runs.length >= 3
      && data.runs.every((run) => (
        typeof run.id === 'string'
          && ['adapter', 'full-model'].includes(run.artifactType)
          && Array.isArray(run.checkpoints)
          && run.checkpoints.length >= 2
          && run.checkpoints.every((checkpoint) => (
            isNumber(checkpoint.trainLoss)
              && isNumber(checkpoint.validationLoss)
              && isNumber(checkpoint.taskScore)
              && isNumber(checkpoint.rareSliceScore)
              && isNumber(checkpoint.safetyScore)
              && isNumber(checkpoint.baseRegressionPp)
          ))
      ))
      && Array.isArray(data.runtimes)
      && data.runtimes.length >= 3,
  );
}

export default function FineTuningPracticesReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [runId, setRunId] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [runtimeId, setRuntimeId] = useState('');
  const [policyId, setPolicyId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseData(payload)) throw new Error('Release gate data is incomplete.');
        setData(payload);
        setRunId(payload.defaults.runId);
        setCheckpointId(payload.defaults.checkpointId);
        setRuntimeId(payload.defaults.runtimeId);
        setPolicyId(payload.defaults.policyId);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const run = data?.runs.find((item) => item.id === runId) ?? data?.runs[0];
  const checkpoint = run?.checkpoints.find((item) => item.id === checkpointId)
    ?? run?.checkpoints[0];
  const runtime = data?.runtimes.find((item) => item.id === runtimeId)
    ?? data?.runtimes[0];
  const policy = data?.policies.find((item) => item.id === policyId)
    ?? data?.policies[0];

  const model = useMemo(() => {
    if (!run || !checkpoint || !runtime || !policy) return null;
    const lossGap = checkpoint.validationLoss - checkpoint.trainLoss;
    const lineageMatches = (
      run.baseModel === runtime.baseModel
      && run.tokenizer === runtime.tokenizer
      && run.chatTemplate === runtime.chatTemplate
    );
    const artifactSupported = run.artifactType === 'adapter'
      ? runtime.supportsAdapters
      : runtime.supportsFullModel;

    const gates: Gate[] = [
      {
        id: 'task',
        label: 'Task score',
        value: `${checkpoint.taskScore.toFixed(1)}%`,
        threshold: `at least ${policy.minimumTaskScore}%`,
        passed: checkpoint.taskScore >= policy.minimumTaskScore,
      },
      {
        id: 'rare-slice',
        label: 'Rare slice',
        value: `${checkpoint.rareSliceScore.toFixed(1)}%`,
        threshold: `at least ${policy.minimumRareSliceScore}%`,
        passed: checkpoint.rareSliceScore >= policy.minimumRareSliceScore,
      },
      {
        id: 'safety',
        label: 'Safety suite',
        value: `${checkpoint.safetyScore.toFixed(1)}%`,
        threshold: `at least ${policy.minimumSafetyScore}%`,
        passed: checkpoint.safetyScore >= policy.minimumSafetyScore,
      },
      {
        id: 'regression',
        label: 'Base regression',
        value: `${checkpoint.baseRegressionPp.toFixed(1)} pp`,
        threshold: `at most ${policy.maximumBaseRegressionPp} pp`,
        passed: checkpoint.baseRegressionPp <= policy.maximumBaseRegressionPp,
      },
      {
        id: 'loss-gap',
        label: 'Validation gap',
        value: lossGap.toFixed(2),
        threshold: `at most ${policy.maximumLossGap}`,
        passed: lossGap <= policy.maximumLossGap,
      },
      {
        id: 'lineage',
        label: 'Serving lineage',
        value: lineageMatches ? 'Match' : 'Mismatch',
        threshold: 'exact base, tokenizer, and template',
        passed: lineageMatches,
      },
      {
        id: 'artifact',
        label: 'Artifact support',
        value: artifactSupported ? 'Supported' : 'Unsupported',
        threshold: run.artifactType,
        passed: artifactSupported,
      },
      {
        id: 'rollback',
        label: 'Rollback target',
        value: checkpoint.rollbackReady ? 'Ready' : 'Missing',
        threshold: 'immutable previous manifest',
        passed: checkpoint.rollbackReady,
      },
    ];
    const passedCount = gates.filter((gate) => gate.passed).length;
    const ready = passedCount === gates.length;
    const overfitting = lossGap > policy.maximumLossGap
      || checkpoint.rareSliceScore < policy.minimumRareSliceScore;

    return {
      gates,
      lossGap,
      overfitting,
      passedCount,
      ready,
    };
  }, [checkpoint, policy, run, runtime]);

  function chooseRun(nextRun: Run) {
    setRunId(nextRun.id);
    setCheckpointId(nextRun.checkpoints[0]?.id ?? '');
  }

  function reset() {
    if (!data) return;
    setRunId(data.defaults.runId);
    setCheckpointId(data.defaults.checkpointId);
    setRuntimeId(data.defaults.runtimeId);
    setPolicyId(data.defaults.policyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Checkpoint and serving gate"
          title={data?.title ?? 'Release the strongest compatible checkpoint'}
          description={data?.description ?? 'Loading held-out release evidence...'}
          icon={GitCompareArrows}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !run || !checkpoint || !runtime || !policy || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Training run
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.runs.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === run.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.artifactType === 'adapter' ? Boxes : PackageCheck}
                        accent={item.id === 'lora-conservative' ? 'emerald' : item.id === 'lora-aggressive' ? 'rose' : 'violet'}
                        onClick={() => chooseRun(item)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Serving target
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.runtimes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === runtime.id}
                        label={item.label}
                        detail={item.detail}
                        icon={ServerCog}
                        accent={item.id === 'adapter-runtime-v3' ? 'blue' : item.id === 'stale-base-runtime' ? 'rose' : 'violet'}
                        onClick={() => setRuntimeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Release policy
                  </span>
                  <select
                    value={policy.id}
                    onChange={(event) => setPolicyId(event.target.value)}
                    className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {data.policies.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {policy.detail}
                  </span>
                </label>
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <LabMetric
                label="Method"
                value={run.method}
                detail={`${run.learningRate} learning rate`}
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Effective batch"
                value={run.effectiveBatch.toString()}
                detail="microbatch x accumulation x workers"
                icon={CircleGauge}
                tone="blue"
              />
              <LabMetric
                label="Loss gap"
                value={model.lossGap.toFixed(2)}
                detail="validation loss minus train loss"
                icon={TrendingDown}
                tone={model.overfitting ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Release"
                value={model.ready ? 'Ready' : 'Hold'}
                detail={`${model.passedCount}/${model.gates.length} independent gates pass`}
                icon={model.ready ? CheckCircle2 : AlertTriangle}
                tone={model.ready ? 'emerald' : 'rose'}
              />
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Checkpoint trajectory
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Select the epoch with the strongest held-out evidence
                  </h4>
                </div>
                <FileClock aria-hidden="true" className="h-5 w-5 text-neutral-400" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {run.checkpoints.map((item) => {
                  const selected = item.id === checkpoint.id;
                  const gap = item.validationLoss - item.trainLoss;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCheckpointId(item.id)}
                      className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        selected
                          ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-400 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-50'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-xs font-semibold tabular-nums opacity-70">
                          gap {gap.toFixed(2)}
                        </span>
                      </span>
                      <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded bg-white/70 p-2 dark:bg-neutral-950/60">
                          Task <strong className="block text-sm">{item.taskScore}%</strong>
                        </span>
                        <span className="rounded bg-white/70 p-2 dark:bg-neutral-950/60">
                          Rare slice <strong className="block text-sm">{item.rareSliceScore}%</strong>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`mt-6 rounded-md border p-5 ${
              model.ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {model.ready
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Release decision</p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {model.ready ? 'Eligible for a bounded canary' : 'Hold this candidate'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {model.ready
                      ? 'The selected checkpoint, artifact, and runtime satisfy every independent fixture gate. Production evidence still belongs in the canary.'
                      : model.overfitting
                        ? 'Held-out behavior is diverging from training. Compare an earlier checkpoint before increasing epochs or optimization pressure.'
                        : 'One or more quality, lineage, artifact, or rollback requirements are not satisfied.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {model.gates.map((gate) => (
                <div
                  key={gate.id}
                  className={`rounded-md border p-4 ${
                    gate.passed
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
                      : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {gate.passed
                      ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{gate.label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {gate.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                        Gate: {gate.threshold}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <RotateCcw aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Fixture percentages demonstrate independent release logic. Replace them with versioned task, safety, slice, and online evidence.
            </p>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {error ? 'The release model could not be loaded.' : 'Loading checkpoint evidence...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
