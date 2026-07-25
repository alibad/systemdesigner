'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  FileCheck2,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
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
  '/api/content/ml-systems/healthcare-ai/data/change-control-scenarios.json';
const BLOCK_ID = 'ml-systems/healthcare-ai-change-control-lab';

type RangeDefinition = { min: number; max: number; step: number };
type ChangeScenario = {
  id: string;
  label: string;
  detail: string;
  changedBoundary: string;
  impact: number;
  requiredEvidence: string[];
};
type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    boundaryCoveragePct: number;
    independentCases: number;
    testedFallback: boolean;
  };
  coverageRange: RangeDefinition;
  caseRange: RangeDefinition;
  scenarios: ChangeScenario[];
};

function isRange(value: unknown): value is RangeDefinition {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeDefinition>;
  return [range.min, range.max, range.step].every((item) => typeof item === 'number');
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.boundaryCoveragePct === 'number'
      && typeof data.defaults.independentCases === 'number'
      && typeof data.defaults.testedFallback === 'boolean'
      && isRange(data.coverageRange)
      && isRange(data.caseRange)
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.changedBoundary === 'string'
        && typeof scenario.impact === 'number'
        && Array.isArray(scenario.requiredEvidence)
        && scenario.requiredEvidence.every((item) => typeof item === 'string')
      )),
  );
}

export default function HealthcareAiChangeControlLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('new-device');
  const [boundaryCoveragePct, setBoundaryCoveragePct] = useState(55);
  const [independentCases, setIndependentCases] = useState(250);
  const [testedFallback, setTestedFallback] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Change-control scenario data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setBoundaryCoveragePct(payload.defaults.boundaryCoveragePct);
        setIndependentCases(payload.defaults.independentCases);
        setTestedFallback(payload.defaults.testedFallback);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];

  const result = useMemo(() => {
    if (!scenario) return null;
    const sampleSignal = Math.min(30, Math.log10(independentCases + 1) * 10);
    const evidenceScore = Math.max(0, Math.min(100, Math.round(
      boundaryCoveragePct * 0.55
      + sampleSignal
      + (testedFallback ? 15 : 0)
      - scenario.impact * 8,
    )));

    if (!testedFallback || evidenceScore < 45) {
      return {
        evidenceScore,
        posture: 'Hold and contain',
        detail: 'Keep the changed path out of user-visible use. Preserve the incumbent or ordinary workflow while the evidence gap is closed.',
        tone: 'rose' as const,
        icon: ShieldAlert,
      };
    }
    if (evidenceScore < 75 || scenario.impact === 3) {
      return {
        evidenceScore,
        posture: 'Shadow only',
        detail: 'Run the changed path without influencing care or operations, compare it independently, and keep the tested fallback ready.',
        tone: 'amber' as const,
        icon: TriangleAlert,
      };
    }
    return {
      evidenceScore,
      posture: 'Bounded release candidate',
      detail: 'The engineering evidence supports review of a small, reversible, closely monitored release. This is not clinical or regulatory approval.',
      tone: 'emerald' as const,
      icon: BadgeCheck,
    };
  }, [boundaryCoveragePct, independentCases, scenario, testedFallback]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setBoundaryCoveragePct(data.defaults.boundaryCoveragePct);
    setIndependentCases(data.defaults.independentCases);
    setTestedFallback(data.defaults.testedFallback);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Change-control lab"
          title={data?.title ?? 'Decide how much evidence a system change needs'}
          description={data?.description ?? 'Loading change-control scenarios...'}
          icon={RefreshCw}
          accent="amber"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Select the boundary change
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={RefreshCw}
                        accent={item.impact === 3 ? 'rose' : 'amber'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Required-boundary coverage"
                  value={boundaryCoveragePct}
                  output={`${boundaryCoveragePct}%`}
                  min={data.coverageRange.min}
                  max={data.coverageRange.max}
                  step={data.coverageRange.step}
                  accent="violet"
                  lowLabel="Major gaps"
                  highLabel="Planned slices covered"
                  onChange={setBoundaryCoveragePct}
                />

                <LabRange
                  label="3. Independently reviewed cases"
                  value={independentCases}
                  output={independentCases.toLocaleString()}
                  min={data.caseRange.min}
                  max={data.caseRange.max}
                  step={data.caseRange.step}
                  accent="cyan"
                  lowLabel="No new cases"
                  highLabel="Broader evidence"
                  onChange={setIndependentCases}
                />

                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${testedFallback ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
                  <input
                    type="checkbox"
                    checked={testedFallback}
                    onChange={(event) => setTestedFallback(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-emerald-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold">4. Tested fallback is ready</span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">
                      The team has exercised rollback or the ordinary non-AI workflow with realistic dependencies.
                    </span>
                  </span>
                </label>
              </div>
            )}
          >
            <div aria-live="polite">
              <div className={`rounded-md border p-4 ${result.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}>
                <div className="flex items-start gap-3">
                  <result.icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                  <div>
                    <p className="font-semibold text-neutral-950 dark:text-white">{result.posture}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <LabMetric
                  label="Evidence score"
                  value={`${result.evidenceScore} / 100`}
                  detail="Illustrative engineering model, not a probability or approval score"
                  icon={FlaskConical}
                  tone={result.tone}
                />
                <LabMetric
                  label="Change impact"
                  value={scenario.impact === 3 ? 'High' : scenario.impact === 2 ? 'Moderate' : 'Lower'}
                  detail={scenario.changedBoundary}
                  icon={TriangleAlert}
                  tone={scenario.impact === 3 ? 'rose' : 'amber'}
                />
                <LabMetric
                  label="Containment"
                  value={testedFallback ? 'Tested' : 'Missing'}
                  detail={testedFallback ? 'Rollback or ordinary workflow exercised' : 'A user-visible release remains hard to reverse'}
                  icon={FileCheck2}
                  tone={testedFallback ? 'emerald' : 'rose'}
                />
              </div>

              <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Changed boundary</p>
                <p className="mt-2 font-semibold text-neutral-950 dark:text-white">{scenario.changedBoundary}</p>
                <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence to collect</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {scenario.requiredEvidence.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
                <p className="font-semibold">Why this change matters</p>
                <p className="mt-1">
                  {scenario.id === 'new-device'
                    ? 'A new device can alter the input distribution and acquisition artifacts before the model sees them.'
                    : scenario.id === 'mapping-change'
                      ? 'A semantic mapping change can invalidate model inputs even when schemas and model weights appear unchanged.'
                      : scenario.id === 'population-expansion'
                        ? 'Performance in the original population does not establish calibration, usability, or benefit in a new population.'
                        : 'Presentation and alert routing change the human-AI team, so the system can change without a new score function.'}
                </p>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div className="p-5 md:p-6">
      <div className={`rounded-md border p-4 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100' : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`} role={error ? 'alert' : 'status'}>
        {error ?? 'Loading change-control scenarios...'}
      </div>
    </div>
  );
}
