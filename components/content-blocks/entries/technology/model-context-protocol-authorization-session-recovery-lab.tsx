'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Repeat2,
  Route,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  XCircle,
  type LucideIcon,
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
  boundary: string;
  signal: string;
  authorizationState: string;
  completionState: string;
  recommendedActionId: string;
  safeConsequence: string;
  wrongConsequence: string;
  evidence: string[];
};

type RecoveryAction = {
  id: string;
  label: string;
  detail: string;
  restores: string;
};

type IncidentData = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultActionId: string;
  scenarios: Scenario[];
  actions: RecoveryAction[];
};

type Judgment = 'safe' | 'incomplete' | 'dangerous';

const scenarioIcons: Record<string, LucideIcon> = {
  'expired-session': Unplug,
  'insufficient-scope': LockKeyhole,
  'wrong-audience': ShieldAlert,
  'ambiguous-write': Repeat2,
};

const actionIcons: Record<string, LucideIcon> = {
  reinitialize: RefreshCw,
  'step-up': LogIn,
  reauthorize: KeyRound,
  reconcile: FileSearch,
  'blind-retry': Repeat2,
};

const judgmentStyles: Record<Judgment, string> = {
  safe:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  incomplete:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  dangerous:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
};

function isIncidentData(value: unknown): value is IncidentData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IncidentData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultActionId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.boundary === 'string'
        && typeof item.recommendedActionId === 'string'
        && Array.isArray(item.evidence)
        && item.evidence.length > 0
      ))
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && candidate.actions.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.restores === 'string'
      )),
  );
}

export default function ModelContextProtocolAuthorizationSessionRecoveryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<IncidentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No incident model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isIncidentData(payload)) throw new Error('The incident model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the incident model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <RecoveryRunbook data={data} />;
}

function RecoveryRunbook({ data }: { data: IncidentData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialAction = data.actions.find((item) => item.id === data.defaultActionId)
    ?? data.actions[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [actionId, setActionId] = useState(initialAction.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];

  const model = useMemo(() => {
    const exact = action.id === scenario.recommendedActionId;
    const dangerous = action.id === 'blind-retry'
      || (scenario.id === 'wrong-audience' && action.id !== 'reauthorize')
      || (scenario.id === 'ambiguous-write' && action.id !== 'reconcile');
    const judgment: Judgment = exact ? 'safe' : dangerous ? 'dangerous' : 'incomplete';

    const retrySafety = scenario.id === 'ambiguous-write'
      ? exact ? 'Reconcile first' : 'Duplicate possible'
      : scenario.id === 'expired-session'
        ? exact ? 'After initialize' : 'Session still absent'
        : exact ? 'After new grant' : 'Still unauthorized';

    const nextProtocolState = exact
      ? scenario.id === 'expired-session'
        ? 'Fresh session negotiated'
        : scenario.id === 'ambiguous-write'
          ? 'Outcome known'
          : 'Protected request may resume'
      : judgment === 'dangerous'
        ? 'Failure amplified'
        : 'Original boundary still broken';

    return { exact, judgment, nextProtocolState, retrySafety };
  }, [action, scenario]);

  function chooseScenario(next: Scenario) {
    setScenarioId(next.id);
    setActionId(next.recommendedActionId);
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setActionId(initialAction.id);
  }

  const JudgmentIcon = model.judgment === 'safe'
    ? ShieldCheck
    : model.judgment === 'dangerous'
      ? XCircle
      : AlertTriangle;

  const trace = [
    {
      label: 'Observe',
      title: scenario.signal,
      detail: `Failed boundary: ${scenario.boundary}`,
      icon: CircleAlert,
      state: 'observed',
    },
    {
      label: 'Classify',
      title: scenario.authorizationState,
      detail: scenario.completionState,
      icon: ShieldAlert,
      state: 'classified',
    },
    {
      label: 'Respond',
      title: action.label,
      detail: `Attempts to restore: ${action.restores}`,
      icon: actionIcons[action.id] ?? Route,
      state: model.judgment,
    },
    {
      label: 'Verify',
      title: model.nextProtocolState,
      detail: model.judgment === 'safe' ? 'Resume only after evidence agrees.' : 'Do not resume normal operation.',
      icon: model.judgment === 'safe' ? BadgeCheck : AlertTriangle,
      state: model.judgment,
    },
  ];

  return (
    <div data-content-block="technology/model-context-protocol-authorization-session-recovery-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Authorization and session incident lab"
          title="Repair the boundary that actually failed"
          description="Read the protocol evidence, choose a recovery, and trace whether it restores session state, authority, resource identity, or completion certainty."
          icon={ShieldAlert}
          accent="rose"
          onReset={reset}
        />

        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Observed incident
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => {
                    const Icon = scenarioIcons[item.id] ?? CircleAlert;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'expired-session' ? 'blue' : item.id === 'ambiguous-write' ? 'amber' : 'rose'}
                        onClick={() => chooseScenario(item)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Recovery response
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.actions.map((item) => {
                    const Icon = actionIcons[item.id] ?? RefreshCw;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === action.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'blind-retry' ? 'rose' : item.id === scenario.recommendedActionId ? 'emerald' : 'violet'}
                        onClick={() => setActionId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Failed boundary"
                value={scenario.boundary}
                detail={scenario.signal}
                icon={ShieldAlert}
                tone="amber"
              />
              <LabMetric
                label="Recovery judgment"
                value={model.judgment === 'safe' ? 'Boundary restored' : model.judgment === 'dangerous' ? 'Unsafe response' : 'Incomplete response'}
                detail={`Selected action restores: ${action.restores}`}
                icon={JudgmentIcon}
                tone={model.judgment === 'safe' ? 'emerald' : model.judgment === 'dangerous' ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Retry safety"
                value={model.retrySafety}
                detail={scenario.completionState}
                icon={Repeat2}
                tone={model.judgment === 'safe' ? 'blue' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Recovery trace
              </p>
              <ol className="mt-4 grid gap-3 lg:grid-cols-4">
                {trace.map((step, index) => {
                  const Icon = step.icon;
                  const resultTone = index < 2
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
                    : model.judgment === 'safe'
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : model.judgment === 'dangerous'
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                        : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30';

                  return (
                    <li key={step.label} className={`relative rounded-md border p-4 ${resultTone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{step.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">{step.title}</p>
                      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${judgmentStyles[model.judgment]}`}>
              <div className="flex items-start gap-3">
                <JudgmentIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {model.judgment === 'safe'
                      ? 'Defensible recovery'
                      : model.judgment === 'dangerous'
                        ? 'Failure made worse'
                        : 'Wrong boundary restored'}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-6">
                    {model.judgment === 'safe' ? scenario.safeConsequence : scenario.wrongConsequence}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-80">
                    Current authorization state: {scenario.authorizationState}.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Evidence required before normal operation resumes
                </h4>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-3">
                {scenario.evidence.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-md bg-neutral-50 p-3 text-sm leading-6 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <section className="not-prose my-7 min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
        {error ? (
          <>
            <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Incident model unavailable</p>
            <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle aria-hidden="true" className="h-7 w-7 text-rose-600 motion-safe:animate-spin dark:text-rose-400" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Loading recovery runbook...</p>
          </>
        )}
      </div>
    </section>
  );
}
