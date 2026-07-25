'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  RefreshCw,
  ShieldCheck,
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

type CriticalSlice = {
  id: string;
  label: string;
  detail: string;
  scorePct: number;
};

type ReleaseGateData = {
  baselineScorePct: number;
  candidateScorePct: number;
  defaultContaminationPct: number;
  defaultPromptVariancePct: number;
  defaultJudgeDisagreementPct: number;
  defaultEvidenceCases: number;
  defaultRegressionThresholdPct: number;
  defaultCriticalSliceId: string;
  gates: {
    maxContaminationPct: number;
    maxPromptVariancePct: number;
    maxJudgeDisagreementPct: number;
    minEvidenceCases: number;
    criticalSliceFloorPct: number;
  };
  criticalSlices: CriticalSlice[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/evaluation-benchmarks-comprehensive/data/release-gate-evidence.json';

const percent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return typeof candidate.baselineScorePct === 'number'
    && typeof candidate.candidateScorePct === 'number'
    && typeof candidate.defaultContaminationPct === 'number'
    && typeof candidate.defaultPromptVariancePct === 'number'
    && typeof candidate.defaultJudgeDisagreementPct === 'number'
    && typeof candidate.defaultEvidenceCases === 'number'
    && typeof candidate.defaultRegressionThresholdPct === 'number'
    && typeof candidate.defaultCriticalSliceId === 'string'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.criticalSlices)
    && candidate.criticalSlices.length > 0;
}

export default function EvaluationBenchmarksComprehensiveContaminationReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [contaminationPct, setContaminationPct] = useState(1);
  const [promptVariancePct, setPromptVariancePct] = useState(3);
  const [judgeDisagreementPct, setJudgeDisagreementPct] = useState(8);
  const [evidenceCases, setEvidenceCases] = useState(600);
  const [regressionThresholdPct, setRegressionThresholdPct] = useState(3);
  const [criticalSliceId, setCriticalSliceId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseGateData(payload)) throw new Error('Release gate data is incomplete.');

        if (active) {
          setData(payload);
          setContaminationPct(payload.defaultContaminationPct);
          setPromptVariancePct(payload.defaultPromptVariancePct);
          setJudgeDisagreementPct(payload.defaultJudgeDisagreementPct);
          setEvidenceCases(payload.defaultEvidenceCases);
          setRegressionThresholdPct(payload.defaultRegressionThresholdPct);
          setCriticalSliceId(payload.defaultCriticalSliceId);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load release gate data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const criticalSlice = data?.criticalSlices.find((slice) => slice.id === criticalSliceId)
    ?? data?.criticalSlices[0];

  const model = useMemo(() => {
    if (!data || !criticalSlice) return null;

    const candidateFraction = data.candidateScorePct / 100;
    const samplingMarginPct = 1.96 * Math.sqrt((candidateFraction * (1 - candidateFraction)) / evidenceCases) * 100;
    const protocolPenaltyPct = promptVariancePct / 2 + judgeDisagreementPct / 6;
    const conservativeRegressionPct = Math.max(
      0,
      data.baselineScorePct - data.candidateScorePct + samplingMarginPct + protocolPenaltyPct,
    );
    const sliceLowerBoundPct = Math.max(0, criticalSlice.scorePct - samplingMarginPct - protocolPenaltyPct);
    const contaminationPass = contaminationPct <= data.gates.maxContaminationPct;
    const variancePass = promptVariancePct <= data.gates.maxPromptVariancePct;
    const disagreementPass = judgeDisagreementPct <= data.gates.maxJudgeDisagreementPct;
    const evidencePass = evidenceCases >= data.gates.minEvidenceCases;
    const regressionPass = conservativeRegressionPct <= regressionThresholdPct;
    const slicePass = sliceLowerBoundPct >= data.gates.criticalSliceFloorPct;
    const failedGates = [
      !contaminationPass ? 'replace contaminated holdout cases' : null,
      !variancePass ? 'stabilize the prompt protocol' : null,
      !disagreementPass ? 'calibrate or adjudicate judge disagreements' : null,
      !evidencePass ? `review at least ${data.gates.minEvidenceCases.toLocaleString()} cases` : null,
      !regressionPass ? 'collect evidence that narrows or explains the regression bound' : null,
      !slicePass ? `repair or expand evidence for ${criticalSlice.label}` : null,
    ].filter((item): item is string => Boolean(item));

    const releaseReady = failedGates.length === 0;
    const decision = !contaminationPass
      ? 'Hold: the release holdout is not independent'
      : !slicePass
        ? 'Hold: the critical slice does not clear its conservative floor'
        : !regressionPass
          ? 'Hold: the regression bound exceeds the declared limit'
          : !variancePass || !disagreementPass || !evidencePass
            ? 'Collect and calibrate more evidence before a release decision'
            : 'Eligible for a monitored canary';

    return {
      contaminationPass,
      conservativeRegressionPct,
      decision,
      disagreementPass,
      evidencePass,
      failedGates,
      protocolPenaltyPct,
      regressionPass,
      releaseReady,
      samplingMarginPct,
      sliceLowerBoundPct,
      slicePass,
      variancePass,
    };
  }, [contaminationPct, criticalSlice, data, evidenceCases, judgeDisagreementPct, promptVariancePct, regressionThresholdPct]);

  function reset() {
    if (!data) return;
    setContaminationPct(data.defaultContaminationPct);
    setPromptVariancePct(data.defaultPromptVariancePct);
    setJudgeDisagreementPct(data.defaultJudgeDisagreementPct);
    setEvidenceCases(data.defaultEvidenceCases);
    setRegressionThresholdPct(data.defaultRegressionThresholdPct);
    setCriticalSliceId(data.defaultCriticalSliceId);
  }

  return (
    <div data-content-block="genai/evaluation-benchmarks-comprehensive-contamination-release-gate-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Contamination and uncertainty release gate"
          title="Make a release decision with evidence that can fail"
          description="Inject contamination, protocol instability, and a critical-slice result. The gate calculates a conservative regression bound and names the evidence required before a bounded release is defensible."
          icon={ShieldCheck}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !criticalSlice || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <LabRange
                  label="1. Holdout contamination"
                  value={contaminationPct}
                  output={percent(contaminationPct, 0)}
                  min={0}
                  max={12}
                  step={1}
                  accent="rose"
                  lowLabel="Independent"
                  highLabel="Leaky"
                  onChange={setContaminationPct}
                />
                <LabRange
                  label="2. Prompt variance"
                  value={promptVariancePct}
                  output={percent(promptVariancePct, 0)}
                  min={0}
                  max={12}
                  step={1}
                  accent="amber"
                  lowLabel="Stable"
                  highLabel="Protocol-sensitive"
                  onChange={setPromptVariancePct}
                />
                <LabRange
                  label="3. Judge disagreement"
                  value={judgeDisagreementPct}
                  output={percent(judgeDisagreementPct, 0)}
                  min={0}
                  max={30}
                  step={1}
                  accent="violet"
                  lowLabel="Aligned"
                  highLabel="Unreliable"
                  onChange={setJudgeDisagreementPct}
                />
                <LabRange
                  label="4. Independently reviewed cases"
                  value={evidenceCases}
                  output={evidenceCases.toLocaleString()}
                  min={100}
                  max={2_000}
                  step={100}
                  accent="blue"
                  lowLabel="Wide interval"
                  highLabel="Narrower interval"
                  onChange={setEvidenceCases}
                />
                <LabRange
                  label="5. Maximum regression bound"
                  value={regressionThresholdPct}
                  output={percent(regressionThresholdPct, 1)}
                  min={1}
                  max={6}
                  step={0.5}
                  accent="rose"
                  lowLabel="Strict"
                  highLabel="Permissive"
                  onChange={setRegressionThresholdPct}
                />
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    6. Critical-slice result
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.criticalSlices.map((slice) => (
                      <LabChoice
                        key={slice.id}
                        selected={slice.id === criticalSlice.id}
                        label={`${slice.label}: ${percent(slice.scorePct, 1)}`}
                        detail={slice.detail}
                        icon={Users}
                        accent={slice.scorePct < data.gates.criticalSliceFloorPct ? 'rose' : 'emerald'}
                        onClick={() => setCriticalSliceId(slice.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[640px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <LabMetric
                  label="Conservative regression bound"
                  value={percent(model.conservativeRegressionPct)}
                  detail={`Must be at most ${percent(regressionThresholdPct, 1)}`}
                  icon={Gauge}
                  tone={model.regressionPass ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Approximate 95% sampling margin"
                  value={`+/- ${percent(model.samplingMarginPct)}`}
                  detail={`${evidenceCases.toLocaleString()} independent reviewed cases`}
                  icon={FlaskConical}
                  tone={model.evidencePass ? 'blue' : 'amber'}
                />
                <LabMetric
                  label="Critical-slice lower bound"
                  value={percent(model.sliceLowerBoundPct)}
                  detail={`Must be at least ${percent(data.gates.criticalSliceFloorPct, 0)}`}
                  icon={Users}
                  tone={model.slicePass ? 'emerald' : 'rose'}
                />
              </div>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.releaseReady
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.releaseReady ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      The bound includes a teaching penalty of {percent(model.protocolPenaltyPct)} for prompt variance and judge disagreement. It is not a production statistical method; define and validate the uncertainty model before use.
                    </p>
                    {model.failedGates.length > 0 ? (
                      <>
                        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Required evidence before the next decision</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                          {model.failedGates.map((gate) => <li key={gate}>{gate}</li>)}
                        </ul>
                      </>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        Offline evidence supports only a monitored canary. Preserve the baseline, monitor the same critical slice, and define an abort threshold and rollback owner before exposure.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Release gate status">
                <Gate label="Holdout independence" pass={model.contaminationPass} result={percent(contaminationPct, 0)} requirement={`At most ${percent(data.gates.maxContaminationPct, 0)} contamination`} />
                <Gate label="Prompt stability" pass={model.variancePass} result={percent(promptVariancePct, 0)} requirement={`At most ${percent(data.gates.maxPromptVariancePct, 0)} variance`} />
                <Gate label="Judge reliability" pass={model.disagreementPass} result={percent(judgeDisagreementPct, 0)} requirement={`At most ${percent(data.gates.maxJudgeDisagreementPct, 0)} disagreement`} />
                <Gate label="Evidence volume" pass={model.evidencePass} result={evidenceCases.toLocaleString()} requirement={`At least ${data.gates.minEvidenceCases.toLocaleString()} independent cases`} />
                <Gate label="Regression threshold" pass={model.regressionPass} result={percent(model.conservativeRegressionPct)} requirement={`At most ${percent(regressionThresholdPct, 1)} conservative bound`} />
                <Gate label="Critical slice" pass={model.slicePass} result={percent(model.sliceLowerBoundPct)} requirement={`At least ${percent(data.gates.criticalSliceFloorPct, 0)} conservative lower bound`} />
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function Gate({ label, pass, result, requirement }: { label: string; pass: boolean; result: string; requirement: string }) {
  return (
    <div className={`rounded-md border p-4 ${pass ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
      <div className="flex items-start gap-3">
        {pass ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">{result}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{requirement}</p>
        </div>
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[360px] place-items-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Release gate data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading release evidence...</p>}
      </div>
    </LearningLabBody>
  );
}
