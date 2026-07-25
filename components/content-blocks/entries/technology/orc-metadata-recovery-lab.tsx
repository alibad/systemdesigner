'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileWarning,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Part = {
  id: string;
  label: string;
  detail: string;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
};

type PolicyResult = {
  action: string;
  coverage: string;
  pruning: string;
  aggregateSafe: boolean;
  explanation: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  affectedPartIds: string[];
  results: Record<string, PolicyResult>;
};

type MetadataFailureModel = {
  modelNote: string;
  defaultScenarioId: string;
  defaultPolicyId: string;
  parts: Part[];
  policies: Policy[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'technology/orc-metadata-recovery-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/orc/data/metadata-failure-model.json';

function isPolicyResult(value: unknown): value is PolicyResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<PolicyResult>;
  return Boolean(
    result.action
      && result.coverage
      && result.pruning
      && typeof result.aggregateSafe === 'boolean'
      && result.explanation,
  );
}

function isMetadataFailureModel(value: unknown): value is MetadataFailureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MetadataFailureModel>;
  return Boolean(
    candidate.modelNote
      && candidate.defaultScenarioId
      && candidate.defaultPolicyId
      && Array.isArray(candidate.parts)
      && candidate.parts.length > 0
      && candidate.parts.every((part) => part.id && part.label && part.detail)
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => policy.id && policy.label && policy.detail)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every(
        (scenario) => scenario.id
          && scenario.label
          && scenario.detail
          && Array.isArray(scenario.affectedPartIds)
          && scenario.results
          && candidate.policies?.every((policy) =>
            isPolicyResult(scenario.results[policy.id]),
          ),
      ),
  );
}

export default function OrcMetadataRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MetadataFailureModel | null>(null);
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
        if (!isMetadataFailureModel(payload)) {
          throw new Error('The ORC metadata failure model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load failure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Correctness boundary lab"
            title="Inject an ORC file failure"
            description="Loading metadata and recovery scenarios."
            icon={FileWarning}
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
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
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
                  <FileWarning aria-hidden="true" className="h-5 w-5 animate-pulse" />
                  Loading recovery model
                </div>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      ) : (
        <RecoveryWorkbench data={data} />
      )}
    </div>
  );
}

function RecoveryWorkbench({ data }: { data: MetadataFailureModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaultScenarioId);
  const [policyId, setPolicyId] = useState(data.defaultPolicyId);
  const scenario = data.scenarios.find((item) => item.id === scenarioId)
    ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId)
    ?? data.policies[0];
  const result = scenario.results[policy.id];
  const isComplete = result.coverage === 'Complete';
  const isRejected = result.coverage === 'No result'
    || result.coverage === 'No trustworthy live result';

  function reset() {
    setScenarioId(data.defaultScenarioId);
    setPolicyId(data.defaultPolicyId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Correctness boundary lab"
        title="Decide when fallback is safe"
        description="Inject a missing or corrupt file part, then compare the default strict reader with a best-effort data policy. Required metadata cannot be guessed."
        icon={FileWarning}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. File condition
              </legend>
              <div className="mt-3 grid gap-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.affectedPartIds.length === 0 ? ShieldCheck : FileWarning}
                    accent={item.affectedPartIds.length === 0 ? 'emerald' : 'rose'}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Reader policy
              </legend>
              <div className="mt-3 grid gap-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'strict' ? ShieldCheck : ShieldAlert}
                    accent={item.id === 'strict' ? 'blue' : 'amber'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Reader action"
            value={result.action}
            detail={policy.label}
            icon={isRejected ? ShieldAlert : SearchCheck}
            tone={isRejected ? 'rose' : 'blue'}
          />
          <LabMetric
            label="Result coverage"
            value={result.coverage}
            detail="Completeness, not availability"
            icon={isComplete ? CheckCircle2 : CircleAlert}
            tone={isComplete ? 'emerald' : isRejected ? 'neutral' : 'amber'}
          />
          <LabMetric
            label="Pruning available"
            value={result.pruning}
            detail="Optimization metadata still usable"
            icon={SearchCheck}
            tone="violet"
          />
          <LabMetric
            label="Aggregate-safe"
            value={result.aggregateSafe ? 'Yes' : 'No'}
            detail={result.aggregateSafe ? 'No silent partial aggregate' : 'Rows may be missing'}
            icon={result.aggregateSafe ? ShieldCheck : ShieldAlert}
            tone={result.aggregateSafe ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                ORC file dependency chain
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Highlighted parts are missing or damaged in the selected scenario.
              </p>
            </div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {scenario.label}
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.parts.map((part) => {
              const affected = scenario.affectedPartIds.includes(part.id);
              return (
                <div
                  key={part.id}
                  className={`min-w-0 rounded-md border p-3 ${
                    affected
                      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{part.label}</p>
                    <span className="text-[11px] font-semibold uppercase">
                      {affected ? 'Affected' : 'Available'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-75">{part.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`mt-5 flex items-start gap-3 rounded-md border p-4 ${
            result.aggregateSafe
              ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
              : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
          }`}
        >
          {result.aggregateSafe ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {result.aggregateSafe ? 'Correctness boundary preserved' : 'Partial-result risk'}
            </p>
            <p className="mt-1 text-sm leading-6 opacity-85">{result.explanation}</p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {data.modelNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
