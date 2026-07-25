'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  ScanSearch,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/model-training/data/training-diagnosis-lab.json';

type DiagnosisId = 'overfit' | 'underfit' | 'divergence' | 'leakage' | 'data';
type Scores = Record<DiagnosisId, number>;
type Curve = { id: string; label: string; detail: string; train: number[]; validation: number[]; scores: Scores };
type Signal = { id: string; label: string; detail: string; scores: Scores };
type Gap = Signal & { offset: number };
type Intervention = { id: string; label: string; detail: string; targets: DiagnosisId[] };
type LabData = { title: string; description: string; curves: Curve[]; gaps: Gap[]; gradients: Signal[]; dataConditions: Signal[]; interventions: Intervention[] };

const DIAGNOSES: Record<DiagnosisId, { label: string; evidence: string; experiment: string }> = {
  overfit: {
    label: 'Overfitting pressure',
    evidence: 'The model is fitting training-specific patterns faster than it generalizes to protected examples.',
    experiment: 'Hold the split fixed; compare the current run with stronger regularization and early stopping from the same checkpoint.',
  },
  underfit: {
    label: 'Insufficient learning signal',
    evidence: 'The model is not reducing either objective enough to show useful capacity or feature coverage.',
    experiment: 'Run a small ablation that increases signal or capacity one variable at a time, then inspect the hardest slices.',
  },
  divergence: {
    label: 'Unstable optimization',
    evidence: 'The update path is too erratic to interpret a quality metric as a model decision.',
    experiment: 'Replay a short fixed-data run with a lower learning rate, clipping, and gradient-norm logging before changing architecture.',
  },
  leakage: {
    label: 'Split or feature leakage risk',
    evidence: 'The held-out result is too favorable for the selected evidence and may not represent future production behavior.',
    experiment: 'Rebuild train and validation boundaries by entity and time; remove target-derived fields and rerun the baseline.',
  },
  data: {
    label: 'Data quality pressure',
    evidence: 'Label disagreement or corrupted inputs can cap validation quality even when the optimizer behaves normally.',
    experiment: 'Create a reviewed holdout from the noisy slice, measure disagreement, then compare repaired labels against the original run.',
  },
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.curves) && data.curves.length > 0 &&
      Array.isArray(data.gaps) && data.gaps.length > 0 &&
      Array.isArray(data.gradients) && data.gradients.length > 0 &&
      Array.isArray(data.dataConditions) && data.dataConditions.length > 0 &&
      Array.isArray(data.interventions) && data.interventions.length > 0,
  );
}

function points(values: number[]) {
  return values
    .map((value, index) => {
      const x = 12 + (index / Math.max(1, values.length - 1)) * 276;
      const y = 94 - Math.max(0.5, Math.min(9.8, value)) * 7.6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function ModelTrainingDiagnosisLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curveId, setCurveId] = useState('overfit');
  const [gapId, setGapId] = useState('wide');
  const [gradientId, setGradientId] = useState('stable');
  const [dataConditionId, setDataConditionId] = useState('clean');
  const [interventionId, setInterventionId] = useState('regularize');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const curve = data.curves.find((item) => item.id === curveId) ?? data.curves[0];
    const gap = data.gaps.find((item) => item.id === gapId) ?? data.gaps[0];
    const gradient = data.gradients.find((item) => item.id === gradientId) ?? data.gradients[0];
    const dataCondition = data.dataConditions.find((item) => item.id === dataConditionId) ?? data.dataConditions[0];
    const intervention = data.interventions.find((item) => item.id === interventionId) ?? data.interventions[0];
    const scores = (Object.keys(DIAGNOSES) as DiagnosisId[]).reduce((total, id) => {
      total[id] = curve.scores[id] + gap.scores[id] + gradient.scores[id] + dataCondition.scores[id];
      return total;
    }, {} as Scores);
    const diagnosis = (Object.keys(DIAGNOSES) as DiagnosisId[]).sort((left, right) => scores[right] - scores[left])[0];
    const interventionMatches = intervention.targets.includes(diagnosis);
    const baselineGap = curve.validation[curve.validation.length - 1] - curve.train[curve.train.length - 1];
    const validation = curve.validation.map((value) => Math.max(0.5, Math.min(9.8, value + gap.offset - baselineGap)));
    const selectedEvidence = [curve.detail, gap.detail, gradient.detail, dataCondition.detail];
    return { curve, gap, gradient, dataCondition, intervention, diagnosis, scores, interventionMatches, validation, selectedEvidence };
  }, [curveId, data, dataConditionId, gapId, gradientId, interventionId]);

  const reset = () => {
    setCurveId('overfit');
    setGapId('wide');
    setGradientId('stable');
    setDataConditionId('clean');
    setInterventionId('regularize');
  };

  if (error) {
    return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>;
  }
  if (!data || !result) {
    return <div className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading training diagnosis lab" />;
  }

  const diagnosis = DIAGNOSES[result.diagnosis];

  return (
    <div data-content-block="ml-systems/model-training-diagnosis-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Failure diagnosis lab" title={data.title} description={data.description} icon={ScanSearch} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Read the loss curve</legend>
                <div className="mt-3 space-y-2">
                  {data.curves.map((curve) => <LabChoice key={curve.id} selected={curveId === curve.id} label={curve.label} detail={curve.detail} icon={Activity} accent="rose" onClick={() => setCurveId(curve.id)} />)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Add the observed evidence</legend>
                <div className="mt-3 space-y-2">
                  {data.gaps.map((gap) => <LabChoice key={gap.id} selected={gapId === gap.id} label={`Train/validation gap: ${gap.label}`} detail={gap.detail} icon={GitCompareArrows} accent="amber" onClick={() => setGapId(gap.id)} />)}
                  {data.gradients.map((gradient) => <LabChoice key={gradient.id} selected={gradientId === gradient.id} label={`Gradients: ${gradient.label}`} detail={gradient.detail} icon={Activity} accent="violet" onClick={() => setGradientId(gradient.id)} />)}
                  {data.dataConditions.map((condition) => <LabChoice key={condition.id} selected={dataConditionId === condition.id} label={`Data: ${condition.label}`} detail={condition.detail} icon={condition.id === 'leakage' ? ShieldAlert : Sparkles} accent="cyan" onClick={() => setDataConditionId(condition.id)} />)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Choose the first intervention</legend>
                <div className="mt-3 space-y-2">
                  {data.interventions.map((intervention) => <LabChoice key={intervention.id} selected={interventionId === intervention.id} label={intervention.label} detail={intervention.detail} icon={FlaskConical} accent="emerald" onClick={() => setInterventionId(intervention.id)} />)}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Current evidence model</p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{diagnosis.label}</h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${result.interventionMatches ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
                {result.interventionMatches ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
                {result.interventionMatches ? 'Intervention matches evidence' : 'Intervention mismatch'}
              </span>
            </div>
            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Loss by epoch</p>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Train cyan, validation amber</span>
              </div>
              <svg className="mt-4 h-auto w-full" viewBox="0 0 300 112" role="img" aria-label={`Training and validation loss for ${result.curve.label}`}>
                {[18, 37, 56, 75, 94].map((y) => <line key={y} x1="12" x2="288" y1={y} y2={y} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth="1" />)}
                <polyline fill="none" points={points(result.curve.train)} className="stroke-cyan-600 dark:stroke-cyan-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline fill="none" points={points(result.validation)} className="stroke-amber-600 dark:stroke-amber-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Leading diagnosis score" value={`${result.scores[result.diagnosis]} signals`} detail="The strongest explanation across selected evidence" icon={ScanSearch} tone="rose" />
              <LabMetric label="Gap observation" value={result.gap.label} detail={result.gap.detail} icon={GitCompareArrows} tone="amber" />
              <LabMetric label="Gradient evidence" value={result.gradient.label} detail={result.gradient.detail} icon={Activity} tone="violet" />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Why this is likely</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{diagnosis.evidence}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.selectedEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                </ul>
              </div>
              <div className={`rounded-md border p-4 ${result.interventionMatches ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Next experiment</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.interventionMatches ? diagnosis.experiment : `${result.intervention.label} is not the most direct first move. ${diagnosis.experiment}`}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
