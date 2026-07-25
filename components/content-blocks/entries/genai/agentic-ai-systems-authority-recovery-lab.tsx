'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  Siren,
  Undo2,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type IncidentKind = 'ambiguous-commit' | 'duplicate' | 'injection';
type Tone = 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'neutral';

interface Tool {
  id: string;
  label: string;
  detail: string;
  requiredPermissionRank: number;
  mutation: boolean;
  highImpact: boolean;
  exposureUnits: number;
  compensatable: boolean;
}

interface Permission {
  id: string;
  label: string;
  detail: string;
  rank: number;
  scopeMultiplier: number;
}

interface Approval {
  id: string;
  label: string;
  detail: string;
  level: number;
}

interface RetryPolicy {
  id: string;
  label: string;
  detail: string;
  attempts: number;
  usesStableKey: boolean;
}

interface RecoveryPolicy {
  id: string;
  label: string;
  detail: string;
  checkpoint: boolean;
  compensate: boolean;
}

interface Incident {
  id: string;
  label: string;
  detail: string;
  kind: IncidentKind;
}

interface AuthorityLabData {
  title: string;
  description: string;
  defaults: {
    selectedToolIds: string[];
    permissionId: string;
    approvalId: string;
    retryId: string;
    recoveryId: string;
    incidentId: string;
  };
  tools: Tool[];
  permissions: Permission[];
  approvals: Approval[];
  retryPolicies: RetryPolicy[];
  recoveries: RecoveryPolicy[];
  incidents: Incident[];
}

const BLOCK_ID = 'genai/agentic-ai-systems-authority-recovery-lab';

function isAuthorityLabData(value: unknown): value is AuthorityLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthorityLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.tools)
      && candidate.tools.length > 0
      && Array.isArray(candidate.permissions)
      && candidate.permissions.length > 0
      && Array.isArray(candidate.approvals)
      && candidate.approvals.length > 0
      && Array.isArray(candidate.retryPolicies)
      && candidate.retryPolicies.length > 0
      && Array.isArray(candidate.recoveries)
      && candidate.recoveries.length > 0
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0,
  );
}

export default function AgenticAiSystemsAuthorityRecoveryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AuthorityLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No authority and recovery model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAuthorityLabData(payload)) {
          throw new Error('Authority and recovery data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load authority data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return <LabState title="Authority model unavailable" detail={loadError} tone="rose" />;
  }
  if (!data) {
    return (
      <LabState
        title="Loading authority model"
        detail="Preparing tools, permissions, incidents, and recovery controls..."
        tone="neutral"
      />
    );
  }

  return <AuthorityRecoveryLab data={data} />;
}

function AuthorityRecoveryLab({ data }: { data: AuthorityLabData }) {
  const [selectedToolIds, setSelectedToolIds] = useState(data.defaults.selectedToolIds);
  const [permissionId, setPermissionId] = useState(data.defaults.permissionId);
  const [approvalId, setApprovalId] = useState(data.defaults.approvalId);
  const [retryId, setRetryId] = useState(data.defaults.retryId);
  const [recoveryId, setRecoveryId] = useState(data.defaults.recoveryId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);

  const permission =
    data.permissions.find((item) => item.id === permissionId) ?? data.permissions[0];
  const approval = data.approvals.find((item) => item.id === approvalId) ?? data.approvals[0];
  const retry =
    data.retryPolicies.find((item) => item.id === retryId) ?? data.retryPolicies[0];
  const recovery =
    data.recoveries.find((item) => item.id === recoveryId) ?? data.recoveries[0];
  const incident =
    data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const selectedTools = data.tools.filter((tool) => selectedToolIds.includes(tool.id));

  const result = useMemo(
    () => evaluateConfiguration(selectedTools, permission, approval, retry, recovery, incident),
    [approval, incident, permission, recovery, retry, selectedTools],
  );

  const toggleTool = (toolId: string) => {
    setSelectedToolIds((current) =>
      current.includes(toolId)
        ? current.filter((candidate) => candidate !== toolId)
        : [...current, toolId],
    );
  };

  const reset = () => {
    setSelectedToolIds(data.defaults.selectedToolIds);
    setPermissionId(data.defaults.permissionId);
    setApprovalId(data.defaults.approvalId);
    setRetryId(data.defaults.retryId);
    setRecoveryId(data.defaults.recoveryId);
    setIncidentId(data.defaults.incidentId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Authority and recovery lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Inject an incident"
                items={data.incidents}
                selectedId={incident.id}
                icon={Siren}
                accent="rose"
                onChoose={setIncidentId}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Assign tools
                </legend>
                <div className="mt-3 space-y-2">
                  {data.tools.map((tool) => {
                    const selected = selectedToolIds.includes(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                          selected
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100'
                            : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTool(tool.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-cyan-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{tool.label}</span>
                          <span className="mt-1 block text-xs leading-5 opacity-75">
                            {tool.detail}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <ChoiceGroup
                legend="3. Set credential scope"
                items={data.permissions}
                selectedId={permission.id}
                icon={KeyRound}
                accent="amber"
                onChoose={setPermissionId}
              />
              <ChoiceGroup
                legend="4. Set approval level"
                items={data.approvals}
                selectedId={approval.id}
                icon={LockKeyhole}
                accent="emerald"
                onChoose={setApprovalId}
              />
              <ChoiceGroup
                legend="5. Set retry policy"
                items={data.retryPolicies}
                selectedId={retry.id}
                icon={RotateCcw}
                accent="violet"
                onChoose={setRetryId}
              />
              <ChoiceGroup
                legend="6. Set recovery behavior"
                items={data.recoveries}
                selectedId={recovery.id}
                icon={LifeBuoy}
                accent="cyan"
                onChoose={setRecoveryId}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0 space-y-5">
            <section className={`rounded-md border p-5 ${toneClasses[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Release decision</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.decision}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.decisionDetail}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled blast radius"
                value={
                  result.affectedObjects === 0
                    ? '0 objects'
                    : `Up to ${result.affectedObjects} objects`
                }
                detail={`${permission.label}; scenario-local count.`}
                icon={ShieldAlert}
                tone={result.affectedObjects === 0 ? 'emerald' : result.tone}
              />
              <LabMetric
                label="Repeated side effects"
                value={`${result.repeatedEffects}`}
                detail={`${result.totalEffects} total modeled external effect units.`}
                icon={Fingerprint}
                tone={result.repeatedEffects === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Recoverability"
                value={result.recoverability}
                detail={result.recoveryDetail}
                icon={Undo2}
                tone={result.recoveryTone}
              />
              <LabMetric
                label="Failed gates"
                value={`${result.failedChecks.length} / ${result.checks.length}`}
                detail="Independent release controls do not average into one score."
                icon={BadgeCheck}
                tone={result.failedChecks.length === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <Wrench
                  aria-hidden="true"
                  className="h-4 w-4 text-cyan-600 dark:text-cyan-300"
                />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Effective authority
                </h4>
              </div>
              {selectedTools.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  No tools are assigned, so the requested workflow cannot operate.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedTools.map((tool) => {
                    const accessible = permission.rank >= tool.requiredPermissionRank;
                    return (
                      <li
                        key={tool.id}
                        className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {tool.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                              {tool.mutation ? 'External mutation' : 'Read-only'};{' '}
                              {tool.compensatable ? 'compensatable' : 'not compensatable'}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                              accessible
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                            }`}
                          >
                            {accessible ? 'Reachable' : 'Denied'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                Release evidence gates
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {result.checks.map((check) => (
                  <div
                    key={check.label}
                    className={`rounded-md border p-4 ${
                      check.passed ? toneClasses.emerald : toneClasses.rose
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {check.passed ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0"
                        />
                      ) : (
                        <Ban aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">{check.label}</p>
                        <p className="mt-1 text-xs leading-5 opacity-75">{check.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`rounded-md border p-4 ${toneClasses[result.consequenceTone]}`}>
              <div className="flex items-start gap-3">
                <Siren aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Incident consequence
                  </p>
                  <p className="mt-2 text-sm leading-6">{result.consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function evaluateConfiguration(
  selectedTools: Tool[],
  permission: Permission,
  approval: Approval,
  retry: RetryPolicy,
  recovery: RecoveryPolicy,
  incident: Incident,
) {
  const reachableTools = selectedTools.filter(
    (tool) => permission.rank >= tool.requiredPermissionRank,
  );
  const unreachableTools = selectedTools.filter(
    (tool) => permission.rank < tool.requiredPermissionRank,
  );
  const mutations = reachableTools.filter((tool) => tool.mutation);
  const maxRequiredRank = selectedTools.reduce(
    (maximum, tool) => Math.max(maximum, tool.requiredPermissionRank),
    0,
  );
  const authorityComplete = selectedTools.length > 0 && unreachableTools.length === 0;
  const leastAuthority =
    authorityComplete && permission.rank === Math.max(1, maxRequiredRank);
  const highImpactCovered = mutations.every((tool) => !tool.highImpact || approval.level >= 1);
  const retrySafe =
    mutations.length === 0 || retry.usesStableKey || retry.id === 'no-retry';
  const durableRecovery = recovery.checkpoint;

  const injectionTarget = [...mutations].sort(
    (left, right) => right.exposureUnits - left.exposureUnits,
  )[0];
  const injectionApprovalCatches = injectionTarget
    ? approval.level >= 2 || (injectionTarget.highImpact && approval.level >= 1)
    : true;
  const injectionContained = incident.kind !== 'injection' || injectionApprovalCatches;

  const baseExposure = mutations.reduce((total, tool) => total + tool.exposureUnits, 0);
  let deliveries = 1;
  let uniqueEffectMultiplier = 1;

  if (incident.kind === 'ambiguous-commit') {
    deliveries = retry.attempts;
    uniqueEffectMultiplier = retry.usesStableKey ? 1 : retry.attempts;
  } else if (incident.kind === 'duplicate') {
    deliveries = Math.max(2, retry.attempts);
    uniqueEffectMultiplier = retry.usesStableKey ? 1 : deliveries;
  }

  let totalEffects = baseExposure * permission.scopeMultiplier * uniqueEffectMultiplier;
  let repeatedEffects =
    baseExposure * permission.scopeMultiplier * Math.max(0, uniqueEffectMultiplier - 1);
  let affectedObjects = totalEffects;

  if (incident.kind === 'injection') {
    if (!injectionTarget || injectionApprovalCatches) {
      totalEffects = 0;
      repeatedEffects = 0;
      affectedObjects = 0;
    } else {
      totalEffects = injectionTarget.exposureUnits * permission.scopeMultiplier;
      repeatedEffects = 0;
      affectedObjects = totalEffects;
    }
  }

  const nonCompensatableEffect =
    totalEffects > 0 && mutations.some((tool) => !tool.compensatable);
  let recoverability = 'Poor';
  let recoveryDetail = 'No durable record proves what executed.';
  let recoveryTone: Tone = 'rose';

  if (totalEffects === 0) {
    recoverability = 'Contained';
    recoveryDetail = 'The incident is stopped before an external effect.';
    recoveryTone = 'emerald';
  } else if (recovery.checkpoint && repeatedEffects === 0) {
    recoverability = 'Full';
    recoveryDetail = 'Operation identity supports reconciliation to authoritative state.';
    recoveryTone = 'emerald';
  } else if (recovery.checkpoint && recovery.compensate && !nonCompensatableEffect) {
    recoverability = 'Compensatable';
    recoveryDetail = 'Duplicate supported effects can be found and reversed through audit.';
    recoveryTone = 'cyan';
  } else if (recovery.checkpoint) {
    recoverability = 'Partial';
    recoveryDetail = nonCompensatableEffect
      ? 'The trace is durable, but at least one side effect has no reliable compensation.'
      : 'The trace supports diagnosis, but repeated effects still need manual repair.';
    recoveryTone = 'amber';
  }

  const checks = [
    {
      label: 'Usable tool contract',
      passed: authorityComplete,
      detail:
        selectedTools.length === 0
          ? 'Assign the minimum tools needed for the workflow.'
          : unreachableTools.length === 0
            ? 'Every assigned tool is reachable under the selected credential.'
            : `${unreachableTools.length} assigned tool${unreachableTools.length === 1 ? '' : 's'} cannot execute under this credential.`,
    },
    {
      label: 'Least authority',
      passed: leastAuthority,
      detail: leastAuthority
        ? 'Credential rank matches the most privileged required tool.'
        : 'The credential is either insufficient or broader than the selected tools require.',
    },
    {
      label: 'Approval boundary',
      passed: highImpactCovered,
      detail: highImpactCovered
        ? 'Every reachable high-impact mutation pauses for exact-argument review.'
        : 'At least one high-impact mutation can execute without review.',
    },
    {
      label: 'Replay safety',
      passed: retrySafe,
      detail: retrySafe
        ? 'The runtime either stops to reconcile or reuses one stable operation key.'
        : `${deliveries} deliveries can become distinct external effects.`,
    },
    {
      label: 'Durable recovery',
      passed: durableRecovery,
      detail: durableRecovery
        ? 'Checkpointed operation IDs survive worker and process failure.'
        : 'Process memory cannot support reliable reconciliation.',
    },
    {
      label: 'Injected action containment',
      passed: injectionContained,
      detail: injectionContained
        ? 'The malicious output cannot directly trigger the reachable mutation.'
        : 'The broadest reachable mutation can execute from untrusted tool text.',
    },
  ];
  const failedChecks = checks.filter((check) => !check.passed);

  const decision =
    failedChecks.length === 0
      ? 'Eligible for a bounded canary'
      : failedChecks.length <= 2
        ? 'Hold and repair failed controls'
        : 'Block release';
  const tone: Tone =
    failedChecks.length === 0 ? 'emerald' : failedChecks.length <= 2 ? 'amber' : 'rose';
  const decisionDetail =
    failedChecks.length === 0
      ? 'Independent authority, approval, replay, recovery, and incident gates pass. Keep exposure small and verify production traces.'
      : `${failedChecks.length} of ${checks.length} required gates fail. A small modeled blast radius cannot excuse a missing boundary.`;

  let consequence =
    'The incident does not reach an external mutation because no mutation tool is both selected and reachable.';
  let consequenceTone: Tone = 'emerald';

  if (incident.kind === 'injection' && injectionTarget) {
    if (injectionApprovalCatches) {
      consequence = `The injected request targets "${injectionTarget.label}", but the runtime pauses on canonical call details before credentials are used. Reject the call and quarantine the result.`;
      consequenceTone = 'amber';
    } else {
      consequence = `The injected request can execute "${injectionTarget.label}" across up to ${affectedObjects} modeled objects because tool output is allowed to drive an ungated mutation.`;
      consequenceTone = 'rose';
    }
  } else if (baseExposure > 0 && incident.kind === 'ambiguous-commit') {
    consequence =
      repeatedEffects === 0
        ? 'The acknowledgement is lost, but one operation identity lets recovery reconcile the committed effect before any replay.'
        : `Blind replay can create ${repeatedEffects} repeated side-effect units after the first acknowledgement is lost.`;
    consequenceTone = repeatedEffects === 0 ? 'emerald' : 'rose';
  } else if (baseExposure > 0 && incident.kind === 'duplicate') {
    consequence =
      repeatedEffects === 0
        ? 'Duplicate job delivery resolves to the original operation, so only one logical mutation remains.'
        : `${deliveries} deliveries can create ${repeatedEffects} repeated side-effect units without a stable operation key.`;
    consequenceTone = repeatedEffects === 0 ? 'emerald' : 'rose';
  }

  return {
    affectedObjects,
    checks,
    consequence,
    consequenceTone,
    decision,
    decisionDetail,
    failedChecks,
    recoverability,
    recoveryDetail,
    recoveryTone,
    repeatedEffects,
    tone,
    totalEffects,
  };
}

function ChoiceGroup({
  legend,
  items,
  selectedId,
  icon,
  accent,
  onChoose,
}: {
  legend: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: typeof Siren;
  accent: 'rose' | 'amber' | 'emerald' | 'violet' | 'cyan';
  onChoose: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onChoose(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function LabState({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: 'neutral' | 'rose';
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            role="status"
            className={`flex items-start gap-3 rounded-md border p-4 ${toneClasses[tone]}`}
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-6 opacity-75">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  amber:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
  violet:
    'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
  neutral:
    'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
};
