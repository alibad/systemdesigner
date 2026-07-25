'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  KeyRound,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Repeat2,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Unplug,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

interface RecoveryScenario {
  id: string;
  label: string;
  detail: string;
  signal: string;
  boundary: string;
  completion: string;
  recommendedActionId: string;
  dangerousActionIds: string[];
  safeConsequence: string;
  wrongConsequence: string;
  evidence: string[];
  trace: string[];
}

interface RecoveryAction {
  id: string;
  label: string;
  detail: string;
  restores: string;
}

interface SessionRecoveryData {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultActionId: string;
  scenarios: RecoveryScenario[];
  actions: RecoveryAction[];
}

type Judgment = 'safe' | 'incomplete' | 'dangerous';

const BLOCK_ID = 'genai/model-context-protocol-session-recovery-lab';

const scenarioIcons: Record<string, LucideIcon> = {
  'expired-session': Unplug,
  'ambiguous-write': Repeat2,
  'insufficient-scope': KeyRound,
  'session-hijack': ShieldAlert,
  'progress-hang': Clock3,
};

const actionIcons: Record<string, LucideIcon> = {
  reinitialize: LogIn,
  reconcile: FileSearch,
  'step-up-scope': KeyRound,
  'reject-rotate': Ban,
  'cancel-deadline': Clock3,
  'blind-retry': RotateCw,
};

function isSessionRecoveryData(value: unknown): value is SessionRecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionRecoveryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultActionId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.signal === 'string'
        && typeof scenario.boundary === 'string'
        && typeof scenario.completion === 'string'
        && typeof scenario.recommendedActionId === 'string'
        && Array.isArray(scenario.dangerousActionIds)
        && typeof scenario.safeConsequence === 'string'
        && typeof scenario.wrongConsequence === 'string'
        && Array.isArray(scenario.evidence)
        && scenario.evidence.length > 0
        && Array.isArray(scenario.trace)
        && scenario.trace.length === 4
      ))
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && candidate.actions.every((action) => (
        typeof action.id === 'string'
        && typeof action.label === 'string'
        && typeof action.detail === 'string'
        && typeof action.restores === 'string'
      )),
  );
}

export default function ModelContextProtocolSessionRecoveryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SessionRecoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No MCP recovery model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSessionRecoveryData(payload)) throw new Error('Recovery data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <SessionRecoveryLab data={data} />;
}

function SessionRecoveryLab({ data }: { data: SessionRecoveryData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialAction = data.actions.find((item) => item.id === data.defaultActionId)
    ?? data.actions[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [actionId, setActionId] = useState(initialAction.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];

  const model = useMemo(() => {
    const judgment: Judgment = action.id === scenario.recommendedActionId
      ? 'safe'
      : scenario.dangerousActionIds.includes(action.id)
        ? 'dangerous'
        : 'incomplete';

    const duplicateRisk = scenario.id === 'ambiguous-write'
      ? judgment === 'safe'
        ? 'Controlled by reconciliation'
        : action.id === 'blind-retry'
          ? 'High: duplicate effect'
          : 'Unknown completion'
      : scenario.id === 'progress-hang' && action.id === 'blind-retry'
        ? 'High: concurrent work'
        : 'No replay required';

    const sessionState = scenario.id === 'expired-session'
      ? judgment === 'safe' ? 'Fresh initialization' : 'Still expired'
      : scenario.id === 'session-hijack'
        ? judgment === 'safe' ? 'Rejected and rotated' : 'Identity not restored'
        : 'Session is not the failed boundary';

    const authorityState = scenario.id === 'insufficient-scope'
      ? judgment === 'safe' ? 'Visible step-up' : 'Still insufficient'
      : scenario.id === 'session-hijack'
        ? judgment === 'safe' ? 'Subject reverified' : 'Unsafe session trust'
        : 'Authorization unchanged';

    return {
      authorityState,
      duplicateRisk,
      judgment,
      sessionState,
    };
  }, [action.id, scenario]);

  function chooseScenario(next: RecoveryScenario) {
    setScenarioId(next.id);
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setActionId(initialAction.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Session and authorization recovery"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Observed failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => {
                    const Icon = scenarioIcons[item.id] ?? AlertTriangle;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'session-hijack' ? 'rose' : item.id === 'ambiguous-write' ? 'amber' : 'blue'}
                        onClick={() => chooseScenario(item)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                icon={model.judgment === 'safe' ? CheckCircle2 : AlertTriangle}
                tone={model.judgment === 'safe' ? 'emerald' : model.judgment === 'dangerous' ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Session state"
                value={model.sessionState}
                detail="Session identity is separate from authentication"
                icon={LogIn}
                tone={scenario.id === 'expired-session' && model.judgment !== 'safe' ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Replay risk"
                value={model.duplicateRisk}
                detail={scenario.completion}
                icon={Repeat2}
                tone={model.duplicateRisk.startsWith('High') ? 'rose' : model.duplicateRisk.startsWith('Unknown') ? 'amber' : 'cyan'}
              />
            </div>

            <IncidentTrace scenario={scenario} action={action} judgment={model.judgment} />

            <section className={`rounded-md border p-5 ${model.judgment === 'safe'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : model.judgment === 'dangerous'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100'}`}>
              <div className="flex items-start gap-3">
                {model.judgment === 'safe'
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {model.judgment === 'safe' ? 'Defensible recovery' : model.judgment === 'dangerous' ? 'Failure made worse' : 'Wrong boundary restored'}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-6">
                    {model.judgment === 'safe' ? scenario.safeConsequence : scenario.wrongConsequence}
                  </p>
                  <p className="mt-3 text-sm leading-6 opacity-80">
                    Authorization state: {model.authorityState}.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence required before normal operation resumes
              </p>
              <ul className="mt-4 grid gap-3 lg:grid-cols-3">
                {scenario.evidence.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-md bg-neutral-50 p-3 text-sm leading-6 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function IncidentTrace({
  action,
  judgment,
  scenario,
}: {
  action: RecoveryAction;
  judgment: Judgment;
  scenario: RecoveryScenario;
}) {
  const trace = scenario.trace.map((step, index) => (
    index === scenario.trace.length - 1 ? action.label : step
  ));

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Incident trace
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
            Follow the boundary that actually failed
          </h4>
        </div>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{scenario.signal}</span>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
        {trace.map((step, index) => {
          const final = index === trace.length - 1;
          const tone = final
            ? judgment === 'safe'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : judgment === 'dangerous'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100'
            : index === 2
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
              : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200';

          return (
            <li key={`${index}-${step}`} className="contents">
              <div className={`rounded-md border p-3 ${tone}`}>
                <span className="text-xs font-semibold uppercase opacity-70">
                  {final ? 'Your response' : `Step ${index + 1}`}
                </span>
                <p className="mt-2 text-sm font-semibold leading-5">{step}</p>
              </div>
              {index < trace.length - 1 ? (
                <ArrowRight aria-hidden="true" className="hidden h-5 w-5 self-center text-neutral-400 md:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="status" className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading MCP recovery scenarios...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="alert" className="flex min-h-48 items-center justify-center gap-3 text-sm text-rose-700 dark:text-rose-300">
            <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span>{detail}</span>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
