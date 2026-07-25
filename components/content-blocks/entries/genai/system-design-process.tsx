'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Gauge,
  Image,
  Network,
  Route,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  userOutcome: string;
  requiredReasoningLevel: number;
  requiredModalities: string[];
  requiresGrounding: boolean;
  requiresTools: boolean;
  requiresHumanApproval: boolean;
  maximumPlanningLatencyMs: number;
};

type ModelTier = {
  id: string;
  label: string;
  detail: string;
  reasoningLevel: number;
  modalities: string[];
  planningLatencyMs: number;
};

type Architecture = {
  id: string;
  label: string;
  detail: string;
  supportsGrounding: boolean;
  supportsTools: boolean;
  supportsHumanApproval: boolean;
  stages: string[];
};

type DesignContractData = {
  title: string;
  description: string;
  evidenceNote: string;
  defaultScenarioId: string;
  defaultTierId: string;
  defaultArchitectureId: string;
  scenarios: Scenario[];
  tiers: ModelTier[];
  architectures: Architecture[];
};

type FitCheck = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
};

function isDesignContractData(value: unknown): value is DesignContractData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DesignContractData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.evidenceNote
      && candidate.defaultScenarioId
      && candidate.defaultTierId
      && candidate.defaultArchitectureId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        Boolean(scenario.id && scenario.label && scenario.userOutcome)
          && scenario.requiredReasoningLevel > 0
          && scenario.maximumPlanningLatencyMs > 0
          && Array.isArray(scenario.requiredModalities)
      ))
      && Array.isArray(candidate.tiers)
      && candidate.tiers.length > 0
      && candidate.tiers.every((tier) => (
        Boolean(tier.id && tier.label)
          && tier.reasoningLevel > 0
          && tier.planningLatencyMs > 0
          && Array.isArray(tier.modalities)
      ))
      && Array.isArray(candidate.architectures)
      && candidate.architectures.length > 0
      && candidate.architectures.every((architecture) => (
        Boolean(architecture.id && architecture.label)
          && Array.isArray(architecture.stages)
          && architecture.stages.length > 0
      )),
  );
}

export default function GenaiSystemDesignContractLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DesignContractData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No design-contract evidence was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDesignContractData(payload)) {
          throw new Error('Design-contract data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the design lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        title="Design lab unavailable"
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  if (!data) {
    return <LoadState error={null} title="Loading design evidence" onRetry={() => undefined} />;
  }

  return <DesignContractLab data={data} />;
}

function DesignContractLab({ data }: { data: DesignContractData }) {
  const defaultScenario = data.scenarios.find(
    (scenario) => scenario.id === data.defaultScenarioId,
  ) ?? data.scenarios[0];
  const defaultTier = data.tiers.find((tier) => tier.id === data.defaultTierId)
    ?? data.tiers[0];
  const defaultArchitecture = data.architectures.find(
    (architecture) => architecture.id === data.defaultArchitectureId,
  ) ?? data.architectures[0];

  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [tierId, setTierId] = useState(defaultTier.id);
  const [architectureId, setArchitectureId] = useState(defaultArchitecture.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId)
    ?? data.scenarios[0];
  const tier = data.tiers.find((item) => item.id === tierId) ?? data.tiers[0];
  const architecture = data.architectures.find((item) => item.id === architectureId)
    ?? data.architectures[0];

  const checks = useMemo<FitCheck[]>(() => {
    const missingModalities = scenario.requiredModalities.filter(
      (modality) => !tier.modalities.includes(modality),
    );

    return [
      {
        id: 'reasoning',
        label: 'Task capability',
        detail: tier.reasoningLevel >= scenario.requiredReasoningLevel
          ? `${tier.label} meets reasoning level ${scenario.requiredReasoningLevel}.`
          : `${tier.label} is below required reasoning level ${scenario.requiredReasoningLevel}.`,
        passed: tier.reasoningLevel >= scenario.requiredReasoningLevel,
      },
      {
        id: 'modality',
        label: 'Input modality',
        detail: missingModalities.length === 0
          ? `Supports ${scenario.requiredModalities.join(' and ')} input.`
          : `Missing ${missingModalities.join(' and ')} input.`,
        passed: missingModalities.length === 0,
      },
      {
        id: 'grounding',
        label: 'Evidence path',
        detail: scenario.requiresGrounding
          ? architecture.supportsGrounding
            ? 'Authorized evidence enters before generation.'
            : 'Current private evidence has no retrieval path.'
          : 'No external evidence store is required for this bounded draft.',
        passed: !scenario.requiresGrounding || architecture.supportsGrounding,
      },
      {
        id: 'tools',
        label: 'Action boundary',
        detail: scenario.requiresTools
          ? architecture.supportsTools
            ? 'Tool proposals pass through deterministic application policy.'
            : 'The workflow cannot perform its required bounded action.'
          : 'The workflow has no external side effect.',
        passed: !scenario.requiresTools || architecture.supportsTools,
      },
      {
        id: 'approval',
        label: 'Approval boundary',
        detail: scenario.requiresHumanApproval
          ? architecture.supportsHumanApproval
            ? 'A human owns the consequential action.'
            : 'The required approval checkpoint is missing.'
          : 'No human approval is required for the declared outcome.',
        passed: !scenario.requiresHumanApproval || architecture.supportsHumanApproval,
      },
      {
        id: 'latency',
        label: 'Planning latency',
        detail: `${tier.planningLatencyMs.toLocaleString()} ms tier measurement vs ${scenario.maximumPlanningLatencyMs.toLocaleString()} ms requirement.`,
        passed: tier.planningLatencyMs <= scenario.maximumPlanningLatencyMs,
      },
    ];
  }, [architecture, scenario, tier]);

  const failedChecks = checks.filter((check) => !check.passed);
  const ready = failedChecks.length === 0;

  function reset() {
    setScenarioId(defaultScenario.id);
    setTierId(defaultTier.id);
    setArchitectureId(defaultArchitecture.id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Requirement and routing lab"
        title={data.title}
        description={data.description}
        icon={Route}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the user outcome
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={FileQuestion}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose a model tier
              </legend>
              <div className="mt-3 space-y-2">
                {data.tiers.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === tier.id}
                    label={item.label}
                    detail={item.detail}
                    icon={BrainCircuit}
                    accent="violet"
                    onClick={() => setTierId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose an execution path
              </legend>
              <div className="mt-3 space-y-2">
                {data.architectures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === architecture.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Network}
                    accent="emerald"
                    onClick={() => setArchitectureId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Design verdict"
            value={ready ? 'Candidate' : 'Revise'}
            detail={ready ? 'All declared requirements fit.' : `${failedChecks.length} requirement gates failed.`}
            icon={ready ? BadgeCheck : XCircle}
            tone={ready ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Planning latency"
            value={`${tier.planningLatencyMs.toLocaleString()} ms`}
            detail={`Requirement: at most ${scenario.maximumPlanningLatencyMs.toLocaleString()} ms`}
            icon={Clock3}
            tone={tier.planningLatencyMs <= scenario.maximumPlanningLatencyMs ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Reasoning fit"
            value={`${tier.reasoningLevel} / ${scenario.requiredReasoningLevel}`}
            detail="Selected tier / required level"
            icon={Gauge}
            tone={tier.reasoningLevel >= scenario.requiredReasoningLevel ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Required inputs"
            value={scenario.requiredModalities.join(' + ')}
            detail={`Tier supports ${tier.modalities.join(' + ')}`}
            icon={scenario.requiredModalities.includes('image') ? Image : FileQuestion}
            tone={scenario.requiredModalities.every((item) => tier.modalities.includes(item)) ? 'violet' : 'rose'}
          />
        </div>

        <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Intended user outcome
          </p>
          <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
            {scenario.userOutcome}
          </p>
        </section>

        <section className="mt-5">
          <div className="flex items-center gap-2">
            <Network aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              {architecture.label} request path
            </h4>
          </div>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {architecture.stages.map((stage, index) => (
              <li
                key={stage}
                className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-950 dark:bg-violet-950 dark:text-violet-100">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {stage}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Requirement trace
            </h4>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {checks.map((check) => (
              <li
                key={check.id}
                className={`rounded-md border p-4 ${
                  check.passed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                }`}
              >
                <span className="flex items-start gap-3">
                  {check.passed
                    ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{check.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-80">{check.detail}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          <Wrench aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {data.evidenceNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({
  error,
  title,
  onRetry,
}: {
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Requirement and routing lab"
        title={title}
        description={error ?? 'Loading the co-located design evidence.'}
        icon={Route}
        accent={error ? 'rose' : 'violet'}
        onReset={error ? onRetry : undefined}
      />
    </LearningLab>
  );
}
