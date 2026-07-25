'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck2,
  Fingerprint,
  History,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldAlert,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  Webhook,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/quantum-as-a-service-architecture-job-lifecycle-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/quantum-as-a-service-architecture/data/job-lifecycle-model.json';

type EvidenceContract = {
  id: string;
  label: string;
  detail: string;
  minimumShotCompletion: number;
  maximumCalibrationAgeMinutes: number;
  requiresExecutionManifest: boolean;
  requiresSignedEvidence: boolean;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  acceptedBeforeResponseLost: boolean;
  callbackDeliveries: number;
  completedShotRatio: number;
  calibrationAgeMinutes: number;
  resultChecksumMatches: boolean;
};

type RecoveryPolicy = {
  id: string;
  label: string;
  detail: string;
  usesStableIdempotencyKey: boolean;
  reconcilesProviderJob: boolean;
  deduplicatesCompletion: boolean;
  quarantinesContractFailure: boolean;
};

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  hasExecutionManifest: boolean;
  signed: boolean;
  capturesExactShots: boolean;
  checksResultDigest: boolean;
};

type JobLifecycleModel = {
  kind: 'qaas-job-lifecycle';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    contractId: string;
    scenarioId: string;
    recoveryId: string;
    evidenceId: string;
  };
  contracts: EvidenceContract[];
  scenarios: FailureScenario[];
  recoveryPolicies: RecoveryPolicy[];
  evidencePolicies: EvidencePolicy[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJobLifecycleModel(value: unknown): value is JobLifecycleModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'qaas-job-lifecycle'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.modelNote === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.contracts)
      && value.contracts.length >= 3
      && Array.isArray(value.scenarios)
      && value.scenarios.length >= 5
      && Array.isArray(value.recoveryPolicies)
      && value.recoveryPolicies.length >= 3
      && Array.isArray(value.evidencePolicies)
      && value.evidencePolicies.length >= 3,
  );
}

function scenarioIcon(id: string) {
  if (id === 'acceptance-timeout') return TimerOff;
  if (id === 'duplicate-callback') return Webhook;
  if (id === 'stale-calibration') return Clock3;
  if (id === 'partial-result') return History;
  if (id === 'corrupt-payload') return ShieldAlert;
  return CheckCircle2;
}

export default function QuantumJobLifecycleLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<JobLifecycleModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [contractId, setContractId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');

  function reset(nextModel: JobLifecycleModel) {
    setContractId(nextModel.defaults.contractId);
    setScenarioId(nextModel.defaults.scenarioId);
    setRecoveryId(nextModel.defaults.recoveryId);
    setEvidenceId(nextModel.defaults.evidenceId);
  }

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isJobLifecycleModel(payload)) {
          throw new Error('The job lifecycle model is incomplete.');
        }
        setModel(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the lifecycle model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!model) return null;
    const contract =
      model.contracts.find((candidate) => candidate.id === contractId)
      ?? model.contracts[0];
    const scenario =
      model.scenarios.find((candidate) => candidate.id === scenarioId)
      ?? model.scenarios[0];
    const recovery =
      model.recoveryPolicies.find((candidate) => candidate.id === recoveryId)
      ?? model.recoveryPolicies[0];
    const evidence =
      model.evidencePolicies.find((candidate) => candidate.id === evidenceId)
      ?? model.evidencePolicies[0];
    const duplicateExecution =
      scenario.acceptedBeforeResponseLost
      && !recovery.usesStableIdempotencyKey
      && !recovery.reconcilesProviderJob;
    const executionCount = duplicateExecution ? 2 : 1;
    const completionEffects = recovery.deduplicatesCompletion
      ? 1
      : scenario.callbackDeliveries;
    const shotEvidenceClear =
      scenario.completedShotRatio >= contract.minimumShotCompletion
      && (
        !contract.requiresExecutionManifest
        || evidence.capturesExactShots
      );
    const calibrationClear =
      scenario.calibrationAgeMinutes <= contract.maximumCalibrationAgeMinutes
      && (
        !contract.requiresExecutionManifest
        || evidence.hasExecutionManifest
      );
    const provenanceClear =
      !contract.requiresExecutionManifest || evidence.hasExecutionManifest;
    const signatureClear =
      !contract.requiresSignedEvidence || evidence.signed;
    const digestClear =
      scenario.resultChecksumMatches
      && (
        !contract.requiresExecutionManifest
        || evidence.checksResultDigest
      );
    const lifecycleClear =
      !duplicateExecution
      && completionEffects === 1;
    const blockers = [
      duplicateExecution
        ? 'The timeout creates a second provider job because the accepted request cannot be reconciled.'
        : null,
      completionEffects > 1
        ? 'The terminal callback applies the completion side effect more than once.'
        : null,
      !shotEvidenceClear
        ? `Only ${(scenario.completedShotRatio * 100).toFixed(0)}% of requested shots satisfy a ${(contract.minimumShotCompletion * 100).toFixed(0)}% contract.`
        : null,
      !calibrationClear
        ? `Calibration evidence is ${scenario.calibrationAgeMinutes} minutes old; this contract allows ${contract.maximumCalibrationAgeMinutes}.`
        : null,
      !provenanceClear
        ? 'The result lacks a versioned circuit, compiler, backend, calibration, and shot manifest.'
        : null,
      !signatureClear
        ? 'The controlled decision contract requires verifiable signed evidence.'
        : null,
      !digestClear
        ? scenario.resultChecksumMatches
          ? 'The evidence policy does not verify the result digest required by this contract.'
          : 'The returned result payload does not match its recorded digest.'
        : null,
    ].filter((item): item is string => Boolean(item));
    const accepted = blockers.length === 0;
    const quarantined = !accepted && recovery.quarantinesContractFailure;
    const tone = accepted ? 'emerald' : quarantined ? 'amber' : 'rose';
    const status = accepted
      ? 'Evidence accepted'
      : quarantined
        ? 'Quarantined for reconciliation'
        : 'Unsafe result path';
    const verdict = accepted
      ? 'One logical experiment produced one completion effect, and the evidence clears the selected acceptance contract.'
      : quarantined
        ? 'The workflow avoids treating this result as truth. Reconcile provider state, rerun under a fresh contract, or retain it only as labeled exploratory evidence.'
        : 'The policy can duplicate cost or downstream effects and still accept evidence that cannot support the selected decision.';
    const stages = [
      {
        label: 'Submit',
        detail: recovery.usesStableIdempotencyKey ? 'stable experiment key' : 'new key on retry',
        healthy: !duplicateExecution,
      },
      {
        label: 'Reconcile',
        detail: recovery.reconcilesProviderJob ? 'provider job resumed' : 'provider state unknown',
        healthy: !scenario.acceptedBeforeResponseLost || recovery.reconcilesProviderJob,
      },
      {
        label: 'Execute',
        detail: `${executionCount} physical ${executionCount === 1 ? 'job' : 'jobs'}`,
        healthy: executionCount === 1,
      },
      {
        label: 'Verify',
        detail: evidence.label,
        healthy:
          shotEvidenceClear
          && calibrationClear
          && provenanceClear
          && signatureClear
          && digestClear,
      },
      {
        label: 'Commit',
        detail: `${completionEffects} completion ${completionEffects === 1 ? 'effect' : 'effects'}`,
        healthy: completionEffects === 1 && accepted,
      },
    ];

    return {
      contract,
      scenario,
      recovery,
      evidence,
      executionCount,
      completionEffects,
      accepted,
      quarantined,
      blockers,
      stages,
      tone,
      status,
      verdict,
      calibrationClear,
      shotEvidenceClear,
      lifecycleClear,
    };
  }, [contractId, evidenceId, model, recoveryId, scenarioId]);

  if (!model || !view) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Job lifecycle and evidence lab"
            title="Recover the job without corrupting the experiment"
            description="Loading failure, recovery, and evidence policies."
            icon={Route}
            accent="cyan"
          />
          <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading lifecycle model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Job lifecycle and evidence lab"
          title={model.title}
          description={model.description}
          icon={Route}
          accent="cyan"
          onReset={() => reset(model)}
        />

        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Acceptance contract
                </legend>
                <div className="mt-3 space-y-2">
                  {model.contracts.map((contract) => (
                    <LabChoice
                      key={contract.id}
                      selected={contract.id === view.contract.id}
                      label={contract.label}
                      detail={contract.detail}
                      icon={contract.requiresSignedEvidence ? ShieldCheck : FileCheck2}
                      accent={contract.requiresSignedEvidence ? 'violet' : 'blue'}
                      onClick={() => setContractId(contract.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inject a failure
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((scenario) => {
                    const Icon = scenarioIcon(scenario.id);
                    return (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === view.scenario.id}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={Icon}
                        accent={scenario.id === 'healthy' ? 'emerald' : 'rose'}
                        onClick={() => setScenarioId(scenario.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite">
            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Recovery policy
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {model.recoveryPolicies.map((recovery) => (
                  <LabChoice
                    key={recovery.id}
                    selected={recovery.id === view.recovery.id}
                    label={recovery.label}
                    detail={recovery.detail}
                    icon={recovery.id === 'blind-resubmit' ? RefreshCw : Fingerprint}
                    accent={recovery.id === 'blind-resubmit' ? 'rose' : 'cyan'}
                    onClick={() => setRecoveryId(recovery.id)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Result evidence
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {model.evidencePolicies.map((evidence) => (
                  <LabChoice
                    key={evidence.id}
                    selected={evidence.id === view.evidence.id}
                    label={evidence.label}
                    detail={evidence.detail}
                    icon={evidence.signed ? BadgeCheck : FileCheck2}
                    accent={evidence.signed ? 'violet' : evidence.hasExecutionManifest ? 'blue' : 'amber'}
                    onClick={() => setEvidenceId(evidence.id)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                One logical experiment
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {view.stages.map((stage, index) => (
                  <div key={stage.label} className="relative min-w-0">
                    <div
                      className={`h-full min-h-24 rounded-md border p-3 ${
                        stage.healthy
                          ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
                          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase opacity-70">
                          {index + 1}
                        </span>
                        {stage.healthy ? (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <TriangleAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{stage.label}</p>
                      <p className="mt-1 break-words text-xs leading-5 opacity-75">
                        {stage.detail}
                      </p>
                    </div>
                    {index < view.stages.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="mx-auto block h-3 w-px bg-neutral-300 sm:absolute sm:-right-2 sm:top-1/2 sm:h-px sm:w-2 dark:bg-neutral-700"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Physical jobs"
                value={String(view.executionCount)}
                detail="For one logical experiment"
                icon={Copy}
                tone={view.executionCount === 1 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Completion effects"
                value={String(view.completionEffects)}
                detail="Downstream commits"
                icon={Webhook}
                tone={view.completionEffects === 1 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Shot evidence"
                value={`${(view.scenario.completedShotRatio * 100).toFixed(0)}%`}
                detail={`${(view.contract.minimumShotCompletion * 100).toFixed(0)}% required`}
                icon={FileCheck2}
                tone={view.shotEvidenceClear ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Calibration age"
                value={`${view.scenario.calibrationAgeMinutes} min`}
                detail={`${view.contract.maximumCalibrationAgeMinutes} min maximum`}
                icon={Clock3}
                tone={view.calibrationClear ? 'cyan' : 'rose'}
              />
            </div>

            <section
              className={`mt-6 rounded-md border p-4 ${
                view.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                  : view.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {view.accepted ? (
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                ) : view.quarantined ? (
                  <AlertTriangle aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="h-5 w-5" />
                )}
                <p className="text-sm font-semibold">{view.status}</p>
              </div>
              <p className="mt-3 text-sm leading-6">{view.verdict}</p>
              {view.blockers.length > 0 ? (
                <ul className="mt-4 space-y-2 border-t border-current/20 pt-4 text-sm">
                  {view.blockers.map((blocker) => (
                    <li key={blocker} className="flex gap-2">
                      <span aria-hidden="true">-</span>
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.modelNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
