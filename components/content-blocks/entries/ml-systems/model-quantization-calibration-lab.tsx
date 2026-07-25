'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  Brackets,
  CircleDot,
  Gauge,
  Layers3,
  ScanLine,
  Sigma,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/model-quantization-calibration-range-lab';

type PolicyId = 'full' | 'p99-9' | 'p99';
type Granularity = 'per-tensor' | 'per-channel';

type NumericRange = {
  min: number;
  max: number;
};

type RangePolicy = {
  id: PolicyId;
  label: string;
  detail: string;
  clippedPerTenThousand: number;
};

type ChannelRange = NumericRange & {
  label: string;
};

type CalibrationScenario = {
  id: string;
  label: string;
  detail: string;
  examples: number;
  omittedSlice: string | null;
  productionBounds: NumericRange;
  ranges: Record<PolicyId, NumericRange>;
  channels: ChannelRange[];
  probeValues: number[];
};

type CalibrationData = {
  kind: 'calibration-range';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  note: string;
  defaults: {
    scenarioId: string;
    policyId: PolicyId;
    granularity: Granularity;
  };
  policies: RangePolicy[];
  scenarios: CalibrationScenario[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPolicyId(value: unknown): value is PolicyId {
  return value === 'full' || value === 'p99-9' || value === 'p99';
}

function isGranularity(value: unknown): value is Granularity {
  return value === 'per-tensor' || value === 'per-channel';
}

function isNumericRange(value: unknown): value is NumericRange {
  return (
    isRecord(value) &&
    isFiniteNumber(value.min) &&
    isFiniteNumber(value.max) &&
    value.max > value.min
  );
}

function isCalibrationData(value: unknown): value is CalibrationData {
  if (
    !isRecord(value) ||
    value.kind !== 'calibration-range' ||
    value.blockId !== BLOCK_ID ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.note !== 'string' ||
    !isRecord(value.defaults) ||
    typeof value.defaults.scenarioId !== 'string' ||
    !isPolicyId(value.defaults.policyId) ||
    !isGranularity(value.defaults.granularity) ||
    !Array.isArray(value.policies) ||
    value.policies.length < 2 ||
    !Array.isArray(value.scenarios) ||
    value.scenarios.length < 2
  ) {
    return false;
  }

  const defaults = value.defaults;
  const policiesValid = value.policies.every(
    (policy) =>
      isRecord(policy) &&
      isPolicyId(policy.id) &&
      typeof policy.label === 'string' &&
      typeof policy.detail === 'string' &&
      Number.isInteger(policy.clippedPerTenThousand) &&
      Number(policy.clippedPerTenThousand) >= 0,
  );
  if (!policiesValid) return false;

  const scenariosValid = value.scenarios.every((scenario) => {
    if (
      !isRecord(scenario) ||
      typeof scenario.id !== 'string' ||
      typeof scenario.label !== 'string' ||
      typeof scenario.detail !== 'string' ||
      !Number.isInteger(scenario.examples) ||
      Number(scenario.examples) <= 0 ||
      !(scenario.omittedSlice === null || typeof scenario.omittedSlice === 'string') ||
      !isNumericRange(scenario.productionBounds) ||
      !isRecord(scenario.ranges) ||
      !isNumericRange(scenario.ranges.full) ||
      !isNumericRange(scenario.ranges['p99-9']) ||
      !isNumericRange(scenario.ranges.p99) ||
      !Array.isArray(scenario.channels) ||
      scenario.channels.length < 2 ||
      !Array.isArray(scenario.probeValues) ||
      scenario.probeValues.length < 3 ||
      !scenario.probeValues.every(isFiniteNumber)
    ) {
      return false;
    }

    return scenario.channels.every(
      (channel) =>
        isRecord(channel) &&
        typeof channel.label === 'string' &&
        isFiniteNumber(channel.min) &&
        isFiniteNumber(channel.max) &&
        channel.max > channel.min,
    );
  });

  return (
    scenariosValid &&
    value.policies.some((policy) => policy.id === defaults.policyId) &&
    value.scenarios.some((scenario) => scenario.id === defaults.scenarioId)
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantizationParameters(range: NumericRange) {
  const qMin = -128;
  const qMax = 127;
  const scale = (range.max - range.min) / (qMax - qMin);
  const zeroPoint = clamp(Math.round(qMin - range.min / scale), qMin, qMax);
  return { qMin, qMax, scale, zeroPoint };
}

function formatValue(value: number) {
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(3);
}

function LoadingState() {
  return (
    <div
      className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading calibration range lab"
      role="status"
    />
  );
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/model-quantization/data/calibration-range-model.json';

export default function ModelQuantizationCalibrationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the calibration model (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCalibrationData(payload)) {
          throw new Error('The calibration data contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the calibration lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Calibration lab unavailable</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return <LoadingState />;
  return <CalibrationRangeLab data={data} />;
}

function CalibrationRangeLab({ data }: { data: CalibrationData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [policyId, setPolicyId] = useState<PolicyId>(data.defaults.policyId);
  const [granularity, setGranularity] = useState<Granularity>(
    data.defaults.granularity,
  );

  const scenario =
    data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy =
    data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const selectedRange = scenario.ranges[policy.id];
    const tensorParameters = quantizationParameters(selectedRange);
    const fullWidth = scenario.ranges.full.max - scenario.ranges.full.min;
    const selectedWidth = selectedRange.max - selectedRange.min;
    const policyRatio = selectedWidth / fullWidth;
    const channelParameters = scenario.channels.map((channel) => {
      const adjustedRange = {
        min: channel.min * policyRatio,
        max: channel.max * policyRatio,
      };
      return {
        ...channel,
        adjustedRange,
        ...quantizationParameters(adjustedRange),
      };
    });
    const meanChannelScale =
      channelParameters.reduce((sum, channel) => sum + channel.scale, 0) /
      channelParameters.length;
    const effectiveScale =
      granularity === 'per-tensor' ? tensorParameters.scale : meanChannelScale;
    const missesProductionRange =
      selectedRange.min > scenario.productionBounds.min ||
      selectedRange.max < scenario.productionBounds.max;

    const probes = scenario.probeValues.map((real) => {
      const unclamped = Math.round(real / tensorParameters.scale) + tensorParameters.zeroPoint;
      const code = clamp(unclamped, tensorParameters.qMin, tensorParameters.qMax);
      const reconstructed = tensorParameters.scale * (code - tensorParameters.zeroPoint);
      return {
        real,
        code,
        reconstructed,
        clipped: unclamped !== code,
      };
    });

    const diagnosis = scenario.omittedSlice
      ? {
          tone: 'rose' as const,
          title: `${scenario.omittedSlice} is absent from calibration`,
          detail:
            'The observer cannot learn a range for evidence it never sees. Add that slice, version the corpus, and re-run conversion before evaluating the artifact.',
        }
      : missesProductionRange
        ? {
            tone: 'amber' as const,
            title: 'The selected range clips valid production values',
            detail:
              'A tighter range improves in-range resolution, but the held production bounds extend beyond it. Evaluate the affected tails and their business cost.',
          }
        : {
            tone: 'emerald' as const,
            title: 'The observed range covers the production fixture',
            detail:
              'Coverage is necessary, not sufficient. Run the independent evaluation set to measure whether rounding and clipping remain within each quality budget.',
          };

    return {
      channelParameters,
      diagnosis,
      effectiveScale,
      missesProductionRange,
      probes,
      selectedRange,
      tensorParameters,
    };
  }, [granularity, policy.id, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setPolicyId(data.defaults.policyId);
    setGranularity(data.defaults.granularity);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Numeric representation lab"
          title={data.title}
          description={data.description}
          icon={Binary}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Calibration corpus
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.omittedSlice ? TriangleAlert : ScanLine}
                      accent={item.omittedSlice ? 'amber' : 'cyan'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Range policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Brackets}
                      accent="violet"
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Parameter granularity
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <LabChoice
                    selected={granularity === 'per-tensor'}
                    label="Per tensor"
                    detail="One scale and zero point for the complete tensor."
                    icon={CircleDot}
                    accent="blue"
                    onClick={() => setGranularity('per-tensor')}
                  />
                  <LabChoice
                    selected={granularity === 'per-channel'}
                    label="Per channel"
                    detail="One parameter pair for each output channel."
                    icon={Layers3}
                    accent="emerald"
                    onClick={() => setGranularity('per-channel')}
                  />
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label={granularity === 'per-tensor' ? 'Scale' : 'Mean channel scale'}
                value={result.effectiveScale.toFixed(4)}
                detail="Real-value distance per integer step"
                icon={Sigma}
                tone="cyan"
              />
              <LabMetric
                label="Zero point"
                value={
                  granularity === 'per-tensor'
                    ? String(result.tensorParameters.zeroPoint)
                    : 'Per channel'
                }
                detail="Integer code that reconstructs real zero"
                icon={CircleDot}
                tone="violet"
              />
              <LabMetric
                label="Rounding bound"
                value={`<= ${(result.effectiveScale / 2).toFixed(4)}`}
                detail="Inside the selected range with nearest rounding"
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label="Calibration tail"
                value={`${policy.clippedPerTenThousand} / 10k`}
                detail="Expected clipped calibration values for this policy"
                icon={Brackets}
                tone={policy.clippedPerTenThousand >= 100 ? 'amber' : 'neutral'}
              />
            </div>

            <RangeMap
              productionBounds={scenario.productionBounds}
              selectedRange={result.selectedRange}
            />

            {granularity === 'per-tensor' ? (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Probe values through one tensor scale
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Each value is rounded to an INT8 code, clamped, then reconstructed.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {scenario.examples.toLocaleString()} calibration examples
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {result.probes.map((probe) => (
                    <div
                      key={probe.real}
                      className={`rounded-md border p-3 ${
                        probe.clipped
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
                      }`}
                    >
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        Real {formatValue(probe.real)}
                      </p>
                      <p className="mt-1 font-mono text-base font-semibold text-neutral-950 dark:text-white">
                        {probe.code} <span className="text-neutral-400">-&gt;</span>{' '}
                        {formatValue(probe.reconstructed)}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          probe.clipped
                            ? 'font-semibold text-rose-700 dark:text-rose-300'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {probe.clipped ? 'Clamped to endpoint' : 'Rounded in range'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  One local step per output channel
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The same clipping policy is applied to each fixture channel independently.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {result.channelParameters.map((channel) => (
                    <div
                      key={channel.label}
                      className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {channel.label}
                        </p>
                        <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          step {channel.scale.toFixed(4)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatValue(channel.adjustedRange.min)} to{' '}
                        {formatValue(channel.adjustedRange.max)}; zero point{' '}
                        {channel.zeroPoint}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`rounded-md border p-4 ${
                result.diagnosis.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                  : result.diagnosis.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {result.diagnosis.tone === 'emerald' ? (
                  <ScanLine aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold">{result.diagnosis.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {result.diagnosis.detail}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.note}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RangeMap({
  productionBounds,
  selectedRange,
}: {
  productionBounds: NumericRange;
  selectedRange: NumericRange;
}) {
  const axisMin = Math.min(productionBounds.min, selectedRange.min);
  const axisMax = Math.max(productionBounds.max, selectedRange.max);
  const width = axisMax - axisMin;
  const position = (value: number) => ((value - axisMin) / width) * 100;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            Represented range versus production fixture
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Values outside the cyan band clamp to the nearest INT8 endpoint.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-neutral-300 dark:bg-neutral-600" />
            Production bounds
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500 dark:bg-cyan-400" />
            Quantized range
          </span>
        </div>
      </div>
      <div className="relative mt-8 h-14" aria-label="Quantized and production range comparison">
        <div className="absolute inset-x-0 top-4 h-4 rounded-sm bg-neutral-200 dark:bg-neutral-800" />
        <div
          className="absolute top-4 h-4 rounded-sm bg-neutral-400 dark:bg-neutral-600"
          style={{
            left: `${position(productionBounds.min)}%`,
            width: `${position(productionBounds.max) - position(productionBounds.min)}%`,
          }}
        />
        <div
          className="absolute top-3 h-6 rounded-sm border-2 border-cyan-700 bg-cyan-400/80 dark:border-cyan-200 dark:bg-cyan-500/70"
          style={{
            left: `${position(selectedRange.min)}%`,
            width: `${position(selectedRange.max) - position(selectedRange.min)}%`,
          }}
        />
        {axisMin <= 0 && axisMax >= 0 ? (
          <div
            className="absolute top-0 h-12 w-px bg-violet-600 dark:bg-violet-300"
            style={{ left: `${position(0)}%` }}
          >
            <span className="absolute left-1 top-0 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
              zero
            </span>
          </div>
        ) : null}
        <span className="absolute bottom-0 left-0 text-[10px] text-neutral-500 dark:text-neutral-400">
          {formatValue(axisMin)}
        </span>
        <span className="absolute bottom-0 right-0 text-[10px] text-neutral-500 dark:text-neutral-400">
          {formatValue(axisMax)}
        </span>
      </div>
    </div>
  );
}
