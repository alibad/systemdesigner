'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Gauge, SearchCheck, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Retrieval = 'none' | 'uncited' | 'verified';
type Calibration = 'raw' | 'calibrated';

interface LabData {
  protocolLabel?: string;
  scopeNote?: string;
  releaseRule?: string;
}

const RETRIEVAL_PROFILES: Record<Retrieval, { label: string; detail: string; accuracy: number; evidence: number; slice: number }> = {
  none: {
    label: 'No retrieval evidence',
    detail: 'The answer relies only on model parameters and its stated uncertainty.',
    accuracy: 0,
    evidence: 0,
    slice: 0,
  },
  uncited: {
    label: 'Unverified retrieval',
    detail: 'Context is supplied, but source authority and answer entailment are not checked.',
    accuracy: 0.035,
    evidence: 8,
    slice: 0.01,
  },
  verified: {
    label: 'Verified cited retrieval',
    detail: 'Sources are checked for authority, freshness, and support for the final claim.',
    accuracy: 0.06,
    evidence: 16,
    slice: 0.025,
  },
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));
const initialData: LabData = {
  protocolLabel: 'Illustrative evidence review',
  scopeNote: 'This lab separates a benchmark score from the quality of evidence supporting a production claim.',
  releaseRule: 'Evidence must be clean, stable across valid prompts, calibrated, and above the critical-slice floor.',
};

export default function TruthfulqaEvaluationEvidenceLab({ dataFile }: { dataFile?: string }) {
  const [retrieval, setRetrieval] = useState<Retrieval>('verified');
  const [contamination, setContamination] = useState(8);
  const [promptVariance, setPromptVariance] = useState(4);
  const [calibration, setCalibration] = useState<Calibration>('calibrated');
  const [sliceFloor, setSliceFloor] = useState(68);
  const [data, setData] = useState<LabData>(initialData);

  useEffect(() => {
    let active = true;
    if (!dataFile) return undefined;

    void fetch(dataFile)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load lab data'))))
      .then((loaded: LabData) => {
        if (active) setData({ ...initialData, ...loaded });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [dataFile]);

  const model = useMemo(() => {
    const retrievalProfile = RETRIEVAL_PROFILES[retrieval];
    const cleanAccuracy = clamp(0.74 + retrievalProfile.accuracy - promptVariance * 0.004, 0.3, 0.95);
    const leakageLift = contamination * 0.0025;
    const benchmarkScore = clamp(cleanAccuracy + leakageLift, 0.01, 0.99);
    const calibrationGap = calibration === 'raw' ? 0.11 + promptVariance * 0.004 : 0.022 + promptVariance * 0.0015;
    const reportedConfidence = clamp(benchmarkScore + calibrationGap, 0.01, 0.99);
    const evidenceQuality = clamp(74 + retrievalProfile.evidence - contamination * 0.8 - promptVariance * 2 - (calibration === 'raw' ? 8 : 0), 0, 100);
    const worstSlice = clamp(cleanAccuracy - 0.1 - promptVariance * 0.006 + retrievalProfile.slice, 0.01, 0.99);
    const failures = [
      contamination > 10 ? `Contamination risk: ${contamination}% of the holdout may reward memorized items.` : null,
      promptVariance > 5 ? `Prompt sensitivity: valid templates differ by ${promptVariance} points.` : null,
      calibrationGap > 0.05 ? `Overconfidence: reported confidence exceeds the clean estimate by ${percent(calibrationGap)}.` : null,
      retrieval === 'none' ? 'Grounding gap: no retrieved evidence is available for a disputed answer.' : null,
      retrieval === 'uncited' ? 'Entailment gap: retrieved text is present but not verified against the final claim.' : null,
      worstSlice < sliceFloor / 100 ? `Slice floor missed: weakest slice is ${percent(worstSlice)} versus ${sliceFloor}%.` : null,
    ].filter(Boolean) as string[];
    const release = failures.length === 0 && evidenceQuality >= 70;

    return { benchmarkScore, cleanAccuracy, evidenceQuality, failures, release, reportedConfidence, worstSlice };
  }, [calibration, contamination, promptVariance, retrieval, sliceFloor]);

  const reset = () => {
    setRetrieval('verified');
    setContamination(8);
    setPromptVariance(4);
    setCalibration('calibrated');
    setSliceFloor(68);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow={data.protocolLabel || initialData.protocolLabel || 'Evidence review'}
        title="Separate a high score from strong evidence"
        description="Change retrieval quality, holdout contamination, prompt variance, calibration, and the weakest-slice floor. The lab exposes why confidence can rise while evidence quality falls."
        icon={SearchCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Retrieval treatment</legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(RETRIEVAL_PROFILES) as Retrieval[]).map((key) => (
                  <LabChoice
                    key={key}
                    selected={retrieval === key}
                    label={RETRIEVAL_PROFILES[key].label}
                    detail={RETRIEVAL_PROFILES[key].detail}
                    icon={BookOpenCheck}
                    accent={key === 'verified' ? 'emerald' : key === 'uncited' ? 'amber' : 'rose'}
                    onClick={() => setRetrieval(key)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange label="Possible holdout contamination" value={contamination} output={`${contamination}%`} min={0} max={40} step={1} accent="rose" lowLabel="Clean" highLabel="High leakage" onChange={setContamination} />
            <LabRange label="Prompt-template score spread" value={promptVariance} output={`${promptVariance} points`} min={0} max={16} step={1} accent="amber" lowLabel="Stable" highLabel="Sensitive" onChange={setPromptVariance} />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Confidence calibration</legend>
              <div className="mt-3 grid gap-2">
                <LabChoice selected={calibration === 'raw'} label="Raw model confidence" detail="Use the uncorrected confidence signal despite known overconfidence risk." icon={Gauge} accent="rose" onClick={() => setCalibration('raw')} />
                <LabChoice selected={calibration === 'calibrated'} label="Human-checked calibration" detail="Fit and audit confidence against held-out, independently reviewed cases." icon={ShieldCheck} accent="emerald" onClick={() => setCalibration('calibrated')} />
              </div>
            </fieldset>
            <LabRange label="Critical-slice floor" value={sliceFloor} output={`${sliceFloor}%`} min={55} max={88} step={1} accent="violet" lowLabel="55%" highLabel="88%" onChange={setSliceFloor} />
          </div>
        }
      >
        <div className="min-h-[500px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric label="Observed benchmark score" value={percent(model.benchmarkScore)} detail="Can be lifted by contamination" icon={Gauge} tone="violet" />
            <LabMetric label="Reported confidence" value={percent(model.reportedConfidence)} detail={`Clean-behavior estimate: ${percent(model.cleanAccuracy)}`} icon={ShieldAlert} tone="amber" />
            <LabMetric label="Evidence quality" value={`${model.evidenceQuality.toFixed(0)} / 100`} detail="Independence, stability, grounding, and calibration" icon={BookOpenCheck} tone={model.evidenceQuality >= 70 ? 'emerald' : 'rose'} />
            <LabMetric label="Weakest category slice" value={percent(model.worstSlice)} detail={`Required floor: ${sliceFloor}%`} icon={TriangleAlert} tone={model.worstSlice >= sliceFloor / 100 ? 'blue' : 'rose'} />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.release ? 'Evidence supports the next release gate' : 'Evidence is not yet release-ready'}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{data.scopeNote}</p>
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Failure evidence</p>
            {model.failures.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{data.releaseRule} Continue with independent human review and a bounded canary; this configuration still does not prove all future claims are true.</p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {model.failures.map((failure) => <li key={failure}>{failure}</li>)}
              </ul>
            )}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
