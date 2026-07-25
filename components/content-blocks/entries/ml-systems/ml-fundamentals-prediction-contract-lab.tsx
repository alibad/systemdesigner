'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  ListOrdered,
  ShieldCheck,
  Target,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ml-fundamentals/data/prediction-contract-lab.json';

type TaskFamily = {
  id: string;
  label: string;
  detail: string;
};

type FeaturePolicy = {
  id: string;
  label: string;
  detail: string;
  quality: number;
  leaksTarget: boolean;
};

type Scenario = {
  id: string;
  label: string;
  need: string;
  unit: string;
  target: string;
  correctFamily: string;
  predictionTime: string;
  action: string;
  labelSource: string;
  futureFeature: string;
  mistake: string;
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultFamily: string;
  defaultFeaturePolicy: string;
  families: TaskFamily[];
  featurePolicies: FeaturePolicy[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      typeof data.defaultFamily === 'string' &&
      typeof data.defaultFeaturePolicy === 'string' &&
      Array.isArray(data.families) &&
      data.families.length > 0 &&
      Array.isArray(data.featurePolicies) &&
      data.featurePolicies.length > 0 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0,
  );
}

export default function MlFundamentalsPredictionContractLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('delivery-eta');
  const [familyId, setFamilyId] = useState('classification');
  const [featurePolicyId, setFeaturePolicyId] = useState('minimal');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The prediction contract data does not match the expected format.');
        }
        setData(value);
        setScenarioId(value.defaultScenario);
        setFamilyId(value.defaultFamily);
        setFeaturePolicyId(value.defaultFeaturePolicy);
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
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const family = data.families.find((item) => item.id === familyId) ?? data.families[0];
    const featurePolicy =
      data.featurePolicies.find((item) => item.id === featurePolicyId) ??
      data.featurePolicies[0];
    const familyMatches = family.id === scenario.correctFamily;
    const taskFit = familyMatches ? 1 : family.id === 'ranking' ? 0.35 : 0.2;
    const dataFit = featurePolicy.leaksTarget ? 0 : featurePolicy.quality;
    const readiness = Math.round(100 * (0.45 * taskFit + 0.35 * dataFit + 0.2));
    const status = featurePolicy.leaksTarget
      ? 'Blocked by target leakage'
      : !familyMatches
        ? 'Task family does not match'
        : featurePolicy.quality < 0.9
          ? 'Useful baseline contract'
          : 'Ready to build a baseline';
    const nextMove = featurePolicy.leaksTarget
      ? `Remove ${scenario.futureFeature.toLowerCase()}; it is not known at ${scenario.predictionTime.toLowerCase()}.`
      : !familyMatches
        ? `Use ${scenario.correctFamily}; it matches the shape of the target: ${scenario.target.toLowerCase()}.`
        : featurePolicy.quality < 0.9
          ? 'Ship the small request-time feature set as a baseline, then prove that each additional feature improves unseen results.'
          : 'Freeze this contract, define a holdout, and compare the first model with a simple non-ML baseline.';
    return {
      scenario,
      family,
      featurePolicy,
      familyMatches,
      readiness,
      status,
      nextMove,
    };
  }, [data, familyId, featurePolicyId, scenarioId]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaultScenario);
    setFamilyId(data.defaultFamily);
    setFeaturePolicyId(data.defaultFeaturePolicy);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading prediction contract lab"
      />
    );
  }

  const blocked = result.featurePolicy.leaksTarget || !result.familyMatches;

  return (
    <div data-content-block="ml-systems/ml-fundamentals-prediction-contract-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Prediction framing lab"
          title={data.title}
          description={data.description}
          icon={Target}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a product need
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.need}
                      icon={Workflow}
                      accent="cyan"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose an output shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.families.map((family) => (
                    <LabChoice
                      key={family.id}
                      selected={family.id === result.family.id}
                      label={family.label}
                      detail={family.detail}
                      icon={family.id === 'ranking' ? ListOrdered : BrainCircuit}
                      accent="violet"
                      onClick={() => setFamilyId(family.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Set the feature boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {data.featurePolicies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === result.featurePolicy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.leaksTarget ? TriangleAlert : Database}
                      accent={policy.leaksTarget ? 'rose' : 'emerald'}
                      onClick={() => setFeaturePolicyId(policy.id)}
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
                  Contract verdict
                </p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {result.status}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  blocked
                    ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                }`}
              >
                {blocked ? (
                  <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                )}
                {blocked ? 'Revise before training' : 'Coherent learning problem'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Contract readiness"
                value={`${result.readiness}%`}
                detail="Modeled fit across target, feature timing, and actionability."
                icon={ShieldCheck}
                tone={blocked ? 'rose' : result.readiness < 90 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Task family"
                value={result.family.label}
                detail={result.familyMatches ? 'Matches the target shape.' : `Expected ${result.scenario.correctFamily}.`}
                icon={BrainCircuit}
                tone={result.familyMatches ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Feature timing"
                value={result.featurePolicy.leaksTarget ? 'Future data' : 'Request time'}
                detail={result.featurePolicy.detail}
                icon={Clock3}
                tone={result.featurePolicy.leaksTarget ? 'rose' : 'cyan'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Executable decision path
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <div className="rounded-md border border-cyan-200 bg-white p-3 dark:border-cyan-900 dark:bg-neutral-950">
                  <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">Input</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{result.scenario.unit}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">Known at {result.scenario.predictionTime.toLowerCase()}</p>
                </div>
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 md:rotate-0" />
                <div className="rounded-md border border-violet-200 bg-white p-3 dark:border-violet-900 dark:bg-neutral-950">
                  <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Prediction</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{result.scenario.target}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">Learned as {result.family.label.toLowerCase()}</p>
                </div>
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 md:rotate-0" />
                <div className="rounded-md border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-neutral-950">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Action</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{result.scenario.action}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Label evidence</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.scenario.labelSource}
                </p>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Cost of mistakes: {result.scenario.mistake}
                </p>
              </div>
              <div
                className={`rounded-md border p-4 ${
                  blocked
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                }`}
              >
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Best next move</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.nextMove}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
