'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Layers,
  Scale,
  Search,
  Shield,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/shap-lime-explainability/data/explanation-stability-scenarios.json';
const BLOCK_ID = 'ml-systems/shap-lime-explainability-stability-lab';

type FeatureContribution = {
  id: string;
  label: string;
  contribution: number;
  sensitivity: number;
};

type ReferenceCohort = {
  id: string;
  label: string;
  detail: string;
  baseValue: number;
  features: FeatureContribution[];
};

type ExplanationCase = {
  id: string;
  label: string;
  detail: string;
  prediction: number;
  unit: string;
  correlationRisk: number;
  references: ReferenceCohort[];
};

type ExplanationMethod = {
  id: string;
  label: string;
  detail: string;
  fidelityAt256: number;
  instabilityAt256: number;
  correlationPenalty: number;
  limitation: string;
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    caseId: string;
    methodId: string;
    referenceId: string;
    samples: number;
  };
  cases: ExplanationCase[];
  methods: ExplanationMethod[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.caseId === 'string'
      && typeof data.defaults.methodId === 'string'
      && typeof data.defaults.referenceId === 'string'
      && isFiniteNumber(data.defaults.samples)
      && Array.isArray(data.methods)
      && data.methods.length >= 3
      && data.methods.every((method) => (
        method.id
          && method.label
          && method.detail
          && isFiniteNumber(method.fidelityAt256)
          && isFiniteNumber(method.instabilityAt256)
          && isFiniteNumber(method.correlationPenalty)
          && method.limitation
      ))
      && Array.isArray(data.cases)
      && data.cases.length >= 2
      && data.cases.every((item) => (
        item.id
          && item.label
          && item.detail
          && item.unit
          && isFiniteNumber(item.prediction)
          && isFiniteNumber(item.correlationRisk)
          && Array.isArray(item.references)
          && item.references.length >= 3
          && item.references.every((reference) => (
            reference.id
              && reference.label
              && reference.detail
              && isFiniteNumber(reference.baseValue)
              && Array.isArray(reference.features)
              && reference.features.length >= 4
              && reference.features.every((feature) => (
                feature.id
                  && feature.label
                  && isFiniteNumber(feature.contribution)
                  && isFiniteNumber(feature.sensitivity)
              ))
          ))
      )),
  );
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPoints(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

export default function ShapLimeExplainabilityStabilityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Explanation stability data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load stability data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return <LabState title="Stability lab unavailable" detail={error} />;
  }
  if (!data) {
    return <LabState title="Loading explanation evidence" detail="Preparing cases, reference cohorts, and estimator behavior." />;
  }

  return <StabilityLabContent data={data} />;
}

function StabilityLabContent({ data }: { data: LabData }) {
  const [caseId, setCaseId] = useState(data.defaults.caseId);
  const [methodId, setMethodId] = useState(data.defaults.methodId);
  const [referenceId, setReferenceId] = useState(data.defaults.referenceId);
  const [samples, setSamples] = useState(data.defaults.samples);

  const explanationCase = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
  const method = data.methods.find((item) => item.id === methodId) ?? data.methods[0];
  const reference = explanationCase.references.find((item) => item.id === referenceId)
    ?? explanationCase.references[0];

  const result = useMemo(() => {
    const sampleFactor = Math.sqrt(256 / samples);
    const approximationScale = method.id === 'exact-tree-shap'
      ? 0
      : method.instabilityAt256 * sampleFactor * 0.1;
    const contributions = reference.features.map((feature) => ({
      ...feature,
      estimated: feature.contribution + feature.sensitivity * approximationScale,
    }));
    const contributionTotal = contributions.reduce((sum, feature) => sum + feature.estimated, 0);
    const reconstructed = reference.baseValue + contributionTotal;
    const residual = Math.abs(explanationCase.prediction - reconstructed);
    const sampleLift = Math.max(0, Math.log2(samples / 256)) * 1.8;
    const dependencePenalty = explanationCase.correlationRisk * method.correlationPenalty;
    const localFidelity = clamp(method.fidelityAt256 + sampleLift - dependencePenalty);
    const signAgreement = clamp(
      100 - method.instabilityAt256 * sampleFactor - dependencePenalty * 0.65,
    );
    const rankAgreement = clamp(
      signAgreement - (method.id === 'lime' ? 7 : method.id === 'sampled-shap' ? 3 : 0),
    );
    const residualGate = method.id === 'lime' ? residual <= 8 : residual <= 3;
    const releaseReady = localFidelity >= 92
      && signAgreement >= 90
      && rankAgreement >= 85
      && residualGate;
    const maxContribution = Math.max(
      1,
      ...contributions.map((feature) => Math.abs(feature.estimated)),
    );
    const verdict = releaseReady
      ? 'This modeled explanation clears the repeatability gate'
      : localFidelity < 92
        ? 'The local approximation does not reproduce the model closely enough'
        : signAgreement < 90 || rankAgreement < 85
          ? 'The explanation changes too much across repeated runs'
          : 'The explanation does not reconcile with the modeled output';

    return {
      contributions,
      localFidelity,
      maxContribution,
      rankAgreement,
      reconstructed,
      releaseReady,
      residual,
      signAgreement,
      verdict,
    };
  }, [explanationCase, method, reference, samples]);

  function selectCase(nextCaseId: string) {
    const nextCase = data.cases.find((item) => item.id === nextCaseId);
    setCaseId(nextCaseId);
    setReferenceId(nextCase?.references[0]?.id ?? data.defaults.referenceId);
  }

  function reset() {
    setCaseId(data.defaults.caseId);
    setMethodId(data.defaults.methodId);
    setReferenceId(data.defaults.referenceId);
    setSamples(data.defaults.samples);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Attribution stability lab"
          title={data.title}
          description={data.description}
          icon={Layers}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Prediction to explain
                </legend>
                <div className="mt-3 space-y-2">
                  {data.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === explanationCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'fraud-review' ? Shield : item.id === 'retention-risk' ? Activity : Search}
                      accent="violet"
                      onClick={() => selectCase(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Estimator
                </legend>
                <div className="mt-3 space-y-2">
                  {data.methods.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === method.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'exact-tree-shap' ? Scale : item.id === 'sampled-shap' ? Target : Gauge}
                      accent={item.id === 'exact-tree-shap' ? 'blue' : item.id === 'sampled-shap' ? 'violet' : 'amber'}
                      onClick={() => setMethodId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Reference cohort
                </span>
                <select
                  value={reference.id}
                  onChange={(event) => setReferenceId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {explanationCase.references.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {reference.detail}
                </span>
              </label>

              <LabRange
                label="Perturbation / coalition samples"
                value={samples}
                output={samples.toLocaleString()}
                min={256}
                max={8_192}
                step={256}
                accent="emerald"
                lowLabel="Fast estimate"
                highLabel="Lower variance"
                onChange={setSamples}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${result.releaseReady ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.releaseReady ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    Prediction {explanationCase.prediction.toFixed(1)} {explanationCase.unit}; reference {reference.baseValue.toFixed(1)}. The explanation answers why the model output differs from this cohort baseline.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Local fidelity"
                value={`${result.localFidelity.toFixed(1)}%`}
                detail="Modeled agreement with nearby black-box outputs"
                icon={Target}
                tone={result.localFidelity >= 92 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Sign agreement"
                value={`${result.signAgreement.toFixed(1)}%`}
                detail="Contribution direction across repeated runs"
                icon={Scale}
                tone={result.signAgreement >= 90 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Top-rank agreement"
                value={`${result.rankAgreement.toFixed(1)}%`}
                detail="Ordering stability for the strongest features"
                icon={BarChart3}
                tone={result.rankAgreement >= 85 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Reconciliation gap"
                value={`${result.residual.toFixed(2)} pts`}
                detail={`Reconstructed output: ${result.reconstructed.toFixed(1)}`}
                icon={Gauge}
                tone={result.residual <= (method.id === 'lime' ? 8 : 3) ? 'violet' : 'rose'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Local contribution map
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Relative to {reference.label.toLowerCase()}
                  </h4>
                </div>
                <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-300">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 bg-blue-500" />Raises output</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 bg-amber-500" />Lowers output</span>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {result.contributions.map((feature) => {
                  const width = Math.max(2, (Math.abs(feature.estimated) / result.maxContribution) * 50);
                  return (
                    <div key={feature.id} className="grid min-w-0 grid-cols-[minmax(92px,140px)_minmax(0,1fr)_52px] items-center gap-3">
                      <span className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-200" title={feature.label}>
                        {feature.label}
                      </span>
                      <div className="relative h-6 overflow-hidden rounded-sm bg-white dark:bg-neutral-950">
                        <div className="absolute inset-y-0 left-1/2 border-l border-neutral-400 dark:border-neutral-600" />
                        <div
                          className={`absolute inset-y-1 ${feature.estimated >= 0 ? 'left-1/2 bg-blue-500' : 'right-1/2 bg-amber-500'}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                        {formatPoints(feature.estimated)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <Database aria-hidden="true" className="h-4 w-4" />
                  Reference semantics
                </div>
                <p className="mt-3 text-sm leading-6">
                  Changing the cohort changes the question and may legitimately move the base value, ranking, and contribution split. Version the cohort query with the explanation.
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <CircleAlert aria-hidden="true" className="h-4 w-4" />
                  Method limitation
                </div>
                <p className="mt-3 text-sm leading-6">{method.limitation}</p>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              These values are a deterministic teaching model of approximation pressure. Production gates must be calibrated from repeated explanations against the actual model, data representation, background distribution, and stakeholder decision.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass =
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass =
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
