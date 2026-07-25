'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, ClipboardCheck, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CategoryMix = 'health' | 'law' | 'mixed';
type Judge = 'human' | 'calibrated' | 'unvalidated';
type RefusalPolicy = 'qualified' | 'force-answer' | 'blanket';

interface LabData {
  protocolLabel?: string;
  scopeNote?: string;
  releaseRule?: string;
}

const CATEGORY_PROFILES: Record<CategoryMix, { label: string; detail: string; truth: number; informative: number }> = {
  health: {
    label: 'Health and medicine weighted',
    detail: 'Higher consequence claims with more cautious default answers.',
    truth: 0.79,
    informative: 0.71,
  },
  law: {
    label: 'Law and finance weighted',
    detail: 'Context-sensitive claims where jurisdiction and time matter.',
    truth: 0.75,
    informative: 0.74,
  },
  mixed: {
    label: 'Balanced misconception mix',
    detail: 'A broad but less product-specific category mix.',
    truth: 0.81,
    informative: 0.77,
  },
};

const JUDGE_PROFILES: Record<Judge, { label: string; detail: string; optimism: number; uncertainty: number; calibrated: boolean }> = {
  human: {
    label: 'Blinded human adjudication',
    detail: 'Qualified reviewers resolve material claims using the rubric.',
    optimism: 0,
    uncertainty: 0.005,
    calibrated: true,
  },
  calibrated: {
    label: 'Human-calibrated LLM judge',
    detail: 'Automated judge audited against human decisions on risky cases.',
    optimism: 0.012,
    uncertainty: 0.015,
    calibrated: true,
  },
  unvalidated: {
    label: 'Unvalidated LLM judge',
    detail: 'Fast scoring without a demonstrated human agreement check.',
    optimism: 0.055,
    uncertainty: 0.05,
    calibrated: false,
  },
};

const REFUSAL_PROFILES: Record<RefusalPolicy, { label: string; detail: string; truth: number; informative: number }> = {
  qualified: {
    label: 'Credit qualified abstentions',
    detail: 'Accept uncertainty only when the answer explains the limit and next evidence step.',
    truth: 0.025,
    informative: -0.025,
  },
  'force-answer': {
    label: 'Require a direct answer',
    detail: 'Rewards completion even when the model lacks enough support.',
    truth: -0.07,
    informative: 0.06,
  },
  blanket: {
    label: 'Credit any refusal',
    detail: 'Raises apparent truthfulness while allowing broadly unhelpful behavior.',
    truth: 0.045,
    informative: -0.18,
  },
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const clamp = (value: number) => Math.min(0.99, Math.max(0.01, value));
const initialData: LabData = {
  protocolLabel: 'Illustrative scoring protocol',
  scopeNote: 'This lab models a predeclared gate. Its values teach protocol sensitivity and are not TruthfulQA leaderboard results.',
  releaseRule: 'Release only when all predeclared evidence checks pass.',
};

export default function TruthfulqaEvaluationScoringLab({ dataFile }: { dataFile?: string }) {
  const [categoryMix, setCategoryMix] = useState<CategoryMix>('health');
  const [sampleSize, setSampleSize] = useState(240);
  const [judge, setJudge] = useState<Judge>('calibrated');
  const [threshold, setThreshold] = useState(76);
  const [refusalPolicy, setRefusalPolicy] = useState<RefusalPolicy>('qualified');
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
    const category = CATEGORY_PROFILES[categoryMix];
    const judgeProfile = JUDGE_PROFILES[judge];
    const refusal = REFUSAL_PROFILES[refusalPolicy];
    const actualTruth = clamp(category.truth + refusal.truth);
    const scoredTruth = clamp(actualTruth + judgeProfile.optimism);
    const informative = clamp(category.informative + refusal.informative);
    const randomMargin = 1.96 * Math.sqrt((scoredTruth * (1 - scoredTruth)) / sampleSize);
    const totalMargin = randomMargin + judgeProfile.uncertainty;
    const lowerBound = Math.max(0, scoredTruth - totalMargin);
    const blockers = [
      lowerBound < threshold / 100 ? `lower bound ${percent(lowerBound)} is below ${threshold}%` : null,
      informative < 0.65 ? `informativeness ${percent(informative)} is below 65%` : null,
      sampleSize < 200 ? `sample size ${sampleSize} is below 200` : null,
      !judgeProfile.calibrated ? 'judge has no documented human calibration' : null,
    ].filter(Boolean) as string[];

    return {
      category,
      informative,
      lowerBound,
      release: blockers.length === 0,
      scoredTruth,
      totalMargin,
      blockers,
    };
  }, [categoryMix, judge, refusalPolicy, sampleSize, threshold]);

  const reset = () => {
    setCategoryMix('health');
    setSampleSize(240);
    setJudge('calibrated');
    setThreshold(76);
    setRefusalPolicy('qualified');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow={data.protocolLabel || initialData.protocolLabel || 'Scoring protocol'}
        title="Make the scoring rule earn the release claim"
        description="Change the evaluation contract. The lab recomputes scored truthfulness, usefulness, uncertainty, and the predeclared release gate together."
        icon={Scale}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Category mix</legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(CATEGORY_PROFILES) as CategoryMix[]).map((key) => (
                  <LabChoice
                    key={key}
                    selected={categoryMix === key}
                    label={CATEGORY_PROFILES[key].label}
                    detail={CATEGORY_PROFILES[key].detail}
                    icon={ClipboardCheck}
                    accent={key === 'health' ? 'rose' : key === 'law' ? 'amber' : 'blue'}
                    onClick={() => setCategoryMix(key)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange
              label="Evaluated responses"
              value={sampleSize}
              output={sampleSize.toLocaleString()}
              min={40}
              max={800}
              step={20}
              accent="blue"
              lowLabel="40"
              highLabel="800"
              onChange={setSampleSize}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Truthfulness judge</legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(JUDGE_PROFILES) as Judge[]).map((key) => (
                  <LabChoice
                    key={key}
                    selected={judge === key}
                    label={JUDGE_PROFILES[key].label}
                    detail={JUDGE_PROFILES[key].detail}
                    icon={key === 'unvalidated' ? ShieldAlert : ShieldCheck}
                    accent={key === 'human' ? 'emerald' : key === 'calibrated' ? 'blue' : 'rose'}
                    onClick={() => setJudge(key)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange
              label="Truthfulness lower-bound gate"
              value={threshold}
              output={`${threshold}%`}
              min={65}
              max={90}
              step={1}
              accent="amber"
              lowLabel="65%"
              highLabel="90%"
              onChange={setThreshold}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Refusal policy</legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(REFUSAL_PROFILES) as RefusalPolicy[]).map((key) => (
                  <LabChoice
                    key={key}
                    selected={refusalPolicy === key}
                    label={REFUSAL_PROFILES[key].label}
                    detail={REFUSAL_PROFILES[key].detail}
                    icon={CheckCircle2}
                    accent={key === 'qualified' ? 'emerald' : key === 'force-answer' ? 'amber' : 'rose'}
                    onClick={() => setRefusalPolicy(key)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div className="min-h-[500px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric label="Scored truthfulness" value={percent(model.scoredTruth)} detail="Observed under the chosen judge and policy" icon={CheckCircle2} tone="blue" />
            <LabMetric label="Informativeness" value={percent(model.informative)} detail="Must stay above the product usefulness floor" icon={ClipboardCheck} tone="amber" />
            <LabMetric label="Approximate lower bound" value={percent(model.lowerBound)} detail={`Total uncertainty: +/- ${percent(model.totalMargin)}`} icon={BarChart3} tone="violet" />
            <LabMetric label="Release decision" value={model.release ? 'Release candidate' : 'Hold candidate'} detail={model.release ? 'All modeled checks pass.' : `${model.blockers.length} gate check${model.blockers.length === 1 ? '' : 's'} failed.`} icon={model.release ? ShieldCheck : ShieldAlert} tone={model.release ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.category.label}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{data.scopeNote}</p>
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Gate consequence</p>
            {model.release ? (
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{data.releaseRule} This model may proceed to the next evidence layer; it is not certified by this benchmark alone.</p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {model.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            )}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
