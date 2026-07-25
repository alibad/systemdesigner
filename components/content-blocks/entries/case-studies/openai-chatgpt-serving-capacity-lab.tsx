'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  Coins,
  Cpu,
  Gauge,
  Layers3,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeData {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface ModelTierData {
  id: string;
  label: string;
  detail: string;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  effectiveUnitsPerWorkerSecond: number;
  inputServingWeight: number;
}

interface ServingCapacityData {
  title: string;
  description: string;
  requestsPerSecond: RangeData;
  inputTokensPerRequest: RangeData;
  outputTokensPerRequest: RangeData;
  workerCount: RangeData;
  targetUtilization: number;
  defaultTierId: string;
  tiers: ModelTierData[];
}

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeData>;
  return (
    typeof candidate.default === 'number' &&
    typeof candidate.min === 'number' &&
    typeof candidate.max === 'number' &&
    typeof candidate.step === 'number' &&
    candidate.min < candidate.max &&
    candidate.step > 0 &&
    candidate.default >= candidate.min &&
    candidate.default <= candidate.max
  );
}

function isModelTierData(value: unknown): value is ModelTierData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ModelTierData>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.detail === 'string' &&
    typeof candidate.inputCostPerMillionTokens === 'number' &&
    candidate.inputCostPerMillionTokens >= 0 &&
    typeof candidate.outputCostPerMillionTokens === 'number' &&
    candidate.outputCostPerMillionTokens >= 0 &&
    typeof candidate.effectiveUnitsPerWorkerSecond === 'number' &&
    candidate.effectiveUnitsPerWorkerSecond > 0 &&
    typeof candidate.inputServingWeight === 'number' &&
    candidate.inputServingWeight > 0
  );
}

function isServingCapacityData(value: unknown): value is ServingCapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingCapacityData>;
  if (
    typeof candidate.title !== 'string' ||
    typeof candidate.description !== 'string' ||
    !isRangeData(candidate.requestsPerSecond) ||
    !isRangeData(candidate.inputTokensPerRequest) ||
    !isRangeData(candidate.outputTokensPerRequest) ||
    !isRangeData(candidate.workerCount) ||
    typeof candidate.targetUtilization !== 'number' ||
    candidate.targetUtilization <= 0 ||
    candidate.targetUtilization >= 1 ||
    typeof candidate.defaultTierId !== 'string' ||
    !Array.isArray(candidate.tiers) ||
    candidate.tiers.length === 0 ||
    !candidate.tiers.every(isModelTierData)
  ) {
    return false;
  }

  return candidate.tiers.some((tier) => tier.id === candidate.defaultTierId);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTierEconomics(tier: ModelTierData) {
  return `$${tier.inputCostPerMillionTokens}/M input, $${tier.outputCostPerMillionTokens}/M output, ${formatCompact(tier.effectiveUnitsPerWorkerSecond)} units/worker/s.`;
}

export default function OpenAiChatGptServingCapacityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ServingCapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [requestsPerSecond, setRequestsPerSecond] = useState(0);
  const [inputTokensPerRequest, setInputTokensPerRequest] = useState(0);
  const [outputTokensPerRequest, setOutputTokensPerRequest] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);
  const [tierId, setTierId] = useState('');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Serving capacity request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isServingCapacityData(payload)) {
          throw new Error('Serving capacity data is invalid');
        }
        setData(payload);
        setRequestsPerSecond(payload.requestsPerSecond.default);
        setInputTokensPerRequest(payload.inputTokensPerRequest.default);
        setOutputTokensPerRequest(payload.outputTokensPerRequest.default);
        setWorkerCount(payload.workerCount.default);
        setTierId(payload.defaultTierId);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const tier = data?.tiers.find((candidate) => candidate.id === tierId) ?? data?.tiers[0];
  const model = useMemo(() => {
    if (!data || !tier) return null;

    const inputTokensPerSecond = requestsPerSecond * inputTokensPerRequest;
    const outputTokensPerSecond = requestsPerSecond * outputTokensPerRequest;
    const rawTokensPerSecond = inputTokensPerSecond + outputTokensPerSecond;
    const servingUnitsPerSecond =
      inputTokensPerSecond * tier.inputServingWeight + outputTokensPerSecond;
    const rawCapacity = workerCount * tier.effectiveUnitsPerWorkerSecond;
    const plannedCapacity = Math.floor(rawCapacity * data.targetUtilization);
    const pressure = plannedCapacity === 0 ? 0 : servingUnitsPerSecond / plannedCapacity;
    const queueGrowthPerSecond = Math.max(0, servingUnitsPerSecond - plannedCapacity);
    const minimumWorkers = Math.ceil(
      servingUnitsPerSecond /
        (tier.effectiveUnitsPerWorkerSecond * data.targetUtilization),
    );
    const secondsPerDay = 86_400;
    const inputCostPerDay =
      (inputTokensPerSecond * secondsPerDay * tier.inputCostPerMillionTokens) / 1_000_000;
    const outputCostPerDay =
      (outputTokensPerSecond * secondsPerDay * tier.outputCostPerMillionTokens) / 1_000_000;
    const costPerDay = inputCostPerDay + outputCostPerDay;
    const overloaded = pressure > 1;
    const tight = !overloaded && pressure >= 0.8;

    return {
      inputTokensPerSecond,
      outputTokensPerSecond,
      rawTokensPerSecond,
      servingUnitsPerSecond,
      plannedCapacity,
      pressure,
      queueGrowthPerSecond,
      minimumWorkers,
      inputCostPerDay,
      outputCostPerDay,
      costPerDay,
      overloaded,
      tight,
    };
  }, [
    data,
    inputTokensPerRequest,
    outputTokensPerRequest,
    requestsPerSecond,
    tier,
    workerCount,
  ]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        The serving capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !tier || !model) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading serving capacity model"
        className="min-h-[760px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const reset = () => {
    setRequestsPerSecond(data.requestsPerSecond.default);
    setInputTokensPerRequest(data.inputTokensPerRequest.default);
    setOutputTokensPerRequest(data.outputTokensPerRequest.default);
    setWorkerCount(data.workerCount.default);
    setTierId(data.defaultTierId);
  };
  const stateTone = model.overloaded ? 'rose' : model.tight ? 'amber' : 'emerald';
  const verdict = model.overloaded
    ? 'Demand exceeds the tier\'s planned serving envelope'
    : model.tight
      ? 'The fleet fits normal demand but has little recovery headroom'
      : 'The selected tier fits inside the operating target';
  const consequence = model.overloaded
    ? `The queue adds ${formatCompact(model.queueGrowthPerSecond)} serving units each second. Add workers, shorten context or output, shed low-priority work, or route eligible requests to a faster tier.`
    : model.tight
      ? `Only ${Math.max(0, 100 - model.pressure * 100).toFixed(0)}% of the planning envelope remains. A worker loss or request burst can raise time to first token before token streaming slows.`
      : `The fleet preserves ${Math.max(0, 100 - model.pressure * 100).toFixed(0)}% of the planning envelope for bursts, retries, and worker loss.`;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Token, throughput, and cost lab"
        title={data.title}
        description={data.description}
        icon={Bot}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Incoming requests"
              value={requestsPerSecond}
              output={`${requestsPerSecond}/s`}
              min={data.requestsPerSecond.min}
              max={data.requestsPerSecond.max}
              step={data.requestsPerSecond.step}
              lowLabel="Normal load"
              highLabel="Traffic surge"
              onChange={setRequestsPerSecond}
            />
            <LabRange
              label="Input context"
              value={inputTokensPerRequest}
              output={`${inputTokensPerRequest.toLocaleString()} tokens`}
              min={data.inputTokensPerRequest.min}
              max={data.inputTokensPerRequest.max}
              step={data.inputTokensPerRequest.step}
              accent="violet"
              lowLabel="Short turn"
              highLabel="Long context"
              onChange={setInputTokensPerRequest}
            />
            <LabRange
              label="Generated response"
              value={outputTokensPerRequest}
              output={`${outputTokensPerRequest.toLocaleString()} tokens`}
              min={data.outputTokensPerRequest.min}
              max={data.outputTokensPerRequest.max}
              step={data.outputTokensPerRequest.step}
              accent="amber"
              lowLabel="Concise"
              highLabel="Long answer"
              onChange={setOutputTokensPerRequest}
            />
            <LabRange
              label="Serving workers"
              value={workerCount}
              output={workerCount.toLocaleString()}
              min={data.workerCount.min}
              max={data.workerCount.max}
              step={data.workerCount.step}
              accent="emerald"
              lowLabel={data.workerCount.min.toLocaleString()}
              highLabel={data.workerCount.max.toLocaleString()}
              onChange={setWorkerCount}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Model tier
              </legend>
              <div className="mt-3 space-y-2">
                {data.tiers.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === tier.id}
                    label={candidate.label}
                    detail={`${candidate.detail} ${formatTierEconomics(candidate)}`}
                    icon={Layers3}
                    accent={
                      candidate.id === 'fast'
                        ? 'emerald'
                        : candidate.id === 'balanced'
                          ? 'blue'
                          : 'violet'
                    }
                    onClick={() => setTierId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Serving units weight prompt processing separately from generated tokens.
              The model reserves {(data.targetUtilization * 100).toFixed(0)}% utilization
              as its steady operating target.
            </p>
          </div>
        )}
      >
        <div
          className="min-w-0"
          data-content-block="case-studies/openai-chatgpt-serving-capacity-lab"
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Raw token rate"
              value={`${formatCompact(model.rawTokensPerSecond)}/s`}
              detail={`${formatCompact(model.inputTokensPerSecond)} input + ${formatCompact(model.outputTokensPerSecond)} output`}
              icon={Activity}
              tone="blue"
            />
            <LabMetric
              label="Serving pressure"
              value={`${(model.pressure * 100).toFixed(0)}%`}
              detail={`${formatCompact(model.servingUnitsPerSecond)} of ${formatCompact(model.plannedCapacity)} units/s`}
              icon={Gauge}
              tone={stateTone}
            />
            <LabMetric
              label="Minimum workers"
              value={model.minimumWorkers.toLocaleString()}
              detail={`At the ${(data.targetUtilization * 100).toFixed(0)}% planning target`}
              icon={Cpu}
              tone="violet"
            />
            <LabMetric
              label="Estimated daily cost"
              value={formatCurrency(model.costPerDay)}
              detail="Illustrative token rates, before platform overhead"
              icon={Coins}
              tone="amber"
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              <span>Planned serving envelope</span>
              <span className="tabular-nums">{(model.pressure * 100).toFixed(0)}%</span>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
              role="img"
              aria-label={`Serving pressure is ${(model.pressure * 100).toFixed(0)} percent of the planning envelope`}
            >
              <div
                className={`h-full transition-[width] motion-reduce:transition-none ${
                  model.overloaded
                    ? 'bg-rose-500'
                    : model.tight
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, model.pressure * 100)}%` }}
              />
            </div>
          </div>

          <div
            className={`mt-5 rounded-md border p-4 ${
              model.overloaded
                ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                : model.tight
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {model.overloaded ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{consequence}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Input work
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {formatCompact(model.inputTokensPerSecond)} tokens/s costs about{' '}
                {formatCurrency(model.inputCostPerDay)} per day under this tier assumption.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Decode work
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {formatCompact(model.outputTokensPerSecond)} generated tokens/s costs about{' '}
                {formatCurrency(model.outputCostPerDay)} per day and grows with every
                extra response token.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                User-visible effect
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {model.overloaded
                  ? 'Queue delay rises before generation begins, so time to first token degrades first.'
                  : model.tight
                    ? 'Responses stream now, but failover or bursts can create visible queue delay.'
                    : 'Admission and routing retain room to absorb ordinary bursts without sustained queue growth.'}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
