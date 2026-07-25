'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CirclePause,
  FlaskConical,
  Gauge,
  Microscope,
  PlayCircle,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
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
  '/api/content/ml-systems/scientific-ml/data/validation-gate-scenarios.json';
const BLOCK_ID = 'ml-systems/scientific-ml-validation-gate-lab';

type DecisionId = 'release' | 'bounded-pilot' | 'hold';

type Decision = {
  id: DecisionId;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  context: string;
  changedBoundary: string;
  minimumEvidence: number;
  targetCoverage: number;
  maximumUsefulWidth: number;
  fallbackRequired: boolean;
  requiredEvidence: string[];
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultDecision: DecisionId;
  defaultEvidence: number;
  defaultCoverage: number;
  defaultIntervalWidth: number;
  decisions: Decision[];
  scenarios: Scenario[];
};

type GateState = {
  label: string;
  value: string;
  passes: boolean;
  detail: string;
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.defaultScenario === 'string' &&
      typeof data.defaultDecision === 'string' &&
      typeof data.defaultEvidence === 'number' &&
      typeof data.defaultCoverage === 'number' &&
      typeof data.defaultIntervalWidth === 'number' &&
      Array.isArray(data.decisions) &&
      data.decisions.length === 3 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.minimumEvidence === 'number' &&
          typeof scenario.targetCoverage === 'number' &&
          Array.isArray(scenario.requiredEvidence),
      ),
  );
}

const decisionIcons: Record<DecisionId, LucideIcon> = {
  release: BadgeCheck,
  'bounded-pilot': PlayCircle,
  hold: CirclePause,
};

const decisionTone: Record<DecisionId, 'emerald' | 'amber' | 'rose'> = {
  release: 'emerald',
  'bounded-pilot': 'amber',
  hold: 'rose',
};

export default function ScientificMlValidationGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('new-geometry');
  const [decisionId, setDecisionId] = useState<DecisionId>('bounded-pilot');
  const [evidence, setEvidence] = useState(68);
  const [coverage, setCoverage] = useState(86);
  const [intervalWidth, setIntervalWidth] = useState(16);
  const [fallbackTested, setFallbackTested] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load release scenarios (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The release scenarios have an invalid contract.');
        setData(value);
        setScenarioId(value.defaultScenario);
        setDecisionId(value.defaultDecision);
        setEvidence(value.defaultEvidence);
        setCoverage(value.defaultCoverage);
        setIntervalWidth(value.defaultIntervalWidth);
        setFallbackTested(false);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const decision = data.decisions.find((item) => item.id === decisionId) ?? data.decisions[0];
    const evidencePasses = evidence >= scenario.minimumEvidence;
    const coveragePasses = coverage >= scenario.targetCoverage;
    const widthPasses = intervalWidth <= scenario.maximumUsefulWidth;
    const fallbackPasses = fallbackTested || !scenario.fallbackRequired;

    let recommendation: DecisionId = 'hold';
    if (evidencePasses && coveragePasses && widthPasses && fallbackPasses) {
      recommendation = 'release';
    } else if (
      evidence >= scenario.minimumEvidence - 15 &&
      coverage >= scenario.targetCoverage - 5 &&
      fallbackPasses
    ) {
      recommendation = 'bounded-pilot';
    }

    const recommendedDecision =
      data.decisions.find((item) => item.id === recommendation) ?? data.decisions[0];
    const gates: GateState[] = [
      {
        label: 'Independent regime evidence',
        value: `${evidence}% / ${scenario.minimumEvidence}%`,
        passes: evidencePasses,
        detail: 'Coverage of the changed scientific boundary with protected references.',
      },
      {
        label: 'Empirical interval coverage',
        value: `${coverage}% / ${scenario.targetCoverage}%`,
        passes: coveragePasses,
        detail: 'Observed coverage on the relevant validation regime.',
      },
      {
        label: 'Interval usefulness',
        value: `${intervalWidth}% / max ${scenario.maximumUsefulWidth}%`,
        passes: widthPasses,
        detail: 'A calibrated interval can still be too wide to support this decision.',
      },
      {
        label: 'Containment path',
        value: fallbackPasses ? 'Ready' : 'Missing',
        passes: fallbackPasses,
        detail: scenario.fallbackRequired
          ? 'This regime requires a tested trusted path.'
          : 'Fallback is recommended but not mandatory for this modeled policy.',
      },
    ];

    return {
      scenario,
      decision,
      recommendation,
      recommendedDecision,
      matches: decision.id === recommendation,
      gates,
      passedCount: gates.filter((gate) => gate.passes).length,
    };
  }, [coverage, data, decisionId, evidence, fallbackTested, intervalWidth, scenarioId]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaultScenario);
    setDecisionId(data.defaultDecision);
    setEvidence(data.defaultEvidence);
    setCoverage(data.defaultCoverage);
    setIntervalWidth(data.defaultIntervalWidth);
    setFallbackTested(false);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading scientific validation gate"
      />
    );
  }

  const RecommendationIcon = decisionIcons[result.recommendation];
  const recommendationStyles =
    result.recommendation === 'release'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
      : result.recommendation === 'bounded-pilot'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Scientific release review"
          title={data.title}
          description={data.description}
          icon={Microscope}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the changed boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.context}
                      accent="blue"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Independent evidence"
                value={evidence}
                output={`${evidence}%`}
                min={40}
                max={100}
                step={2}
                accent="blue"
                lowLabel="Sparse"
                highLabel="Regime covered"
                onChange={setEvidence}
              />

              <LabRange
                label="Empirical interval coverage"
                value={coverage}
                output={`${coverage}%`}
                min={70}
                max={99}
                step={1}
                accent="violet"
                lowLabel="Under-covers"
                highLabel="Target covered"
                onChange={setCoverage}
              />

              <LabRange
                label="Interval width"
                value={intervalWidth}
                output={`${intervalWidth}%`}
                min={4}
                max={30}
                step={1}
                accent="amber"
                lowLabel="Sharper"
                highLabel="Less useful"
                onChange={setIntervalWidth}
              />

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                  fallbackTested
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                    : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={fallbackTested}
                  onChange={(event) => setFallbackTested(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-sm font-semibold">4. Trusted fallback is tested</span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Unsupported cases can reach the reference solver or conservative scientific path.
                  </span>
                </span>
              </label>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  5. Commit your release posture
                </legend>
                <div className="mt-3 space-y-2">
                  {data.decisions.map((decision) => (
                    <LabChoice
                      key={decision.id}
                      selected={decision.id === result.decision.id}
                      label={decision.label}
                      detail={decision.detail}
                      icon={decisionIcons[decision.id]}
                      accent={decisionTone[decision.id]}
                      onClick={() => setDecisionId(decision.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Changed scientific boundary
              </p>
              <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                {result.scenario.changedBoundary}
              </h4>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {result.scenario.context}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {result.gates.map((gate) => (
                <article
                  key={gate.label}
                  className={`rounded-md border p-4 ${
                    gate.passes
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">{gate.label}</h5>
                    {gate.passes ? (
                      <ShieldCheck aria-label="Pass" className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    ) : (
                      <TriangleAlert aria-label="Fail" className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
                    )}
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {gate.value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{gate.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Passing gates"
                value={`${result.passedCount} / 4`}
                detail="Every release gate remains independently visible"
                icon={Gauge}
                tone={result.passedCount === 4 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Coverage target"
                value={`${result.scenario.targetCoverage}%`}
                detail="Empirical target for this illustrative regime policy"
                icon={FlaskConical}
                tone="violet"
              />
              <LabMetric
                label="Useful width"
                value={`<= ${result.scenario.maximumUsefulWidth}%`}
                detail="Wider intervals cannot support the intended decision"
                icon={Microscope}
                tone="blue"
              />
            </div>

            <div className={`mt-5 rounded-md border p-5 ${recommendationStyles}`} role="status">
              <div className="flex items-start gap-3">
                <RecommendationIcon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Supported posture
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {result.recommendedDecision.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.matches
                      ? 'Your decision matches the evidence available under this illustrative policy.'
                      : `Your choice is not supported. The current evidence supports: ${result.recommendedDecision.label.toLowerCase()}.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence still required for this boundary
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.scenario.requiredEvidence.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The thresholds are an explanatory policy model, not scientific or regulatory approval criteria.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
