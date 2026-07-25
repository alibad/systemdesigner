'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CloudOff,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  Route,
  ServerOff,
  ShieldCheck,
  TimerOff,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/sovereign-cloud-systems-recovery-portability-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/sovereign-cloud-systems/data/recovery-portability-model.json';

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  unavailableDependencies: string[];
  maximumRestoreHours: number;
  requiresIndependentRecovery: boolean;
  requiresExit: boolean;
};

type RecoveryPlan = {
  id: string;
  label: string;
  detail: string;
  dependencies: string[];
  restoreHours: number;
  localEmergencyCredentials: boolean;
  dualApproval: boolean;
  offlineRunbook: boolean;
  cleanEnvironment: boolean;
  evidenceArtifacts: string[];
};

type ExitPackage = {
  id: string;
  label: string;
  detail: string;
  portableCapabilities: string[];
  estimatedExitDays: number;
};

type RecoveryPortabilityModel = {
  kind: 'sovereign-recovery-portability';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    recoveryId: string;
    exitId: string;
  };
  scenarios: FailureScenario[];
  recoveryPlans: RecoveryPlan[];
  exitPackages: ExitPackage[];
  requiredExitCapabilities: string[];
  requiredRecoveryEvidence: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecoveryPortabilityModel(
  value: unknown,
): value is RecoveryPortabilityModel {
  if (
    !isRecord(value)
    || value.kind !== 'sovereign-recovery-portability'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.scenarioId !== 'string'
    || typeof value.defaults.recoveryId !== 'string'
    || typeof value.defaults.exitId !== 'string'
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 4
    || !Array.isArray(value.recoveryPlans)
    || value.recoveryPlans.length < 3
    || !Array.isArray(value.exitPackages)
    || value.exitPackages.length < 3
    || !isStringArray(value.requiredExitCapabilities)
    || value.requiredExitCapabilities.length < 6
    || !isStringArray(value.requiredRecoveryEvidence)
    || value.requiredRecoveryEvidence.length < 4
  ) {
    return false;
  }

  const validScenarios = value.scenarios.every((scenario) => (
    isRecord(scenario)
    && typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && isStringArray(scenario.unavailableDependencies)
    && typeof scenario.maximumRestoreHours === 'number'
    && typeof scenario.requiresIndependentRecovery === 'boolean'
    && typeof scenario.requiresExit === 'boolean'
  ));
  const validRecoveryPlans = value.recoveryPlans.every((plan) => (
    isRecord(plan)
    && typeof plan.id === 'string'
    && typeof plan.label === 'string'
    && typeof plan.detail === 'string'
    && isStringArray(plan.dependencies)
    && typeof plan.restoreHours === 'number'
    && typeof plan.localEmergencyCredentials === 'boolean'
    && typeof plan.dualApproval === 'boolean'
    && typeof plan.offlineRunbook === 'boolean'
    && typeof plan.cleanEnvironment === 'boolean'
    && isStringArray(plan.evidenceArtifacts)
  ));
  const validExitPackages = value.exitPackages.every((exitPackage) => (
    isRecord(exitPackage)
    && typeof exitPackage.id === 'string'
    && typeof exitPackage.label === 'string'
    && typeof exitPackage.detail === 'string'
    && isStringArray(exitPackage.portableCapabilities)
    && typeof exitPackage.estimatedExitDays === 'number'
  ));

  if (!validScenarios || !validRecoveryPlans || !validExitPackages) return false;

  const defaults = value.defaults as RecoveryPortabilityModel['defaults'];
  return (
    value.scenarios.some((item) => item.id === defaults.scenarioId)
    && value.recoveryPlans.some((item) => item.id === defaults.recoveryId)
    && value.exitPackages.some((item) => item.id === defaults.exitId)
  );
}

function scenarioIcon(id: string) {
  if (id === 'identity-isolation') return Fingerprint;
  if (id === 'key-control-isolation') return KeyRound;
  if (id === 'sovereign-zone-loss') return ServerOff;
  return CloudOff;
}

export default function SovereignCloudRecoveryPortabilityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RecoveryPortabilityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRecoveryPortabilityModel(payload)) {
          throw new Error('The recovery-portability contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the recovery contract.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Recovery and portability lab"
            title="Test recovery against the failed dependency"
            description="Loading dependency failures, break-glass plans, and exit packages."
            icon={LifeBuoy}
            accent="rose"
          />
          <LearningLabBody>
            <LoadState
              error={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <RecoveryPortabilityLab model={model} />
    </div>
  );
}

function RecoveryPortabilityLab({
  model,
}: {
  model: RecoveryPortabilityModel;
}) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [recoveryId, setRecoveryId] = useState(model.defaults.recoveryId);
  const [exitId, setExitId] = useState(model.defaults.exitId);

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const recovery = model.recoveryPlans.find((item) => item.id === recoveryId)
    ?? model.recoveryPlans[0];
  const exitPackage = model.exitPackages.find((item) => item.id === exitId)
    ?? model.exitPackages[0];

  const decision = useMemo(() => {
    const failedDependencies = recovery.dependencies.filter((dependency) =>
      scenario.unavailableDependencies.includes(dependency),
    );
    const missingEvidence = model.requiredRecoveryEvidence.filter(
      (artifact) => !recovery.evidenceArtifacts.includes(artifact),
    );
    const missingExitCapabilities = model.requiredExitCapabilities.filter(
      (capability) => !exitPackage.portableCapabilities.includes(capability),
    );
    const dependencyReady = failedDependencies.length === 0;
    const authorityReady =
      recovery.localEmergencyCredentials && recovery.dualApproval;
    const environmentReady =
      recovery.offlineRunbook && recovery.cleanEnvironment;
    const timingReady =
      dependencyReady && recovery.restoreHours <= scenario.maximumRestoreHours;
    const evidenceReady = missingEvidence.length === 0;
    const recoveryReady =
      dependencyReady
      && authorityReady
      && environmentReady
      && timingReady
      && evidenceReady;
    const exitReady = missingExitCapabilities.length === 0;
    const exitTimingReady =
      exitPackage.estimatedExitDays * 24 <= scenario.maximumRestoreHours;
    const overallReady =
      recoveryReady
      && (!scenario.requiresExit || (exitReady && exitTimingReady));

    const blockers = [
      failedDependencies.length > 0
        ? `Recovery still depends on failed services: ${failedDependencies.join(', ')}.`
        : null,
      !recovery.localEmergencyCredentials
        ? 'No provider-independent emergency credential can authorize recovery.'
        : null,
      !recovery.dualApproval
        ? 'Break glass has no second custodian or approval record.'
        : null,
      !recovery.offlineRunbook
        ? 'The recovery procedure is unavailable outside the normal control plane.'
        : null,
      !recovery.cleanEnvironment
        ? 'The plan restores into the affected environment instead of isolated clean capacity.'
        : null,
      dependencyReady && !timingReady
        ? `Modeled restore time is ${recovery.restoreHours} hours; the target is ${scenario.maximumRestoreHours}.`
        : null,
      missingEvidence.length > 0
        ? `Missing recovery evidence: ${missingEvidence.join(', ')}.`
        : null,
      scenario.requiresExit && !exitReady
        ? `Exit package lacks: ${missingExitCapabilities.join(', ')}.`
        : null,
      scenario.requiresExit && !exitTimingReady
        ? `Modeled exit is ${exitPackage.estimatedExitDays} days; the deadline is ${scenario.maximumRestoreHours / 24} days.`
        : null,
    ].filter((item): item is string => Boolean(item));

    const stages = [
      {
        label: 'Authorize',
        detail: authorityReady ? 'Two local custodians' : 'Authority unavailable or unilateral',
        ready: authorityReady,
      },
      {
        label: 'Unlock',
        detail: dependencyReady ? 'No failed dependency required' : 'Blocked by failed service',
        ready: dependencyReady,
      },
      {
        label: 'Restore',
        detail: environmentReady ? 'Offline runbook into clean capacity' : 'Affected environment reused',
        ready: environmentReady && timingReady,
      },
      {
        label: 'Prove',
        detail: `${recovery.evidenceArtifacts.length}/${model.requiredRecoveryEvidence.length} evidence artifacts`,
        ready: evidenceReady,
      },
      {
        label: 'Exit',
        detail: `${exitPackage.portableCapabilities.length}/${model.requiredExitCapabilities.length} portable capabilities`,
        ready: exitReady,
      },
    ];

    return {
      failedDependencies,
      missingEvidence,
      missingExitCapabilities,
      dependencyReady,
      authorityReady,
      environmentReady,
      timingReady,
      evidenceReady,
      recoveryReady,
      exitReady,
      exitTimingReady,
      overallReady,
      blockers,
      stages,
    };
  }, [exitPackage, model, recovery, scenario]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setRecoveryId(model.defaults.recoveryId);
    setExitId(model.defaults.exitId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Recovery and portability lab"
        title={model.title}
        description={model.description}
        icon={LifeBuoy}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a dependency failure
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => {
                  const Icon = scenarioIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Break-glass design
              </legend>
              <div className="mt-3 grid gap-2">
                {model.recoveryPlans.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === recovery.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.localEmergencyCredentials ? LockKeyhole : CloudOff}
                    accent={item.cleanEnvironment ? 'emerald' : item.localEmergencyCredentials ? 'amber' : 'rose'}
                    onClick={() => setRecoveryId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div aria-live="polite">
          <section>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              3. Exit package
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {model.exitPackages.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === exitPackage.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.id === 'rehearsed-alternate' ? Route : PackageCheck}
                  accent={item.id === 'rehearsed-alternate' ? 'violet' : 'blue'}
                  onClick={() => setExitId(item.id)}
                />
              ))}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Recovery"
              value={decision.recoveryReady ? 'Ready' : 'Blocked'}
              detail={
                decision.dependencyReady
                  ? 'The plan avoids the injected failed services.'
                  : `${decision.failedDependencies.length} failed dependency remains.`
              }
              icon={decision.recoveryReady ? ArchiveRestore : TimerOff}
              tone={decision.recoveryReady ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Restore estimate"
              value={`${recovery.restoreHours} hr`}
              detail={`${scenario.maximumRestoreHours} hr maximum for this scenario.`}
              icon={Clock3}
              tone={decision.timingReady ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Recovery evidence"
              value={`${recovery.evidenceArtifacts.length}/${model.requiredRecoveryEvidence.length}`}
              detail={
                decision.evidenceReady
                  ? 'Required artifacts are produced.'
                  : `${decision.missingEvidence.length} artifact types are missing.`
              }
              icon={FileCheck2}
              tone={decision.evidenceReady ? 'violet' : 'amber'}
            />
            <LabMetric
              label="Exit portability"
              value={`${exitPackage.portableCapabilities.length}/${model.requiredExitCapabilities.length}`}
              detail={`Modeled exit: ${exitPackage.estimatedExitDays} days.`}
              icon={Route}
              tone={decision.exitReady ? 'emerald' : 'amber'}
            />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Injected failure boundary
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {scenario.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Unavailable: {scenario.unavailableDependencies.join(', ')}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                {scenario.requiresExit ? 'Recovery plus exit' : 'Recovery drill'}
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {decision.stages.map((stage, index) => (
                <RecoveryStage
                  key={stage.label}
                  index={index}
                  label={stage.label}
                  detail={stage.detail}
                  ready={stage.ready}
                  last={index === decision.stages.length - 1}
                />
              ))}
            </div>
          </section>

          <section
            className={`mt-6 rounded-md border p-4 ${
              decision.overallReady
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {decision.overallReady ? (
                <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {decision.overallReady
                    ? 'The selected failure can be recovered inside the boundary'
                    : 'The selected plan does not survive this failure boundary'}
                </p>
                {decision.blockers.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm leading-6">
                    {decision.blockers.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-2">
                        <XCircle
                          aria-hidden="true"
                          className="mt-1 h-4 w-4 shrink-0"
                        />
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    Independent authority, clean restore capacity, recovery timing,
                    evidence, and any required exit path meet the selected scenario.
                  </p>
                )}
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReadinessFact
              icon={UserRoundCheck}
              label="Dual authority"
              ready={decision.authorityReady}
              detail={recovery.dualApproval ? 'Two custodians approve' : 'Single or provider authority'}
            />
            <ReadinessFact
              icon={ShieldCheck}
              label="Clean recovery"
              ready={decision.environmentReady}
              detail={recovery.cleanEnvironment ? 'Isolated restore target' : 'Affected environment reused'}
            />
            <ReadinessFact
              icon={FileCheck2}
              label="Evidence"
              ready={decision.evidenceReady}
              detail={decision.evidenceReady ? 'Complete recovery record' : `${decision.missingEvidence.length} missing types`}
            />
            <ReadinessFact
              icon={Route}
              label="Exit"
              ready={decision.exitReady && (!scenario.requiresExit || decision.exitTimingReady)}
              detail={decision.exitReady ? `${exitPackage.estimatedExitDays} day tested path` : `${decision.missingExitCapabilities.length} missing capabilities`}
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function RecoveryStage({
  index,
  label,
  detail,
  ready,
  last,
}: {
  index: number;
  label: string;
  detail: string;
  ready: boolean;
  last: boolean;
}) {
  return (
    <div className="relative min-w-0">
      <div
        className={`h-full min-h-28 rounded-md border p-3 ${
          ready
            ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
            : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase opacity-70">
            {index + 1}
          </span>
          {ready ? (
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <CircleAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
          )}
        </div>
        <p className="mt-2 text-sm font-semibold">{label}</p>
        <p className="mt-1 break-words text-xs leading-5 opacity-75">{detail}</p>
      </div>
      {!last ? (
        <span
          aria-hidden="true"
          className="mx-auto block h-3 w-px bg-neutral-300 sm:absolute sm:-right-2 sm:top-1/2 sm:h-px sm:w-2 dark:bg-neutral-700"
        />
      ) : null}
    </div>
  );
}

function ReadinessFact({
  icon: Icon,
  label,
  ready,
  detail,
}: {
  icon: typeof ShieldCheck;
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div
      className={`min-h-24 min-w-0 rounded-md border p-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-200">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {detail}
      </p>
    </div>
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
    <div className="flex min-h-[420px] items-center justify-center">
      {error ? (
        <div className="max-w-md text-center">
          <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Recovery data could not be loaded
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300" role="status">
          <LoaderCircle
            aria-hidden="true"
            className="h-5 w-5 animate-spin text-rose-500 motion-reduce:animate-none"
          />
          Loading recovery-portability contract...
        </div>
      )}
    </div>
  );
}
