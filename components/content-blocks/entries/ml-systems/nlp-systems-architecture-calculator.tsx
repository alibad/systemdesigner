'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type WorkloadKind = 'encoder' | 'generator';

interface ServingProfile {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  kind: WorkloadKind;
  accelerator: string;
  memoryGb: number;
  tokensPerSecond: number;
  baseLatencyMs: number;
  millisecondsPerInputToken: number;
  millisecondsPerOutputToken: number;
}

interface RangeConfig {
  min: number;
  max: number;
  step: number;
}

interface CapacityLabData {
  title: string;
  description: string;
  assumptions: {
    utilizationTarget: number;
    preprocessingMs: number;
  };
  defaults: {
    profileId: string;
    requestsPerSecond: number;
    inputTokens: number;
    outputTokens: number;
    batchWaitMs: number;
    latencyTargetMs: number;
  };
  ranges: {
    requestsPerSecond: RangeConfig;
    inputTokens: RangeConfig;
    outputTokens: RangeConfig;
    batchWaitMs: RangeConfig;
    latencyTargetMs: RangeConfig;
  };
  profiles: ServingProfile[];
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/nlp-systems-architecture/data/serving-capacity-model.json';

function isRange(value: unknown): value is RangeConfig {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeConfig>;
  return (
    typeof range.min === 'number' &&
    typeof range.max === 'number' &&
    typeof range.step === 'number' &&
    range.min < range.max &&
    range.step > 0
  );
}

function isCapacityLabData(value: unknown): value is CapacityLabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CapacityLabData>;
  const defaults = data.defaults as Partial<CapacityLabData['defaults']> | undefined;
  const assumptions = data.assumptions as Partial<CapacityLabData['assumptions']> | undefined;
  const ranges = data.ranges as Partial<CapacityLabData['ranges']> | undefined;

  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    assumptions !== undefined &&
    typeof assumptions.utilizationTarget === 'number' &&
    assumptions.utilizationTarget > 0 &&
    assumptions.utilizationTarget < 1 &&
    typeof assumptions.preprocessingMs === 'number' &&
    defaults !== undefined &&
    typeof defaults.profileId === 'string' &&
    typeof defaults.requestsPerSecond === 'number' &&
    typeof defaults.inputTokens === 'number' &&
    typeof defaults.outputTokens === 'number' &&
    typeof defaults.batchWaitMs === 'number' &&
    typeof defaults.latencyTargetMs === 'number' &&
    ranges !== undefined &&
    isRange(ranges.requestsPerSecond) &&
    isRange(ranges.inputTokens) &&
    isRange(ranges.outputTokens) &&
    isRange(ranges.batchWaitMs) &&
    isRange(ranges.latencyTargetMs) &&
    Array.isArray(data.profiles) &&
    data.profiles.length > 0 &&
    data.profiles.every(
      (profile) =>
        profile &&
        typeof profile.id === 'string' &&
        typeof profile.label === 'string' &&
        typeof profile.eyebrow === 'string' &&
        typeof profile.detail === 'string' &&
        (profile.kind === 'encoder' || profile.kind === 'generator') &&
        typeof profile.accelerator === 'string' &&
        typeof profile.memoryGb === 'number' &&
        typeof profile.tokensPerSecond === 'number' &&
        typeof profile.baseLatencyMs === 'number' &&
        typeof profile.millisecondsPerInputToken === 'number' &&
        typeof profile.millisecondsPerOutputToken === 'number'
    )
  );
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function NlpSystemsArchitectureCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityLabData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [requestsPerSecond, setRequestsPerSecond] = useState(0);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [batchWaitMs, setBatchWaitMs] = useState(0);
  const [latencyTargetMs, setLatencyTargetMs] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityLabData(payload)) throw new Error('Capacity model data is invalid');
        setData(payload);
        setProfileId(payload.defaults.profileId);
        setRequestsPerSecond(payload.defaults.requestsPerSecond);
        setInputTokens(payload.defaults.inputTokens);
        setOutputTokens(payload.defaults.outputTokens);
        setBatchWaitMs(payload.defaults.batchWaitMs);
        setLatencyTargetMs(payload.defaults.latencyTargetMs);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const profile = data?.profiles.find((item) => item.id === profileId) ?? data?.profiles[0];
  const effectiveOutputTokens = profile?.kind === 'generator' ? outputTokens : 0;

  const model = useMemo(() => {
    if (!data || !profile) return null;
    const tokensPerRequest = inputTokens + effectiveOutputTokens;
    const tokenDemand = requestsPerSecond * tokensPerRequest;
    const safeCapacityPerReplica = profile.tokensPerSecond * data.assumptions.utilizationTarget;
    const replicas = Math.max(1, Math.ceil(tokenDemand / safeCapacityPerReplica));
    const provisionedCapacity = replicas * profile.tokensPerSecond;
    const utilization = tokenDemand / provisionedCapacity;
    const inferenceMs =
      profile.baseLatencyMs +
      inputTokens * profile.millisecondsPerInputToken +
      effectiveOutputTokens * profile.millisecondsPerOutputToken;
    const estimatedLatencyMs = data.assumptions.preprocessingMs + batchWaitMs + inferenceMs;
    const deadlineHeadroomMs = latencyTargetMs - estimatedLatencyMs;
    const memoryGb = replicas * profile.memoryGb;

    return {
      deadlineHeadroomMs,
      estimatedLatencyMs,
      inferenceMs,
      memoryGb,
      provisionedCapacity,
      replicas,
      tokenDemand,
      tokensPerRequest,
      utilization,
    };
  }, [
    batchWaitMs,
    data,
    effectiveOutputTokens,
    inputTokens,
    latencyTargetMs,
    profile,
    requestsPerSecond,
  ]);

  if (loadError) {
    return (
      <div
        className="not-prose my-7 flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        data-content-block="ml-systems/nlp-systems-architecture-capacity-lab"
        role="alert"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        The NLP serving capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !profile || !model) {
    return (
      <div data-content-block="ml-systems/nlp-systems-architecture-capacity-lab">
        <div
          aria-label="Loading NLP serving capacity lab"
          className="not-prose my-7 min-h-[520px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>
    );
  }

  const deadlineMiss = model.deadlineHeadroomMs < 0;
  const tightCapacity = model.utilization > data.assumptions.utilizationTarget * 0.9;
  const statusTone = deadlineMiss ? 'rose' : tightCapacity ? 'amber' : 'emerald';
  const statusTitle = deadlineMiss
    ? 'The request misses its latency target'
    : tightCapacity
      ? 'The plan has little burst headroom'
      : 'The illustrative envelope has headroom';
  const statusDetail = deadlineMiss
    ? 'Reduce sequence length, generation length, or batch wait; choose a faster profile; or move this workload to an asynchronous path.'
    : tightCapacity
      ? 'Add a replica or lower the utilization target before treating this as a production admission limit.'
      : 'Validate these calibration values with a load test that uses your model, hardware, tokenizer, and request-length distribution.';
  const demandPercent = clampPercent((model.tokenDemand / model.provisionedCapacity) * 100);
  const latencyScale = Math.max(latencyTargetMs, model.estimatedLatencyMs);
  const preprocessPercent = (data.assumptions.preprocessingMs / latencyScale) * 100;
  const waitPercent = (batchWaitMs / latencyScale) * 100;
  const inferencePercent = (model.inferenceMs / latencyScale) * 100;
  const headroomPercent = (Math.max(0, model.deadlineHeadroomMs) / latencyScale) * 100;

  const reset = () => {
    setProfileId(data.defaults.profileId);
    setRequestsPerSecond(data.defaults.requestsPerSecond);
    setInputTokens(data.defaults.inputTokens);
    setOutputTokens(data.defaults.outputTokens);
    setBatchWaitMs(data.defaults.batchWaitMs);
    setLatencyTargetMs(data.defaults.latencyTargetMs);
  };

  return (
    <div data-content-block="ml-systems/nlp-systems-architecture-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          accent="violet"
          description={data.description}
          eyebrow="Token and deadline planner"
          icon={BrainCircuit}
          onReset={reset}
          title={data.title}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload profile
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      accent={item.kind === 'generator' ? 'violet' : 'cyan'}
                      detail={item.detail}
                      icon={item.kind === 'generator' ? Sparkles : Cpu}
                      key={item.id}
                      label={item.label}
                      onClick={() => setProfileId(item.id)}
                      selected={item.id === profile.id}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                accent="violet"
                highLabel="Peak traffic"
                label="Requests per second"
                lowLabel="Pilot"
                max={data.ranges.requestsPerSecond.max}
                min={data.ranges.requestsPerSecond.min}
                onChange={setRequestsPerSecond}
                output={`${requestsPerSecond.toLocaleString()} req/s`}
                step={data.ranges.requestsPerSecond.step}
                value={requestsPerSecond}
              />
              <LabRange
                accent="cyan"
                highLabel="Long context"
                label="Average input"
                lowLabel="Short text"
                max={data.ranges.inputTokens.max}
                min={data.ranges.inputTokens.min}
                onChange={setInputTokens}
                output={`${inputTokens.toLocaleString()} tokens`}
                step={data.ranges.inputTokens.step}
                value={inputTokens}
              />
              {profile.kind === 'generator' ? (
                <LabRange
                  accent="emerald"
                  highLabel="Long answer"
                  label="Average output"
                  lowLabel="Brief answer"
                  max={data.ranges.outputTokens.max}
                  min={data.ranges.outputTokens.min}
                  onChange={setOutputTokens}
                  output={`${outputTokens.toLocaleString()} tokens`}
                  step={data.ranges.outputTokens.step}
                  value={outputTokens}
                />
              ) : null}
              <LabRange
                accent="amber"
                highLabel="Fill fuller batches"
                label="Maximum batch wait"
                lowLabel="Dispatch quickly"
                max={data.ranges.batchWaitMs.max}
                min={data.ranges.batchWaitMs.min}
                onChange={setBatchWaitMs}
                output={`${batchWaitMs} ms`}
                step={data.ranges.batchWaitMs.step}
                value={batchWaitMs}
              />
              <LabRange
                accent="blue"
                highLabel="Background-friendly"
                label="Latency target"
                lowLabel="Interactive"
                max={data.ranges.latencyTargetMs.max}
                min={data.ranges.latencyTargetMs.min}
                onChange={setLatencyTargetMs}
                output={`${latencyTargetMs.toLocaleString()} ms`}
                step={data.ranges.latencyTargetMs.step}
                value={latencyTargetMs}
              />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              detail={`${model.tokensPerRequest.toLocaleString()} tokens per request`}
              icon={Activity}
              label="Token demand"
              tone="violet"
              value={`${Math.round(model.tokenDemand).toLocaleString()}/s`}
            />
            <LabMetric
              detail={`${profile.accelerator} calibration at ${Math.round(data.assumptions.utilizationTarget * 100)}% target utilization`}
              icon={Layers3}
              label="Serving replicas"
              tone="cyan"
              value={model.replicas.toLocaleString()}
            />
            <LabMetric
              detail={`${profile.memoryGb.toFixed(1)} GB per loaded replica`}
              icon={Cpu}
              label="Model memory"
              tone="blue"
              value={`${model.memoryGb.toFixed(1)} GB`}
            />
            <LabMetric
              detail={`${model.deadlineHeadroomMs >= 0 ? '+' : ''}${Math.round(model.deadlineHeadroomMs)} ms versus target`}
              icon={Clock3}
              label="Estimated latency"
              tone={deadlineMiss ? 'rose' : 'emerald'}
              value={`${Math.round(model.estimatedLatencyMs)} ms`}
            />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Provisioned token pressure
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                  {Math.round(model.tokenDemand).toLocaleString()} demanded of{' '}
                  {Math.round(model.provisionedCapacity).toLocaleString()} tokens/s
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {Math.round(model.utilization * 100)}% utilized
              </p>
            </div>
            <div
              aria-label={`${Math.round(model.utilization * 100)} percent of provisioned token capacity used`}
              className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
              role="img"
            >
              <div
                className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                  tightCapacity ? 'bg-amber-500' : 'bg-violet-500'
                }`}
                style={{ width: `${demandPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Latency budget
            </p>
            <div className="mt-3 flex h-11 min-w-0 overflow-hidden rounded-md text-[11px] font-semibold text-white">
              <div
                className="flex min-w-8 items-center justify-center bg-cyan-600 px-1"
                style={{ width: `${preprocessPercent}%` }}
                title={`Preprocess ${data.assumptions.preprocessingMs} ms`}
              >
                Parse
              </div>
              {batchWaitMs > 0 ? (
                <div
                  className="flex min-w-8 items-center justify-center bg-amber-500 px-1 text-neutral-950"
                  style={{ width: `${waitPercent}%` }}
                  title={`Batch wait ${batchWaitMs} ms`}
                >
                  Wait
                </div>
              ) : null}
              <div
                className="flex min-w-12 items-center justify-center bg-violet-600 px-1"
                style={{ width: `${inferencePercent}%` }}
                title={`Inference ${Math.round(model.inferenceMs)} ms`}
              >
                Infer
              </div>
              {headroomPercent > 0 ? (
                <div
                  className="flex min-w-10 items-center justify-center bg-emerald-600 px-1"
                  style={{ width: `${headroomPercent}%` }}
                  title={`Headroom ${Math.round(model.deadlineHeadroomMs)} ms`}
                >
                  Slack
                </div>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-500 sm:grid-cols-4 dark:text-neutral-400">
              <span>Parse {data.assumptions.preprocessingMs} ms</span>
              <span>Wait {batchWaitMs} ms</span>
              <span>Infer {Math.round(model.inferenceMs)} ms</span>
              <span className="sm:text-right">Target {latencyTargetMs} ms</span>
            </div>
          </div>

          <div
            aria-live="polite"
            className={`mt-4 rounded-md border p-4 ${
              statusTone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                : statusTone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{statusTitle}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{statusDetail}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
