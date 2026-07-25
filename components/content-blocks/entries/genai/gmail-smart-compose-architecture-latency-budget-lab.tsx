'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Network,
  Server,
  Timer,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type FixedStages = {
  clientMs: number;
  gatewayMs: number;
  contextBaseMs: number;
  contextPer128TokensMs: number;
  releaseGateMs: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  networkMs: number;
  contextTokens: number;
  batchWaitMs: number;
  modelId: string;
};

type ModelTier = {
  id: string;
  label: string;
  detail: string;
  baseInferenceMs: number;
  contextPer128TokensMs: number;
  qualityIndex: number;
  throughputIndex: number;
};

type LatencyBudgetData = {
  title: string;
  description: string;
  targetMs: number;
  fixedStages: FixedStages;
  defaults: { scenarioId: string };
  scenarios: Scenario[];
  models: ModelTier[];
};

type Stage = {
  id: string;
  label: string;
  detail: string;
  value: number;
  color: string;
};

const BLOCK_ID = 'genai/gmail-smart-compose-architecture-latency-budget-lab';

function isLatencyBudgetData(value: unknown): value is LatencyBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LatencyBudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.targetMs === 'number'
      && candidate.fixedStages
      && candidate.defaults?.scenarioId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.models)
      && candidate.models.length > 0,
  );
}

export default function GmailSmartComposeArchitectureLatencyBudgetLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LatencyBudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No latency-budget data was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLatencyBudgetData(payload)) throw new Error('Latency-budget data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the budget.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <LatencyBudgetLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function LatencyBudgetLab({ data }: { data: LatencyBudgetData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [networkMs, setNetworkMs] = useState(initialScenario.networkMs);
  const [contextTokens, setContextTokens] = useState(initialScenario.contextTokens);
  const [batchWaitMs, setBatchWaitMs] = useState(initialScenario.batchWaitMs);
  const [modelId, setModelId] = useState(initialScenario.modelId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const model = data.models.find((item) => item.id === modelId) ?? data.models[0];

  const result = useMemo(() => {
    const contextUnits = contextTokens / 128;
    const contextMs = data.fixedStages.contextBaseMs
      + contextUnits * data.fixedStages.contextPer128TokensMs;
    const inferenceMs = model.baseInferenceMs + contextUnits * model.contextPer128TokensMs;
    const stages: Stage[] = [
      {
        id: 'client',
        label: 'Client',
        detail: 'Debounce, serialize, and correlate',
        value: data.fixedStages.clientMs,
        color: 'bg-cyan-500 dark:bg-cyan-400',
      },
      {
        id: 'network',
        label: 'Network',
        detail: 'Round trip to the serving region',
        value: networkMs,
        color: 'bg-blue-500 dark:bg-blue-400',
      },
      {
        id: 'context',
        label: 'Context',
        detail: `${contextTokens} tokens plus gateway work`,
        value: contextMs + data.fixedStages.gatewayMs,
        color: 'bg-violet-500 dark:bg-violet-400',
      },
      {
        id: 'queue',
        label: 'Batch wait',
        detail: 'Time traded for accelerator efficiency',
        value: batchWaitMs,
        color: 'bg-amber-500 dark:bg-amber-400',
      },
      {
        id: 'inference',
        label: 'Inference',
        detail: model.label,
        value: inferenceMs,
        color: 'bg-fuchsia-500 dark:bg-fuchsia-400',
      },
      {
        id: 'gate',
        label: 'Release gate',
        detail: 'Freshness, confidence, policy, language',
        value: data.fixedStages.releaseGateMs,
        color: 'bg-emerald-500 dark:bg-emerald-400',
      },
    ];
    const totalMs = stages.reduce((sum, stage) => sum + stage.value, 0);
    const headroomMs = data.targetMs - totalMs;
    const fits = headroomMs >= 0;
    const qualityIndex = Math.min(
      98,
      model.qualityIndex + Math.max(0, Math.round(Math.log2(contextTokens / 32) * 1.5)),
    );
    const throughputIndex = Math.min(100, model.throughputIndex + Math.round(batchWaitMs * 1.4));

    return { fits, headroomMs, qualityIndex, stages, throughputIndex, totalMs };
  }, [batchWaitMs, contextTokens, data, model, networkMs]);

  function chooseScenario(next: Scenario) {
    setScenarioId(next.id);
    setNetworkMs(next.networkMs);
    setContextTokens(next.contextTokens);
    setBatchWaitMs(next.batchWaitMs);
    setModelId(next.modelId);
  }

  function reset() {
    chooseScenario(initialScenario);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Keystroke latency lab"
        title={data.title}
        description={data.description}
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Start from a traffic condition
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Network}
                    accent="cyan"
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose the serving model
              </legend>
              <div className="mt-3 space-y-2">
                {data.models.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === model.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Cpu}
                    accent="violet"
                    onClick={() => setModelId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Network round trip"
                value={networkMs}
                output={`${networkMs} ms`}
                min={4}
                max={60}
                step={1}
                accent="blue"
                lowLabel="Nearby"
                highLabel="Distant"
                onChange={setNetworkMs}
              />
              <LabRange
                label="Context tokens"
                value={contextTokens}
                output={`${contextTokens}`}
                min={32}
                max={384}
                step={32}
                accent="violet"
                lowLabel="Current phrase"
                highLabel="Longer context"
                onChange={setContextTokens}
              />
              <LabRange
                label="Batch wait"
                value={batchWaitMs}
                output={`${batchWaitMs} ms`}
                min={0}
                max={20}
                step={1}
                accent="amber"
                lowLabel="Dispatch now"
                highLabel="Fill the batch"
                onChange={setBatchWaitMs}
              />
            </div>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <LabMetric
            label="Complete path"
            value={`${result.totalMs.toFixed(1)} ms`}
            detail={`Target: ${data.targetMs} ms`}
            icon={Timer}
            tone={result.fits ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Deadline headroom"
            value={`${result.headroomMs >= 0 ? '+' : ''}${result.headroomMs.toFixed(1)} ms`}
            detail={result.fits ? 'Variance can still fit.' : 'The client should abstain.'}
            icon={result.fits ? CheckCircle2 : CircleAlert}
            tone={result.fits ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Serving trade-off"
            value={`${result.throughputIndex}/100`}
            detail={`Illustrative throughput index; quality ${result.qualityIndex}/100`}
            icon={Zap}
            tone="violet"
          />
        </div>

        <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                End-to-end budget
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                Every synchronous stage spends the same deadline
              </p>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Scale is relative to {Math.max(data.targetMs, Math.ceil(result.totalMs))} ms
            </p>
          </div>

          <div className="mt-4 flex h-8 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
            {result.stages.map((stage) => (
              <div
                key={stage.id}
                className={`${stage.color} min-w-px transition-[width] motion-reduce:transition-none`}
                style={{
                  width: `${(stage.value / Math.max(data.targetMs, result.totalMs)) * 100}%`,
                }}
                title={`${stage.label}: ${stage.value.toFixed(1)} ms`}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {result.stages.map((stage) => (
              <div
                key={stage.id}
                className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${stage.color}`} />
                    {stage.label}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {stage.value.toFixed(1)} ms
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {stage.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div
          className={`mt-5 rounded-md border p-4 ${
            result.fits
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.fits ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
            )}
            <div>
              <p className="font-semibold text-neutral-950 dark:text-white">
                {result.fits ? 'Eligible for the release gate' : 'Missed deadline: return no suggestion'}
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.fits
                  ? 'The path fits the target, but the client must still verify that the response belongs to the active draft.'
                  : 'Do not let retries or a late response block the editor. Regional routing, a smaller model, less context, or a shorter batch wait can restore headroom.'}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Keystroke latency lab"
        title={error ? 'The latency model could not load' : 'Loading the latency model'}
        description={error ?? 'Preparing the request stages and serving scenarios.'}
        icon={error ? CircleAlert : Server}
        accent={error ? 'rose' : 'cyan'}
      />
      <LearningLabBody>
        <div className="flex min-h-32 items-center justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <Layers3 aria-hidden="true" className="h-4 w-4" />
              Loading stages...
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
