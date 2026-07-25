'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  RefreshCw,
  Scale,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Dimension = {
  id: string;
  label: string;
  benchmark: string;
  scorePct: number;
  publicEvidence: boolean;
  productEvidence: boolean;
  judgeSupport: string[];
};

type TaskMix = {
  id: string;
  label: string;
  detail: string;
  weights: Record<string, number>;
};

type Judge = {
  id: string;
  label: string;
  detail: string;
};

type PortfolioData = {
  defaultTaskMixId: string;
  defaultJudgeId: string;
  defaultSampleSize: number;
  defaultSliceFloorPct: number;
  dimensions: Dimension[];
  taskMixes: TaskMix[];
  judges: Judge[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/evaluation-benchmarks-comprehensive/data/benchmark-portfolio.json';

const percent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

function isNumberRecord(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every((item) => typeof item === 'number');
}

function isPortfolioData(value: unknown): value is PortfolioData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortfolioData>;
  return typeof candidate.defaultTaskMixId === 'string'
    && typeof candidate.defaultJudgeId === 'string'
    && typeof candidate.defaultSampleSize === 'number'
    && typeof candidate.defaultSliceFloorPct === 'number'
    && Array.isArray(candidate.dimensions)
    && candidate.dimensions.length > 0
    && Array.isArray(candidate.taskMixes)
    && candidate.taskMixes.length > 0
    && candidate.taskMixes.every((item) => isNumberRecord(item.weights))
    && Array.isArray(candidate.judges)
    && candidate.judges.length > 0;
}

export default function EvaluationBenchmarksComprehensivePortfolioCoverageLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [taskMixId, setTaskMixId] = useState('');
  const [judgeId, setJudgeId] = useState('');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [sampleSize, setSampleSize] = useState(600);
  const [sliceFloorPct, setSliceFloorPct] = useState(80);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isPortfolioData(payload)) throw new Error('Portfolio data is incomplete.');
        const defaultMix = payload.taskMixes.find((item) => item.id === payload.defaultTaskMixId)
          ?? payload.taskMixes[0];

        if (active) {
          setData(payload);
          setTaskMixId(defaultMix.id);
          setJudgeId(payload.defaultJudgeId);
          setWeights({ ...defaultMix.weights });
          setSampleSize(payload.defaultSampleSize);
          setSliceFloorPct(payload.defaultSliceFloorPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load portfolio data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const model = useMemo(() => {
    if (!data) return null;
    const totalWeight = data.dimensions.reduce((sum, dimension) => sum + (weights[dimension.id] ?? 0), 0);
    if (totalWeight <= 0) return null;

    const normalizedWeights = Object.fromEntries(
      data.dimensions.map((dimension) => [
        dimension.id,
        ((weights[dimension.id] ?? 0) / totalWeight) * 100,
      ]),
    );
    const aggregateScorePct = data.dimensions.reduce(
      (sum, dimension) => sum + dimension.scorePct * (normalizedWeights[dimension.id] ?? 0) / 100,
      0,
    );
    const scoreFraction = aggregateScorePct / 100;
    const confidenceMarginPct = 1.96 * Math.sqrt((scoreFraction * (1 - scoreFraction)) / sampleSize) * 100;

    const evidence = data.dimensions.map((dimension) => {
      const judgeSupported = dimension.judgeSupport.includes(judgeId);
      const evidenceParts = [dimension.publicEvidence, dimension.productEvidence, judgeSupported]
        .filter(Boolean).length;
      return {
        ...dimension,
        judgeSupported,
        coveragePct: (evidenceParts / 3) * 100,
        weightPct: normalizedWeights[dimension.id] ?? 0,
        clearsFloor: dimension.scorePct >= sliceFloorPct,
      };
    });
    const weightedCoveragePct = evidence.reduce(
      (sum, dimension) => sum + dimension.coveragePct * dimension.weightPct / 100,
      0,
    );
    const blindSpots = evidence.flatMap((dimension) => {
      const issues: string[] = [];
      if (!dimension.judgeSupported) issues.push(`${dimension.label} lacks a suitable judge`);
      if (!dimension.clearsFloor) issues.push(`${dimension.label} is below the ${sliceFloorPct}% slice floor`);
      if (dimension.weightPct < 10) issues.push(`${dimension.label} has under 10% portfolio weight`);
      return issues;
    });
    const requiredEvidence = evidence
      .filter((dimension) => dimension.coveragePct < 100 || !dimension.clearsFloor)
      .map((dimension) => dimension.label);

    return {
      aggregateScorePct,
      blindSpots,
      confidenceMarginPct,
      evidence,
      requiredEvidence,
      weightedCoveragePct,
    };
  }, [data, judgeId, sampleSize, sliceFloorPct, weights]);

  function selectTaskMix(taskMix: TaskMix) {
    setTaskMixId(taskMix.id);
    setWeights({ ...taskMix.weights });
  }

  function reset() {
    if (!data) return;
    const defaultMix = data.taskMixes.find((item) => item.id === data.defaultTaskMixId)
      ?? data.taskMixes[0];
    setTaskMixId(defaultMix.id);
    setJudgeId(data.defaultJudgeId);
    setWeights({ ...defaultMix.weights });
    setSampleSize(data.defaultSampleSize);
    setSliceFloorPct(data.defaultSliceFloorPct);
  }

  return (
    <div data-content-block="genai/evaluation-benchmarks-comprehensive-portfolio-coverage-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Benchmark portfolio coverage lab"
          title="Build evidence for a release claim, not a leaderboard"
          description="Set the task mix, make domain priorities explicit, choose a judge, and size the review. The aggregate moves with the weights, while blind spots remain visible until the portfolio actually covers them."
          icon={Scale}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Task mix
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.taskMixes.map((taskMix) => (
                      <LabChoice
                        key={taskMix.id}
                        selected={taskMix.id === taskMixId}
                        label={taskMix.label}
                        detail={taskMix.detail}
                        icon={ClipboardCheck}
                        accent={taskMix.id === 'workflow-agent' ? 'amber' : 'violet'}
                        onClick={() => selectTaskMix(taskMix)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Domain weights
                  </legend>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Values normalize into the visible portfolio shares. A low-weighted concern is still a blind spot when it is release-critical.
                  </p>
                  <div className="mt-4 space-y-5">
                    {data.dimensions.map((dimension) => (
                      <LabRange
                        key={dimension.id}
                        label={dimension.label}
                        value={weights[dimension.id] ?? 1}
                        output={percent(model.evidence.find((item) => item.id === dimension.id)?.weightPct ?? 0, 0)}
                        min={1}
                        max={100}
                        step={1}
                        lowLabel="Low"
                        highLabel="High"
                        accent={dimension.id === 'safety-slices' ? 'rose' : 'blue'}
                        onChange={(value) => {
                          setTaskMixId('custom');
                          setWeights((current) => ({ ...current, [dimension.id]: value }));
                        }}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Judge type
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.judges.map((judge) => (
                      <LabChoice
                        key={judge.id}
                        selected={judge.id === judgeId}
                        label={judge.label}
                        detail={judge.detail}
                        icon={Users}
                        accent={judge.id === 'hybrid-calibrated' ? 'emerald' : 'cyan'}
                        onClick={() => setJudgeId(judge.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="4. Reviewed cases"
                  value={sampleSize}
                  output={sampleSize.toLocaleString()}
                  min={100}
                  max={2_000}
                  step={100}
                  accent="blue"
                  lowLabel="Wide interval"
                  highLabel="Narrower interval"
                  onChange={setSampleSize}
                />

                <LabRange
                  label="5. Critical-slice floor"
                  value={sliceFloorPct}
                  output={percent(sliceFloorPct, 0)}
                  min={70}
                  max={95}
                  step={1}
                  accent="rose"
                  lowLabel="Permissive"
                  highLabel="Strict"
                  onChange={setSliceFloorPct}
                />
              </div>
            )}
          >
            <div className="min-h-[680px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <LabMetric
                  label="Weighted aggregate"
                  value={percent(model.aggregateScorePct)}
                  detail="A prioritization summary, not a release decision"
                  icon={Gauge}
                  tone="violet"
                />
                <LabMetric
                  label="Approximate 95% margin"
                  value={`+/- ${percent(model.confidenceMarginPct)}`}
                  detail={`${sampleSize.toLocaleString()} reviewed cases under a simple binomial approximation`}
                  icon={BarChart3}
                  tone="blue"
                />
                <LabMetric
                  label="Weighted evidence coverage"
                  value={percent(model.weightedCoveragePct, 0)}
                  detail="Public, product, and suitable judgment evidence"
                  icon={model.weightedCoveragePct === 100 ? CheckCircle2 : CircleAlert}
                  tone={model.weightedCoveragePct === 100 ? 'emerald' : 'amber'}
                />
              </div>

              <section className="mt-5" aria-label="Portfolio evidence by dimension">
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white">Evidence by dimension</h4>
                <div className="mt-3 space-y-3">
                  {model.evidence.map((dimension) => (
                    <div key={dimension.id} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div>
                          <p className="font-semibold text-neutral-950 dark:text-white">{dimension.label}</p>
                          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{dimension.benchmark}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {percent(dimension.scorePct, 0)} score · {percent(dimension.weightPct, 0)} weight
                        </p>
                      </div>
                      <div className="mt-3 flex h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                        <div className="bg-violet-500" style={{ width: `${dimension.coveragePct}%` }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <EvidenceBadge label="Public benchmark" active={dimension.publicEvidence} />
                        <EvidenceBadge label="Product tasks" active={dimension.productEvidence} />
                        <EvidenceBadge label="Suitable judge" active={dimension.judgeSupported} />
                        <EvidenceBadge label={`Floor ${percent(sliceFloorPct, 0)}`} active={dimension.clearsFloor} critical />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.blindSpots.length === 0
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.blindSpots.length === 0 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">
                      {model.blindSpots.length === 0 ? 'Portfolio evidence is complete for this teaching scenario' : 'Blind spots still need explicit evidence'}
                    </p>
                    {model.blindSpots.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        {model.blindSpots.map((blindSpot) => <li key={blindSpot}>{blindSpot}</li>)}
                      </ul>
                    ) : null}
                    {model.requiredEvidence.length > 0 ? (
                      <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        Required follow-up: add or repair evidence for {model.requiredEvidence.join(', ')} before treating this as a release-ready portfolio.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function EvidenceBadge({ label, active, critical = false }: { label: string; active: boolean; critical?: boolean }) {
  const style = active
    ? critical
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
  return <span className={`rounded border px-2 py-1 font-semibold ${style}`}>{active ? 'Covered: ' : 'Missing: '}{label}</span>;
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[360px] place-items-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Portfolio data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading portfolio evidence...</p>}
      </div>
    </LearningLabBody>
  );
}
