'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileSearch,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  Trash2,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/oozie-recovery-rerun-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/oozie/data/recovery-rerun-model.json';

type RecoveryAction = {
  id: string;
  label: string;
  detail: string;
  command: string;
  replayScope: string;
  cleansCoordinatorOutputs: boolean;
  reevaluatesDependencies: boolean;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  evidence: string[];
  requiredActionId: string;
  requiresPatch: boolean;
  requiresIdempotency: boolean;
  requiresReconciliation: boolean;
  safeResult: string;
  unsafeResult: string;
};

type RecoveryModel = {
  kind: 'oozie-recovery-rerun';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    patchDeployed: boolean;
    idempotentWrites: boolean;
    reconciledOutputs: boolean;
    preserveCoordinatorOutputs: boolean;
  };
  actions: RecoveryAction[];
  scenarios: FailureScenario[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isRecoveryModel(value: unknown): value is RecoveryModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'oozie-recovery-rerun'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.actions)
      && value.actions.length >= 4
      && Array.isArray(value.scenarios)
      && value.scenarios.length >= 4
      && typeof value.notice === 'string',
  );
}

export default function OozieRecoveryRerunLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRecoveryModel(payload)) {
          throw new Error('The Oozie recovery model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load recovery data.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <RecoveryWorkbench model={model} />;
}

function RecoveryWorkbench({ model }: { model: RecoveryModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [actionId, setActionId] = useState(model.defaults.actionId);
  const [patchDeployed, setPatchDeployed] = useState(model.defaults.patchDeployed);
  const [idempotentWrites, setIdempotentWrites] = useState(
    model.defaults.idempotentWrites,
  );
  const [reconciledOutputs, setReconciledOutputs] = useState(
    model.defaults.reconciledOutputs,
  );
  const [preserveOutputs, setPreserveOutputs] = useState(
    model.defaults.preserveCoordinatorOutputs,
  );

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const action = model.actions.find((item) => item.id === actionId) ?? model.actions[0];

  const result = useMemo(() => {
    const actionMatches = action.id === scenario.requiredActionId;
    const patchReady = !scenario.requiresPatch || patchDeployed;
    const sideEffectsSafe = !scenario.requiresIdempotency || idempotentWrites;
    const stateKnown = !scenario.requiresReconciliation || reconciledOutputs;
    const safe = actionMatches && patchReady && sideEffectsSafe && stateKnown;
    const blockers: string[] = [];

    if (!actionMatches) blockers.push('the selected operation has the wrong replay scope');
    if (!patchReady) blockers.push('the deterministic defect has not been patched');
    if (!sideEffectsSafe) blockers.push('external writes lack an idempotency key');
    if (!stateKnown) blockers.push('the destination state has not been reconciled');

    const cleanup = action.cleansCoordinatorOutputs
      ? preserveOutputs
        ? 'Preserved with -nocleanup'
        : 'Deleted before rerun'
      : 'Not changed by this operation';
    const command =
      action.cleansCoordinatorOutputs && !preserveOutputs
        ? action.command.replace(' -nocleanup', '')
        : action.command;

    return {
      actionMatches,
      blockers,
      cleanup,
      command,
      patchReady,
      safe,
      sideEffectsSafe,
      stateKnown,
    };
  }, [
    action,
    idempotentWrites,
    patchDeployed,
    preserveOutputs,
    reconciledOutputs,
    scenario,
  ]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setActionId(model.defaults.actionId);
    setPatchDeployed(model.defaults.patchDeployed);
    setIdempotentWrites(model.defaults.idempotentWrites);
    setReconciledOutputs(model.defaults.reconciledOutputs);
    setPreserveOutputs(model.defaults.preserveCoordinatorOutputs);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure recovery lab"
          title={model.title}
          description={model.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Select an incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'late-input'
                        ? FileClock
                        : item.id === 'ambiguous-commit'
                          ? AlertTriangle
                          : Siren}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the replay boundary
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === action.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'coordinator-refresh'
                        ? RefreshCw
                        : item.id === 'reconcile-then-rerun'
                          ? FileSearch
                          : RotateCcw}
                      accent="blue"
                      onClick={() => setActionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Incident evidence
              </p>
              <h4 className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
                {scenario.symptom}
              </h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {scenario.evidence.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <FileSearch
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-neutral-500"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Replay scope"
                value={action.replayScope}
                detail={action.label}
                icon={RotateCcw}
                tone={result.actionMatches ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Dependency check"
                value={action.reevaluatesDependencies ? 'Refreshed' : 'Reused'}
                detail="Coordinator latest/future inputs"
                icon={RefreshCw}
                tone={action.reevaluatesDependencies ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Output cleanup"
                value={result.cleanup}
                detail="Coordinator output-event directories"
                icon={action.cleansCoordinatorOutputs ? Trash2 : PackageCheck}
                tone={action.cleansCoordinatorOutputs && !preserveOutputs ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Recovery gate"
                value={result.safe ? 'Ready' : 'Blocked'}
                detail={result.safe ? 'Required evidence and controls are present' : 'Resolve every blocker first'}
                icon={result.safe ? CheckCircle2 : AlertTriangle}
                tone={result.safe ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Establish rerun preconditions
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <GateToggle
                  enabled={patchDeployed}
                  label="Patched definition deployed"
                  detail="The deterministic workflow or action defect is fixed before replay."
                  onClick={() => setPatchDeployed((value) => !value)}
                />
                <GateToggle
                  enabled={idempotentWrites}
                  label="External writes are idempotent"
                  detail="The destination rejects duplicate business operation IDs."
                  onClick={() => setIdempotentWrites((value) => !value)}
                />
                <GateToggle
                  enabled={reconciledOutputs}
                  label="Destination state reconciled"
                  detail="Logs and target records establish whether the prior attempt committed."
                  onClick={() => setReconciledOutputs((value) => !value)}
                />
                <GateToggle
                  enabled={preserveOutputs}
                  label="Preserve output-event directories"
                  detail="Model -nocleanup; verify the rerun will not collide with partial output."
                  onClick={() => setPreserveOutputs((value) => !value)}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected command shape
                </p>
              </div>
              <pre className="overflow-x-auto bg-neutral-950 p-4 text-sm leading-6 text-neutral-100">
                <code>{result.command}</code>
              </pre>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.safe
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.safe ? (
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                  />
                ) : (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Recovery verdict
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.safe ? 'The rerun boundary is defensible' : 'Do not start this rerun yet'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.safe
                      ? scenario.safeResult
                      : `${scenario.unsafeResult} Blockers: ${result.blockers.join('; ')}.`}
                  </p>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <ClipboardCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function GateToggle({
  detail,
  enabled,
  label,
  onClick,
}: {
  detail: string;
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onClick}
      className={`min-h-24 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        enabled
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 shrink-0 ${enabled ? 'opacity-100' : 'opacity-30'}`}
        />
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure recovery lab"
          title="Choose the smallest safe replay boundary"
          description="Loading failure, evidence, and rerun scenarios."
          icon={Siren}
          accent="rose"
        />
        <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
            >
              {error} Retry
            </button>
          ) : (
            <>
              <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
              Loading recovery model...
            </>
          )}
        </div>
      </LearningLab>
    </div>
  );
}
