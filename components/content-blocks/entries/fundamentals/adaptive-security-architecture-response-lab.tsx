'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  KeyRound,
  Laptop,
  LockKeyhole,
  Radar,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
  UserX,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Incident = {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  activePaths: string[];
  recommendedActionId: string;
  recoveryNeedsCredentialRotation: boolean;
  userConsequence: string;
};

type ContainmentAction = {
  id: string;
  label: string;
  detail: string;
  blocksPaths: string[];
  availabilityImpact: string;
  reversible: boolean;
  preservesEvidence: boolean;
};

type RecoveryPlan = {
  id: string;
  label: string;
  detail: string;
  preservesEvidence: boolean;
  rotatesCredentials: boolean;
  remediatesCause: boolean;
  verifiesCanary: boolean;
};

type ResponseModel = {
  title: string;
  description: string;
  defaults: { incidentId: string; actionId: string; recoveryId: string };
  pathLabels: Record<string, string>;
  incidents: Incident[];
  actions: ContainmentAction[];
  recoveryPlans: RecoveryPlan[];
};

const BLOCK_ID = 'fundamentals/adaptive-security-architecture-response-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/adaptive-security-architecture/data/containment-response-model.json';

function isResponseModel(value: unknown): value is ResponseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResponseModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults.actionId
      && candidate.defaults.recoveryId
      && candidate.pathLabels
      && typeof candidate.pathLabels === 'object'
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 3
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && typeof incident.evidence === 'string'
        && Array.isArray(incident.activePaths)
        && incident.activePaths.length > 0
        && typeof incident.recommendedActionId === 'string'
        && typeof incident.recoveryNeedsCredentialRotation === 'boolean'
        && typeof incident.userConsequence === 'string'
      ))
      && Array.isArray(candidate.actions)
      && candidate.actions.length >= 3
      && candidate.actions.every((action) => (
        typeof action.id === 'string'
        && typeof action.label === 'string'
        && typeof action.detail === 'string'
        && Array.isArray(action.blocksPaths)
        && typeof action.availabilityImpact === 'string'
        && typeof action.reversible === 'boolean'
        && typeof action.preservesEvidence === 'boolean'
      ))
      && Array.isArray(candidate.recoveryPlans)
      && candidate.recoveryPlans.length >= 2
      && candidate.recoveryPlans.every((plan) => (
        typeof plan.id === 'string'
        && typeof plan.label === 'string'
        && typeof plan.detail === 'string'
        && typeof plan.preservesEvidence === 'boolean'
        && typeof plan.rotatesCredentials === 'boolean'
        && typeof plan.remediatesCause === 'boolean'
        && typeof plan.verifiesCanary === 'boolean'
      )),
  );
}

export default function AdaptiveSecurityArchitectureResponseLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ResponseModel | null>(null);
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
        if (!isResponseModel(payload)) throw new Error('The containment model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load containment data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Containment and recovery drill"
            title="Stop every active attack path"
            description="Loading the lesson-owned incident and response model."
            icon={Siren}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ResponseLab model={model} />
      )}
    </div>
  );
}

function ResponseLab({ model }: { model: ResponseModel }) {
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [actionId, setActionId] = useState(model.defaults.actionId);
  const [recoveryId, setRecoveryId] = useState(model.defaults.recoveryId);
  const incident = model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];
  const action = model.actions.find((item) => item.id === actionId) ?? model.actions[0];
  const recovery = model.recoveryPlans.find((item) => item.id === recoveryId)
    ?? model.recoveryPlans[0];

  const result = useMemo(() => {
    const active = new Set(incident.activePaths);
    const blocked = new Set(action.blocksPaths);
    const uncovered = incident.activePaths.filter((path) => !blocked.has(path));
    const extra = action.blocksPaths.filter((path) => !active.has(path));
    const contained = uncovered.length === 0;
    const missingRecovery: string[] = [];
    if (!recovery.preservesEvidence || !action.preservesEvidence) {
      missingRecovery.push('preserve decision and enforcement evidence');
    }
    if (incident.recoveryNeedsCredentialRotation && !recovery.rotatesCredentials) {
      missingRecovery.push('rotate exposed credentials');
    }
    if (!recovery.remediatesCause) missingRecovery.push('repair the cause');
    if (!recovery.verifiesCanary) missingRecovery.push('verify a bounded canary');
    const recoveryReady = contained && missingRecovery.length === 0;
    const recommended = action.id === incident.recommendedActionId;

    let title = 'Containment and recovery are ready';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (!contained) {
      title = 'The selected response leaves an active path';
      tone = 'rose';
    } else if (!recoveryReady) {
      title = 'Contained, but recovery is not authorized';
      tone = 'amber';
    } else if (extra.length > 0) {
      title = 'Safe, but broader than the observed path';
      tone = 'amber';
    }

    return { contained, extra, missingRecovery, recommended, recoveryReady, title, tone, uncovered };
  }, [action, incident, recovery]);

  const statusClass = result.tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
    : result.tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
  const StatusIcon = result.tone === 'emerald' ? CheckCircle2 : result.tone === 'amber' ? CircleAlert : Ban;

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setActionId(model.defaults.actionId);
    setRecoveryId(model.defaults.recoveryId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Containment and recovery drill"
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
                1. Observed incident
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'identity-takeover' ? UserX : ShieldAlert}
                    accent="rose"
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Containment action
              </legend>
              <div className="mt-3 grid gap-2">
                {model.actions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === action.id}
                    label={item.label}
                    detail={item.detail}
                    icon={actionIcon(item.id)}
                    accent={item.id === 'observe-only' ? 'amber' : item.id === 'disable-identity' ? 'rose' : 'blue'}
                    onClick={() => setActionId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Recovery gate
              </legend>
              <div className="mt-3 grid gap-2">
                {model.recoveryPlans.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === recovery.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'remediate-and-canary' ? BadgeCheck : item.id === 'investigate-only' ? SearchCheck : RotateCcw}
                    accent={item.id === 'remediate-and-canary' ? 'emerald' : item.id === 'investigate-only' ? 'amber' : 'rose'}
                    onClick={() => setRecoveryId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${statusClass}`}>
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Response state</p>
                <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {result.contained
                    ? result.recoveryReady
                      ? 'Every observed path is blocked and every modeled recovery condition is satisfied.'
                      : `Every observed path is blocked. Still required: ${result.missingRecovery.join(', ')}.`
                    : `Still active: ${result.uncovered.map((path) => model.pathLabels[path] ?? path).join(', ')}.`}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-start gap-3">
              <Radar aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed evidence</p>
                <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{incident.evidence}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(model.pathLabels).map(([pathId, label]) => {
              const active = incident.activePaths.includes(pathId);
              const blocked = action.blocksPaths.includes(pathId);
              return <PathCard key={pathId} label={label} active={active} blocked={blocked} />;
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Active paths blocked"
              value={`${incident.activePaths.length - result.uncovered.length}/${incident.activePaths.length}`}
              detail={result.contained ? 'All observed paths contained' : 'Containment is incomplete'}
              icon={LockKeyhole}
              tone={result.contained ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Response scope"
              value={result.extra.length > 0 ? 'Broader' : result.recommended ? 'Proportional' : 'Selected'}
              detail={result.extra.length > 0 ? `${result.extra.length} unobserved path boundary also blocked` : 'Compared with observed evidence'}
              icon={ShieldCheck}
              tone={result.extra.length > 0 ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Availability impact"
              value={action.availabilityImpact}
              detail={action.reversible ? 'The control has a documented reversal path' : 'No reversal path modeled'}
              icon={Activity}
              tone="violet"
            />
            <LabMetric
              label="Recovery gate"
              value={result.recoveryReady ? 'Authorized' : 'Blocked'}
              detail={result.recoveryReady ? 'Bounded canary verified' : `${result.missingRecovery.length} condition(s) missing`}
              icon={result.recoveryReady ? BadgeCheck : KeyRound}
              tone={result.recoveryReady ? 'emerald' : 'amber'}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Response sequence</p>
            </header>
            <div className="grid md:grid-cols-3">
              <Phase
                number="1"
                title="Contain"
                detail={result.contained ? 'Every observed path is blocked.' : `${result.uncovered.length} path(s) remain active.`}
                complete={result.contained}
              />
              <Phase
                number="2"
                title="Remediate"
                detail={recovery.remediatesCause && recovery.rotatesCredentials ? 'Cause repaired and exposed authority replaced.' : 'Cause repair or credential rotation is incomplete.'}
                complete={recovery.remediatesCause && recovery.rotatesCredentials}
              />
              <Phase
                number="3"
                title="Recover"
                detail={result.recoveryReady ? 'Bounded verification passed; normal authority can return.' : 'Restore remains blocked by the recovery gate.'}
                complete={result.recoveryReady}
              />
            </div>
          </section>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">User consequence</p>
            <p className="mt-2 text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100">{incident.userConsequence}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function actionIcon(id: string) {
  if (id === 'observe-only') return Radar;
  if (id === 'revoke-session') return KeyRound;
  if (id === 'isolate-device') return Laptop;
  return Fingerprint;
}

function PathCard({ label, active, blocked }: { label: string; active: boolean; blocked: boolean }) {
  const effectiveBlock = active && blocked;
  const style = !active
    ? 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
    : effectiveBlock
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
  const Icon = !active ? Activity : effectiveBlock ? ShieldCheck : ShieldAlert;
  const status = !active ? 'Not observed' : effectiveBlock ? 'Blocked' : 'Still active';

  return (
    <div className={`rounded-md border p-4 ${style}`}>
      <Icon aria-hidden="true" className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs font-semibold uppercase opacity-70">{status}</p>
    </div>
  );
}

function Phase({ number, title, detail, complete }: { number: string; title: string; detail: string; complete: boolean }) {
  return (
    <div className="border-b border-neutral-200 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
          complete
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        }`}>
          {complete ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : number}
        </span>
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center" role="alert">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Containment model could not be loaded</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Siren aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-rose-500 motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading response model...</p>
        </div>
      )}
    </div>
  );
}
