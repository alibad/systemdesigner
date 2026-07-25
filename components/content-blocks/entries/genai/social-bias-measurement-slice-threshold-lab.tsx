'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  Layers3,
  RefreshCw,
  Scale,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type MetricDefinition = {
  id: string;
  label: string;
  benchmark: string;
  definition: string;
};

type Observation = {
  referenceEvents: number;
  referenceTotal: number;
  focusEvents: number;
  focusTotal: number;
};

type SliceDefinition = {
  id: string;
  label: string;
  referenceLabel: string;
  focusLabel: string;
  detail: string;
  observations: Record<string, Observation>;
};

type SliceMetricData = {
  defaultMetricId: string;
  defaultSliceId: string;
  defaultCoverageMultiplier: number;
  defaultThresholdPct: number;
  coverageMin: number;
  coverageMax: number;
  thresholdMinPct: number;
  thresholdMaxPct: number;
  metrics: MetricDefinition[];
  slices: SliceDefinition[];
};

type RateEvidence = {
  events: number;
  total: number;
  rate: number;
  lower: number;
  upper: number;
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/social-bias-measurement/data/intersectional-slice-metrics.json';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  const points = value * 100;
  return `${points > 0 ? '+' : ''}${points.toFixed(1)} pp`;
}

function wilsonInterval(events: number, total: number): RateEvidence {
  const rate = events / total;
  const z = 1.96;
  const denominator = 1 + z ** 2 / total;
  const center = (rate + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((rate * (1 - rate) + z ** 2 / (4 * total)) / total) / denominator;

  return {
    events,
    total,
    rate,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

function isSliceMetricData(value: unknown): value is SliceMetricData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SliceMetricData>;
  return Array.isArray(candidate.metrics)
    && candidate.metrics.length > 0
    && Array.isArray(candidate.slices)
    && candidate.slices.length > 0
    && typeof candidate.defaultMetricId === 'string'
    && typeof candidate.defaultThresholdPct === 'number';
}

export default function SocialBiasMeasurementSliceThresholdLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SliceMetricData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [metricId, setMetricId] = useState('');
  const [sliceId, setSliceId] = useState('');
  const [coverageMultiplier, setCoverageMultiplier] = useState(1);
  const [thresholdPct, setThresholdPct] = useState(8);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const payload = (await response.json()) as unknown;
        if (!isSliceMetricData(payload)) throw new Error('Slice metric data is incomplete.');

        if (active) {
          setData(payload);
          setMetricId(payload.defaultMetricId);
          setSliceId(payload.defaultSliceId);
          setCoverageMultiplier(payload.defaultCoverageMultiplier);
          setThresholdPct(payload.defaultThresholdPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load slice data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const metric = data?.metrics.find((item) => item.id === metricId) ?? data?.metrics[0];
  const slice = data?.slices.find((item) => item.id === sliceId) ?? data?.slices[0];

  const model = useMemo(() => {
    if (!metric || !slice) return null;
    const observation = slice.observations[metric.id];
    if (!observation) return null;

    const reference = wilsonInterval(
      observation.referenceEvents * coverageMultiplier,
      observation.referenceTotal * coverageMultiplier,
    );
    const focus = wilsonInterval(
      observation.focusEvents * coverageMultiplier,
      observation.focusTotal * coverageMultiplier,
    );
    const gap = focus.rate - reference.rate;
    const standardError = Math.sqrt(
      focus.rate * (1 - focus.rate) / focus.total
      + reference.rate * (1 - reference.rate) / reference.total,
    );
    const gapLower = Math.max(-1, gap - 1.96 * standardError);
    const gapUpper = Math.min(1, gap + 1.96 * standardError);
    const threshold = thresholdPct / 100;

    if (gapLower > threshold) {
      return {
        reference,
        focus,
        gap,
        gapLower,
        gapUpper,
        decision: 'Block deployment',
        decisionDetail: 'The complete plausible gap is above the declared maximum. More data would sharpen the estimate, not make this measured effect acceptable.',
        decisionTone: 'rose' as const,
        decisionState: 'block' as const,
      };
    }

    if (gapUpper > threshold) {
      return {
        reference,
        focus,
        gap,
        gapLower,
        gapUpper,
        decision: 'Hold for evidence',
        decisionDetail: 'The interval crosses the fairness threshold. Collect more independent cases for this slice before choosing release or remediation.',
        decisionTone: 'amber' as const,
        decisionState: 'hold' as const,
      };
    }

    return {
      reference,
      focus,
      gap,
      gapLower,
      gapUpper,
      decision: 'Eligible for canary',
      decisionDetail: 'The upper plausible gap stays below the declared maximum. This supports bounded production validation, not an unrestricted release.',
      decisionTone: 'emerald' as const,
      decisionState: 'pass' as const,
    };
  }, [coverageMultiplier, metric, slice, thresholdPct]);

  function reset() {
    if (!data) return;
    setMetricId(data.defaultMetricId);
    setSliceId(data.defaultSliceId);
    setCoverageMultiplier(data.defaultCoverageMultiplier);
    setThresholdPct(data.defaultThresholdPct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Intersectional fairness gate"
        title="Decide with the slice, denominator, and interval"
        description="Switch the harm metric and reporting slice, scale independent coverage, and move the declared fairness threshold. The deployment action uses the plausible gap, not only its point estimate."
        icon={Scale}
        accent="rose"
        onReset={data ? reset : undefined}
      />

      {!data || !metric || !slice || !model ? (
        <LoadState
          error={error}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the harm metric
                </legend>
                <div className="mt-3 space-y-2">
                  {data.metrics.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === metric.id}
                      label={option.label}
                      detail={option.benchmark}
                      icon={BarChart3}
                      accent="violet"
                      onClick={() => setMetricId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the reporting slice
                </legend>
                <div className="mt-3 space-y-2">
                  {data.slices.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === slice.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.id === 'intersection' ? UsersRound : Layers3}
                      accent={option.id === 'intersection' ? 'rose' : 'blue'}
                      onClick={() => setSliceId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Independent coverage"
                value={coverageMultiplier}
                output={`${coverageMultiplier}x`}
                min={data.coverageMin}
                max={data.coverageMax}
                step={1}
                lowLabel="Baseline n"
                highLabel="8x evidence"
                accent="blue"
                onChange={setCoverageMultiplier}
              />

              <LabRange
                label="Maximum allowed gap"
                value={thresholdPct}
                output={`${thresholdPct} pp`}
                min={data.thresholdMinPct}
                max={data.thresholdMaxPct}
                step={1}
                lowLabel="Strict"
                highLabel="Permissive"
                accent="amber"
                onChange={setThresholdPct}
              />
            </div>
          )}
        >
          <div className="min-h-[650px] min-w-0">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {metric.benchmark}
              </p>
              <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                {metric.label} for {slice.label}
              </h4>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {metric.definition}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Observed gap"
                value={formatSignedPercent(model.gap)}
                detail="Focus rate minus reference rate"
                icon={Gauge}
                tone={model.decisionTone}
              />
              <LabMetric
                label="Plausible gap"
                value={`${formatSignedPercent(model.gapLower)} to ${formatSignedPercent(model.gapUpper)}`}
                detail="Approximate 95% interval"
                icon={BarChart3}
                tone="blue"
              />
              <LabMetric
                label="Total denominator"
                value={(model.reference.total + model.focus.total).toLocaleString()}
                detail={`${model.reference.total.toLocaleString()} reference + ${model.focus.total.toLocaleString()} focus`}
                icon={UsersRound}
                tone="neutral"
              />
              <LabMetric
                label="Gate action"
                value={model.decision}
                detail={`Maximum gap: ${thresholdPct} pp`}
                icon={model.decisionState === 'pass' ? CheckCircle2 : CircleAlert}
                tone={model.decisionTone}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <GroupRate
                label={slice.referenceLabel}
                evidence={model.reference}
                tone="blue"
              />
              <GroupRate
                label={slice.focusLabel}
                evidence={model.focus}
                tone="rose"
              />
            </div>

            <GapRail
              lower={model.gapLower}
              estimate={model.gap}
              upper={model.gapUpper}
              threshold={thresholdPct / 100}
            />

            <div
              className={`mt-5 rounded-md border p-5 ${
                model.decisionState === 'pass'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : model.decisionState === 'hold'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {model.decisionState === 'pass' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.decisionState === 'hold' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {model.decisionDetail}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Synthetic teaching data. The coverage control models additional independent cases with the same event rates; real repeated generations need prompt-cluster uncertainty.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function GroupRate({
  label,
  evidence,
  tone,
}: {
  label: string;
  evidence: RateEvidence;
  tone: 'blue' | 'rose';
}) {
  const barTone = tone === 'blue' ? 'bg-blue-500' : 'bg-rose-500';
  const intervalTone = tone === 'blue' ? 'bg-blue-900 dark:bg-blue-100' : 'bg-rose-900 dark:bg-rose-100';

  return (
    <section className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {evidence.events.toLocaleString()} harmful events / {evidence.total.toLocaleString()} cases
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
          {formatPercent(evidence.rate)}
        </p>
      </div>
      <div
        className="relative mt-4 h-5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800"
        role="img"
        aria-label={`${label}: ${formatPercent(evidence.rate)}, with an approximate 95 percent interval from ${formatPercent(evidence.lower)} to ${formatPercent(evidence.upper)}`}
      >
        <div className={`h-full ${barTone}`} style={{ width: `${evidence.rate * 100}%` }} />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-1 -translate-y-1/2 ${intervalTone}`}
          style={{ left: `${evidence.lower * 100}%`, width: `${(evidence.upper - evidence.lower) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Approximate 95% rate interval: {formatPercent(evidence.lower)} to {formatPercent(evidence.upper)}
      </p>
    </section>
  );
}

function GapRail({
  lower,
  estimate,
  upper,
  threshold,
}: {
  lower: number;
  estimate: number;
  upper: number;
  threshold: number;
}) {
  const maximum = 0.35;
  const left = clamp(lower, 0, maximum) / maximum * 100;
  const right = clamp(upper, 0, maximum) / maximum * 100;
  const point = clamp(estimate, 0, maximum) / maximum * 100;
  const gate = clamp(threshold, 0, maximum) / maximum * 100;

  return (
    <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">Fairness gap against the gate</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            The line is the plausible gap range in percentage points. The dot is the estimate; the vertical marker is the declared maximum.
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
          Scale: 0 to 35 pp
        </span>
      </div>
      <div
        className="relative mt-5 h-12 rounded bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`The observed gap is ${formatSignedPercent(estimate)}, the plausible range is ${formatSignedPercent(lower)} to ${formatSignedPercent(upper)}, and the gate is ${(threshold * 100).toFixed(1)} percentage points.`}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-blue-600 dark:bg-blue-300"
          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-700 shadow dark:border-neutral-900 dark:bg-blue-200"
          style={{ left: `${point}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-rose-600 dark:bg-rose-300"
          style={{ left: `${gate}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>0 pp gap</span>
        <span>Declared gate {(threshold * 100).toFixed(0)} pp</span>
        <span>35 pp gap</span>
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[620px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Slice evidence could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-rose-500 motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading slice evidence...
          </p>
        </div>
      )}
    </div>
  );
}
