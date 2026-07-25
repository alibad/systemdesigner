'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  Check,
  CircleX,
  ClipboardCheck,
  Gauge,
  Scale,
  ShieldCheck,
  TimerReset,
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
  '/api/content/ml-systems/quantum-ml/data/advantage-claim-gate.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  dataFit: number;
  structureFit: number;
  noiseTolerance: number;
  inputEvidence: string;
};

type Boundary = {
  id: string;
  label: string;
  detail: string;
  rigor: number;
  includes: string[];
};

type Baseline = {
  id: string;
  label: string;
  detail: string;
  rigor: number;
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultBoundary: string;
  defaultBaseline: string;
  scenarios: Scenario[];
  boundaries: Boundary[];
  baselines: Baseline[];
};

type EvidenceCheck = {
  label: string;
  detail: string;
  passed: boolean;
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      typeof data.defaultBoundary === 'string' &&
      typeof data.defaultBaseline === 'string' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      Array.isArray(data.boundaries) &&
      data.boundaries.length > 0 &&
      Array.isArray(data.baselines) &&
      data.baselines.length > 0,
  );
}

export default function QuantumMlAdvantageClaimGate({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('classical-customer-data');
  const [boundaryId, setBoundaryId] = useState('circuit-only');
  const [baselineId, setBaselineId] = useState('naive');
  const [trials, setTrials] = useState(5);

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
          throw new Error('The advantage gate data does not match the expected contract.');
        }
        setData(value);
        setScenarioId(value.defaultScenario);
        setBoundaryId(value.defaultBoundary);
        setBaselineId(value.defaultBaseline);
        setTrials(5);
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
    const boundary = data.boundaries.find((item) => item.id === boundaryId) ?? data.boundaries[0];
    const baseline = data.baselines.find((item) => item.id === baselineId) ?? data.baselines[0];
    const includes = new Set(boundary.includes);
    const checks: EvidenceCheck[] = [
      {
        label: 'Input acquisition is timed',
        detail: scenario.inputEvidence,
        passed: includes.has('inputs'),
      },
      {
        label: 'Device path is included',
        detail: 'Compilation, queueing, calibration context, and execution belong in elapsed time.',
        passed: includes.has('device'),
      },
      {
        label: 'Measurement repetitions are counted',
        detail: 'Every shot, observable group, mitigation variant, and parameter update consumes work.',
        passed: includes.has('measurements'),
      },
      {
        label: 'Independent trials expose variability',
        detail: 'At least 20 trials make drift and optimizer variance harder to hide behind one favorable run.',
        passed: includes.has('repetitions') && trials >= 20,
      },
      {
        label: 'The classical baseline is competitive',
        detail: 'Use a task-appropriate tuned method with the same quality target and disclosed search budget.',
        passed: baseline.rigor >= 0.8,
      },
    ];
    const passedChecks = checks.filter((check) => check.passed).length;
    const evidenceCoverage = passedChecks / checks.length;
    const technicalFit = (scenario.dataFit + scenario.structureFit + scenario.noiseTolerance) / 3;
    const readiness = Math.round(100 * (0.35 * technicalFit + 0.65 * evidenceCoverage));
    const relativeUncertainty = 100 / Math.sqrt(trials);
    const completeBoundary = boundary.id === 'end-to-end';
    const strongBaseline = baseline.rigor >= 0.8;
    const repeated = trials >= 20;
    const ready = completeBoundary && strongBaseline && repeated && technicalFit >= 0.5;
    const weakFit = completeBoundary && strongBaseline && repeated && technicalFit < 0.5;
    const status = ready
      ? 'Ready for a bounded study'
      : weakFit
        ? 'Research fit is weak'
        : 'Advantage claim blocked';
    const explanation = ready
      ? 'The experiment boundary is credible enough to test a narrow claim. Report quality, uncertainty, and total resources; this gate still does not prove advantage.'
      : weakFit
        ? 'The evidence process is complete, but this workload has weak quantum-data, structure, or noise fit. Reframe the research question before spending more hardware budget.'
        : 'The current setup can support a circuit demo, not an end-to-end advantage claim. Close every failed evidence check before interpreting timing differences.';

    return {
      scenario,
      boundary,
      baseline,
      checks,
      passedChecks,
      readiness,
      technicalFit,
      relativeUncertainty,
      ready,
      weakFit,
      status,
      explanation,
    };
  }, [baselineId, boundaryId, data, scenarioId, trials]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaultScenario);
    setBoundaryId(data.defaultBoundary);
    setBaselineId(data.defaultBaseline);
    setTrials(5);
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
        aria-label="Loading quantum advantage claim gate"
      />
    );
  }

  const statusTone = result.ready
    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
    : result.weakFit
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
      : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35';

  return (
    <div data-content-block="ml-systems/quantum-ml-advantage-claim-gate">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence design lab"
          title={data.title}
          description={data.description}
          icon={Scale}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a research claim
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Atom}
                      accent="violet"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Define the timing boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {data.boundaries.map((boundary) => (
                    <LabChoice
                      key={boundary.id}
                      selected={boundary.id === result.boundary.id}
                      label={boundary.label}
                      detail={boundary.detail}
                      icon={TimerReset}
                      accent="cyan"
                      onClick={() => setBoundaryId(boundary.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose the comparison
                </legend>
                <div className="mt-3 space-y-2">
                  {data.baselines.map((baseline) => (
                    <LabChoice
                      key={baseline.id}
                      selected={baseline.id === result.baseline.id}
                      label={baseline.label}
                      detail={baseline.detail}
                      icon={Scale}
                      accent="amber"
                      onClick={() => setBaselineId(baseline.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Independent trials"
                value={trials}
                output={String(trials)}
                min={3}
                max={50}
                accent="emerald"
                lowLabel="Anecdotal"
                highLabel="Variability visible"
                onChange={setTrials}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Claim under review
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.scenario.label}
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${statusTone}`}>
                {result.ready ? (
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                )}
                {result.status}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric
                label="Study readiness"
                value={`${result.readiness}%`}
                detail="Technical fit plus evidence completeness; not probability of advantage"
                icon={Gauge}
                tone={result.ready ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Evidence checks"
                value={`${result.passedChecks}/${result.checks.length}`}
                detail={`${result.boundary.label}; ${result.baseline.label}`}
                icon={ClipboardCheck}
                tone={result.passedChecks === result.checks.length ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Trial uncertainty index"
                value={`±${result.relativeUncertainty.toFixed(1)}%`}
                detail="Illustrative 1/sqrt(trials) planning index, not a measured confidence interval"
                icon={Scale}
                tone={trials >= 20 ? 'cyan' : 'amber'}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence ledger</p>
              </div>
              <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {result.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-3 p-4">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${check.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                      {check.passed ? <Check aria-hidden="true" className="h-4 w-4" /> : <CircleX aria-hidden="true" className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{check.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`mt-5 rounded-md border p-4 ${statusTone}`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Gate decision</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.explanation}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
