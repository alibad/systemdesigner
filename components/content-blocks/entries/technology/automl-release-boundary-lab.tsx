'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Scale,
  ShieldCheck,
  ShieldX,
  Target,
  TriangleAlert,
  UnlockKeyhole,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type SplitPolicyId = 'random' | 'grouped' | 'chronological';
type MetricId = 'accuracy' | 'recall' | 'cost';

type Choice = {
  id: string;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requiredSplitPolicyId: SplitPolicyId;
  preferredMetricId: MetricId;
  boundaryViolations: Record<SplitPolicyId, number>;
  violationUnit: string;
  risk: string;
  decision: string;
};

type ReleaseBoundaryData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    splitPolicyId: SplitPolicyId;
    metricId: MetricId;
    testLocked: boolean;
  };
  candidateDecisions: number;
  splitPolicies: Choice[];
  metrics: Choice[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'technology/automl-release-boundary-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/automl/data/release-boundary-scenarios.json';
const splitIds: SplitPolicyId[] = ['random', 'grouped', 'chronological'];
const metricIds: MetricId[] = ['accuracy', 'recall', 'cost'];

function isChoice(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Choice>;
  return Boolean(candidate.id && candidate.label && candidate.detail);
}

function isReleaseBoundaryData(value: unknown): value is ReleaseBoundaryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseBoundaryData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && splitIds.includes(candidate.defaults.splitPolicyId as SplitPolicyId)
      && metricIds.includes(candidate.defaults.metricId as MetricId)
      && typeof candidate.defaults.testLocked === 'boolean'
      && typeof candidate.candidateDecisions === 'number'
      && Number.isInteger(candidate.candidateDecisions)
      && candidate.candidateDecisions > 0
      && Array.isArray(candidate.splitPolicies)
      && candidate.splitPolicies.length === splitIds.length
      && candidate.splitPolicies.every(isChoice)
      && Array.isArray(candidate.metrics)
      && candidate.metrics.length === metricIds.length
      && candidate.metrics.every(isChoice)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && splitIds.includes(scenario.requiredSplitPolicyId)
        && metricIds.includes(scenario.preferredMetricId)
        && splitIds.every((id) => (
          typeof scenario.boundaryViolations?.[id] === 'number'
          && scenario.boundaryViolations[id] >= 0
        ))
        && typeof scenario.violationUnit === 'string'
        && typeof scenario.risk === 'string'
        && typeof scenario.decision === 'string'
      )),
  );
}

export default function AutoMLReleaseBoundaryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseBoundaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseBoundaryData(payload)) {
          throw new Error('The AutoML release-boundary scenarios are incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load release scenarios.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Evaluation boundary lab"
            title="Protect evidence before searching"
            description="Loading synthetic failure scenarios."
            icon={ShieldCheck}
            accent="rose"
          />
          <LearningLabBody>
            <div className="flex min-h-44 items-center justify-center">
              {error ? (
                <div className="max-w-md text-center">
                  <CircleAlert
                    aria-hidden="true"
                    className="mx-auto h-6 w-6 text-rose-500"
                  />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5 animate-pulse" />
                  Loading evaluation boundaries
                </div>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      ) : (
        <ReleaseBoundaryWorkbench data={data} />
      )}
    </div>
  );
}

function ReleaseBoundaryWorkbench({ data }: { data: ReleaseBoundaryData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [splitPolicyId, setSplitPolicyId] = useState<SplitPolicyId>(
    data.defaults.splitPolicyId,
  );
  const [metricId, setMetricId] = useState<MetricId>(data.defaults.metricId);
  const [testLocked, setTestLocked] = useState(data.defaults.testLocked);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const selectedSplit = data.splitPolicies.find((item) => item.id === splitPolicyId)
    ?? data.splitPolicies[0];
  const selectedMetric = data.metrics.find((item) => item.id === metricId)
    ?? data.metrics[0];
  const requiredSplit = data.splitPolicies.find(
    (item) => item.id === scenario.requiredSplitPolicyId,
  ) ?? data.splitPolicies[0];
  const preferredMetric = data.metrics.find(
    (item) => item.id === scenario.preferredMetricId,
  ) ?? data.metrics[0];

  const result = useMemo(() => {
    const boundaryViolations = scenario.boundaryViolations[splitPolicyId];
    const splitValid = boundaryViolations === 0;
    const metricAligned = metricId === scenario.preferredMetricId;
    const testInformedDecisions = testLocked ? 0 : data.candidateDecisions;
    const releasePasses = splitValid && metricAligned && testLocked;

    return {
      boundaryViolations,
      metricAligned,
      releasePasses,
      splitValid,
      testInformedDecisions,
    };
  }, [data.candidateDecisions, metricId, scenario, splitPolicyId, testLocked]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setSplitPolicyId(data.defaults.splitPolicyId);
    setMetricId(data.defaults.metricId);
    setTestLocked(data.defaults.testLocked);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evaluation boundary lab"
        title={data.title}
        description={data.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload
              </legend>
              <div className="mt-3 grid gap-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'renewal' ? Users : item.id === 'demand' ? GitBranch : Target}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Validation partition
              </legend>
              <div className="mt-3 grid gap-2">
                {data.splitPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === splitPolicyId}
                    label={item.label}
                    detail={item.detail}
                    icon={GitBranch}
                    accent={item.id === scenario.requiredSplitPolicyId ? 'emerald' : 'amber'}
                    onClick={() => setSplitPolicyId(item.id as SplitPolicyId)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Selection objective
              </legend>
              <div className="mt-3 grid gap-2">
                {data.metrics.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === metricId}
                    label={item.label}
                    detail={item.detail}
                    icon={Scale}
                    accent={item.id === scenario.preferredMetricId ? 'emerald' : 'amber'}
                    onClick={() => setMetricId(item.id as MetricId)}
                  />
                ))}
              </div>
            </fieldset>

            <LabChoice
              selected={testLocked}
              label={testLocked ? 'Final test set is locked' : 'Final test set is visible during search'}
              detail={testLocked
                ? 'Candidate builders cannot inspect it until the search and selection policy are frozen.'
                : 'Each of the modeled candidate decisions can react to final-test evidence.'}
              icon={testLocked ? LockKeyhole : UnlockKeyhole}
              accent={testLocked ? 'emerald' : 'rose'}
              onClick={() => setTestLocked((value) => !value)}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              result.releasePasses
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.releasePasses ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <ShieldX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Release consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {result.releasePasses
                    ? 'The modeled evidence boundary is valid for review'
                    : 'Block release before comparing candidate scores'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {result.releasePasses
                    ? 'The split matches the workload, the objective matches the declared decision, and the final test set remains independent.'
                    : 'AutoML cannot compensate for cross-boundary observations, a mismatched objective, or a final test set used as optimization feedback.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Boundary violations"
              value={result.boundaryViolations.toLocaleString()}
              detail={scenario.violationUnit}
              icon={GitBranch}
              tone={result.splitValid ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Selection objective"
              value={result.metricAligned ? 'Aligned' : 'Mismatch'}
              detail={`Selected: ${selectedMetric.label}`}
              icon={Scale}
              tone={result.metricAligned ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Test-informed decisions"
              value={result.testInformedDecisions.toLocaleString()}
              detail={testLocked ? 'Final evidence remains locked' : 'Modeled selection steps can see final evidence'}
              icon={testLocked ? LockKeyhole : UnlockKeyhole}
              tone={testLocked ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Release gate"
              value={result.releasePasses ? 'Pass' : 'Block'}
              detail="All three boundaries must pass"
              icon={result.releasePasses ? ShieldCheck : ShieldX}
              tone={result.releasePasses ? 'emerald' : 'rose'}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Boundary review
              </p>
              <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {scenario.label}
              </h4>
            </header>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <ReviewRow
                pass={result.splitValid}
                icon={GitBranch}
                title="Partition matches the generalization question"
                selected={`${selectedSplit.label}: ${result.boundaryViolations} ${scenario.violationUnit}`}
                required={`Required for this scenario: ${requiredSplit.label}. ${scenario.risk}`}
              />
              <ReviewRow
                pass={result.metricAligned}
                icon={Scale}
                title="Selection objective matches the product decision"
                selected={`Selected objective: ${selectedMetric.label}`}
                required={`Declared objective: ${preferredMetric.label}. ${scenario.decision}`}
              />
              <ReviewRow
                pass={testLocked}
                icon={KeyRound}
                title="Final evidence is outside the optimization loop"
                selected={testLocked
                  ? 'The final test set is unavailable until selection is frozen.'
                  : `${data.candidateDecisions} modeled candidate decisions can react to final-test results.`}
                required="A test result that changes the pipeline, threshold, feature set, metric, or search space becomes selection evidence."
              />
            </div>
          </section>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
            <div className="flex items-start gap-3">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Synthetic counts, real boundary logic</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  The violation counts make state changes inspectable. Production counts
                  must come from an overlap audit of your exact split indices, entity
                  keys, feature timestamps, and prediction-time contract.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ReviewRow({
  icon: Icon,
  pass,
  required,
  selected,
  title,
}: {
  icon: typeof GitBranch;
  pass: boolean;
  required: string;
  selected: string;
  title: string;
}) {
  return (
    <div className="grid gap-3 bg-white p-5 md:grid-cols-[auto_minmax(0,1fr)] dark:bg-neutral-950">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md ${
          pass
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        }`}
      >
        {pass ? (
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        ) : (
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <p className="font-semibold text-neutral-950 dark:text-white">{title}</p>
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              pass
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
            }`}
          >
            {pass ? 'Valid' : 'Invalid'}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
          {selected}
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {required}
        </p>
      </div>
    </div>
  );
}
