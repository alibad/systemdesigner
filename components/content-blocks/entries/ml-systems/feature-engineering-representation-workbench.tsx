'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCircle2,
  Gauge,
  Layers3,
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
  '/api/content/ml-systems/feature-engineering/data/representation-workbench.json';

type Candidate = {
  id: string;
  label: string;
  technique: string;
  detail: string;
  example: string;
  outputBars: number[];
  signal: number;
  stability: number;
  dimensions: number;
  latencyMs: number;
  risk: string;
  verdict: string;
  explanation: string;
  tradeoff: string;
};

type Scenario = {
  id: string;
  label: string;
  prompt: string;
  rawFeature: string;
  featureType: string;
  constraint: string;
  rawBars: number[];
  defaultCandidate: string;
  candidates: Candidate[];
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.defaultCandidate === 'string' &&
          Array.isArray(scenario.rawBars) &&
          Array.isArray(scenario.candidates) &&
          scenario.candidates.length > 0,
      ),
  );
}

function DistributionBars({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone: 'cyan' | 'violet';
}) {
  const barClass =
    tone === 'cyan'
      ? 'bg-cyan-500 dark:bg-cyan-400'
      : 'bg-violet-500 dark:bg-violet-400';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <div
        className="mt-4 flex h-28 items-end gap-2 border-b border-neutral-300 px-1 dark:border-neutral-700"
        role="img"
        aria-label={`${label}: ${values.join(', ')}`}
      >
        {values.map((value, index) => (
          <span
            key={`${index}-${value}`}
            className={`min-h-1 flex-1 rounded-t-sm ${barClass}`}
            style={{ height: `${Math.max(4, Math.min(100, value))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function FeatureEngineeringRepresentationWorkbench({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('transaction-amount');
  const [candidateId, setCandidateId] = useState('amount-log');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load workbench data (${response.status}).`);
        }
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The representation data does not match the expected contract.');
        }
        const scenario =
          value.scenarios.find((item) => item.id === value.defaultScenario) ??
          value.scenarios[0];
        setData(value);
        setScenarioId(scenario.id);
        setCandidateId(scenario.defaultCandidate);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(
            fetchError instanceof Error ? fetchError.message : 'Could not load workbench data.',
          );
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const candidate =
      scenario.candidates.find((item) => item.id === candidateId) ?? scenario.candidates[0];
    const readiness = Math.round(candidate.signal * 0.55 + candidate.stability * 0.45);
    const blocked = candidate.verdict === 'Reject for this model';
    return { scenario, candidate, readiness, blocked };
  }, [candidateId, data, scenarioId]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setCandidateId(scenario.defaultCandidate);
  };

  const reset = () => {
    if (!data) return;
    const scenario =
      data.scenarios.find((item) => item.id === data.defaultScenario) ?? data.scenarios[0];
    setScenarioId(scenario.id);
    setCandidateId(scenario.defaultCandidate);
  };

  if (error) {
    return (
      <div
        data-content-block="ml-systems/feature-engineering-representation-workbench"
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block="ml-systems/feature-engineering-representation-workbench"
        className="not-prose my-7 h-80 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading feature representation workbench"
      />
    );
  }

  return (
    <div data-content-block="ml-systems/feature-engineering-representation-workbench">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Representation workbench"
          title={data.title}
          description={data.description}
          icon={Sparkles}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a raw signal
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.featureType}
                      icon={Layers3}
                      accent="cyan"
                      onClick={() => chooseScenario(scenario)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Prediction context
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                  {result.scenario.prompt}
                </p>
                <dl className="mt-3 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <div className="flex justify-between gap-3">
                    <dt>Raw field</dt>
                    <dd className="text-right font-mono text-neutral-900 dark:text-neutral-100">
                      {result.scenario.rawFeature}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Constraint</dt>
                    <dd className="max-w-44 text-right font-medium text-neutral-900 dark:text-neutral-100">
                      {result.scenario.constraint}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          }
        >
          <div aria-live="polite">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose the representation
              </p>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {result.scenario.candidates.map((candidate) => {
                  const selected = candidate.id === result.candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCandidateId(candidate.id)}
                      className={`min-h-32 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        selected
                          ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:bg-violet-950/50 dark:text-violet-50'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="block text-xs font-semibold uppercase opacity-70">
                        {candidate.technique}
                      </span>
                      <span className="mt-1 block text-sm font-semibold">{candidate.label}</span>
                      <span className="mt-2 block text-xs leading-5 opacity-80">
                        {candidate.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workbench verdict
                </p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {result.candidate.verdict}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  result.blocked
                    ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                }`}
              >
                {result.blocked ? (
                  <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                )}
                {result.blocked ? 'Geometry mismatch' : 'Candidate worth testing'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled readiness"
                value={`${result.readiness}%`}
                detail="Signal and stability combined for comparison."
                icon={Gauge}
                tone={result.readiness >= 80 ? 'emerald' : result.readiness >= 60 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Holdout signal"
                value={`${result.candidate.signal}/100`}
                detail="Illustrative protected-evaluation score."
                icon={Activity}
                tone="cyan"
              />
              <LabMetric
                label="Output width"
                value={`${result.candidate.dimensions}`}
                detail={result.candidate.dimensions === 1 ? 'One model input.' : 'Model input dimensions.'}
                icon={Boxes}
                tone={result.candidate.dimensions > 100 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Online transform"
                value={`${result.candidate.latencyMs} ms`}
                detail="Illustrative per-entity compute cost."
                icon={BarChart3}
                tone="blue"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <DistributionBars label="Raw geometry" values={result.scenario.rawBars} tone="cyan" />
              <DistributionBars label="Model-facing geometry" values={result.candidate.outputBars} tone="violet" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  What changed
                </p>
                <p className="mt-2 font-mono text-xs text-violet-700 dark:text-violet-300">
                  {result.candidate.example}
                </p>
                <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.candidate.explanation}
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Production challenge
                </p>
                <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  {result.candidate.risk}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.candidate.tradeoff}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
