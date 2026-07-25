'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Network,
  ShieldCheck,
  Siren,
  Undo2,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/autonomous-infrastructure-management-authority-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/autonomous-infrastructure-management/data/remediation-authority-model.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requiredAction: string;
  minimumEvidence: number;
  maximumAutomaticScope: number;
  impact: number;
  reversible: boolean;
};

type Action = {
  id: string;
  label: string;
  detail: string;
  scope: number;
  risk: number;
};

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  strength: number;
};

type AuthorityMode = {
  id: string;
  label: string;
  detail: string;
  maximumRisk: number;
  maximumScope: number;
  mayExecute: boolean;
};

type AuthorityModel = {
  kind: 'autonomous-remediation-authority';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    evidenceId: string;
    authorityId: string;
    rollbackReady: boolean;
    conflictLock: boolean;
  };
  scenarios: Scenario[];
  actions: Action[];
  evidencePolicies: EvidencePolicy[];
  authorityModes: AuthorityMode[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isAuthorityModel(value: unknown): value is AuthorityModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'autonomous-remediation-authority'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.modelNote === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.scenarios)
      && Array.isArray(value.actions)
      && Array.isArray(value.evidencePolicies)
      && Array.isArray(value.authorityModes),
  );
}

export default function AutonomousInfrastructureManagementCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AuthorityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [actionId, setActionId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [authorityId, setAuthorityId] = useState('');
  const [rollbackReady, setRollbackReady] = useState(false);
  const [conflictLock, setConflictLock] = useState(false);

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
        if (!isAuthorityModel(payload)) {
          throw new Error('The remediation authority model is incomplete.');
        }
        setModel(payload);
        setScenarioId(payload.defaults.scenarioId);
        setActionId(payload.defaults.actionId);
        setEvidenceId(payload.defaults.evidenceId);
        setAuthorityId(payload.defaults.authorityId);
        setRollbackReady(payload.defaults.rollbackReady);
        setConflictLock(payload.defaults.conflictLock);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the remediation authority model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario =
    model?.scenarios.find((item) => item.id === scenarioId) ?? model?.scenarios[0];
  const action = model?.actions.find((item) => item.id === actionId) ?? model?.actions[0];
  const evidence =
    model?.evidencePolicies.find((item) => item.id === evidenceId)
    ?? model?.evidencePolicies[0];
  const authority =
    model?.authorityModes.find((item) => item.id === authorityId)
    ?? model?.authorityModes[0];

  const result = useMemo(() => {
    if (!scenario || !action || !evidence || !authority) return null;

    const blockers = [
      action.id !== scenario.requiredAction
        ? `The proposed action does not address the modeled incident mechanism.`
        : null,
      evidence.strength < scenario.minimumEvidence
        ? 'The evidence policy is weaker than this incident requires.'
        : null,
      action.scope > scenario.maximumAutomaticScope
        ? scenario.maximumAutomaticScope === 0
          ? 'This scenario is outside automatic authority and requires an accountable human decision.'
          : `The ${action.scope}% action exceeds the ${scenario.maximumAutomaticScope}% automatic blast-radius limit.`
        : null,
      action.risk > authority.maximumRisk
        ? 'The action risk exceeds the selected authority mode.'
        : null,
      action.scope > authority.maximumScope
        ? 'The action scope exceeds the selected authority mode.'
        : null,
      authority.id === 'fleet-auto'
        ? 'Unbounded fleet authority has no independent containment boundary.'
        : null,
      scenario.reversible && !rollbackReady
        ? 'The recovery artifact is not ready before execution.'
        : null,
      !conflictLock
        ? 'Another controller can issue a competing action against the same target.'
        : null,
    ].filter((item): item is string => Boolean(item));

    const advisory = !authority.mayExecute;
    const decision = advisory
      ? 'Recommendation only'
      : blockers.length === 0
        ? 'Authorized'
        : scenario.maximumAutomaticScope === 0
          ? 'Human approval'
          : 'Blocked';

    return {
      advisory,
      blockers,
      decision,
      ready: !advisory && blockers.length === 0,
      risk: Math.max(action.risk, scenario.impact),
    };
  }, [action, authority, conflictLock, evidence, rollbackReady, scenario]);

  if (!model || !scenario || !action || !evidence || !authority || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Autonomy authority lab"
            title="Bind remediation to evidence and authority"
            description="Loading incidents, actions, evidence policies, and execution boundaries."
            icon={ShieldCheck}
            accent="cyan"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading authority model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setScenarioId(model.defaults.scenarioId);
    setActionId(model.defaults.actionId);
    setEvidenceId(model.defaults.evidenceId);
    setAuthorityId(model.defaults.authorityId);
    setRollbackReady(model.defaults.rollbackReady);
    setConflictLock(model.defaults.conflictLock);
  };
  const OutcomeIcon = result.ready
    ? CheckCircle2
    : result.advisory
      ? Users
      : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Autonomy authority lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Observed incident
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'bad-rollout' ? Activity : item.impact >= 5 ? Siren : Gauge}
                      accent={item.impact >= 5 ? 'rose' : item.impact >= 2 ? 'amber' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Authority mode
                </legend>
                <div className="mt-3 space-y-2">
                  {model.authorityModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === authority.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.mayExecute ? KeyRound : Users}
                      accent={item.id === 'fleet-auto' ? 'rose' : item.mayExecute ? 'violet' : 'blue'}
                      onClick={() => setAuthorityId(item.id)}
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
                3. Proposed production action
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {model.actions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === action.id}
                    label={item.label}
                    detail={`${item.detail} Modeled scope: ${item.scope}%.`}
                    icon={item.id === 'rollback-release' ? Undo2 : item.scope >= 100 ? Network : Wrench}
                    accent={item.risk >= 5 ? 'rose' : item.risk >= 2 ? 'amber' : 'cyan'}
                    onClick={() => setActionId(item.id)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Evidence policy
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {model.evidencePolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === evidence.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'control-comparison' ? Activity : Gauge}
                    accent={item.strength >= 4 ? 'emerald' : item.strength >= 3 ? 'blue' : 'amber'}
                    onClick={() => setEvidenceId(item.id)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-3 md:grid-cols-2">
              <PolicyToggle
                checked={rollbackReady}
                label="Tested rollback is ready"
                detail="The previous artifact and reversal procedure are available before the action."
                icon={Undo2}
                onChange={setRollbackReady}
              />
              <PolicyToggle
                checked={conflictLock}
                label="Target conflict lock"
                detail="Only one controller owns the resource mutation at a time."
                icon={LockKeyhole}
                onChange={setConflictLock}
              />
            </section>

            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Authority decision"
                value={result.decision}
                detail={authority.label}
                icon={ShieldCheck}
                tone={result.ready ? 'emerald' : result.advisory ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Blast radius"
                value={`${action.scope}%`}
                detail={`Scenario permits ${scenario.maximumAutomaticScope}% automatically`}
                icon={Network}
                tone={action.scope <= scenario.maximumAutomaticScope ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Evidence"
                value={`${evidence.strength}/${scenario.minimumEvidence}`}
                detail="Selected strength / incident minimum"
                icon={Gauge}
                tone={evidence.strength >= scenario.minimumEvidence ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Modeled risk"
                value={`${result.risk}/5`}
                detail={scenario.reversible ? 'Reversible incident path' : 'Irreversible or ambiguous path'}
                icon={Siren}
                tone={result.risk >= 5 ? 'rose' : result.risk >= 3 ? 'amber' : 'violet'}
              />
            </div>

            <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Decision path
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
                <Boundary label="Observe" detail={evidence.label} tone="blue" />
                <span className="hidden text-neutral-400 sm:block">→</span>
                <Boundary label="Authorize" detail={authority.label} tone="violet" />
                <span className="hidden text-neutral-400 sm:block">→</span>
                <Boundary label="Act" detail={action.label} tone="amber" />
                <span className="hidden text-neutral-400 sm:block">→</span>
                <Boundary label="Verify" detail="Service outcome" tone="emerald" />
              </div>
            </section>

            <section
              className={`mt-6 rounded-md border p-4 ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : result.advisory
                    ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.ready
                      ? 'The action is inside the selected automatic authority'
                      : result.advisory
                        ? 'The controller may recommend, but it may not mutate production'
                        : 'The controller must stop before execution'}
                  </p>
                  {result.blockers.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
                      {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      The execution still needs a stable action identity, bounded concurrency,
                      fresh verification, an audit record, and escalation on an unknown result.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.modelNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PolicyToggle({
  checked,
  label,
  detail,
  icon: Icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  icon: LucideIcon;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
        checked
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
      />
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
      </span>
    </label>
  );
}

function Boundary({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'blue' | 'violet' | 'amber' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  } as const;
  return (
    <div className={`rounded-md border p-3 text-center ${styles[tone]}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}
