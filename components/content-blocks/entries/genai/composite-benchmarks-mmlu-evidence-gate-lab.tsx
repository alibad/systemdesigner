'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  FlaskConical,
  Gauge,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Shuffle,
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

type EvidenceProfile = {
  id: string;
  label: string;
  detail: string;
  overallAccuracyPct: number;
  worstSliceLabel: string;
  worstSliceAccuracyPct: number;
  worstSliceSharePct: number;
  contaminatedItemAccuracyPct: number;
};

type EvidenceGateData = {
  defaultProfileId: string;
  defaultSampleSize: number;
  defaultContaminationPct: number;
  defaultPromptVariancePct: number;
  defaultSliceFloorPct: number;
  sampleMin: number;
  sampleMax: number;
  sampleStep: number;
  contaminationMinPct: number;
  contaminationMaxPct: number;
  promptVarianceMinPct: number;
  promptVarianceMaxPct: number;
  sliceFloorMinPct: number;
  sliceFloorMaxPct: number;
  gates: {
    maximumContaminationPct: number;
    maximumPromptVariancePct: number;
    minimumSliceCases: number;
  };
  profiles: EvidenceProfile[];
};

type Interval = {
  rate: number;
  lower: number;
  upper: number;
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/composite-benchmarks-mmlu/data/evidence-gate.json';

function isEvidenceGateData(value: unknown): value is EvidenceGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceGateData>;
  return typeof candidate.defaultProfileId === 'string'
    && typeof candidate.defaultSampleSize === 'number'
    && typeof candidate.defaultContaminationPct === 'number'
    && typeof candidate.defaultPromptVariancePct === 'number'
    && typeof candidate.defaultSliceFloorPct === 'number'
    && typeof candidate.sampleMin === 'number'
    && typeof candidate.sampleMax === 'number'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.profiles)
    && candidate.profiles.length > 0;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function wilsonInterval(correct: number, total: number): Interval {
  const rate = correct / total;
  const z = 1.96;
  const denominator = 1 + z ** 2 / total;
  const center = (rate + z ** 2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt(
    rate * (1 - rate) / total + z ** 2 / (4 * total ** 2),
  ) / denominator;
  return {
    rate,
    lower: clamp(center - margin),
    upper: clamp(center + margin),
  };
}

function estimateCleanRate(observedRate: number, contamination: number, leakedRate: number) {
  if (contamination <= 0) return observedRate;
  return clamp((observedRate - contamination * leakedRate) / (1 - contamination));
}

export default function CompositeBenchmarksMmluEvidenceGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvidenceGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [sampleSize, setSampleSize] = useState(800);
  const [contaminationPct, setContaminationPct] = useState(2);
  const [promptVariancePct, setPromptVariancePct] = useState(2);
  const [sliceFloorPct, setSliceFloorPct] = useState(65);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isEvidenceGateData(payload)) throw new Error('Evidence-gate data is incomplete.');

        if (active) {
          setData(payload);
          setProfileId(payload.defaultProfileId);
          setSampleSize(payload.defaultSampleSize);
          setContaminationPct(payload.defaultContaminationPct);
          setPromptVariancePct(payload.defaultPromptVariancePct);
          setSliceFloorPct(payload.defaultSliceFloorPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load evidence data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const profile = data?.profiles.find((item) => item.id === profileId) ?? data?.profiles[0];

  const model = useMemo(() => {
    if (!data || !profile) return null;

    const sliceCases = Math.max(1, Math.round(sampleSize * profile.worstSliceSharePct / 100));
    const overallCorrect = Math.round(sampleSize * profile.overallAccuracyPct / 100);
    const sliceCorrect = Math.round(sliceCases * profile.worstSliceAccuracyPct / 100);
    const overallObserved = wilsonInterval(overallCorrect, sampleSize);
    const sliceObserved = wilsonInterval(sliceCorrect, sliceCases);
    const contamination = contaminationPct / 100;
    const leakedRate = profile.contaminatedItemAccuracyPct / 100;
    const promptPenalty = promptVariancePct / 100;

    const cleanOverall = {
      rate: estimateCleanRate(overallObserved.rate, contamination, leakedRate),
      lower: estimateCleanRate(overallObserved.lower, contamination, leakedRate),
      upper: estimateCleanRate(overallObserved.upper, contamination, leakedRate),
    };
    const cleanSlice = {
      rate: estimateCleanRate(sliceObserved.rate, contamination, leakedRate),
      lower: estimateCleanRate(sliceObserved.lower, contamination, leakedRate),
      upper: estimateCleanRate(sliceObserved.upper, contamination, leakedRate),
    };
    const conservativeSliceLower = clamp(cleanSlice.lower - promptPenalty);
    const floor = sliceFloorPct / 100;

    const integrityPass = contaminationPct <= data.gates.maximumContaminationPct;
    const stabilityPass = promptVariancePct <= data.gates.maximumPromptVariancePct;
    const coveragePass = sliceCases >= data.gates.minimumSliceCases;
    const pointPass = cleanSlice.rate >= floor;
    const confidencePass = conservativeSliceLower >= floor;

    let decision: string;
    let explanation: string;
    let state: 'pass' | 'hold' | 'block';

    if (!integrityPass) {
      decision = 'Block the benchmark claim';
      explanation = `Estimated overlap exceeds the ${data.gates.maximumContaminationPct}% integrity gate. Quarantine or replace contaminated clusters; more samples do not restore holdout independence.`;
      state = 'block';
    } else if (!pointPass) {
      decision = 'Block the candidate';
      explanation = `The contamination-adjusted ${profile.worstSliceLabel} point estimate is below the ${sliceFloorPct}% floor. This is a measured slice failure, not merely a wide interval.`;
      state = 'block';
    } else if (!stabilityPass) {
      decision = 'Hold for a stable protocol';
      explanation = `Prompt-run spread exceeds the ${data.gates.maximumPromptVariancePct}-point stability gate. Freeze the primary prompt and diagnose the sensitivity before comparing candidates.`;
      state = 'hold';
    } else if (!coveragePass) {
      decision = 'Hold for slice coverage';
      explanation = `${profile.worstSliceLabel} has ${sliceCases} cases, below the minimum of ${data.gates.minimumSliceCases}. Add independent questions before treating the point estimate as release evidence.`;
      state = 'hold';
    } else if (!confidencePass) {
      decision = 'Hold for confidence';
      explanation = `The conservative slice lower bound is ${formatPct(conservativeSliceLower)}, below the ${sliceFloorPct}% floor. More independent cases can narrow this uncertainty.`;
      state = 'hold';
    } else {
      decision = 'Eligible for a bounded canary';
      explanation = `Integrity and prompt-stability gates pass, and the conservative ${profile.worstSliceLabel} lower bound clears the declared floor. Product and safety gates still apply.`;
      state = 'pass';
    }

    return {
      cleanOverall,
      cleanSlice,
      confidencePass,
      conservativeSliceLower,
      coveragePass,
      decision,
      explanation,
      integrityPass,
      overallObserved,
      pointPass,
      sliceCases,
      sliceObserved,
      stabilityPass,
      state,
    };
  }, [contaminationPct, data, profile, promptVariancePct, sampleSize, sliceFloorPct]);

  function reset() {
    if (!data) return;
    setProfileId(data.defaultProfileId);
    setSampleSize(data.defaultSampleSize);
    setContaminationPct(data.defaultContaminationPct);
    setPromptVariancePct(data.defaultPromptVariancePct);
    setSliceFloorPct(data.defaultSliceFloorPct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Uncertainty and integrity lab"
        title="Decide whether to collect, repair, or block"
        description="Change independent sample size, estimated contamination, prompt-run spread, and the critical-slice floor. The decision distinguishes weak evidence from a point-estimate failure."
        icon={ScanSearch}
        accent="rose"
        onReset={data ? reset : undefined}
      />

      {!data || !profile || !model ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Evidence profile
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FlaskConical}
                      accent={item.id === 'hidden-failure' ? 'rose' : 'blue'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Independent test items"
                value={sampleSize}
                output={sampleSize.toLocaleString()}
                min={data.sampleMin}
                max={data.sampleMax}
                step={data.sampleStep}
                lowLabel="Wide intervals"
                highLabel="Narrower intervals"
                accent="blue"
                onChange={setSampleSize}
              />

              <LabRange
                label="3. Estimated contamination"
                value={contaminationPct}
                output={`${contaminationPct}%`}
                min={data.contaminationMinPct}
                max={data.contaminationMaxPct}
                step={1}
                lowLabel="No detected overlap"
                highLabel="Claim invalid"
                accent="rose"
                onChange={setContaminationPct}
              />

              <LabRange
                label="4. Prompt-run spread"
                value={promptVariancePct}
                output={`${promptVariancePct} points`}
                min={data.promptVarianceMinPct}
                max={data.promptVarianceMaxPct}
                step={1}
                lowLabel="Stable"
                highLabel="Prompt-sensitive"
                accent="violet"
                onChange={setPromptVariancePct}
              />

              <LabRange
                label="5. Critical-slice floor"
                value={sliceFloorPct}
                output={`${sliceFloorPct}%`}
                min={data.sliceFloorMinPct}
                max={data.sliceFloorMaxPct}
                step={1}
                lowLabel="Permissive"
                highLabel="Strict"
                accent="amber"
                onChange={setSliceFloorPct}
              />
            </div>
          )}
        >
          <div className="min-h-[700px] min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <LabMetric
                label="Observed overall"
                value={formatPct(model.overallObserved.rate)}
                detail={`${sampleSize.toLocaleString()} total items`}
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label={`Observed ${profile.worstSliceLabel}`}
                value={formatPct(model.sliceObserved.rate)}
                detail={`${model.sliceCases.toLocaleString()} slice items`}
                icon={UsersRound}
                tone="violet"
              />
              <LabMetric
                label="Adjusted slice estimate"
                value={formatPct(model.cleanSlice.rate)}
                detail={`Modeled after ${contaminationPct}% overlap adjustment`}
                icon={FileWarning}
                tone="amber"
              />
              <LabMetric
                label="Conservative lower bound"
                value={formatPct(model.conservativeSliceLower)}
                detail={`95% lower bound minus ${promptVariancePct} prompt points`}
                icon={BarChart3}
                tone={model.confidencePass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Release action"
                value={model.state === 'pass' ? 'Canary' : model.state === 'hold' ? 'Hold' : 'Block'}
                detail={`Critical floor: ${sliceFloorPct}%`}
                icon={model.state === 'pass' ? ShieldCheck : CircleAlert}
                tone={model.state === 'pass' ? 'emerald' : model.state === 'hold' ? 'amber' : 'rose'}
              />
            </div>

            <ConfidenceRail
              label={profile.worstSliceLabel}
              lower={model.cleanSlice.lower}
              conservativeLower={model.conservativeSliceLower}
              estimate={model.cleanSlice.rate}
              upper={model.cleanSlice.upper}
              floor={sliceFloorPct / 100}
            />

            <section className="mt-5">
              <div className="flex items-start gap-3">
                <Shuffle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Four independent gates
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    Each gate protects a different claim. Passing one cannot cancel another.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <GateStatus
                  label="Holdout integrity"
                  pass={model.integrityPass}
                  detail={`${contaminationPct}% estimated overlap; maximum ${data.gates.maximumContaminationPct}%`}
                />
                <GateStatus
                  label="Prompt stability"
                  pass={model.stabilityPass}
                  detail={`${promptVariancePct}-point spread; maximum ${data.gates.maximumPromptVariancePct} points`}
                />
                <GateStatus
                  label="Slice coverage"
                  pass={model.coveragePass}
                  detail={`${model.sliceCases} independent cases; minimum ${data.gates.minimumSliceCases}`}
                />
                <GateStatus
                  label="Slice performance"
                  pass={model.pointPass && model.confidencePass}
                  detail={`${formatPct(model.cleanSlice.rate)} estimate and ${formatPct(model.conservativeSliceLower)} conservative lower bound against ${sliceFloorPct}%`}
                />
              </div>
            </section>

            <div
              className={`mt-5 rounded-md border p-5 ${
                model.state === 'pass'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                  : model.state === 'hold'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {model.state === 'pass' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${model.state === 'hold' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {model.explanation}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Synthetic teaching model. The overlap adjustment assumes contaminated items score at {profile.contaminatedItemAccuracyPct}%; real contamination requires item-level quarantine and a fresh holdout.
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

function GateStatus({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      {pass ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}: {pass ? 'pass' : 'not met'}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
      </div>
    </div>
  );
}

function ConfidenceRail({
  label,
  lower,
  conservativeLower,
  estimate,
  upper,
  floor,
}: {
  label: string;
  lower: number;
  conservativeLower: number;
  estimate: number;
  upper: number;
  floor: number;
}) {
  const scaleMinimum = 0.4;
  const scaleMaximum = 0.9;
  const position = (value: number) => (
    clamp(value, scaleMinimum, scaleMaximum) - scaleMinimum
  ) / (scaleMaximum - scaleMinimum) * 100;
  const intervalLeft = position(lower);
  const intervalRight = position(upper);

  return (
    <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{label} confidence against the floor</h4>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            The interval reflects sample size. The separate conservative marker subtracts the declared prompt-run spread.
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">Scale: 40% to 90%</span>
      </div>
      <div
        className="relative mt-6 h-14 rounded bg-neutral-200 dark:bg-neutral-800"
        role="img"
        aria-label={`${label} adjusted estimate is ${formatPct(estimate)}, the adjusted 95 percent interval is ${formatPct(lower)} to ${formatPct(upper)}, the conservative lower bound is ${formatPct(conservativeLower)}, and the floor is ${formatPct(floor)}.`}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-blue-600 dark:bg-blue-300"
          style={{ left: `${intervalLeft}%`, width: `${Math.max(1, intervalRight - intervalLeft)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-700 shadow dark:border-neutral-900 dark:bg-blue-200"
          style={{ left: `${position(estimate)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-amber-600 dark:bg-amber-300"
          style={{ left: `${position(floor)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1 h-4 w-4 -translate-x-1/2 rotate-45 border-2 border-white bg-rose-600 shadow dark:border-neutral-900 dark:bg-rose-300"
          style={{ left: `${position(conservativeLower)}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span>Interval {formatPct(lower)} to {formatPct(upper)}</span>
        <span>Point {formatPct(estimate)}</span>
        <span>Conservative lower {formatPct(conservativeLower)}</span>
        <span>Floor {formatPct(floor)}</span>
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[500px] place-items-center p-6 text-center">
        {error ? (
          <div className="max-w-md">
            <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Evidence data could not load</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <div role="status">
            <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-rose-500 motion-reduce:animate-none" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Loading evaluation evidence...</p>
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
