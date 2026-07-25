'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Languages,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type DimensionId = 'topic' | 'linguistic' | 'complexity' | 'representation';
type ContractId = 'general' | 'tutor' | 'global-support';
type DatasetId = 'balanced' | 'regional-gap' | 'template-heavy' | 'missing-metadata';

type Contract = {
  id: ContractId;
  label: string;
  detail: string;
  floor: number;
  weights: Record<DimensionId, number>;
};

type Dataset = {
  id: DatasetId;
  label: string;
  detail: string;
  completeness: number;
  scores: Record<DimensionId, number>;
};

const dimensions: Array<{ id: DimensionId; label: string; icon: typeof Layers3 }> = [
  { id: 'topic', label: 'Topic coverage', icon: Layers3 },
  { id: 'linguistic', label: 'Linguistic variety', icon: Languages },
  { id: 'complexity', label: 'Complexity coverage', icon: Sparkles },
  { id: 'representation', label: 'Representation', icon: ShieldCheck },
];

const contracts: Contract[] = [
  {
    id: 'general',
    label: 'General assistant',
    detail: 'Balanced coverage across common tasks and audiences.',
    floor: 65,
    weights: { topic: 30, linguistic: 25, complexity: 20, representation: 25 },
  },
  {
    id: 'tutor',
    label: 'Learning tutor',
    detail: 'Difficulty progression carries more of the contract.',
    floor: 70,
    weights: { topic: 20, linguistic: 20, complexity: 40, representation: 20 },
  },
  {
    id: 'global-support',
    label: 'Global support',
    detail: 'Regional representation is a critical operating slice.',
    floor: 72,
    weights: { topic: 25, linguistic: 20, complexity: 15, representation: 40 },
  },
];

const datasets: Dataset[] = [
  {
    id: 'balanced',
    label: 'Balanced candidate',
    detail: 'No obvious gap and strong supplied metadata.',
    completeness: 96,
    scores: { topic: 84, linguistic: 81, complexity: 78, representation: 76 },
  },
  {
    id: 'regional-gap',
    label: 'Broad, but regionally thin',
    detail: 'Strong aggregate variety hides one underserved population.',
    completeness: 97,
    scores: { topic: 91, linguistic: 86, complexity: 82, representation: 58 },
  },
  {
    id: 'template-heavy',
    label: 'Template-heavy collection',
    detail: 'Many topics are present, but prompt forms repeat.',
    completeness: 95,
    scores: { topic: 88, linguistic: 43, complexity: 77, representation: 75 },
  },
  {
    id: 'missing-metadata',
    label: 'Missing locale evidence',
    detail: 'Content looks varied, but 39% of locale metadata is unknown.',
    completeness: 61,
    scores: { topic: 90, linguistic: 84, complexity: 82, representation: 69 },
  },
];

const overallTarget = 78;
const completenessTarget = 90;

export default function DatasetDiversityDashboardScorecardLab() {
  const [contractId, setContractId] = useState<ContractId>('general');
  const [datasetId, setDatasetId] = useState<DatasetId>('regional-gap');
  const [hardFloor, setHardFloor] = useState(65);

  const model = useMemo(() => {
    const contract = contracts.find((item) => item.id === contractId) ?? contracts[0];
    const dataset = datasets.find((item) => item.id === datasetId) ?? datasets[1];
    const weightedScore = dimensions.reduce(
      (sum, dimension) => sum + dataset.scores[dimension.id] * (contract.weights[dimension.id] / 100),
      0,
    );
    const weakest = dimensions.reduce((current, dimension) =>
      dataset.scores[dimension.id] < dataset.scores[current.id] ? dimension : current,
    );
    const overallPass = weightedScore >= overallTarget;
    const slicePass = dataset.scores[weakest.id] >= hardFloor;
    const evidencePass = dataset.completeness >= completenessTarget;
    const decision = !evidencePass
      ? 'Insufficient evidence'
      : !slicePass
        ? 'Collect targeted data'
        : !overallPass
          ? 'Improve overall coverage'
          : 'Eligible for review';

    return {
      contract,
      dataset,
      weightedScore,
      weakest,
      overallPass,
      slicePass,
      evidencePass,
      decision,
    };
  }, [contractId, datasetId, hardFloor]);

  const chooseContract = (contract: Contract) => {
    setContractId(contract.id);
    setHardFloor(contract.floor);
  };

  const reset = () => {
    setContractId('general');
    setDatasetId('regional-gap');
    setHardFloor(65);
  };

  const decisionTone = model.evidencePass && model.slicePass && model.overallPass
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : model.overallPass
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Diversity contract lab"
        title="Decide whether the dataset is ready"
        description="Change the intended use, candidate dataset, and critical-slice floor. Compare the weighted summary with the evidence gates that actually control release."
        icon={Gauge}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the use contract
              </legend>
              <div className="mt-3 space-y-2">
                {contracts.map((contract) => (
                  <LabChoice
                    key={contract.id}
                    selected={contract.id === contractId}
                    label={contract.label}
                    detail={contract.detail}
                    icon={ClipboardCheck}
                    accent="violet"
                    onClick={() => chooseContract(contract)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Load a candidate dataset
              </legend>
              <div className="mt-3 space-y-2">
                {datasets.map((dataset) => (
                  <LabChoice
                    key={dataset.id}
                    selected={dataset.id === datasetId}
                    label={dataset.label}
                    detail={dataset.detail}
                    icon={BarChart3}
                    accent="blue"
                    onClick={() => setDatasetId(dataset.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Critical-slice floor"
              value={hardFloor}
              output={`${hardFloor}/100`}
              min={55}
              max={80}
              step={1}
              lowLabel="Exploratory"
              highLabel="Strict"
              accent="amber"
              onChange={setHardFloor}
            />
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Weighted score"
            value={model.weightedScore.toFixed(1)}
            detail={`Target ${overallTarget}/100`}
            icon={Gauge}
            tone={model.overallPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Weakest dimension"
            value={`${model.dataset.scores[model.weakest.id]}`}
            detail={model.weakest.label}
            icon={CircleAlert}
            tone={model.slicePass ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Evidence complete"
            value={`${model.dataset.completeness}%`}
            detail={`Target ${completenessTarget}%`}
            icon={ClipboardCheck}
            tone={model.evidencePass ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Release state"
            value={model.evidencePass && model.slicePass && model.overallPass ? 'Pass' : 'Hold'}
            detail="All three gates must pass"
            icon={model.evidencePass && model.slicePass && model.overallPass ? CheckCircle2 : CircleAlert}
            tone={model.evidencePass && model.slicePass && model.overallPass ? 'emerald' : 'amber'}
          />
        </div>

        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Dimension evidence</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                The marker shows the current {hardFloor}-point hard floor.
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Weights: {Object.values(model.contract.weights).join(' / ')}
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {dimensions.map((dimension) => {
              const score = model.dataset.scores[dimension.id];
              const passes = score >= hardFloor;
              const Icon = dimension.icon;
              return (
                <div key={dimension.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-100">
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
                      {dimension.label}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${passes ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      {score}/100 / {model.contract.weights[dimension.id]}% weight
                    </span>
                  </div>
                  <div
                    className="relative mt-2 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                    role="progressbar"
                    aria-label={`${dimension.label} score`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={score}
                  >
                    <div
                      className={`h-full ${passes ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${score}%` }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                      style={{ left: `${hardFloor}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`mt-5 rounded-lg border p-5 ${decisionTone}`} aria-live="polite">
          <div className="flex items-start gap-3">
            {model.evidencePass && model.slicePass && model.overallPass ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Decision</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {!model.evidencePass
                  ? 'The content may look diverse, but missing metadata makes the representation claim untestable.'
                  : !model.slicePass
                    ? `The ${model.weakest.label.toLowerCase()} slice fails its hard floor even though the weighted summary may look healthy.`
                    : !model.overallPass
                      ? 'No critical slice fails, but the combined contract still needs broader improvement.'
                      : 'The automated gates pass. A reviewer can now inspect examples and make the final approval decision.'}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
