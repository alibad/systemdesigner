'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Binary,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Gauge,
  LoaderCircle,
  ScanSearch,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/discriminative-vs-generative/data/missing-evidence-cases.json';
const BLOCK_ID = 'ml-systems/discriminative-vs-generative-missing-evidence-lab';

type FeatureId = 'temperature' | 'vibration';
type EvidenceMode = 'both' | 'temperature-only' | 'vibration-only' | 'none';
type MissingPolicy = 'reject' | 'population-mean' | 'last-known';

type Feature = {
  id: FeatureId;
  label: string;
  unit: string;
  populationMean: number;
};

type ClassModel = {
  id: 'healthy' | 'fault';
  label: string;
  prior: number;
  distributions: Record<FeatureId, { mean: number; standardDeviation: number }>;
};

type EvidenceChoice = {
  id: EvidenceMode;
  label: string;
  detail: string;
  observed: FeatureId[];
};

type PolicyChoice = {
  id: MissingPolicy;
  label: string;
  detail: string;
};

type CaseStudy = {
  id: string;
  label: string;
  detail: string;
  values: Record<FeatureId, number>;
  lastKnown: Record<FeatureId, number>;
};

type LabData = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    caseId: string;
    evidenceMode: EvidenceMode;
    missingPolicy: MissingPolicy;
  };
  features: Feature[];
  classes: ClassModel[];
  evidenceChoices: EvidenceChoice[];
  missingPolicies: PolicyChoice[];
  cases: CaseStudy[];
  directModel: {
    intercept: number;
    temperatureWeight: number;
    vibrationWeight: number;
    temperatureCenter: number;
    temperatureScale: number;
    vibrationCenter: number;
    vibrationScale: number;
  };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.notice === 'string' &&
      data.defaults &&
      Array.isArray(data.features) &&
      data.features.length === 2 &&
      Array.isArray(data.classes) &&
      data.classes.length === 2 &&
      Array.isArray(data.evidenceChoices) &&
      data.evidenceChoices.length >= 3 &&
      Array.isArray(data.missingPolicies) &&
      data.missingPolicies.length >= 3 &&
      Array.isArray(data.cases) &&
      data.cases.length >= 3 &&
      data.directModel,
  );
}

function gaussianLogLikelihood(value: number, mean: number, standardDeviation: number) {
  const variance = standardDeviation ** 2;
  return -0.5 * Math.log(2 * Math.PI * variance) - ((value - mean) ** 2) / (2 * variance);
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DiscriminativeVsGenerativeMissingEvidenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState('bearing-fault');
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>('both');
  const [missingPolicy, setMissingPolicy] = useState<MissingPolicy>('reject');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Missing-evidence data is incomplete.');
        setData(payload);
        setCaseId(payload.defaults.caseId);
        setEvidenceMode(payload.defaults.evidenceMode);
        setMissingPolicy(payload.defaults.missingPolicy);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const selectedCase = data?.cases.find((item) => item.id === caseId) ?? data?.cases[0];
  const selectedEvidence = data?.evidenceChoices.find((item) => item.id === evidenceMode) ?? data?.evidenceChoices[0];
  const selectedPolicy = data?.missingPolicies.find((item) => item.id === missingPolicy) ?? data?.missingPolicies[0];

  const result = useMemo(() => {
    if (!data || !selectedCase || !selectedEvidence) return null;
    const observed = new Set(selectedEvidence.observed);
    const classScores = data.classes.map((classModel) => {
      const score = selectedEvidence.observed.reduce((sum, featureId) => {
        const distribution = classModel.distributions[featureId];
        return sum + gaussianLogLikelihood(
          selectedCase.values[featureId],
          distribution.mean,
          distribution.standardDeviation,
        );
      }, Math.log(classModel.prior));
      return { id: classModel.id, label: classModel.label, score };
    });
    const maximumScore = Math.max(...classScores.map((item) => item.score));
    const normalizer = classScores.reduce((sum, item) => sum + Math.exp(item.score - maximumScore), 0);
    const generativeProbabilities = Object.fromEntries(
      classScores.map((item) => [item.id, Math.exp(item.score - maximumScore) / normalizer]),
    ) as Record<'healthy' | 'fault', number>;

    const missing = data.features.filter((feature) => !observed.has(feature.id));
    const directUnavailable = missing.length > 0 && missingPolicy === 'reject';
    const directValues = Object.fromEntries(
      data.features.map((feature) => {
        if (observed.has(feature.id)) return [feature.id, selectedCase.values[feature.id]];
        if (missingPolicy === 'last-known') return [feature.id, selectedCase.lastKnown[feature.id]];
        return [feature.id, feature.populationMean];
      }),
    ) as Record<FeatureId, number>;
    const directLogit =
      data.directModel.intercept +
      data.directModel.temperatureWeight *
        ((directValues.temperature - data.directModel.temperatureCenter) /
          data.directModel.temperatureScale) +
      data.directModel.vibrationWeight *
        ((directValues.vibration - data.directModel.vibrationCenter) /
          data.directModel.vibrationScale);
    const directFaultProbability = directUnavailable ? null : sigmoid(directLogit);
    const generativeFaultProbability = generativeProbabilities.fault;
    const generativePrediction = generativeFaultProbability >= 0.5 ? 'Fault' : 'Healthy';
    const directPrediction = directFaultProbability === null
      ? 'No prediction'
      : directFaultProbability >= 0.5
        ? 'Fault'
        : 'Healthy';
    const disagreement = directFaultProbability !== null && directPrediction !== generativePrediction;
    const generativeConfidence = Math.max(generativeFaultProbability, 1 - generativeFaultProbability);

    return {
      directFaultProbability,
      directPrediction,
      directValues,
      disagreement,
      generativeConfidence,
      generativeFaultProbability,
      generativePrediction,
      missing,
      observed,
    };
  }, [data, missingPolicy, selectedCase, selectedEvidence]);

  function reset() {
    if (!data) return;
    setCaseId(data.defaults.caseId);
    setEvidenceMode(data.defaults.evidenceMode);
    setMissingPolicy(data.defaults.missingPolicy);
  }

  if (!data || !selectedCase || !selectedEvidence || !selectedPolicy || !result) {
    return <LoadState error={error} />;
  }

  const missingEvidence = result.missing.length > 0;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Missing evidence lab"
          title={data.title}
          description={data.description}
          icon={ScanSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a machine reading
                </legend>
                <div className="mt-3 space-y-2">
                  {data.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === selectedCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Gauge}
                      accent="cyan"
                      onClick={() => setCaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Remove or restore evidence
                </legend>
                <div className="mt-3 space-y-2">
                  {data.evidenceChoices.map((choice) => (
                    <LabChoice
                      key={choice.id}
                      selected={choice.id === selectedEvidence.id}
                      label={choice.label}
                      detail={choice.detail}
                      icon={choice.id === 'both' ? Eye : EyeOff}
                      accent={choice.id === 'both' ? 'emerald' : 'amber'}
                      onClick={() => setEvidenceMode(choice.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Set the direct model policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.missingPolicies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === selectedPolicy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'reject' ? AlertOctagon : Database}
                      accent={policy.id === 'reject' ? 'rose' : 'blue'}
                      onClick={() => setMissingPolicy(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence received
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {selectedEvidence.label}
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                missingEvidence
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100'
              }`}>
                {missingEvidence ? <ShieldQuestion aria-hidden="true" className="h-4 w-4" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
                {missingEvidence ? `${result.missing.length} feature missing` : 'Complete observation'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.features.map((feature) => {
                const visible = result.observed.has(feature.id);
                return (
                  <div key={feature.id} className={`rounded-md border p-4 ${
                    visible
                      ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/35'
                      : 'border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{feature.label}</span>
                      {visible ? <Eye aria-label="Observed" className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> : <EyeOff aria-label="Missing" className="h-4 w-4 text-neutral-500" />}
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {visible ? `${selectedCase.values[feature.id]} ${feature.unit}` : 'Not received'}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Direct predictor P(fault | x)"
                value={result.directFaultProbability === null ? 'Unavailable' : percent(result.directFaultProbability)}
                detail={result.directFaultProbability === null
                  ? 'The fixed input contract rejected the incomplete record'
                  : `${result.directPrediction}; missing values use ${selectedPolicy.label.toLowerCase()}`}
                icon={Binary}
                tone={result.directFaultProbability === null ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Generative posterior P(fault | observed)"
                value={percent(result.generativeFaultProbability)}
                detail={`${result.generativePrediction}; ${selectedEvidence.observed.length} likelihood term${selectedEvidence.observed.length === 1 ? '' : 's'} plus the class prior`}
                icon={Sparkles}
                tone="violet"
              />
            </div>

            <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start gap-3">
                <Database aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Distributional evidence path
                  </p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    Unobserved likelihood terms are omitted
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    The Gaussian Naive Bayes example multiplies only the likelihoods for evidence that arrived, then renormalizes with the class priors. Less evidence usually means lower confidence, not invented sensor values.
                  </p>
                  <div className="mt-4 space-y-3">
                    <ProbabilityBar label="Healthy posterior" value={1 - result.generativeFaultProbability} tone="emerald" />
                    <ProbabilityBar label="Fault posterior" value={result.generativeFaultProbability} tone="violet" />
                  </div>
                </div>
              </div>
            </section>

            <div className={`mt-6 rounded-md border p-4 ${
              result.disagreement
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100'
                : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
            }`}>
              <div className="flex items-start gap-3">
                {result.disagreement ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />}
                <div>
                  <p className="text-sm font-semibold">
                    {result.disagreement ? 'The missing-value policy changed the decision' : 'The prediction paths currently agree'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {result.directFaultProbability === null
                      ? 'Rejection is an explicit and often safe contract. Availability now depends on a fallback, delayed inference, or a model trained for partial inputs.'
                      : result.disagreement
                        ? 'Imputation is part of the deployed model contract. Monitor it as carefully as weights because a different fill value can cross the decision boundary.'
                        : missingEvidence
                          ? `The direct path filled missing inputs before scoring. The generative path used ${percent(result.generativeConfidence)} confidence from observed evidence and its assumptions.`
                          : 'With complete evidence, both formulations see the same measurements even though they compute the class score differently.'}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ProbabilityBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'violet';
}) {
  const bar = tone === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500';
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="tabular-nums">{percent(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${bar}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Missing evidence lab"
          title="Trace what each formulation does when an input disappears"
          description="Loading the evidence model..."
          icon={ScanSearch}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center">
            {error ? (
              <div role="alert" className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
                <div className="flex items-start gap-3">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Missing-evidence lab unavailable</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                Loading evidence cases...
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
