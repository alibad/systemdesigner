'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  GitBranch,
  MapPinOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RecoveryResponse = {
  id: string;
  label: string;
  detail: string;
  tripState: string;
  invariant: string;
  customerImpact: string;
  operatorAction: string;
};

type RecoveryScenario = {
  id: string;
  label: string;
  summary: string;
  injection: string;
  recommendedResponseId: string;
  trace: string[];
  responses: RecoveryResponse[];
};

type RecoveryModel = {
  defaults: { scenarioId: string; responseId: string };
  scenarios: RecoveryScenario[];
};

function isRecoveryModel(value: unknown): value is RecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as RecoveryModel;
  return Boolean(
    candidate.defaults
      && typeof candidate.defaults.scenarioId === 'string'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.summary === 'string'
        && typeof scenario.injection === 'string'
        && typeof scenario.recommendedResponseId === 'string'
        && Array.isArray(scenario.trace)
        && scenario.trace.length === 4
        && scenario.trace.every((step) => typeof step === 'string')
        && Array.isArray(scenario.responses)
        && scenario.responses.length >= 2
        && scenario.responses.some((response) => response.id === scenario.recommendedResponseId)
        && scenario.responses.every((response) => (
          typeof response.id === 'string'
          && typeof response.label === 'string'
          && typeof response.detail === 'string'
          && typeof response.tripState === 'string'
          && typeof response.invariant === 'string'
          && typeof response.customerImpact === 'string'
          && typeof response.operatorAction === 'string'
        ))
      )),
  );
}

const scenarioIcons = {
  'duplicate-accept': UserRoundCheck,
  'stale-location': MapPinOff,
  'payment-timeout': CircleDollarSign,
  'safety-incident': ShieldAlert,
} as const;

export default function RideSharingTripRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RecoveryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('duplicate-accept');
  const [responseId, setResponseId] = useState('atomic-claim');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The trip recovery scenarios were not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((model) => {
        if (!isRecoveryModel(model)) throw new Error('The trip recovery scenario data is invalid.');
        setData(model);
        setScenarioId(model.defaults.scenarioId);
        setResponseId(model.defaults.responseId);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the trip recovery scenarios.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">Recovery scenarios unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading trip recovery scenarios"
      />
    );
  }

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const response = scenario.responses.find((item) => item.id === responseId)
    ?? scenario.responses.find((item) => item.id === scenario.recommendedResponseId)
    ?? scenario.responses[0];
  const protectedOutcome = response.id === scenario.recommendedResponseId;
  const ResultIcon = protectedOutcome ? CheckCircle2 : AlertTriangle;
  const resultStyle = protectedOutcome
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';

  const chooseScenario = (nextScenario: RecoveryScenario) => {
    setScenarioId(nextScenario.id);
    setResponseId(nextScenario.recommendedResponseId);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Trip lifecycle failure lab"
        title="Choose which guarantee survives an uncertain outcome"
        description="Inject a race, stale location, payment timeout, or safety incident. Then choose the recovery contract and trace whether trip state, customer promises, and operational ownership remain coherent."
        icon={GitBranch}
        accent="rose"
        onReset={() => {
          setScenarioId(data.defaults.scenarioId);
          setResponseId(data.defaults.responseId);
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject a failure</legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => {
                  const Icon = scenarioIcons[item.id as keyof typeof scenarioIcons] ?? ShieldAlert;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.summary}
                      icon={Icon}
                      accent={item.id === 'safety-incident' ? 'rose' : item.id === 'payment-timeout' ? 'amber' : 'violet'}
                      onClick={() => chooseScenario(item)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Choose the recovery contract</legend>
              <div className="mt-3 space-y-2">
                {scenario.responses.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={response.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === scenario.recommendedResponseId ? ShieldCheck : RefreshCw}
                    accent={item.id === scenario.recommendedResponseId ? 'emerald' : 'amber'}
                    onClick={() => setResponseId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <LabMetric
            label="Injection point"
            value={scenario.injection}
            detail={scenario.summary}
            icon={Clock3}
            tone="amber"
          />
          <LabMetric
            label="Resulting trip state"
            value={response.tripState}
            detail="The durable lifecycle must not move backward to hide a failed side effect."
            icon={GitBranch}
            tone={protectedOutcome ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Invariant"
            value={response.invariant}
            detail={protectedOutcome ? 'The selected response keeps one accountable owner for the outcome.' : 'The selected response creates ambiguity or violates the user promise.'}
            icon={protectedOutcome ? ShieldCheck : ShieldAlert}
            tone={protectedOutcome ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 dark:border-neutral-800">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Failure trace: {scenario.label}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">The final step changes with the recovery contract; the initial uncertainty does not.</p>
          </div>
          <ol className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {scenario.trace.map((step, index) => (
              <li key={step} className={`rounded-md border p-4 ${index === scenario.trace.length - 1 ? resultStyle : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
                <span className="text-xs font-semibold uppercase opacity-70">Step {index + 1}</span>
                <p className="mt-2 text-sm leading-6">{index === scenario.trace.length - 1 ? `${response.label}: ${response.tripState}. ${response.customerImpact}` : step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className={`mt-5 rounded-md border p-4 ${resultStyle}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <ResultIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{protectedOutcome ? 'Recovery contract protects the promise' : 'Recovery contract leaves a correctness gap'}</p>
              <p className="mt-1 text-xs leading-5 opacity-85">{response.customerImpact}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
            <ShieldAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
            Operator handoff
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{response.operatorAction}</p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
