'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileClock,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Radar,
  RotateCw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Siren,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

interface ContainmentScope {
  id: string;
  label: string;
  detail: string;
  rank: number;
  availabilityCost: string;
  actions: string[];
}

interface RecoveryPlan {
  id: string;
  label: string;
  detail: string;
  preservesEvidence: boolean;
  reconcilesEffects: boolean;
  rotatesCredentials: boolean;
  usesCleanContext: boolean;
  canary: boolean;
}

interface IncidentScenario {
  id: string;
  label: string;
  brief: string;
  signal: string;
  requiredScopeRank: number;
  baseExposedRuns: number;
  persistentContext: boolean;
  liveCredentials: boolean;
  ambiguousEffects: boolean;
  recommendedScopeId: string;
  recommendedRecoveryId: string;
  containmentReason: string;
  recoveryReason: string;
  userConsequence: string;
}

interface ContainmentResponseData {
  title: string;
  description: string;
  defaultIncidentId: string;
  defaultScopeId: string;
  defaultRecoveryId: string;
  containmentScopes: ContainmentScope[];
  recoveryPlans: RecoveryPlan[];
  incidents: IncidentScenario[];
}

type ResultTone = 'emerald' | 'amber' | 'rose';
type PhaseState = 'complete' | 'incomplete' | 'blocked';

const BLOCK_ID = 'genai/agentic-ai-security-containment-response-lab';

const incidentIcons: Record<string, LucideIcon> = {
  'poisoned-payables-memory': FileClock,
  'webhook-exfiltration': ShieldAlert,
  'runaway-deployer': RotateCw,
  'rogue-coordinator': Siren,
};

function isContainmentResponseData(value: unknown): value is ContainmentResponseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContainmentResponseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultIncidentId
      && candidate.defaultScopeId
      && candidate.defaultRecoveryId
      && Array.isArray(candidate.containmentScopes)
      && candidate.containmentScopes.length > 0
      && candidate.containmentScopes.every((scope) => (
        typeof scope.id === 'string'
        && typeof scope.label === 'string'
        && typeof scope.detail === 'string'
        && typeof scope.rank === 'number'
        && typeof scope.availabilityCost === 'string'
        && Array.isArray(scope.actions)
        && scope.actions.every((action) => typeof action === 'string')
      ))
      && Array.isArray(candidate.recoveryPlans)
      && candidate.recoveryPlans.length > 0
      && candidate.recoveryPlans.every((plan) => (
        typeof plan.id === 'string'
        && typeof plan.label === 'string'
        && typeof plan.detail === 'string'
        && typeof plan.preservesEvidence === 'boolean'
        && typeof plan.reconcilesEffects === 'boolean'
        && typeof plan.rotatesCredentials === 'boolean'
        && typeof plan.usesCleanContext === 'boolean'
        && typeof plan.canary === 'boolean'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.brief === 'string'
        && typeof incident.signal === 'string'
        && typeof incident.requiredScopeRank === 'number'
        && typeof incident.baseExposedRuns === 'number'
        && typeof incident.persistentContext === 'boolean'
        && typeof incident.liveCredentials === 'boolean'
        && typeof incident.ambiguousEffects === 'boolean'
        && typeof incident.recommendedScopeId === 'string'
        && typeof incident.recommendedRecoveryId === 'string'
        && typeof incident.containmentReason === 'string'
        && typeof incident.recoveryReason === 'string'
        && typeof incident.userConsequence === 'string'
      )),
  );
}

export default function AgenticAiSecurityContainmentResponseLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ContainmentResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No containment and recovery scenario file was supplied.');
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
        if (!isContainmentResponseData(payload)) {
          throw new Error('Containment and recovery data is incomplete.');
        }
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
  return <ContainmentResponseLab data={data} />;
}

function ContainmentResponseLab({ data }: { data: ContainmentResponseData }) {
  const initialIncident = data.incidents.find((item) => item.id === data.defaultIncidentId)
    ?? data.incidents[0];
  const initialScope = data.containmentScopes.find((item) => item.id === data.defaultScopeId)
    ?? data.containmentScopes[0];
  const initialRecovery = data.recoveryPlans.find((item) => item.id === data.defaultRecoveryId)
    ?? data.recoveryPlans[0];
  const [incidentId, setIncidentId] = useState(initialIncident.id);
  const [scopeId, setScopeId] = useState(initialScope.id);
  const [recoveryId, setRecoveryId] = useState(initialRecovery.id);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const scope = data.containmentScopes.find((item) => item.id === scopeId) ?? data.containmentScopes[0];
  const recovery = data.recoveryPlans.find((item) => item.id === recoveryId) ?? data.recoveryPlans[0];

  const result = useMemo(() => {
    const scopeFits = scope.rank >= incident.requiredScopeRank;
    const overbroad = scope.rank > incident.requiredScopeRank;
    const missingRecovery: string[] = [];
    if (!recovery.preservesEvidence) missingRecovery.push('preserve trajectory evidence');
    if (incident.ambiguousEffects && !recovery.reconcilesEffects) {
      missingRecovery.push('reconcile external effects');
    }
    if (incident.liveCredentials && !recovery.rotatesCredentials) {
      missingRecovery.push('rotate delegated credentials');
    }
    if (incident.persistentContext && !recovery.usesCleanContext) {
      missingRecovery.push('remove poisoned persistent context');
    }
    if (!recovery.canary) missingRecovery.push('verify a bounded canary');

    const recoveryReady = missingRecovery.length === 0;
    const continuingRuns = scopeFits
      ? 0
      : Math.max(1, Math.ceil(
        incident.baseExposedRuns
          * ((incident.requiredScopeRank - scope.rank + 1) / incident.requiredScopeRank),
      ));

    let title = 'Controlled recovery';
    let tone: ResultTone = 'emerald';
    if (!scopeFits) {
      title = 'Containment is too narrow';
      tone = 'rose';
    } else if (!recoveryReady) {
      title = 'Recovery gate is incomplete';
      tone = 'amber';
    } else if (overbroad) {
      title = 'Safe, but broader than necessary';
      tone = 'amber';
    }

    const phases: Array<{
      id: string;
      label: string;
      detail: string;
      state: PhaseState;
      icon: LucideIcon;
    }> = [
      {
        id: 'detect',
        label: 'Detect',
        detail: incident.signal,
        state: 'complete',
        icon: Radar,
      },
      {
        id: 'contain',
        label: 'Contain',
        detail: scopeFits
          ? `${scope.label} stops every active path in the modeled boundary.`
          : `${continuingRuns} sibling or shared run${continuingRuns === 1 ? '' : 's'} remain exposed.`,
        state: scopeFits ? 'complete' : 'blocked',
        icon: LockKeyhole,
      },
      {
        id: 'investigate',
        label: 'Reconcile',
        detail: recovery.preservesEvidence && (!incident.ambiguousEffects || recovery.reconcilesEffects)
          ? 'Trajectory evidence and external effects can be joined into one incident record.'
          : 'The response cannot reliably attribute or reconcile the real-world effects.',
        state: recovery.preservesEvidence && (!incident.ambiguousEffects || recovery.reconcilesEffects)
          ? 'complete'
          : 'incomplete',
        icon: SearchCheck,
      },
      {
        id: 'recover',
        label: 'Recover',
        detail: recoveryReady
          ? 'Authority returns only after the failed boundary is repaired and a bounded canary passes.'
          : `Still required: ${missingRecovery.join(', ')}.`,
        state: scopeFits && recoveryReady ? 'complete' : 'blocked',
        icon: Activity,
      },
    ];

    return {
      continuingRuns,
      missingRecovery,
      overbroad,
      phases,
      recoveryReady,
      scopeFits,
      title,
      tone,
    };
  }, [incident, recovery, scope]);

  const ResultIcon = result.tone === 'emerald' ? CheckCircle2 : result.tone === 'amber' ? CircleAlert : Ban;

  function chooseIncident(next: IncidentScenario) {
    setIncidentId(next.id);
  }

  function reset() {
    setIncidentId(initialIncident.id);
    setScopeId(initialScope.id);
    setRecoveryId(initialRecovery.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime containment and recovery"
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
                  1. Observed incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => {
                    const Icon = incidentIcons[item.id] ?? ShieldAlert;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === incident.id}
                        label={item.label}
                        detail={item.brief}
                        icon={Icon}
                        accent="rose"
                        onClick={() => chooseIncident(item)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Immediate containment scope
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.containmentScopes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scope.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'run-only' ? Clock3 : item.id === 'principal' ? Fingerprint : LockKeyhole}
                      accent={item.id === 'run-only' ? 'amber' : item.id === 'principal' ? 'blue' : 'rose'}
                      onClick={() => setScopeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Recovery gate
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.recoveryPlans.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === recovery.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'immediate-restart' ? RotateCw : item.id === 'reconcile-and-rotate' ? SearchCheck : BadgeCheck}
                      accent={item.id === 'immediate-restart' ? 'rose' : item.id === 'reconcile-and-rotate' ? 'amber' : 'emerald'}
                      onClick={() => setRecoveryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className="min-w-0">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  <ShieldAlert aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Detection signal</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{incident.signal}</p>
                </div>
              </div>
            </section>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Continuing reach"
                value={result.continuingRuns === 0 ? 'Stopped' : `${result.continuingRuns} runs`}
                detail={result.scopeFits ? 'The selected scope covers the modeled active paths.' : 'Sibling or shared trajectories can still act.'}
                icon={Activity}
                tone={result.scopeFits ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Evidence"
                value={recovery.preservesEvidence ? 'Preserved' : 'Discarded'}
                detail={recovery.preservesEvidence ? 'Trajectory identity remains available for forensics.' : 'Attribution and regression evidence are lost.'}
                icon={FileClock}
                tone={recovery.preservesEvidence ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Recovery gate"
                value={result.recoveryReady ? 'Ready' : `${result.missingRecovery.length} gaps`}
                detail={result.recoveryReady ? 'All incident-specific prerequisites are present.' : result.missingRecovery[0]}
                icon={result.recoveryReady ? ShieldCheck : CircleAlert}
                tone={result.recoveryReady ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Availability cost"
                value={scope.availabilityCost}
                detail={result.overbroad ? 'Containment exceeds the incident boundary.' : 'Scope compared with the modeled blast radius.'}
                icon={Clock3}
                tone={result.overbroad ? 'amber' : 'neutral'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Response timeline
              </p>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                {result.phases.map((phase, index) => (
                  <ResponsePhase key={phase.id} phase={phase} number={index + 1} />
                ))}
              </ol>
            </section>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ResponseNotes
                title="Why this containment boundary?"
                icon={LockKeyhole}
                text={incident.containmentReason}
                items={scope.actions}
                tone={result.scopeFits ? 'blue' : 'rose'}
              />
              <ResponseNotes
                title="What must be true before resume?"
                icon={SearchCheck}
                text={incident.recoveryReason}
                items={result.missingRecovery.length ? result.missingRecovery : ['All modeled recovery prerequisites are satisfied.']}
                tone={result.recoveryReady ? 'emerald' : 'amber'}
              />
            </div>

            <section className={`mt-5 rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                <ResultIcon aria-hidden="true" className="h-4 w-4" />
                {result.title}
              </div>
              <p className="mt-3 text-sm leading-6">{incident.userConsequence}</p>
              <p className="mt-3 border-t border-current/20 pt-3 text-sm font-semibold leading-6">
                {result.scopeFits && result.recoveryReady
                  ? result.overbroad
                    ? 'This response is safe, but a narrower boundary would preserve more unrelated service availability.'
                    : 'Active authority is contained and recovery is gated on evidence, repair, reconciliation, and verification.'
                  : !result.scopeFits
                    ? 'Widen containment before investigation allows another exposed trajectory to create more effects.'
                    : 'Do not restore credentials or context until every incident-specific recovery gap is closed.'}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ResponsePhase({
  phase,
  number,
}: {
  phase: { label: string; detail: string; state: PhaseState; icon: LucideIcon };
  number: number;
}) {
  const Icon = phase.icon;
  const styles: Record<PhaseState, string> = {
    complete:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    incomplete:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    blocked:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  };
  const stateLabel = phase.state === 'complete' ? 'Ready' : phase.state === 'incomplete' ? 'Incomplete' : 'Blocked';

  return (
    <li className={`min-w-0 rounded-md border p-4 ${styles[phase.state]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        <span className="text-[11px] font-semibold uppercase opacity-70">{stateLabel}</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{phase.label}</p>
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{phase.detail}</p>
    </li>
  );
}

function ResponseNotes({
  title,
  icon: Icon,
  text,
  items,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  text: string;
  items: string[];
  tone: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20',
    emerald: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20',
    rose: 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20',
  };

  return (
    <section className={`rounded-md border p-4 ${styles[tone]}`}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {title}
      </h4>
      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{text}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-neutral-700 dark:text-neutral-300">
            {tone === 'emerald'
              ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="status" className="flex min-h-[620px] items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading incident containment drill...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Containment response lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
