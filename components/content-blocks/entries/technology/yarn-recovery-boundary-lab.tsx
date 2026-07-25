'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  CircleAlert,
  Clock3,
  FileSearch,
  HeartPulse,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  TerminalSquare,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RecoveryAction = {
  id: string;
  label: string;
  detail: string;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  component: 'ResourceManager' | 'NodeManager' | 'ApplicationMaster' | 'Container';
  symptom: string;
  owner: string;
  boundary: string;
  evidence: string;
  correctActionId: string;
  correctResult: string;
  wrongResult: string;
  failedContainers: number;
  baseRecoveryMinutes: number;
  benefitsFromRmHa: boolean;
  benefitsFromNmRecovery: boolean;
  needsAggregatedLogs: boolean;
};

type RecoveryModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    rmHa: boolean;
    nmRecovery: boolean;
    logAggregation: boolean;
  };
  actions: RecoveryAction[];
  scenarios: FailureScenario[];
};

const BLOCK_ID = 'technology/yarn-recovery-boundary-lab';

function isRecoveryModel(value: unknown): value is RecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecoveryModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.actions)
      && candidate.actions.length >= 3
      && candidate.actions.every((action) => action.id && action.label && action.detail)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(
        (scenario) => scenario.id
          && scenario.label
          && scenario.detail
          && scenario.component
          && scenario.symptom
          && scenario.owner
          && scenario.boundary
          && scenario.evidence
          && scenario.correctActionId
          && scenario.correctResult
          && scenario.wrongResult
          && typeof scenario.failedContainers === 'number'
          && typeof scenario.baseRecoveryMinutes === 'number',
      ),
  );
}

const componentIcons: Record<FailureScenario['component'], LucideIcon> = {
  ResourceManager: ShieldCheck,
  NodeManager: ServerCrash,
  ApplicationMaster: RefreshCw,
  Container: TerminalSquare,
};

export default function YarnRecoveryBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<RecoveryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No YARN recovery scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRecoveryModel(payload)) throw new Error('The YARN recovery model is incomplete.');
        setModel(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load recovery scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LabState
        error={loadError}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <RecoveryWorkbench model={model} />;
}

function RecoveryWorkbench({ model }: { model: RecoveryModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [actionId, setActionId] = useState(model.defaults.actionId);
  const [rmHa, setRmHa] = useState(model.defaults.rmHa);
  const [nmRecovery, setNmRecovery] = useState(model.defaults.nmRecovery);
  const [logAggregation, setLogAggregation] = useState(model.defaults.logAggregation);

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const action = model.actions.find((item) => item.id === actionId) ?? model.actions[0];
  const ScenarioIcon = componentIcons[scenario.component];

  const result = useMemo(() => {
    const correctAction = action.id === scenario.correctActionId;
    let recoveryMinutes = scenario.baseRecoveryMinutes;
    let containersToRetry = scenario.failedContainers;
    const protections: string[] = [];

    if (scenario.benefitsFromRmHa) {
      if (rmHa) {
        recoveryMinutes *= 0.3;
        containersToRetry = Math.ceil(containersToRetry * 0.1);
        protections.push('RM HA and persisted state preserve the control plane');
      } else {
        recoveryMinutes *= 2.5;
      }
    }

    if (scenario.benefitsFromNmRecovery) {
      if (nmRecovery) {
        recoveryMinutes *= 0.25;
        containersToRetry = 0;
        protections.push('NodeManager recovery reattaches supervised containers');
      } else {
        recoveryMinutes *= 1.8;
      }
    }

    if (!correctAction) recoveryMinutes *= 2.4;

    const evidenceAvailable = !scenario.needsAggregatedLogs || logAggregation;
    if (!evidenceAvailable) recoveryMinutes *= 1.35;
    if (logAggregation) protections.push('aggregated logs survive the worker boundary');

    return {
      containersToRetry,
      correctAction,
      evidenceAvailable,
      protections,
      recoveryMinutes,
    };
  }, [action.id, logAggregation, nmRecovery, rmHa, scenario]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setActionId(model.defaults.actionId);
    setRmHa(model.defaults.rmHa);
    setNmRecovery(model.defaults.nmRecovery);
    setLogAggregation(model.defaults.logAggregation);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure ownership and recovery lab"
          title={model.title}
          description={model.description}
          icon={HeartPulse}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.scenarios.map((item) => {
                    const Icon = componentIcons[item.component];
                    return (
                      <LabChoice
                        key={item.id}
                        selected={scenario.id === item.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent="amber"
                        onClick={() => setScenarioId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Set the recovery posture
                </p>
                <div className="mt-3 space-y-2">
                  <RecoverySwitch
                    checked={rmHa}
                    label="ResourceManager HA"
                    detail="Standby plus a durable state store"
                    onChange={setRmHa}
                  />
                  <RecoverySwitch
                    checked={nmRecovery}
                    label="NodeManager recovery"
                    detail="Local state store and supervised containers"
                    onChange={setNmRecovery}
                  />
                  <RecoverySwitch
                    checked={logAggregation}
                    label="Log aggregation"
                    detail="Move container evidence off worker-local disks"
                    onChange={setLogAggregation}
                  />
                </div>
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose the first response
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={action.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Activity}
                      accent="rose"
                      onClick={() => setActionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${result.correctAction ? healthyClass : dangerClass}`}>
              <div className="flex items-start gap-3">
                {result.correctAction
                  ? <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <X aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    First-response review
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.correctAction
                      ? `The response matches the ${scenario.component} failure boundary`
                      : 'The response acts at the wrong ownership boundary'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.correctAction ? scenario.correctResult : scenario.wrongResult}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Failed component"
                value={scenario.component}
                detail={scenario.symptom}
                icon={ScenarioIcon}
                tone="amber"
              />
              <LabMetric
                label="Recovery owner"
                value={scenario.owner}
                detail="The layer that can restore progress"
                icon={ShieldCheck}
                tone="blue"
              />
              <LabMetric
                label="Control gap"
                value={`${Math.max(1, result.recoveryMinutes).toFixed(0)} min`}
                detail="Illustrative response window, not an SLA"
                icon={Clock3}
                tone={result.correctAction ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Containers retried"
                value={`${result.containersToRetry}`}
                detail="Existing task attempts may still be replayed"
                icon={RefreshCw}
                tone={result.containersToRetry === 0 ? 'emerald' : 'violet'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Recovery ownership trace
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  Detect, restore, then prove application progress
                </h4>
              </div>
              <div className="grid md:grid-cols-3">
                <RecoveryStage
                  number="1"
                  title="Detect"
                  detail={scenario.symptom}
                  icon={HeartPulse}
                />
                <RecoveryStage
                  number="2"
                  title={scenario.owner}
                  detail={scenario.boundary}
                  icon={ScenarioIcon}
                />
                <RecoveryStage
                  number="3"
                  title="Verify"
                  detail={scenario.evidence}
                  icon={FileSearch}
                  last
                />
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <div className={`rounded-md border p-4 ${result.evidenceAvailable ? evidenceClass : dangerClass}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileSearch aria-hidden="true" className="h-4 w-4" />
                  {result.evidenceAvailable ? 'Diagnostics remain reachable' : 'Worker-local evidence is at risk'}
                </div>
                <p className="mt-2 text-xs leading-5 opacity-80">
                  {result.evidenceAvailable
                    ? scenario.evidence
                    : 'The failed worker may hold the only container logs. Restore aggregation before treating retry success as sufficient incident evidence.'}
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-blue-500" />
                  Protections in this posture
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {result.protections.length > 0 ? result.protections.map((protection) => (
                    <li key={protection} className="flex gap-2">
                      <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{protection}</span>
                    </li>
                  )) : (
                    <li>No modeled recovery protection is enabled.</li>
                  )}
                </ul>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The timing model compares control choices only. Framework retry rules, heartbeat
              timeouts, state-store health, external side effects, and task idempotency determine
              the real recovery outcome.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RecoverySwitch({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {detail}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}

function RecoveryStage({
  number,
  title,
  detail,
  icon: Icon,
  last = false,
}: {
  number: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  last?: boolean;
}) {
  return (
    <div className={`relative min-w-0 p-5 ${last ? '' : 'border-b border-neutral-200 md:border-b-0 md:border-r dark:border-neutral-800'}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-500" />
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                {error ? 'Recovery lab unavailable' : 'Loading recovery scenarios'}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {error ?? 'Preparing component failures and ownership boundaries...'}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:hover:bg-neutral-950"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
const evidenceClass = 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50';
