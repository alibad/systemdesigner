'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Siren,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Permission = {
  id: string;
  label: string;
  detail: string;
  rank: number;
};

type RecoveryPolicy = {
  id: 'stop-review' | 'bounded-retry' | 'continue';
  label: string;
  detail: string;
};

type FailureScenario = {
  id: string;
  label: string;
  brief: string;
  requiredPermissionRank: number;
  retrySafety: 'safe' | 'idempotency-required' | 'never';
  highImpact: boolean;
  hostileInstruction: boolean;
  failureStage: number;
  defaultPermissionId: string;
  defaultPolicyId: RecoveryPolicy['id'];
  defaultApproval: boolean;
  defaultIdempotency: boolean;
  safeAction: string;
  unsafeOutcome: string;
};

type RecoveryModel = {
  title: string;
  description: string;
  permissions: Permission[];
  policies: RecoveryPolicy[];
  stages: string[];
  scenarios: FailureScenario[];
};

type StageState = 'complete' | 'failed' | 'blocked' | 'recovered' | 'pending';

const BLOCK_ID = 'genai/ai-agents-permission-recovery-lab';

export default function AiAgentsPermissionRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RecoveryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No permission and recovery model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RecoveryModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the recovery model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <PermissionRecoveryLab data={data} />;
}

function PermissionRecoveryLab({ data }: { data: RecoveryModel }) {
  const initialScenario = data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario?.id ?? '');
  const [permissionId, setPermissionId] = useState(initialScenario?.defaultPermissionId ?? '');
  const [policyId, setPolicyId] = useState<RecoveryPolicy['id']>(
    initialScenario?.defaultPolicyId ?? 'stop-review',
  );
  const [approval, setApproval] = useState(initialScenario?.defaultApproval ?? false);
  const [idempotency, setIdempotency] = useState(
    initialScenario?.defaultIdempotency ?? false,
  );

  const scenario =
    data.scenarios.find((candidate) => candidate.id === scenarioId) ?? initialScenario;
  const permission =
    data.permissions.find((candidate) => candidate.id === permissionId) ?? data.permissions[0];
  const policy = data.policies.find((candidate) => candidate.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    if (!scenario || !permission || !policy) return null;

    const permissionEnough = permission.rank >= scenario.requiredPermissionRank;
    const excessivePermission = permission.rank > scenario.requiredPermissionRank;
    const approvalMissing = scenario.highImpact && !approval;
    const retrySafe =
      scenario.retrySafety === 'safe' ||
      (scenario.retrySafety === 'idempotency-required' && idempotency);
    const mustBlock = !permissionEnough || approvalMissing;
    const bypassedHostileInstruction = scenario.hostileInstruction && policy.id !== 'stop-review';

    let outcome = 'Escalated safely';
    let effects = '0 new effects';
    let risk = 'Low';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let explanation = scenario.safeAction;

    if (!permissionEnough) {
      outcome = 'Blocked by scope';
      explanation = 'The runtime denies the proposal before the tool receives credentials.';
    } else if (approvalMissing) {
      outcome = 'Approval required';
      explanation = 'The high-impact action remains pending until an authorized reviewer approves it.';
    } else if (policy.id === 'bounded-retry' && retrySafe && !scenario.hostileInstruction) {
      outcome = 'Recovered safely';
      effects = scenario.requiredPermissionRank > 0 ? '1 confirmed effect' : '0 external effects';
      explanation = scenario.safeAction;
    } else if (policy.id === 'bounded-retry') {
      outcome = 'Unsafe retry blocked';
      risk = 'High';
      tone = 'rose';
      explanation =
        scenario.retrySafety === 'idempotency-required' && !idempotency
          ? 'A mutation cannot be retried until one stable idempotency key can identify the original effect.'
          : 'This failure is not retryable. Preserve the trace and require a new decision.';
    } else if (policy.id === 'continue' || bypassedHostileInstruction) {
      outcome = 'Control bypass';
      effects = scenario.retrySafety === 'idempotency-required' ? 'Up to 2 effects' : 'Unbounded effect risk';
      risk = 'Critical';
      tone = 'rose';
      explanation = scenario.unsafeOutcome;
    } else if (excessivePermission) {
      outcome = 'Stopped, but over-privileged';
      risk = 'Moderate';
      tone = 'amber';
      explanation = `${scenario.safeAction} Reduce the run to the minimum permission needed before resuming.`;
    }

    const stages = data.stages.map((label, index): { label: string; state: StageState } => {
      if (index < scenario.failureStage) return { label, state: 'complete' };
      if (index === scenario.failureStage) return { label, state: 'failed' };
      if (mustBlock) return { label, state: 'blocked' };
      if (index === data.stages.length - 1 && outcome === 'Recovered safely') {
        return { label, state: 'recovered' };
      }
      if (tone === 'rose') return { label, state: 'failed' };
      if (policy.id === 'stop-review') return { label, state: 'pending' };
      return { label, state: 'complete' };
    });

    return {
      permissionEnough,
      excessivePermission,
      approvalMissing,
      retrySafe,
      outcome,
      effects,
      risk,
      tone,
      explanation,
      stages,
    };
  }, [approval, data.stages, idempotency, permission, policy, scenario]);

  if (!scenario || !permission || !policy || !result) {
    return <LabError detail="The recovery model has no usable scenario or control policy." />;
  }

  const chooseScenario = (nextScenario: FailureScenario) => {
    setScenarioId(nextScenario.id);
    setPermissionId(nextScenario.defaultPermissionId);
    setPolicyId(nextScenario.defaultPolicyId);
    setApproval(nextScenario.defaultApproval);
    setIdempotency(nextScenario.defaultIdempotency);
  };

  const reset = () => {
    if (!initialScenario) return;
    chooseScenario(initialScenario);
  };

  const StatusIcon = result.tone === 'emerald' ? CheckCircle2 : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Permission and recovery lab"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenario.id}
                      label={candidate.label}
                      detail={candidate.brief}
                      icon={Siren}
                      accent="rose"
                      onClick={() => chooseScenario(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Set delegated authority
                </legend>
                <div className="mt-3 space-y-2">
                  {data.permissions.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === permission.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={KeyRound}
                      accent="amber"
                      onClick={() => setPermissionId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose recovery behavior
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === policy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={RotateCcw}
                      accent="violet"
                      onClick={() => setPolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Attach mutation controls
                </legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice
                    selected={approval}
                    label="Approval required"
                    detail="A reviewer must approve the exact proposed effect."
                    icon={UserCheck}
                    accent="emerald"
                    onClick={() => setApproval(true)}
                  />
                  <LabChoice
                    selected={!approval}
                    label="No approval gate"
                    detail="The runtime may act immediately if its scope allows the call."
                    icon={Ban}
                    accent="rose"
                    onClick={() => setApproval(false)}
                  />
                  <LabChoice
                    selected={idempotency}
                    label="Stable idempotency key"
                    detail="Repeated delivery resolves to the original mutation."
                    icon={Fingerprint}
                    accent="cyan"
                    onClick={() => setIdempotency(true)}
                  />
                  <LabChoice
                    selected={!idempotency}
                    label="No duplicate-effect guard"
                    detail="A retry can be indistinguishable from a new action."
                    icon={TriangleAlert}
                    accent="rose"
                    onClick={() => setIdempotency(false)}
                  />
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Authorization"
                value={result.permissionEnough ? 'Scope allows' : 'Denied'}
                detail={
                  result.excessivePermission
                    ? 'The run holds more authority than this scenario requires.'
                    : result.approvalMissing
                      ? 'Permission exists, but high-impact approval is missing.'
                      : 'Permission matches or is narrower than the required effect.'
                }
                icon={KeyRound}
                tone={result.permissionEnough && !result.excessivePermission ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Run outcome"
                value={result.outcome}
                detail={result.retrySafe ? 'Selected retry controls can prove safety.' : 'Automatic retry is not proven safe.'}
                icon={StatusIcon}
                tone={result.tone}
              />
              <LabMetric
                label="External effects"
                value={result.effects}
                detail="Side effects count mutations, not read-only tool calls."
                icon={Fingerprint}
                tone={result.effects.startsWith('0') ? 'emerald' : result.tone}
              />
              <LabMetric
                label="Control risk"
                value={result.risk}
                detail={scenario.hostileInstruction ? 'This scenario contains an untrusted authority request.' : 'Risk reflects authority, retry, approval, and recovery choices.'}
                icon={ShieldCheck}
                tone={result.risk === 'Low' ? 'emerald' : result.risk === 'Moderate' ? 'amber' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Failure and recovery trace
              </p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {result.stages.map((stage, index) => (
                  <TraceStep
                    key={`${stage.label}-${index}`}
                    number={index + 1}
                    label={stage.label}
                    state={stage.state}
                  />
                ))}
              </ol>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                <StatusIcon aria-hidden="true" className="h-4 w-4" />
                Operational consequence
              </div>
              <p className="mt-2 text-sm leading-6">{result.explanation}</p>
              <p className="mt-3 border-t border-current/20 pt-3 text-sm leading-6">
                <strong>Safe recovery:</strong> {scenario.safeAction}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TraceStep({
  number,
  label,
  state,
}: {
  number: number;
  label: string;
  state: StageState;
}) {
  const classes: Record<StageState, string> = {
    complete:
      'border-emerald-200 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white',
    failed:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    blocked:
      'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
    recovered:
      'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
    pending:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  };

  return (
    <li className={`min-w-0 rounded-md border p-3 ${classes[state]}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-75">
        <span>Step {number}</span>
        <span>{state}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{label}</p>
    </li>
  );
}

function LabLoading() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[760px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading permission and recovery lab"
    />
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Permission and recovery lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
