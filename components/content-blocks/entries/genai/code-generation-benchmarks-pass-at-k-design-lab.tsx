'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  DollarSign,
  FlaskConical,
  Gauge,
  RefreshCw,
  Scale,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Slice = {
  id: string;
  label: string;
  detail: string;
  calibration: number;
  costPerExecutionCents: number;
};

type TaskMix = {
  id: string;
  label: string;
  detail: string;
  enabledSliceIds: string[];
};

type TestStrength = {
  id: string;
  label: string;
  detail: string;
  falsePositivePct: number;
};

type Aggregation = {
  id: string;
  label: string;
  detail: string;
  weights: Record<string, number>;
};

type PassAtKData = {
  defaultGeneratedSamples: number;
  defaultCorrectSamples: number;
  defaultK: number;
  defaultTaskMixId: string;
  defaultTestStrengthId: string;
  defaultTimeoutSeconds: number;
  defaultAggregationId: string;
  slices: Slice[];
  taskMixes: TaskMix[];
  testStrengths: TestStrength[];
  aggregations: Aggregation[];
};

type Interval = { lower: number; upper: number };

const DEFAULT_DATA_FILE =
  '/api/content/genai/code-generation-benchmarks/data/pass-at-k-design.json';

function validData(value: unknown): value is PassAtKData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PassAtKData>;
  return typeof candidate.defaultGeneratedSamples === 'number'
    && typeof candidate.defaultCorrectSamples === 'number'
    && typeof candidate.defaultK === 'number'
    && typeof candidate.defaultTaskMixId === 'string'
    && typeof candidate.defaultTestStrengthId === 'string'
    && typeof candidate.defaultTimeoutSeconds === 'number'
    && typeof candidate.defaultAggregationId === 'string'
    && Array.isArray(candidate.slices)
    && candidate.slices.length > 0
    && Array.isArray(candidate.taskMixes)
    && Array.isArray(candidate.testStrengths)
    && Array.isArray(candidate.aggregations);
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function passAtK(total: number, correct: number, k: number) {
  const count = Math.min(total, Math.max(1, k));
  if (correct <= 0) return 0;
  if (total - correct < count) return 1;

  let noPass = 1;
  for (let index = 0; index < count; index += 1) {
    noPass *= (total - correct - index) / (total - index);
  }
  return 1 - noPass;
}

function wilsonInterval(correct: number, total: number): Interval {
  const rate = correct / total;
  const z = 1.96;
  const denominator = 1 + z ** 2 / total;
  const center = (rate + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt(rate * (1 - rate) / total + z ** 2 / (4 * total ** 2)) / denominator;
  return { lower: clamp(center - margin), upper: clamp(center + margin) };
}

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CodeGenerationBenchmarksPassAtKDesignLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PassAtKData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [generatedSamples, setGeneratedSamples] = useState(40);
  const [correctSamples, setCorrectSamples] = useState(18);
  const [k, setK] = useState(5);
  const [taskMixId, setTaskMixId] = useState('');
  const [testStrengthId, setTestStrengthId] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(8);
  const [aggregationId, setAggregationId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validData(payload)) throw new Error('Pass@k lab data is incomplete.');
        if (!active) return;
        setData(payload);
        setGeneratedSamples(payload.defaultGeneratedSamples);
        setCorrectSamples(payload.defaultCorrectSamples);
        setK(payload.defaultK);
        setTaskMixId(payload.defaultTaskMixId);
        setTestStrengthId(payload.defaultTestStrengthId);
        setTimeoutSeconds(payload.defaultTimeoutSeconds);
        setAggregationId(payload.defaultAggregationId);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const taskMix = data?.taskMixes.find((item) => item.id === taskMixId) ?? data?.taskMixes[0];
  const testStrength = data?.testStrengths.find((item) => item.id === testStrengthId) ?? data?.testStrengths[0];
  const aggregation = data?.aggregations.find((item) => item.id === aggregationId) ?? data?.aggregations[0];

  const model = useMemo(() => {
    if (!data || !taskMix || !testStrength || !aggregation) return null;
    const activeSlices = data.slices.filter((slice) => taskMix.enabledSliceIds.includes(slice.id));
    if (activeSlices.length === 0) return null;

    const observedRate = correctSamples / generatedSamples;
    const observedInterval = wilsonInterval(correctSamples, generatedSamples);
    const timeoutPenalty = timeoutSeconds < 5 ? (5 - timeoutSeconds) * 0.0125 : 0;
    const totalWeight = activeSlices.reduce((sum, slice) => sum + (aggregation.weights[slice.id] ?? 0), 0);
    const executionMultiplier = testStrength.id === 'visible' ? 1 : testStrength.id === 'hidden' ? 1.4 : 1.9;
    const timeoutCostMultiplier = 0.6 + timeoutSeconds / 20;

    const slices = activeSlices.map((slice) => {
      const adjusted = (rate: number) => clamp(
        rate * slice.calibration - testStrength.falsePositivePct / 100 - timeoutPenalty,
      );
      const adjustedRate = adjusted(observedRate);
      const effectiveCorrect = Math.round(generatedSamples * adjustedRate);
      const weight = (aggregation.weights[slice.id] ?? 0) / totalWeight;
      return {
        ...slice,
        weight,
        adjustedRate,
        score: passAtK(generatedSamples, effectiveCorrect, k),
        interval: {
          lower: passAtK(generatedSamples, Math.round(generatedSamples * adjusted(observedInterval.lower)), k),
          upper: passAtK(generatedSamples, Math.round(generatedSamples * adjusted(observedInterval.upper)), k),
        },
        costCents: generatedSamples * slice.costPerExecutionCents * executionMultiplier * timeoutCostMultiplier,
      };
    });

    const score = slices.reduce((sum, slice) => sum + slice.score * slice.weight, 0);
    const interval = slices.reduce(
      (result, slice) => ({
        lower: result.lower + slice.interval.lower * slice.weight,
        upper: result.upper + slice.interval.upper * slice.weight,
      }),
      { lower: 0, upper: 0 },
    );
    const costCents = slices.reduce((sum, slice) => sum + slice.costCents, 0);
    const meaning = testStrength.id === 'visible'
      ? 'This is an apparent visible-test pass@k. It does not establish behavior on unseen cases.'
      : taskMix.id === 'benchmark-only'
        ? 'This is a reproducible benchmark regression signal, not a repository-agent release claim.'
        : interval.upper - interval.lower > 0.15
          ? 'The task mix is relevant, but the observed sample count leaves a wide uncertainty interval.'
          : 'This supports the declared task-mix claim only under the shown sandbox and test contract.';

    return { costCents, interval, meaning, observedRate, score, slices };
  }, [aggregation, correctSamples, data, generatedSamples, k, taskMix, testStrength, timeoutSeconds]);

  function reset() {
    if (!data) return;
    setGeneratedSamples(data.defaultGeneratedSamples);
    setCorrectSamples(data.defaultCorrectSamples);
    setK(data.defaultK);
    setTaskMixId(data.defaultTaskMixId);
    setTestStrengthId(data.defaultTestStrengthId);
    setTimeoutSeconds(data.defaultTimeoutSeconds);
    setAggregationId(data.defaultAggregationId);
  }

  return (
    <div data-content-block="genai/code-generation-benchmarks-pass-at-k-design-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Pass@k evaluation design lab"
          title="Make the score say exactly what the run tested"
          description="The values are synthetic. Change sampling, verifier strength, timeout, task mix, and aggregation to see the score, interval, cost, and claim move together."
          icon={FlaskConical}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !taskMix || !testStrength || !aggregation || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <LabRange
                  label="1. Generated samples per task"
                  value={generatedSamples}
                  output={generatedSamples.toLocaleString()}
                  min={10}
                  max={100}
                  step={1}
                  lowLabel="Cheap, wide interval"
                  highLabel="More execution evidence"
                  accent="blue"
                  onChange={(value) => {
                    setGeneratedSamples(value);
                    setCorrectSamples((current) => Math.min(current, value));
                    setK((current) => Math.min(current, value));
                  }}
                />
                <LabRange
                  label="2. Correct samples observed"
                  value={correctSamples}
                  output={`${correctSamples} of ${generatedSamples}`}
                  min={0}
                  max={generatedSamples}
                  step={1}
                  lowLabel="No passes"
                  highLabel="All pass"
                  accent="emerald"
                  onChange={setCorrectSamples}
                />
                <LabRange
                  label="3. Candidate budget (k)"
                  value={k}
                  output={`pass@${k}`}
                  min={1}
                  max={generatedSamples}
                  step={1}
                  lowLabel="First attempt"
                  highLabel="Search budget"
                  accent="violet"
                  onChange={setK}
                />
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Task mix</legend>
                  <div className="mt-3 space-y-2">
                    {data.taskMixes.map((item) => (
                      <LabChoice key={item.id} selected={item.id === taskMix.id} label={item.label} detail={item.detail} icon={BarChart3} accent="blue" onClick={() => setTaskMixId(item.id)} />
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">5. Test strength</legend>
                  <div className="mt-3 space-y-2">
                    {data.testStrengths.map((item) => (
                      <LabChoice key={item.id} selected={item.id === testStrength.id} label={item.label} detail={item.detail} icon={CheckCircle2} accent={item.id === 'visible' ? 'amber' : 'emerald'} onClick={() => setTestStrengthId(item.id)} />
                    ))}
                  </div>
                </fieldset>
                <LabRange
                  label="6. Wall-clock timeout"
                  value={timeoutSeconds}
                  output={`${timeoutSeconds}s`}
                  min={1}
                  max={30}
                  step={1}
                  lowLabel="Strict, more timeouts"
                  highLabel="More runner cost"
                  accent="amber"
                  onChange={setTimeoutSeconds}
                />
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">7. Aggregation</legend>
                  <div className="mt-3 space-y-2">
                    {data.aggregations.map((item) => (
                      <LabChoice key={item.id} selected={item.id === aggregation.id} label={item.label} detail={item.detail} icon={Scale} accent="violet" onClick={() => setAggregationId(item.id)} />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Aggregate pass@k" value={percent(model.score)} detail={aggregation.label} icon={Gauge} tone="violet" />
                <LabMetric label="95% interval" value={`${percent(model.interval.lower)} to ${percent(model.interval.upper)}`} detail="Sampling uncertainty only" icon={CircleAlert} tone="blue" />
                <LabMetric label="Observed pass rate" value={percent(model.observedRate)} detail="Before slice and verifier adjustments" icon={CheckCircle2} tone="emerald" />
                <LabMetric label="Estimated run cost" value={dollars(model.costCents)} detail="Candidate generation is excluded" icon={DollarSign} tone="amber" />
              </div>

              <section className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50">
                <div className="flex items-start gap-3">
                  <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h4 className="font-semibold">What this score means</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{model.meaning}</p>
                  </div>
                </div>
              </section>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Slice evidence</h4>
                {model.slices.map((slice) => (
                  <article key={slice.id} className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h5 className="font-semibold text-neutral-950 dark:text-white">{slice.label}</h5>
                        <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">{slice.detail}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">{percent(slice.score)} pass@{k}</p>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-3 dark:text-neutral-300">
                      <span>Weight: {percent(slice.weight, 0)}</span>
                      <span>Interval: {percent(slice.interval.lower)} to {percent(slice.interval.upper)}</span>
                      <span>Runner cost: {dollars(slice.costCents)}</span>
                    </div>
                  </article>
                ))}
              </div>

              <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400"><Timer aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> The interval reflects finite candidate sampling. It does not repair contamination, flaky tests, or an unsafe evaluator.</p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-[360px] p-6" aria-live="polite">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">The evaluation model could not load.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw aria-hidden="true" className="h-4 w-4" />Retry</button>
        </div>
      ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading evaluation model...</p>}
    </div>
  );
}
